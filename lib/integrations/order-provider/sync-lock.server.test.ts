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

describe("barnet sync lock", () => {
  beforeEach(() => {
    firestoreState = createFirestoreMock();
    vi.clearAllMocks();
  });

  it("acquires the lock when no active run exists", async () => {
    const result = await acquireBarnetSyncLock("run-a");
    expect(result).toBe("acquired");
    expect(firestoreState.data()).toMatchObject({
      lockRunId: "run-a",
      lockStartedAt: expect.any(String),
      lockExpiresAt: expect.any(String),
    });
  });

  it("skips when an unexpired lock is held", async () => {
    await acquireBarnetSyncLock("run-a");
    const result = await acquireBarnetSyncLock("run-b");
    expect(result).toBe("skipped");
    expect(firestoreState.data().lockRunId).toBe("run-a");
  });

  it("recovers stale locks after expiry", async () => {
    firestoreState = createFirestoreMock({
        lockRunId: "stale-run",
        lockStartedAt: new Date(Date.now() - 120_000).toISOString(),
        lockExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      });

    const result = await acquireBarnetSyncLock("fresh-run");
    expect(result).toBe("acquired");
    expect(firestoreState.data().lockRunId).toBe("fresh-run");
  });

  it("releases only the owning run id", async () => {
    await acquireBarnetSyncLock("run-a");
    await releaseBarnetSyncLock("run-a");
    expect(firestoreState.data().lockRunId).toBeNull();

    await acquireBarnetSyncLock("run-b");
    await releaseBarnetSyncLock("other-run");
    expect(firestoreState.data().lockRunId).toBe("run-b");
  });
});
