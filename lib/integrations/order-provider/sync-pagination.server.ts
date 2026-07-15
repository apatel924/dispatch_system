export const MAX_EXTERNAL_ORDER_SYNC_PAGES = 20;
export const DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY = 1;
/** Hard cap for Barnet — higher concurrency has caused upstream timeouts in production. */
export const MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY = 2;

const DEFAULT_SYNC_PAGES = 5;
const DEFAULT_ITEMS_PER_PAGE = 20;

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

/**
 * Resolves Barnet order list pagination for live preview, delivery scan, and live sync.
 * Pages are capped at {@link MAX_EXTERNAL_ORDER_SYNC_PAGES}.
 */
export function getExternalOrderSyncPaginationConfig(): {
  pages: number;
  itemsPerPage: number;
} {
  const pages = Math.min(
    parsePositiveInt(process.env.EXTERNAL_ORDER_SYNC_PAGES, DEFAULT_SYNC_PAGES),
    MAX_EXTERNAL_ORDER_SYNC_PAGES,
  );
  const itemsPerPage = parsePositiveInt(
    process.env.EXTERNAL_ORDER_SYNC_ITEMS_PER_PAGE,
    DEFAULT_ITEMS_PER_PAGE,
  );

  return { pages, itemsPerPage };
}

function parseRequestedPageConcurrency(): number {
  const raw = process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY;
  const parsed = Number(raw);
  if (raw === undefined || raw === "" || !Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY;
  }
  return Math.floor(parsed);
}

/** Bounded parallel Barnet GET /orders requests per scan batch (after page-1 probe). */
export function getExternalOrderSyncPageConcurrency(): number {
  return getExternalOrderSyncPageConcurrencyConfig().effectiveConcurrency;
}

export function getExternalOrderSyncPageConcurrencyConfig(): {
  requestedConcurrency: number;
  effectiveConcurrency: number;
} {
  const requestedConcurrency = parseRequestedPageConcurrency();
  const effectiveConcurrency = Math.min(
    requestedConcurrency,
    MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
  );
  return { requestedConcurrency, effectiveConcurrency };
}
