/**
 * Named constants and pure health derivation for Barnet sync.
 */

/** Chosen cron frequency: every 15 minutes (see vercel.json). */
export const BARNET_SYNC_CRON_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Within operating hours, a successful sync older than 2× cron interval is stale.
 * (Allows one missed tick without alarming.)
 */
export const BARNET_SYNC_STALE_AFTER_MS = 2 * BARNET_SYNC_CRON_INTERVAL_MS;

/** Consecutive eligible failures before health becomes `failed`. */
export const BARNET_SYNC_CONSECUTIVE_FAILURE_THRESHOLD = 3;

/** Bounded run history kept in Firestore. */
export const BARNET_SYNC_RUN_HISTORY_LIMIT = 25;

export type BarnetSyncSource = "cron" | "manual";

export type BarnetSyncRunStatus =
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "skipped_outside_hours"
  | "skipped_locked"
  | "disabled"
  | "not_configured";

export type BarnetSyncHealthState =
  | "healthy"
  | "running"
  | "outside_hours"
  | "stale"
  | "degraded"
  | "failed"
  | "locked"
  | "disabled"
  | "not_configured"
  | "never_run";

export interface BarnetSyncRunCounts {
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
  needsReview?: number;
  readyToDispatch?: number;
}

export interface BarnetSyncHealthSnapshot {
  providerConfigured: boolean;
  providerReadEnabled: boolean;
  liveSyncEnabled: boolean;
  mode: "live" | "mock" | string;
  lastAttemptedSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastRunStatus: BarnetSyncRunStatus | null;
  lastRunSource: BarnetSyncSource | null;
  lastDurationMs: number | null;
  lastSafeErrorMessage: string | null;
  lastErrorCode: string | null;
  consecutiveFailures: number;
  lockRunId: string | null;
  lockExpiresAt: string | null;
  lockSource: BarnetSyncSource | null;
  lastCounts: Partial<BarnetSyncRunCounts> | null;
  outsideOperatingHours: boolean;
}

export interface DerivedBarnetSyncHealth {
  state: BarnetSyncHealthState;
  outsideOperatingHours: boolean;
  isRunning: boolean;
  isLocked: boolean;
  lastAttemptedSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastDurationMs: number | null;
  lastSafeErrorMessage: string | null;
  lastErrorCode: string | null;
  lastRunStatus: BarnetSyncRunStatus | null;
  counts: Partial<BarnetSyncRunCounts> | null;
  nextExpectedEligibleScanAt: string | null;
  staleAfterMs: number;
  message: string;
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function isLockActive(snapshot: BarnetSyncHealthSnapshot, nowMs: number): boolean {
  if (!snapshot.lockRunId) return false;
  const expires = parseMs(snapshot.lockExpiresAt);
  return expires !== null && expires > nowMs;
}

/**
 * Derive operator-facing sync health from stored metrics + current time.
 * `outsideOperatingHours` must be computed with America/Edmonton by the caller.
 */
export function deriveBarnetSyncHealth(
  snapshot: BarnetSyncHealthSnapshot,
  options?: {
    now?: Date;
    nextExpectedEligibleScanAt?: string | null;
  },
): DerivedBarnetSyncHealth {
  const now = options?.now ?? new Date();
  const nowMs = now.getTime();
  const outside = snapshot.outsideOperatingHours;
  const locked = isLockActive(snapshot, nowMs);
  const running = snapshot.lastRunStatus === "running";

  const base = {
    outsideOperatingHours: outside,
    isRunning: running,
    isLocked: locked,
    lastAttemptedSyncAt: snapshot.lastAttemptedSyncAt,
    lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
    lastDurationMs: snapshot.lastDurationMs,
    lastSafeErrorMessage: snapshot.lastSafeErrorMessage,
    lastErrorCode: snapshot.lastErrorCode,
    lastRunStatus: snapshot.lastRunStatus,
    counts: snapshot.lastCounts,
    nextExpectedEligibleScanAt: options?.nextExpectedEligibleScanAt ?? null,
    staleAfterMs: BARNET_SYNC_STALE_AFTER_MS,
  };

  if (!snapshot.providerConfigured || snapshot.mode !== "live") {
    return {
      ...base,
      state: "not_configured",
      isRunning: false,
      message: "Barnet live sync is not configured.",
    };
  }

  if (!snapshot.liveSyncEnabled) {
    return {
      ...base,
      state: "disabled",
      isRunning: false,
      message: "Live sync is disabled.",
    };
  }

  if (running) {
    return {
      ...base,
      state: "running",
      isRunning: true,
      message: "A synchronization run is in progress.",
    };
  }

  if (locked) {
    return {
      ...base,
      state: "locked",
      message: "Another synchronization run holds the lock.",
    };
  }

  if (outside) {
    return {
      ...base,
      state: "outside_hours",
      message:
        "Scanning is paused overnight (12:00 AM–8:30 AM Edmonton). This is expected.",
    };
  }

  if (!snapshot.lastSuccessfulSyncAt && !snapshot.lastAttemptedSyncAt) {
    return {
      ...base,
      state: "never_run",
      message: "No synchronization runs have been recorded yet.",
    };
  }

  if (
    snapshot.consecutiveFailures >= BARNET_SYNC_CONSECUTIVE_FAILURE_THRESHOLD ||
    snapshot.lastRunStatus === "failed"
  ) {
    return {
      ...base,
      state: "failed",
      message:
        snapshot.lastSafeErrorMessage ??
        "The latest eligible synchronization run failed.",
    };
  }

  if (snapshot.lastRunStatus === "partial") {
    return {
      ...base,
      state: "degraded",
      message:
        "The latest sync completed with some order-level failures.",
    };
  }

  const successMs = parseMs(snapshot.lastSuccessfulSyncAt);
  if (successMs === null) {
    return {
      ...base,
      state: "never_run",
      message: "No successful synchronization has been recorded yet.",
    };
  }

  if (nowMs - successMs > BARNET_SYNC_STALE_AFTER_MS) {
    return {
      ...base,
      state: "stale",
      message: "Last successful sync is older than the expected cadence.",
    };
  }

  return {
    ...base,
    state: "healthy",
    message: "Synchronization is up to date.",
  };
}

/** Map engine outcome to a completed run status. Partial wins over bare success. */
export function resolveBarnetSyncRunStatus(input: {
  failedHard: boolean;
  enrichmentErrors: number;
  syncErrors: number;
  invalid: number;
}): "success" | "partial" | "failed" {
  if (input.failedHard) return "failed";
  if (input.enrichmentErrors > 0 || input.syncErrors > 0 || input.invalid > 0) {
    return "partial";
  }
  return "success";
}

/** Operator-safe error text — never include payloads or credentials. */
export function toSafeBarnetSyncErrorMessage(error: unknown): {
  errorCode: string;
  safeErrorMessage: string;
} {
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name ?? "");
    if (name === "BarnetUpstreamTimeoutError") {
      return {
        errorCode: "upstream_timeout",
        safeErrorMessage: "Barnet request timed out.",
      };
    }
  }

  const message = error instanceof Error ? error.message : "Synchronization failed";
  const lower = message.toLowerCase();

  if (lower.includes("401") || lower.includes("unauthorized")) {
    return {
      errorCode: "unauthorized",
      safeErrorMessage: "Barnet rejected the request (unauthorized).",
    };
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return {
      errorCode: "forbidden",
      safeErrorMessage: "Barnet rejected the request (forbidden).",
    };
  }
  if (lower.includes("429")) {
    return {
      errorCode: "rate_limited",
      safeErrorMessage: "Barnet rate-limited the request.",
    };
  }
  if (/\b5\d\d\b/.test(message)) {
    return {
      errorCode: "upstream_5xx",
      safeErrorMessage: "Barnet returned a server error.",
    };
  }
  if (lower.includes("not configured") || lower.includes("credentials")) {
    return {
      errorCode: "not_configured",
      safeErrorMessage: "Barnet provider is not configured.",
    };
  }

  return {
    errorCode: "sync_failed",
    safeErrorMessage: "Synchronization failed.",
  };
}
