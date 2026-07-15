import { beforeEach, describe, expect, it, vi } from "vitest";

const stateStore: Record<string, unknown> = {};
const historyStore = new Map<string, Record<string, unknown>>();

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminFirestore: () => ({
    doc: () => ({
      set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        if (opts?.merge) Object.assign(stateStore, data);
        else Object.keys(stateStore).forEach((k) => delete stateStore[k]);
        Object.assign(stateStore, data);
      }),
      get: vi.fn(async () => ({
        exists: Object.keys(stateStore).length > 0,
        data: () => ({ ...stateStore }),
      })),
    }),
    collection: () => ({
      doc: (id: string) => ({
        set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          const prev = historyStore.get(id) ?? {};
          historyStore.set(id, opts?.merge ? { ...prev, ...data } : data);
        }),
      }),
      orderBy: () => ({
        offset: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n: number) => ({ __increment: n }),
  },
}));

import { persistBarnetSyncRunOutcome } from "@/lib/integrations/order-provider/barnet-sync-run.server";

describe("persistBarnetSyncRunOutcome metadata", () => {
  beforeEach(() => {
    Object.keys(stateStore).forEach((k) => delete stateStore[k]);
    historyStore.clear();
  });

  it("updates lastScanAt when zero new orders are found", async () => {
    await persistBarnetSyncRunOutcome({
      runId: "scan-zero",
      source: "cron",
      status: "success",
      startedAt: "2026-07-14T18:00:00.000Z",
      completedAt: "2026-07-14T18:01:00.000Z",
      durationMs: 1000,
      counts: { inserted: 0, pagesScanned: 2 },
      newOrdersImported: 0,
      providerConfigured: true,
      providerReadEnabled: true,
      previousSuccessfulSyncAt: "2026-07-14T17:00:00.000Z",
    });

    expect(stateStore.lastScanAt).toBe("2026-07-14T18:01:00.000Z");
    expect(stateStore.lastSuccessfulSyncAt).toBe("2026-07-14T18:01:00.000Z");
    expect(stateStore.lastResult).toBe("no_new_orders");
  });

  it("preserves lastSuccessfulSyncAt when a later scan fails", async () => {
    stateStore.lastSuccessfulSyncAt = "2026-07-14T17:00:00.000Z";

    await persistBarnetSyncRunOutcome({
      runId: "scan-fail",
      source: "cron",
      status: "failed",
      startedAt: "2026-07-14T18:00:00.000Z",
      completedAt: "2026-07-14T18:01:00.000Z",
      durationMs: 1000,
      errorCode: "upstream_error",
      safeErrorMessage: "Barnet upstream failed",
      providerConfigured: true,
      providerReadEnabled: true,
      previousSuccessfulSyncAt: "2026-07-14T17:00:00.000Z",
    });

    expect(stateStore.lastScanAt).toBe("2026-07-14T18:01:00.000Z");
    expect(stateStore.lastSuccessfulSyncAt).toBe("2026-07-14T17:00:00.000Z");
    expect(stateStore.lastResult).toBe("failed");
  });

  it("records quiet-hours skip without implying a successful scan", async () => {
    await persistBarnetSyncRunOutcome({
      runId: "quiet",
      source: "cron",
      status: "skipped_outside_hours",
      startedAt: "2026-07-14T08:00:00.000Z",
      completedAt: "2026-07-14T08:00:01.000Z",
      durationMs: 1,
      outsideOperatingHours: true,
      providerConfigured: true,
      providerReadEnabled: true,
      previousSuccessfulSyncAt: "2026-07-13T20:00:00.000Z",
    });

    expect(stateStore.lastResult).toBe("skipped_quiet_hours");
    expect(stateStore.lastAttemptResult).toBe("skipped_quiet_hours");
    expect(stateStore.lastAttemptAt).toBe("2026-07-14T08:00:01.000Z");
    expect(stateStore.lastScanAt).toBeUndefined();
    expect(stateStore.lastSuccessfulSyncAt).toBeUndefined();
  });

  it("updates lastAttemptAt for skipped lock without updating lastScanAt", async () => {
    stateStore.lastScanAt = "2026-07-14T17:00:00.000Z";
    stateStore.lastSuccessfulSyncAt = "2026-07-14T17:00:00.000Z";

    await persistBarnetSyncRunOutcome({
      runId: "skip-lock",
      source: "cron",
      status: "skipped_locked",
      startedAt: "2026-07-14T18:00:00.000Z",
      completedAt: "2026-07-14T18:00:01.000Z",
      durationMs: 1,
      providerConfigured: true,
      providerReadEnabled: true,
      previousSuccessfulSyncAt: "2026-07-14T17:00:00.000Z",
    });

    expect(stateStore.lastAttemptAt).toBe("2026-07-14T18:00:01.000Z");
    expect(stateStore.lastAttemptResult).toBe("skipped_lock_active");
    expect(stateStore.lastScanAt).toBe("2026-07-14T17:00:00.000Z");
    expect(stateStore.lastSuccessfulSyncAt).toBe("2026-07-14T17:00:00.000Z");
  });

  it("does not update lastScanAt when a mid-scan failure marks scanCompleted false", async () => {
    stateStore.lastScanAt = "2026-07-14T17:00:00.000Z";
    stateStore.lastSuccessfulSyncAt = "2026-07-14T17:00:00.000Z";

    await persistBarnetSyncRunOutcome({
      runId: "mid-fail",
      source: "cron",
      status: "failed",
      startedAt: "2026-07-14T18:00:00.000Z",
      completedAt: "2026-07-14T18:01:00.000Z",
      durationMs: 1000,
      providerConfigured: true,
      providerReadEnabled: true,
      previousSuccessfulSyncAt: "2026-07-14T17:00:00.000Z",
      scanCompleted: false,
    });

    expect(stateStore.lastScanAt).toBe("2026-07-14T17:00:00.000Z");
    expect(stateStore.lastSuccessfulSyncAt).toBe("2026-07-14T17:00:00.000Z");
    expect(stateStore.lastAttemptResult).toBe("failed");
  });
});
