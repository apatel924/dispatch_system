import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { omitUndefined } from "@/lib/server/firestore/helpers";
import {
  BARNET_SYNC_RUNS_COLLECTION,
  BARNET_SYNC_STATE_DOC,
} from "@/lib/integrations/order-provider/sync-lock.server";
import {
  BARNET_SYNC_RUN_HISTORY_LIMIT,
  type BarnetSyncAttemptResult,
  type BarnetSyncRunCounts,
  type BarnetSyncRunStatus,
  type BarnetSyncSource,
} from "@/lib/integrations/order-provider/barnet-sync-health.server";

/**
 * Identical consecutive skip/disabled outcomes update the current summary only —
 * they do not append another history document (prevents overnight quiet-hours
 * from ejecting daytime success/failure history under the 25-entry cap).
 */
export function shouldRecordBarnetSyncHistoryDoc(input: {
  status: BarnetSyncRunStatus;
  priorLastRunStatus?: string | null;
}): boolean {
  const collapsible: ReadonlySet<string> = new Set([
    "skipped_outside_hours",
    "skipped_locked",
    "disabled",
    "not_configured",
    "timed_out_or_expired",
  ]);
  if (
    collapsible.has(input.status) &&
    input.priorLastRunStatus === input.status
  ) {
    return false;
  }
  return true;
}

export function toBarnetSyncAttemptResult(
  status: BarnetSyncRunStatus,
): BarnetSyncAttemptResult {
  switch (status) {
    case "running":
      return "running";
    case "success":
    case "partial":
      return "completed";
    case "failed":
      return "failed";
    case "timed_out_or_expired":
      return "timed_out_or_expired";
    case "skipped_locked":
      return "skipped_lock_active";
    case "skipped_outside_hours":
      return "skipped_quiet_hours";
    case "disabled":
      return "skipped_disabled";
    case "not_configured":
      return "skipped_not_configured";
    default:
      return "failed";
  }
}

export interface BarnetSyncRunRecord {
  runId: string;
  source: BarnetSyncSource;
  status: BarnetSyncRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  lastAttemptedSyncAt: string;
  lastSuccessfulSyncAt: string | null;
  pagesScanned: number;
  ordersExamined: number;
  deliveryOrdersFound: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  invalid: number;
  enrichmentErrors: number;
  syncErrors: number;
  errorCode: string | null;
  safeErrorMessage: string | null;
  lockRunId: string | null;
  outsideOperatingHours: boolean;
  providerConfigured: boolean;
  providerReadEnabled: boolean;
  actorId?: string | null;
}

function emptyCounts(): BarnetSyncRunCounts {
  return {
    pagesScanned: 0,
    ordersExamined: 0,
    deliveryOrdersFound: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    invalid: 0,
    enrichmentErrors: 0,
    syncErrors: 0,
    needsReview: 0,
    readyToDispatch: 0,
  };
}

export async function markBarnetSyncRunStarted(input: {
  runId: string;
  source: BarnetSyncSource;
  startedAt: string;
  providerConfigured: boolean;
  providerReadEnabled: boolean;
  actorId?: string | null;
}): Promise<void> {
  const db = getAdminFirestore();
  const counts = emptyCounts();

  await db.doc(BARNET_SYNC_STATE_DOC).set(
    omitUndefined({
      provider: "barnet",
      lastStartedAt: input.startedAt,
      lastAttemptedSyncAt: input.startedAt,
      lastAttemptAt: input.startedAt,
      lastAttemptExecutionId: input.runId,
      lastAttemptResult: "running" satisfies BarnetSyncAttemptResult,
      lastRunId: input.runId,
      lastRunStatus: "running" satisfies BarnetSyncRunStatus,
      lastRunSource: input.source,
      trigger: input.source,
      lastResult: "running",
      lastDurationMs: null,
      lastSafeErrorMessage: null,
      lastErrorCode: null,
      lastCounts: counts,
      providerConfigured: input.providerConfigured,
      providerReadEnabled: input.providerReadEnabled,
    }),
    { merge: true },
  );

  await db.collection(BARNET_SYNC_RUNS_COLLECTION).doc(input.runId).set(
    omitUndefined({
      runId: input.runId,
      source: input.source,
      status: "running" satisfies BarnetSyncRunStatus,
      startedAt: input.startedAt,
      completedAt: null,
      durationMs: null,
      lastAttemptedSyncAt: input.startedAt,
      lastSuccessfulSyncAt: null,
      ...counts,
      errorCode: null,
      safeErrorMessage: null,
      lockRunId: input.runId,
      outsideOperatingHours: false,
      providerConfigured: input.providerConfigured,
      providerReadEnabled: input.providerReadEnabled,
      actorId: input.actorId ?? null,
      createdAt: input.startedAt,
    }),
  );
}

export async function persistBarnetSyncRunOutcome(input: {
  runId: string;
  source: BarnetSyncSource;
  status: BarnetSyncRunStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  counts?: Partial<BarnetSyncRunCounts>;
  errorCode?: string | null;
  safeErrorMessage?: string | null;
  outsideOperatingHours?: boolean;
  providerConfigured: boolean;
  providerReadEnabled: boolean;
  previousSuccessfulSyncAt?: string | null;
  actorId?: string | null;
  updateAttemptedAt?: boolean;
  /** When false, update summary state only (no history doc / prune). */
  recordHistory?: boolean;
  /** Count of newly imported delivery orders this run (for lastNewOrderImportedAt). */
  newOrdersImported?: number;
  /** False when the run died before finishing the Barnet page scan. */
  scanCompleted?: boolean;
}): Promise<void> {
  const db = getAdminFirestore();
  const counts = { ...emptyCounts(), ...input.counts };
  const isSuccessLike =
    input.status === "success" || input.status === "partial";
  const previousSuccess =
    typeof input.previousSuccessfulSyncAt === "string"
      ? input.previousSuccessfulSyncAt
      : null;
  const lastSuccessfulSyncAt = isSuccessLike
    ? input.completedAt
    : previousSuccess;

  const lastResult =
    input.status === "skipped_outside_hours"
      ? "skipped_quiet_hours"
      : input.status === "skipped_locked"
        ? "skipped_lock_active"
        : input.status === "disabled"
          ? "skipped_disabled"
          : input.status === "not_configured"
            ? "skipped_not_configured"
            : input.status === "timed_out_or_expired"
              ? "timed_out_or_expired"
              : input.status === "failed"
                ? "failed"
                : input.status === "success" || input.status === "partial"
                  ? (input.newOrdersImported ?? counts.inserted) > 0
                    ? "imported_new"
                    : "no_new_orders"
                  : input.status;

  const attemptResult = toBarnetSyncAttemptResult(input.status);

  const statePatch: Record<string, unknown> = {
    provider: "barnet",
    lastRunId: input.runId,
    lastRunStatus: input.status,
    lastRunSource: input.source,
    trigger: input.source,
    lastDurationMs: input.durationMs,
    lastSafeErrorMessage: input.safeErrorMessage ?? null,
    lastErrorCode: input.errorCode ?? null,
    lastResult,
    lastAttemptAt: input.completedAt,
    lastAttemptExecutionId: input.runId,
    lastAttemptResult: attemptResult,
    lastCounts: counts,
    lastSyncSummary: {
      inserted: counts.inserted,
      updated: counts.updated,
      deliveryOrdersFound: counts.deliveryOrdersFound,
      pagesScanned: counts.pagesScanned,
      unchanged: counts.unchanged,
      invalid: counts.invalid,
      enrichmentErrors: counts.enrichmentErrors,
      syncErrors: counts.syncErrors,
      needsReview: counts.needsReview ?? 0,
      readyToDispatch: counts.readyToDispatch ?? 0,
    },
    lastError: input.safeErrorMessage ?? null,
    providerConfigured: input.providerConfigured,
    providerReadEnabled: input.providerReadEnabled,
    outsideOperatingHours: Boolean(input.outsideOperatingHours),
  };

  if (input.updateAttemptedAt !== false) {
    statePatch.lastAttemptedSyncAt = input.completedAt;
    // lastScanAt updates only after a completed page scan (success/partial),
    // or a failed run that still finished scanning pages.
    if (
      input.status === "success" ||
      input.status === "partial" ||
      (input.status === "failed" && input.scanCompleted !== false)
    ) {
      statePatch.lastScanAt = input.completedAt;
    }
  }

  if (isSuccessLike) {
    statePatch.lastSuccessfulSyncAt = lastSuccessfulSyncAt;
    statePatch.lastCompletedAt = input.completedAt;
    statePatch.consecutiveFailures = 0;
    if ((input.newOrdersImported ?? counts.inserted) > 0) {
      statePatch.lastNewOrderImportedAt = input.completedAt;
    }
  } else if (input.status === "failed" || input.status === "timed_out_or_expired") {
    if (previousSuccess) {
      statePatch.lastSuccessfulSyncAt = previousSuccess;
    }
    statePatch.lastCompletedAt = input.completedAt;
    if (input.status === "failed") {
      statePatch.consecutiveFailures = FieldValue.increment(1);
    }
  } else {
    // Skips: record completed timestamp but do not imply a successful scan.
    statePatch.lastCompletedAt = input.completedAt;
  }
  // skipped / disabled / not_configured: do not touch lastSuccessfulSyncAt

  await db.doc(BARNET_SYNC_STATE_DOC).set(omitUndefined(statePatch), { merge: true });

  if (input.recordHistory === false) {
    return;
  }

  await db.collection(BARNET_SYNC_RUNS_COLLECTION).doc(input.runId).set(
    omitUndefined({
      runId: input.runId,
      source: input.source,
      trigger: input.source,
      status: input.status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      durationMs: input.durationMs,
      lastAttemptedSyncAt: input.completedAt,
      lastSuccessfulSyncAt,
      lastResult,
      ...counts,
      errorCode: input.errorCode ?? null,
      safeErrorMessage: input.safeErrorMessage ?? null,
      lockRunId: input.runId,
      outsideOperatingHours: Boolean(input.outsideOperatingHours),
      providerConfigured: input.providerConfigured,
      providerReadEnabled: input.providerReadEnabled,
      actorId: input.actorId ?? null,
      updatedAt: input.completedAt,
    }),
    { merge: true },
  );

  await pruneBarnetSyncRunHistory(db);
}

async function pruneBarnetSyncRunHistory(
  db: ReturnType<typeof getAdminFirestore>,
): Promise<void> {
  try {
    const snap = await db
      .collection(BARNET_SYNC_RUNS_COLLECTION)
      .orderBy("startedAt", "desc")
      .offset(BARNET_SYNC_RUN_HISTORY_LIMIT)
      .limit(40)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  } catch {
    // History prune is best-effort — never fail the sync run.
  }
}

export async function readBarnetSyncStateDoc(): Promise<Record<string, unknown>> {
  const db = getAdminFirestore();
  const snap = await db.doc(BARNET_SYNC_STATE_DOC).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : {};
}
