export const MAX_EXTERNAL_ORDER_SYNC_PAGES = 20;
export const DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY = 3;
/** Hard cap so misconfigured env cannot fan out every page at once. */
export const MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY = 5;

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

/** Bounded parallel Barnet GET /orders requests per scan batch. */
export function getExternalOrderSyncPageConcurrency(): number {
  return Math.min(
    parsePositiveInt(
      process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
      DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
    ),
    MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
  );
}
