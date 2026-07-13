const DEFAULT_CONSECUTIVE_KNOWN_THRESHOLD = 20;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;
const DEFAULT_ENRICHMENT_CONCURRENCY = 4;
const DEFAULT_LOCK_TTL_MS = 15 * 60 * 1000;

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
  return parsePositiveInt(
    process.env.EXTERNAL_ORDER_UPSTREAM_TIMEOUT_MS,
    DEFAULT_UPSTREAM_TIMEOUT_MS,
  );
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
