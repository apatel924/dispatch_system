import { beforeEach, describe, expect, it, vi } from "vitest";
import { BarnetSyncFailureError } from "@/lib/integrations/order-provider/barnet-sync-errors.server";
import { edmontonWallTimeToUtc } from "@/lib/integrations/order-provider/barnet-operating-hours.server";

const {
  acquireBarnetSyncLock,
  releaseBarnetSyncLock,
  extendBarnetSyncLock,
  runBarnetOrderSync,
  getExternalOrderProviderConfig,
  markBarnetSyncRunStarted,
  persistBarnetSyncRunOutcome,
  readBarnetSyncStateDoc,
} = vi.hoisted(() => ({
  acquireBarnetSyncLock: vi.fn(),
  releaseBarnetSyncLock: vi.fn(),
  extendBarnetSyncLock: vi.fn(),
  runBarnetOrderSync: vi.fn(),
  getExternalOrderProviderConfig: vi.fn(),
  markBarnetSyncRunStarted: vi.fn(),
  persistBarnetSyncRunOutcome: vi.fn(),
  readBarnetSyncStateDoc: vi.fn(),
}));

vi.mock("@/lib/integrations/order-provider/sync-lock.server", () => ({
  acquireBarnetSyncLock,
  releaseBarnetSyncLock,
  extendBarnetSyncLock,
}));

vi.mock("@/lib/integrations/order-provider/run-barnet-order-sync.server", () => ({
  runBarnetOrderSync,
}));

vi.mock("@/lib/integrations/order-provider/env.server", () => ({
  getExternalOrderProviderConfig,
}));

vi.mock("@/lib/integrations/order-provider/barnet-sync-run.server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/integrations/order-provider/barnet-sync-run.server")
  >();
  return {
    ...actual,
    markBarnetSyncRunStarted,
    persistBarnetSyncRunOutcome,
    readBarnetSyncStateDoc,
  };
});

import { executeBarnetSync } from "@/lib/integrations/order-provider/execute-barnet-sync.server";

describe("executeBarnetSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getExternalOrderProviderConfig.mockReturnValue({
      mode: "live",
      configured: true,
      liveSyncEnabled: true,
      liveReadsEnabled: true,
    });
    acquireBarnetSyncLock.mockResolvedValue({
      status: "acquired",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      previousOwnerExecutionId: null,
      previousLockAcquiredAt: null,
      previousLockExpiresAt: null,
    });
    releaseBarnetSyncLock.mockResolvedValue(undefined);
    extendBarnetSyncLock.mockResolvedValue(true);
    markBarnetSyncRunStarted.mockResolvedValue(undefined);
    persistBarnetSyncRunOutcome.mockResolvedValue(undefined);
    readBarnetSyncStateDoc.mockResolvedValue({
      lastSuccessfulSyncAt: "2026-07-14T12:00:00.000Z",
    });
    runBarnetOrderSync.mockResolvedValue({
      pagesScanned: 1,
      ordersSeen: 10,
      deliveryCandidates: 2,
      newDeliveries: 1,
      updatedDeliveries: 1,
      unchangedOrders: 8,
      needsReview: 0,
      readyToDispatch: 2,
      pickupOrdersIgnored: 7,
      unknownOrdersIgnored: 1,
      invalidOrders: 0,
      enrichmentErrors: 0,
      syncErrors: 0,
      dispatchOrdersCreated: 1,
      adminNotificationsCreated: 1,
      exclusionReasons: { pickup: 7, unknown_fulfillment: 1 },
      failedPages: [],
      pageFetchErrors: 0,
    });
  });

  it("skips quiet hours without acquiring lock or calling Barnet", async () => {
    const quiet = edmontonWallTimeToUtc(2026, 7, 14, 3, 0, 0);
    const result = await executeBarnetSync({
      runId: "run-quiet",
      source: "cron",
      now: quiet,
    });

    expect(result).toMatchObject({
      ok: true,
      skipped: true,
      reason: "outside_operating_hours",
      status: "skipped_outside_hours",
    });
    expect(acquireBarnetSyncLock).not.toHaveBeenCalled();
    expect(runBarnetOrderSync).not.toHaveBeenCalled();
    expect(persistBarnetSyncRunOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "skipped_outside_hours",
        outsideOperatingHours: true,
      }),
    );
  });

  it("manual quiet-hours skip does not look like provider failure", async () => {
    const quiet = edmontonWallTimeToUtc(2026, 7, 14, 1, 0, 0);
    const result = await executeBarnetSync({
      runId: "manual-quiet",
      source: "manual",
      now: quiet,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.skipped) {
      expect(result.reason).toBe("outside_operating_hours");
    }
    expect(runBarnetOrderSync).not.toHaveBeenCalled();
  });

  it("honors explicit manual quiet-hours override", async () => {
    const quiet = edmontonWallTimeToUtc(2026, 7, 14, 1, 0, 0);
    const result = await executeBarnetSync({
      runId: "override",
      source: "manual",
      overrideQuietHours: true,
      now: quiet,
    });
    expect(result.ok).toBe(true);
    if (result.ok && !("skipped" in result && result.skipped)) {
      expect(result.status).toBe("success");
    }
    expect(acquireBarnetSyncLock).toHaveBeenCalled();
    expect(runBarnetOrderSync).toHaveBeenCalled();
  });

  it("locked skip does not call Barnet and is not a provider failure", async () => {
    acquireBarnetSyncLock.mockResolvedValue({
      status: "skipped",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      previousOwnerExecutionId: "other",
      previousLockAcquiredAt: new Date(Date.now() - 30_000).toISOString(),
      previousLockExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const open = edmontonWallTimeToUtc(2026, 7, 14, 12, 0, 0);
    const result = await executeBarnetSync({
      runId: "locked",
      source: "manual",
      now: open,
    });
    expect(result).toMatchObject({
      ok: true,
      skipped: true,
      reason: "sync_already_running",
      status: "skipped_locked",
    });
    expect(runBarnetOrderSync).not.toHaveBeenCalled();
    expect(releaseBarnetSyncLock).not.toHaveBeenCalled();
  });

  it("reclaims an expired lock and marks the abandoned run timed out", async () => {
    acquireBarnetSyncLock.mockResolvedValue({
      status: "reclaimed",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      previousOwnerExecutionId: "abandoned-run",
      previousLockAcquiredAt: "2026-07-14T11:00:00.000Z",
      previousLockExpiresAt: "2026-07-14T11:09:00.000Z",
    });
    readBarnetSyncStateDoc.mockResolvedValue({
      lastSuccessfulSyncAt: "2026-07-14T12:00:00.000Z",
      lastStartedAt: "2026-07-14T11:00:00.000Z",
      lastRunStatus: "running",
    });
    const open = edmontonWallTimeToUtc(2026, 7, 14, 12, 0, 0);
    await executeBarnetSync({
      runId: "fresh-run",
      source: "cron",
      now: open,
    });
    expect(persistBarnetSyncRunOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "abandoned-run",
        status: "timed_out_or_expired",
        scanCompleted: false,
      }),
    );
    expect(runBarnetOrderSync).toHaveBeenCalled();
  });

  it("updates attempt+success timestamps on success via persist helper", async () => {
    const open = edmontonWallTimeToUtc(2026, 7, 14, 12, 0, 0);
    await executeBarnetSync({
      runId: "ok-run",
      source: "cron",
      now: open,
    });
    expect(persistBarnetSyncRunOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        previousSuccessfulSyncAt: "2026-07-14T12:00:00.000Z",
        newOrdersImported: 1,
        counts: expect.objectContaining({
          inserted: 1,
          updated: 1,
        }),
      }),
    );
    expect(runBarnetOrderSync).toHaveBeenCalledWith({
      trigger: "cron",
      actor: null,
      onPageBatchComplete: expect.any(Function),
    });
    expect(releaseBarnetSyncLock).toHaveBeenCalledWith("ok-run");
  });

  it("marks partial when enrichment errors occur", async () => {
    runBarnetOrderSync.mockResolvedValue({
      pagesScanned: 1,
      ordersSeen: 2,
      deliveryCandidates: 2,
      newDeliveries: 1,
      updatedDeliveries: 0,
      unchangedOrders: 0,
      needsReview: 0,
      readyToDispatch: 1,
      pickupOrdersIgnored: 0,
      unknownOrdersIgnored: 0,
      invalidOrders: 0,
      enrichmentErrors: 1,
      syncErrors: 1,
      dispatchOrdersCreated: 1,
      adminNotificationsCreated: 1,
      exclusionReasons: {},
    });
    const open = edmontonWallTimeToUtc(2026, 7, 14, 12, 0, 0);
    const result = await executeBarnetSync({
      runId: "partial",
      source: "cron",
      now: open,
    });
    expect(result.ok).toBe(true);
    if (result.ok && !result.skipped) {
      expect(result.status).toBe("partial");
    }
  });

  it("failed run persists failed status and still releases lock", async () => {
    runBarnetOrderSync.mockRejectedValue(new Error("boom"));
    const open = edmontonWallTimeToUtc(2026, 7, 14, 12, 0, 0);
    const result = await executeBarnetSync({
      runId: "fail",
      source: "cron",
      now: open,
    });
    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      error: "unknown_sync_error",
      transientProviderFailure: false,
    });
    expect(persistBarnetSyncRunOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        previousSuccessfulSyncAt: "2026-07-14T12:00:00.000Z",
        scanCompleted: false,
      }),
    );
    expect(releaseBarnetSyncLock).toHaveBeenCalledWith("fail");
  });

  it("maps provider timeout as a transient provider failure", async () => {
    runBarnetOrderSync.mockRejectedValue(
      new BarnetSyncFailureError("provider_timeout", "Barnet page fetch failed for page(s): 1"),
    );
    const open = edmontonWallTimeToUtc(2026, 7, 14, 12, 0, 0);
    const result = await executeBarnetSync({
      runId: "timeout",
      source: "cron",
      now: open,
    });
    expect(result).toMatchObject({
      ok: false,
      error: "provider_timeout",
      status: "failed",
      transientProviderFailure: true,
    });
    expect(persistBarnetSyncRunOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "provider_timeout",
        scanCompleted: false,
      }),
    );
    expect(releaseBarnetSyncLock).toHaveBeenCalledWith("timeout");
  });
});
