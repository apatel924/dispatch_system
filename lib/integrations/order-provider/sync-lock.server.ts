import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { getBarnetSyncLockTtlMs } from "@/lib/integrations/order-provider/barnet-sync-config.server";
import type { BarnetSyncSource } from "@/lib/integrations/order-provider/barnet-sync-health.server";

export const BARNET_SYNC_STATE_DOC = "integrationState/orderProvider";
export const BARNET_SYNC_RUNS_COLLECTION = "barnetSyncRuns";

export type BarnetSyncLockAcquireResult = "acquired" | "skipped";

export interface AcquireBarnetSyncLockOptions {
  runId: string;
  source: BarnetSyncSource;
  actorId?: string | null;
  nowMs?: number;
}

function parseLockExpiry(value: unknown): number {
  if (typeof value !== "string" || value.length === 0) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Acquires a Firestore transaction-based sync lock shared by cron and manual sync.
 * Stale locks (expired lockExpiresAt) can be taken over.
 */
export async function acquireBarnetSyncLock(
  runIdOrOptions: string | AcquireBarnetSyncLockOptions,
  legacySource?: BarnetSyncSource,
): Promise<BarnetSyncLockAcquireResult> {
  const options: AcquireBarnetSyncLockOptions =
    typeof runIdOrOptions === "string"
      ? {
          runId: runIdOrOptions,
          source: legacySource ?? "cron",
        }
      : runIdOrOptions;

  const db = getAdminFirestore();
  const ref = db.doc(BARNET_SYNC_STATE_DOC);
  const now = options.nowMs ?? Date.now();
  const expiresAt = now + getBarnetSyncLockTtlMs();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const activeRunId =
      typeof data.lockRunId === "string" && data.lockRunId.length > 0
        ? data.lockRunId
        : null;
    const lockExpiresAt = parseLockExpiry(data.lockExpiresAt);

    if (activeRunId && lockExpiresAt > now) {
      return "skipped";
    }

    tx.set(
      ref,
      {
        lockRunId: options.runId,
        lockSource: options.source,
        lockActorId: options.actorId ?? null,
        lockStartedAt: new Date(now).toISOString(),
        lockExpiresAt: new Date(expiresAt).toISOString(),
      },
      { merge: true },
    );

    return "acquired";
  });
}

/** Releases the lock when the current run still owns it. */
export async function releaseBarnetSyncLock(runId: string): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.doc(BARNET_SYNC_STATE_DOC);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (data?.lockRunId === runId) {
      tx.set(
        ref,
        {
          lockRunId: null,
          lockSource: null,
          lockActorId: null,
          lockStartedAt: null,
          lockExpiresAt: null,
        },
        { merge: true },
      );
    }
  });
}
