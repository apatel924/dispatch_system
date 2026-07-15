import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { getBarnetSyncLockTtlMs } from "@/lib/integrations/order-provider/barnet-sync-config.server";
import type { BarnetSyncSource } from "@/lib/integrations/order-provider/barnet-sync-health.server";

export const BARNET_SYNC_STATE_DOC = "integrationState/orderProvider";
export const BARNET_SYNC_RUNS_COLLECTION = "barnetSyncRuns";

export type BarnetSyncLockAcquireStatus = "acquired" | "reclaimed" | "skipped";

export interface BarnetSyncLockAcquireResult {
  status: BarnetSyncLockAcquireStatus;
  expiresAt: string | null;
  previousOwnerExecutionId: string | null;
  previousLockAcquiredAt: string | null;
  previousLockExpiresAt: string | null;
}

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

function parseLockAcquiredAt(data: Record<string, unknown>): string | null {
  if (typeof data.acquiredAt === "string" && data.acquiredAt.length > 0) {
    return data.acquiredAt;
  }
  if (typeof data.lockStartedAt === "string" && data.lockStartedAt.length > 0) {
    return data.lockStartedAt;
  }
  return null;
}

function parseLockExpiryIso(data: Record<string, unknown>): string | null {
  if (typeof data.expiresAt === "string" && data.expiresAt.length > 0) {
    return data.expiresAt;
  }
  if (typeof data.lockExpiresAt === "string" && data.lockExpiresAt.length > 0) {
    return data.lockExpiresAt;
  }
  return null;
}

function lockOwnerId(data: Record<string, unknown>): string | null {
  if (typeof data.ownerExecutionId === "string" && data.ownerExecutionId.length > 0) {
    return data.ownerExecutionId;
  }
  if (typeof data.lockRunId === "string" && data.lockRunId.length > 0) {
    return data.lockRunId;
  }
  return null;
}

/**
 * Acquires a Firestore transaction-based sync lock shared by cron and manual sync.
 * Stale locks (expired expiresAt / lockExpiresAt) can be reclaimed.
 * Never treats a bare syncRunning boolean as proof that a sync is alive.
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
  const expiresAtMs = now + getBarnetSyncLockTtlMs();
  const acquiredAt = new Date(now).toISOString();
  const expiresAt = new Date(expiresAtMs).toISOString();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const activeRunId = lockOwnerId(data);
    const lockExpiresAt = Math.max(
      parseLockExpiry(data.expiresAt),
      parseLockExpiry(data.lockExpiresAt),
    );

    if (activeRunId && lockExpiresAt > now) {
      return {
        status: "skipped" as const,
        expiresAt: new Date(lockExpiresAt).toISOString(),
        previousOwnerExecutionId: activeRunId,
        previousLockAcquiredAt: parseLockAcquiredAt(data),
        previousLockExpiresAt: parseLockExpiryIso(data),
      };
    }

    const reclaimed = Boolean(activeRunId && lockExpiresAt > 0 && lockExpiresAt <= now);
    const previousOwnerExecutionId = reclaimed ? activeRunId : null;
    const previousLockAcquiredAt = reclaimed ? parseLockAcquiredAt(data) : null;
    const previousLockExpiresAt = reclaimed ? parseLockExpiryIso(data) : null;

    tx.set(
      ref,
      {
        // Canonical lease fields
        ownerExecutionId: options.runId,
        acquiredAt,
        expiresAt,
        trigger: options.source,
        lastHeartbeatAt: acquiredAt,
        // Compatibility aliases used by existing health/UI readers
        lockRunId: options.runId,
        lockSource: options.source,
        lockActorId: options.actorId ?? null,
        lockStartedAt: acquiredAt,
        lockExpiresAt: expiresAt,
        ...(reclaimed
          ? {
              lastAbandonedRunId: previousOwnerExecutionId,
              lastAbandonedAt: acquiredAt,
              lastAbandonedResult: "timed_out_or_expired",
            }
          : {}),
      },
      { merge: true },
    );

    return {
      status: reclaimed ? ("reclaimed" as const) : ("acquired" as const),
      expiresAt,
      previousOwnerExecutionId,
      previousLockAcquiredAt,
      previousLockExpiresAt,
    };
  });
}

/**
 * Extends the lease while the current execution still owns the lock.
 * Updates lastHeartbeatAt and expiresAt only for the matching owner.
 */
export async function extendBarnetSyncLock(runId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const ref = db.doc(BARNET_SYNC_STATE_DOC);
  const now = Date.now();
  const expiresAt = new Date(now + getBarnetSyncLockTtlMs()).toISOString();
  const heartbeatAt = new Date(now).toISOString();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data || lockOwnerId(data) !== runId) {
      return false;
    }

    tx.set(
      ref,
      {
        lastHeartbeatAt: heartbeatAt,
        expiresAt,
        lockExpiresAt: expiresAt,
      },
      { merge: true },
    );
    return true;
  });
}

/** Releases the lock when the current run still owns it. */
export async function releaseBarnetSyncLock(runId: string): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.doc(BARNET_SYNC_STATE_DOC);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as Record<string, unknown> | undefined;
    if (lockOwnerId(data ?? {}) === runId) {
      tx.set(
        ref,
        {
          ownerExecutionId: null,
          acquiredAt: null,
          expiresAt: null,
          lastHeartbeatAt: null,
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
