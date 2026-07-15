import { beforeEach, describe, expect, it, vi } from "vitest";

type DocData = Record<string, unknown>;

function createFirestoreMock(initialData: DocData = {}) {
  let data = { ...initialData };
  const history = new Map<string, DocData>();

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
    history,
    runTransaction,
    doc,
    collection: vi.fn(() => ({
      doc: vi.fn((id: string) => ({
        set: vi.fn(async (patch: DocData, options?: { merge?: boolean }) => {
          const prev = history.get(id) ?? {};
          history.set(id, options?.merge ? { ...prev, ...patch } : patch);
        }),
      })),
    })),
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
  extendBarnetSyncLock,
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
    expect(result.status).toBe("acquired");
    expect(firestoreState.data()).toMatchObject({
      ownerExecutionId: "cron-1",
      lockRunId: "cron-1",
      lockSource: "cron",
      trigger: "cron",
    });
    expect(typeof firestoreState.data().expiresAt).toBe("string");
  });

  it("manual obtains lock with actor id", async () => {
    const result = await acquireBarnetSyncLock({
      runId: "manual-1",
      source: "manual",
      actorId: "admin-1",
    });
    expect(result.status).toBe("acquired");
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
    expect(result.status).toBe("skipped");
    expect(firestoreState.data().lockRunId).toBe("cron-1");
  });

  it("manual blocks cron while lock is held", async () => {
    await acquireBarnetSyncLock({ runId: "manual-1", source: "manual" });
    const result = await acquireBarnetSyncLock({
      runId: "cron-1",
      source: "cron",
    });
    expect(result.status).toBe("skipped");
  });

  it("recovers stale locks after expiry and marks reclaimed", async () => {
    firestoreState = createFirestoreMock({
      lockRunId: "stale-run",
      ownerExecutionId: "stale-run",
      lockSource: "cron",
      lockStartedAt: new Date(Date.now() - 120_000).toISOString(),
      lockExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const result = await acquireBarnetSyncLock({
      runId: "fresh-run",
      source: "manual",
    });
    expect(result.status).toBe("reclaimed");
    expect(result.previousOwnerExecutionId).toBe("stale-run");
    expect(firestoreState.data().lockRunId).toBe("fresh-run");
    expect(firestoreState.data().lastAbandonedResult).toBe("timed_out_or_expired");
  });

  it("incorrect run cannot release another run's lock", async () => {
    await acquireBarnetSyncLock({ runId: "run-a", source: "cron" });
    await releaseBarnetSyncLock("other-run");
    expect(firestoreState.data().lockRunId).toBe("run-a");
    await releaseBarnetSyncLock("run-a");
    expect(firestoreState.data().lockRunId).toBeNull();
  });

  it("heartbeat extends only for the owning execution", async () => {
    await acquireBarnetSyncLock({ runId: "run-a", source: "cron" });
    const before = String(firestoreState.data().expiresAt);
    expect(await extendBarnetSyncLock("other")).toBe(false);
    expect(firestoreState.data().expiresAt).toBe(before);
    expect(await extendBarnetSyncLock("run-a")).toBe(true);
    expect(String(firestoreState.data().expiresAt) >= before).toBe(true);
    expect(firestoreState.data().lastHeartbeatAt).toBeTruthy();
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

    firestoreState = {
      data: () => shared,
      history: new Map(),
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
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          set: vi.fn(async () => undefined),
        })),
      })),
      tx: mkTx(),
    } as unknown as ReturnType<typeof createFirestoreMock>;

    const first = await acquireBarnetSyncLock({ runId: "winner", source: "cron" });
    const second = await acquireBarnetSyncLock({ runId: "loser", source: "manual" });
    expect(first.status).toBe("acquired");
    expect(second.status).toBe("skipped");
    expect(shared.lockRunId).toBe("winner");
  });
});
