import { beforeEach, describe, expect, it, vi } from "vitest";

type DocData = Record<string, unknown>;

function createFirestoreMock(initialData: DocData = {}) {
  let data = { ...initialData };

  const tx = {
    get: vi.fn(async () => ({
      exists: Object.keys(data).length > 0,
      data: () => ({ ...data }),
    })),
    set: vi.fn((_ref: unknown, patch: DocData, options?: { merge?: boolean }) => {
      data = options?.merge ? { ...data, ...patch } : { ...patch };
    }),
  };

  const runTransaction = vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
    return callback(tx);
  });

  const doc = vi.fn(() => ({
    get: vi.fn(async () => ({
      exists: Object.keys(data).length > 0,
      data: () => ({ ...data }),
    })),
    set: vi.fn(async (patch: DocData, options?: { merge?: boolean }) => {
      data = options?.merge ? { ...data, ...patch } : { ...patch };
    }),
  }));

  return {
    data: () => data,
    runTransaction,
    doc,
    tx,
  };
}

let firestoreState = createFirestoreMock();

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminFirestore: () => firestoreState,
}));

vi.mock("@/lib/integrations/order-provider/barnet-sync-config.server", () => ({
  getBarnetSyncLockTtlMs: () => 60_000,
}));

import {
  acquireBarnetSyncLock,
  releaseBarnetSyncLock,
} from "@/lib/integrations/order-provider/sync-lock.server";

describe("barnet sync lock (shared cron/manual)", () => {
  beforeEach(() => {
    firestoreState = createFirestoreMock();
    vi.clearAllMocks();
  });

  it("cron obtains lock with source metadata", async () => {
    const result = await acquireBarnetSyncLock({
      runId: "cron-1",
      source: "cron",
    });
    expect(result).toBe("acquired");
    expect(firestoreState.data()).toMatchObject({
      lockRunId: "cron-1",
      lockSource: "cron",
    });
  });

  it("manual obtains lock with actor id", async () => {
    const result = await acquireBarnetSyncLock({
      runId: "manual-1",
      source: "manual",
      actorId: "admin-1",
    });
    expect(result).toBe("acquired");
    expect(firestoreState.data()).toMatchObject({
      lockRunId: "manual-1",
      lockSource: "manual",
      lockActorId: "admin-1",
    });
  });

  it("cron blocks manual while lock is held", async () => {
    await acquireBarnetSyncLock({ runId: "cron-1", source: "cron" });
    const result = await acquireBarnetSyncLock({
      runId: "manual-1",
      source: "manual",
    });
    expect(result).toBe("skipped");
    expect(firestoreState.data().lockRunId).toBe("cron-1");
  });

  it("manual blocks cron while lock is held", async () => {
    await acquireBarnetSyncLock({ runId: "manual-1", source: "manual" });
    const result = await acquireBarnetSyncLock({
      runId: "cron-1",
      source: "cron",
    });
    expect(result).toBe("skipped");
  });

  it("recovers stale locks after expiry", async () => {
    firestoreState = createFirestoreMock({
      lockRunId: "stale-run",
      lockSource: "cron",
      lockStartedAt: new Date(Date.now() - 120_000).toISOString(),
      lockExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const result = await acquireBarnetSyncLock({
      runId: "fresh-run",
      source: "manual",
    });
    expect(result).toBe("acquired");
    expect(firestoreState.data().lockRunId).toBe("fresh-run");
  });

  it("incorrect run cannot release another run's lock", async () => {
    await acquireBarnetSyncLock({ runId: "run-a", source: "cron" });
    await releaseBarnetSyncLock("other-run");
    expect(firestoreState.data().lockRunId).toBe("run-a");
    await releaseBarnetSyncLock("run-a");
    expect(firestoreState.data().lockRunId).toBeNull();
  });

  it("concurrent acquisition allows one winner", async () => {
    let shared: DocData = {};
    const mkTx = () => ({
      get: vi.fn(async () => ({
        exists: Object.keys(shared).length > 0,
        data: () => ({ ...shared }),
      })),
      set: vi.fn((_ref: unknown, patch: DocData, options?: { merge?: boolean }) => {
        shared = options?.merge ? { ...shared, ...patch } : { ...patch };
      }),
    });

    // Sequential transaction callbacks emulate contested acquire after first write.
    firestoreState = {
      data: () => shared,
      runTransaction: vi.fn(async (callback) => callback(mkTx())),
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({
          exists: Object.keys(shared).length > 0,
          data: () => ({ ...shared }),
        })),
        set: vi.fn(async (patch: DocData, options?: { merge?: boolean }) => {
          shared = options?.merge ? { ...shared, ...patch } : { ...patch };
        }),
      })),
      tx: mkTx(),
    } as unknown as ReturnType<typeof createFirestoreMock>;

    const first = await acquireBarnetSyncLock({ runId: "winner", source: "cron" });
    const second = await acquireBarnetSyncLock({ runId: "loser", source: "manual" });
    expect(first).toBe("acquired");
    expect(second).toBe("skipped");
    expect(shared.lockRunId).toBe("winner");
  });
});
