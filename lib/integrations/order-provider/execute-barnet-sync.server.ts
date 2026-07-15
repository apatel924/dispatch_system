import { randomUUID } from "node:crypto";
import {
  isBarnetUpstreamTimeoutError,
} from "@/lib/integrations/order-provider/barnet-client.server";
import {
  getNextBarnetOperatingWindowStart,
  isBarnetScanningAllowed,
  OUTSIDE_OPERATING_HOURS_REASON,
} from "@/lib/integrations/order-provider/barnet-operating-hours.server";
import {
  BARNET_SYNC_CRON_INTERVAL_MS,
  deriveBarnetSyncHealth,
  resolveBarnetSyncRunStatus,
  toSafeBarnetSyncErrorMessage,
  type BarnetSyncHealthSnapshot,
  type BarnetSyncSource,
  type DerivedBarnetSyncHealth,
} from "@/lib/integrations/order-provider/barnet-sync-health.server";
import {
  markBarnetSyncRunStarted,
  persistBarnetSyncRunOutcome,
  readBarnetSyncStateDoc,
  shouldRecordBarnetSyncHistoryDoc,
} from "@/lib/integrations/order-provider/barnet-sync-run.server";
import { getExternalOrderProviderConfig } from "@/lib/integrations/order-provider/env.server";
import { runBarnetOrderSync } from "@/lib/integrations/order-provider/run-barnet-order-sync.server";
import {
  acquireBarnetSyncLock,
  releaseBarnetSyncLock,
} from "@/lib/integrations/order-provider/sync-lock.server";

export type BarnetSyncSkippedReason =
  | "sync_already_running"
  | "sync_disabled"
  | "provider_not_live"
  | "provider_not_configured"
  | typeof OUTSIDE_OPERATING_HOURS_REASON;

export type ExecuteBarnetSyncResult =
  | {
      ok: true;
      skipped: true;
      reason: BarnetSyncSkippedReason;
      status:
        | "skipped_outside_hours"
        | "skipped_locked"
        | "disabled"
        | "not_configured";
      durationMs: number;
      nextEligibleAt?: string;
    }
  | {
      ok: true;
      skipped?: false;
      status: "success" | "partial";
      pagesScanned: number;
      ordersSeen: number;
      deliveryCandidates: number;
      newDeliveries: number;
      updatedDeliveries: number;
      unchangedOrders: number;
      needsReview: number;
      readyToDispatch: number;
      pickupOrdersIgnored: number;
      unknownOrdersIgnored: number;
      invalid: number;
      enrichmentErrors: number;
      syncErrors: number;
      durationMs: number;
      exclusionReasons?: Record<string, number>;
    }
  | {
      ok: false;
      error: "upstream_timeout" | "sync_failed";
      status: "failed";
      durationMs: number;
      safeErrorMessage: string;
    };

export interface ExecuteBarnetSyncOptions {
  runId?: string;
  source: BarnetSyncSource;
  actorId?: string | null;
  /** Explicit admin override — must be audit-logged by the route. */
  overrideQuietHours?: boolean;
  now?: Date;
}

function logSyncEvent(payload: Record<string, unknown>): void {
  console.info(
    "[barnet-sync]",
    JSON.stringify(payload),
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildBarnetSyncHealthSnapshot(
  data: Record<string, unknown>,
  options: {
    outsideOperatingHours: boolean;
    providerConfigured: boolean;
    providerReadEnabled: boolean;
    liveSyncEnabled: boolean;
    mode: string;
  },
): BarnetSyncHealthSnapshot {
  const lastCounts =
    data.lastCounts && typeof data.lastCounts === "object"
      ? (data.lastCounts as BarnetSyncHealthSnapshot["lastCounts"])
      : data.lastSyncSummary && typeof data.lastSyncSummary === "object"
        ? {
            pagesScanned: asNumber(
              (data.lastSyncSummary as Record<string, unknown>).pagesScanned,
            ) ?? undefined,
            deliveryOrdersFound: asNumber(
              (data.lastSyncSummary as Record<string, unknown>).deliveryOrdersFound,
            ) ?? undefined,
            inserted: asNumber(
              (data.lastSyncSummary as Record<string, unknown>).inserted,
            ) ?? undefined,
            updated: asNumber(
              (data.lastSyncSummary as Record<string, unknown>).updated,
            ) ?? undefined,
          }
        : null;

  return {
    providerConfigured: options.providerConfigured,
    providerReadEnabled: options.providerReadEnabled,
    liveSyncEnabled: options.liveSyncEnabled,
    mode: options.mode,
    lastAttemptedSyncAt: asString(data.lastAttemptedSyncAt),
    lastSuccessfulSyncAt: asString(data.lastSuccessfulSyncAt),
    lastRunStatus: (asString(data.lastRunStatus) as BarnetSyncHealthSnapshot["lastRunStatus"]) ?? null,
    lastRunSource: (asString(data.lastRunSource) as BarnetSyncHealthSnapshot["lastRunSource"]) ?? null,
    lastDurationMs: asNumber(data.lastDurationMs),
    lastSafeErrorMessage:
      asString(data.lastSafeErrorMessage) ?? asString(data.lastError),
    lastErrorCode: asString(data.lastErrorCode),
    consecutiveFailures: asNumber(data.consecutiveFailures) ?? 0,
    lockRunId: asString(data.lockRunId),
    lockExpiresAt: asString(data.lockExpiresAt),
    lockSource: (asString(data.lockSource) as BarnetSyncHealthSnapshot["lockSource"]) ?? null,
    lastCounts,
    outsideOperatingHours: options.outsideOperatingHours,
  };
}

export function estimateNextEligibleBarnetScanAt(now: Date = new Date()): string {
  if (!isBarnetScanningAllowed(now)) {
    return getNextBarnetOperatingWindowStart(now).toISOString();
  }
  const aligned =
    Math.ceil(now.getTime() / BARNET_SYNC_CRON_INTERVAL_MS) *
    BARNET_SYNC_CRON_INTERVAL_MS;
  const candidate = new Date(aligned);
  if (!isBarnetScanningAllowed(candidate)) {
    return getNextBarnetOperatingWindowStart(now).toISOString();
  }
  return candidate.toISOString();
}

/** Build operator-facing sync health for admin UI / health APIs. */
export async function getBarnetSyncHealthView(
  now: Date = new Date(),
): Promise<DerivedBarnetSyncHealth & {
  syncState: {
    lastSuccessfulSyncAt: string | null;
    lastAttemptedSyncAt: string | null;
    lastError: string | null;
    lastSyncSummary: Record<string, unknown> | null;
  };
}> {
  const config = getExternalOrderProviderConfig();
  const data = await readBarnetSyncStateDoc();
  const outside = !isBarnetScanningAllowed(now);
  const snapshot = buildBarnetSyncHealthSnapshot(data, {
    outsideOperatingHours: outside,
    providerConfigured: config.configured,
    providerReadEnabled: config.liveReadsEnabled,
    liveSyncEnabled: config.liveSyncEnabled,
    mode: config.mode,
  });
  const derived = deriveBarnetSyncHealth(snapshot, {
    now,
    nextExpectedEligibleScanAt: estimateNextEligibleBarnetScanAt(now),
  });

  return {
    ...derived,
    syncState: {
      lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
      lastAttemptedSyncAt: snapshot.lastAttemptedSyncAt,
      lastError: snapshot.lastSafeErrorMessage,
      lastSyncSummary:
        data.lastSyncSummary && typeof data.lastSyncSummary === "object"
          ? (data.lastSyncSummary as Record<string, unknown>)
          : null,
    },
  };
}

/**
 * Shared entry point for cron and manual live Barnet synchronization.
 * Enforces operating hours, shared lock, run metrics, and safe logging.
 */
export async function executeBarnetSync(
  options: ExecuteBarnetSyncOptions,
): Promise<ExecuteBarnetSyncResult> {
  const runId = options.runId ?? randomUUID();
  const now = options.now ?? new Date();
  const startedAtMs = now.getTime();
  const startedAt = now.toISOString();
  const config = getExternalOrderProviderConfig();

  const providerConfigured = Boolean(config.configured && config.mode === "live");
  const providerReadEnabled = Boolean(config.liveReadsEnabled);

  if (config.mode !== "live") {
    const durationMs = Date.now() - startedAtMs;
    const prior = await readBarnetSyncStateDoc();
    await persistBarnetSyncRunOutcome({
      runId,
      source: options.source,
      status: "not_configured",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      providerConfigured: false,
      providerReadEnabled,
      actorId: options.actorId,
      recordHistory: shouldRecordBarnetSyncHistoryDoc({
        status: "not_configured",
        priorLastRunStatus: asString(prior.lastRunStatus),
      }),
    });
    logSyncEvent({
      runId,
      source: options.source,
      stage: "skip",
      status: "not_configured",
      durationMs,
    });
    return {
      ok: true,
      skipped: true,
      reason: "provider_not_live",
      status: "not_configured",
      durationMs,
    };
  }

  if (!config.configured) {
    const durationMs = Date.now() - startedAtMs;
    const prior = await readBarnetSyncStateDoc();
    await persistBarnetSyncRunOutcome({
      runId,
      source: options.source,
      status: "not_configured",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      providerConfigured: false,
      providerReadEnabled,
      actorId: options.actorId,
      recordHistory: shouldRecordBarnetSyncHistoryDoc({
        status: "not_configured",
        priorLastRunStatus: asString(prior.lastRunStatus),
      }),
    });
    return {
      ok: true,
      skipped: true,
      reason: "provider_not_configured",
      status: "not_configured",
      durationMs,
    };
  }

  if (!config.liveSyncEnabled) {
    const durationMs = Date.now() - startedAtMs;
    const prior = await readBarnetSyncStateDoc();
    await persistBarnetSyncRunOutcome({
      runId,
      source: options.source,
      status: "disabled",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      providerConfigured: true,
      providerReadEnabled,
      actorId: options.actorId,
      recordHistory: shouldRecordBarnetSyncHistoryDoc({
        status: "disabled",
        priorLastRunStatus: asString(prior.lastRunStatus),
      }),
    });
    logSyncEvent({
      runId,
      source: options.source,
      stage: "skip",
      status: "disabled",
      durationMs,
    });
    return {
      ok: true,
      skipped: true,
      reason: "sync_disabled",
      status: "disabled",
      durationMs,
    };
  }

  const allowScan =
    isBarnetScanningAllowed(now) ||
    (options.source === "manual" && options.overrideQuietHours === true);

  if (!allowScan) {
    const durationMs = Date.now() - startedAtMs;
    const nextEligibleAt = getNextBarnetOperatingWindowStart(now).toISOString();
    const prior = await readBarnetSyncStateDoc();
    await persistBarnetSyncRunOutcome({
      runId,
      source: options.source,
      status: "skipped_outside_hours",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      outsideOperatingHours: true,
      providerConfigured: true,
      providerReadEnabled,
      previousSuccessfulSyncAt: asString(prior.lastSuccessfulSyncAt),
      actorId: options.actorId,
      recordHistory: shouldRecordBarnetSyncHistoryDoc({
        status: "skipped_outside_hours",
        priorLastRunStatus: asString(prior.lastRunStatus),
      }),
    });
    logSyncEvent({
      runId,
      source: options.source,
      stage: "skip",
      status: "skipped_outside_hours",
      reason: OUTSIDE_OPERATING_HOURS_REASON,
      durationMs,
      lockResult: "not_acquired",
    });
    return {
      ok: true,
      skipped: true,
      reason: OUTSIDE_OPERATING_HOURS_REASON,
      status: "skipped_outside_hours",
      durationMs,
      nextEligibleAt,
    };
  }

  const lock = await acquireBarnetSyncLock({
    runId,
    source: options.source,
    actorId: options.actorId,
  });

  if (lock === "skipped") {
    const durationMs = Date.now() - startedAtMs;
    const prior = await readBarnetSyncStateDoc();
    await persistBarnetSyncRunOutcome({
      runId,
      source: options.source,
      status: "skipped_locked",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      providerConfigured: true,
      providerReadEnabled,
      previousSuccessfulSyncAt: asString(prior.lastSuccessfulSyncAt),
      actorId: options.actorId,
      recordHistory: shouldRecordBarnetSyncHistoryDoc({
        status: "skipped_locked",
        priorLastRunStatus: asString(prior.lastRunStatus),
      }),
    });
    logSyncEvent({
      runId,
      source: options.source,
      stage: "skip",
      status: "skipped_locked",
      durationMs,
      lockResult: "skipped",
    });
    return {
      ok: true,
      skipped: true,
      reason: "sync_already_running",
      status: "skipped_locked",
      durationMs,
    };
  }

  const prior = await readBarnetSyncStateDoc();
  const previousSuccessfulSyncAt = asString(prior.lastSuccessfulSyncAt);

  try {
    await markBarnetSyncRunStarted({
      runId,
      source: options.source,
      startedAt,
      providerConfigured: true,
      providerReadEnabled,
      actorId: options.actorId,
    });

    logSyncEvent({
      runId,
      source: options.source,
      stage: "start",
      status: "running",
      lockResult: "acquired",
    });

    const result = await runBarnetOrderSync();
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAtMs;
    const status = resolveBarnetSyncRunStatus({
      failedHard: false,
      enrichmentErrors: result.enrichmentErrors,
      syncErrors: result.syncErrors,
      invalid: result.invalidOrders,
    });
    if (status === "failed") {
      throw new Error("Unexpected hard failure status without throw");
    }

    await persistBarnetSyncRunOutcome({
      runId,
      source: options.source,
      status,
      startedAt,
      completedAt,
      durationMs,
      counts: {
        pagesScanned: result.pagesScanned,
        ordersExamined: result.ordersSeen,
        deliveryOrdersFound: result.deliveryCandidates,
        inserted: result.newDeliveries,
        updated: result.updatedDeliveries,
        unchanged: result.unchangedOrders,
        skipped: result.pickupOrdersIgnored + result.unknownOrdersIgnored,
        invalid: result.invalidOrders,
        enrichmentErrors: result.enrichmentErrors,
        syncErrors: result.syncErrors,
        needsReview: result.needsReview,
        readyToDispatch: result.readyToDispatch,
      },
      providerConfigured: true,
      providerReadEnabled,
      previousSuccessfulSyncAt,
      actorId: options.actorId,
    });

    logSyncEvent({
      runId,
      source: options.source,
      stage: "complete",
      status,
      durationMs,
      pagesScanned: result.pagesScanned,
      ordersExamined: result.ordersSeen,
      deliveryOrdersFound: result.deliveryCandidates,
      inserted: result.newDeliveries,
      updated: result.updatedDeliveries,
      unchanged: result.unchangedOrders,
      enrichmentErrors: result.enrichmentErrors,
      syncErrors: result.syncErrors,
      invalid: result.invalidOrders,
      needsReview: result.needsReview,
      readyToDispatch: result.readyToDispatch,
    });

    return {
      ok: true,
      status,
      pagesScanned: result.pagesScanned,
      ordersSeen: result.ordersSeen,
      deliveryCandidates: result.deliveryCandidates,
      newDeliveries: result.newDeliveries,
      updatedDeliveries: result.updatedDeliveries,
      unchangedOrders: result.unchangedOrders,
      needsReview: result.needsReview,
      readyToDispatch: result.readyToDispatch,
      pickupOrdersIgnored: result.pickupOrdersIgnored,
      unknownOrdersIgnored: result.unknownOrdersIgnored,
      invalid: result.invalidOrders,
      enrichmentErrors: result.enrichmentErrors,
      syncErrors: result.syncErrors,
      durationMs,
      exclusionReasons: result.exclusionReasons,
    };
  } catch (err) {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAtMs;
    const { errorCode, safeErrorMessage } = toSafeBarnetSyncErrorMessage(err);

    await persistBarnetSyncRunOutcome({
      runId,
      source: options.source,
      status: "failed",
      startedAt,
      completedAt,
      durationMs,
      errorCode,
      safeErrorMessage,
      providerConfigured: true,
      providerReadEnabled,
      previousSuccessfulSyncAt,
      actorId: options.actorId,
    });

    logSyncEvent({
      runId,
      source: options.source,
      stage: "error",
      status: "failed",
      durationMs,
      errorCode,
    });

    if (isBarnetUpstreamTimeoutError(err)) {
      return {
        ok: false,
        error: "upstream_timeout",
        status: "failed",
        durationMs,
        safeErrorMessage,
      };
    }

    return {
      ok: false,
      error: "sync_failed",
      status: "failed",
      durationMs,
      safeErrorMessage,
    };
  } finally {
    try {
      await releaseBarnetSyncLock(runId);
    } catch (releaseErr) {
      logSyncEvent({
        runId,
        source: options.source,
        stage: "lock_release_failed",
        status: "failed",
        errorCode: "lock_release_failed",
      });
      void releaseErr;
    }
  }
}
