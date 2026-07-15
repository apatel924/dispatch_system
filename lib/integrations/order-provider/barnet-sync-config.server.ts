const DEFAULT_CONSECUTIVE_KNOWN_THRESHOLD = 20;
/** Default upstream timeout — Barnet /orders can exceed 20s under load. */
const DEFAULT_UPSTREAM_TIMEOUT_MS = 40_000;
const MIN_UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_UPSTREAM_TIMEOUT_MS = 60_000;
const DEFAULT_ENRICHMENT_CONCURRENCY = 4;
/** 9 minutes — expires before the next 15-minute cron tick. */
const DEFAULT_LOCK_TTL_MS = 9 * 60 * 1000;

/** Internal deadline below Vercel maxDuration=300s. */
export const BARNET_SYNC_EXECUTION_DEADLINE_MS = 260_000;
/** Reserved time for lock release and persistence after the last upstream call. */
export const BARNET_SYNC_EXECUTION_CLEANUP_BUFFER_MS = 5_000;

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function getBarnetSyncConsecutiveKnownThreshold(): number {
  return parsePositiveInt(
    process.env.EXTERNAL_ORDER_SYNC_CONSECUTIVE_KNOWN_THRESHOLD,
    DEFAULT_CONSECUTIVE_KNOWN_THRESHOLD,
  );
}

export function getBarnetUpstreamTimeoutMs(): number {
  const raw =
    process.env.EXTERNAL_ORDER_SYNC_UPSTREAM_TIMEOUT_MS ??
    process.env.EXTERNAL_ORDER_UPSTREAM_TIMEOUT_MS;
  const fallback = DEFAULT_UPSTREAM_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < MIN_UPSTREAM_TIMEOUT_MS) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), MAX_UPSTREAM_TIMEOUT_MS);
}

export function getBarnetEnrichmentConcurrency(): number {
  return Math.min(
    parsePositiveInt(
      process.env.EXTERNAL_ORDER_ENRICHMENT_CONCURRENCY,
      DEFAULT_ENRICHMENT_CONCURRENCY,
    ),
    20,
  );
}

export function getBarnetSyncLockTtlMs(): number {
  return parsePositiveInt(
    process.env.EXTERNAL_ORDER_SYNC_LOCK_TTL_MS,
    DEFAULT_LOCK_TTL_MS,
  );
}

export const BARNET_UPSTREAM_TIMEOUT_DEFAULT_MS = DEFAULT_UPSTREAM_TIMEOUT_MS;
export const BARNET_UPSTREAM_TIMEOUT_MIN_MS = MIN_UPSTREAM_TIMEOUT_MS;
export const BARNET_UPSTREAM_TIMEOUT_MAX_MS = MAX_UPSTREAM_TIMEOUT_MS;
