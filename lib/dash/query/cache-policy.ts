/**
 * Named TanStack Query cache defaults for dash data loading.
 * Values are freshness windows — not permanent storage.
 */

/** Dashboard statistics: ~30s freshness. */
export const CACHE_DASHBOARD_STATS_MS = 30_000;

/** Admin orders lists: ~20–30s. */
export const CACHE_ORDERS_LIST_MS = 25_000;

/** Order detail (admin + driver): ~15–30s. */
export const CACHE_ORDER_DETAIL_MS = 20_000;

/** Driver session/profile: several minutes unless edited. */
export const CACHE_DRIVER_SESSION_MS = 5 * 60_000;

/** Driver active route/orders while focused: ~10–20s. */
export const CACHE_DRIVER_ORDERS_MS = 15_000;

/** Completed / historical lists: longer freshness. */
export const CACHE_HISTORICAL_MS = 2 * 60_000;

/** Admin drivers list. */
export const CACHE_DRIVERS_LIST_MS = 30_000;

/** Reports overview. */
export const CACHE_REPORTS_MS = 60_000;

/** Default GC — keep navigable pages warm without unbounded growth. */
export const CACHE_GC_TIME_MS = 10 * 60_000;

/** Default stale when not overridden. */
export const CACHE_DEFAULT_STALE_MS = 30_000;

/**
 * Polling intervals (visibility-gated where hooks use shouldPollQuery / usePolling).
 *
 * - LIST_SYNC_POLL_MS (20s): admin orders/drivers on operational routes — keeps
 *   dispatch boards current without per-component polling.
 * - ORDER_SYNC_POLL_MS (5s): open order detail + driver active views — short
 *   window for live delivery progress; pauses when document.hidden.
 */
export {
  LIST_SYNC_POLL_MS,
  ORDER_SYNC_POLL_MS,
} from "@/lib/delivery-workflow";
