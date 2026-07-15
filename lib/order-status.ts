/**
 * Authoritative order-status model for Quick Run Express.
 *
 * Canonical statuses are the only values written by production paths.
 * Legacy aliases (e.g. "En Route") normalize to canonical values on read.
 * Cancelled is intentionally omitted — no cancellation workflow exists.
 */

import type { DeliveryStepKey, Order, OrderStatus } from "@/lib/types/backend";

/** Conflict thrown by status helpers (mapped to ServiceError on the server). */
export class OrderStatusConflict extends Error {
  readonly code: string;
  readonly httpStatus = 409;

  constructor(message: string, code: string) {
    super(message);
    this.name = "OrderStatusConflict";
    this.code = code;
  }
}

/** Canonical stored / API status values (no En Route, no Cancelled). */
export const CANONICAL_ORDER_STATUSES = [
  "New",
  "Scheduled",
  "Assigned",
  "Picked Up",
  "Out for Delivery",
  "Delivered",
  "Failed",
  "Returned",
] as const satisfies readonly OrderStatus[];

export type CanonicalOrderStatus = (typeof CANONICAL_ORDER_STATUSES)[number];

/** Legacy / unwritten aliases accepted only on read and list filters. */
export const LEGACY_ORDER_STATUS_ALIASES = {
  "En Route": "Out for Delivery",
  "en route": "Out for Delivery",
  "enroute": "Out for Delivery",
  "out for delivery": "Out for Delivery",
  "picked up": "Picked Up",
  "out-for-delivery": "Out for Delivery",
} as const;

/**
 * Statuses included in Firestore `in` queries for active deliveries.
 * Includes legacy "En Route" so unmigrated rows remain counted.
 */
export const ACTIVE_DELIVERY_QUERY_STATUSES = [
  "Assigned",
  "Picked Up",
  "Out for Delivery",
  "En Route",
] as const;

/** Awaiting assignment (canonical). Scheduled kept for legacy rows only. */
export const AWAITING_ASSIGNMENT_ORDER_STATUSES = [
  "New",
  "Scheduled",
] as const satisfies readonly CanonicalOrderStatus[];

export const NEW_ORDER_STATUSES = ["New"] as const satisfies readonly CanonicalOrderStatus[];

/** Active delivery (canonical — after normalize, En Route is Out for Delivery). */
export const ACTIVE_DELIVERY_ORDER_STATUSES = [
  "Assigned",
  "Picked Up",
  "Out for Delivery",
] as const satisfies readonly CanonicalOrderStatus[];

/** Successful completion. */
export const COMPLETED_ORDER_STATUSES = [
  "Delivered",
] as const satisfies readonly CanonicalOrderStatus[];

/** Issue group. */
export const ISSUE_ORDER_STATUSES = ["Failed"] as const satisfies readonly CanonicalOrderStatus[];

/** Closed unsuccessful. */
export const CLOSED_UNSUCCESSFUL_ORDER_STATUSES = [
  "Returned",
] as const satisfies readonly CanonicalOrderStatus[];

export const TERMINAL_ORDER_STATUSES = [
  "Delivered",
  "Failed",
  "Returned",
] as const satisfies readonly CanonicalOrderStatus[];

/** @deprecated Use ACTIVE_DELIVERY_ORDER_STATUSES */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [...ACTIVE_DELIVERY_ORDER_STATUSES];

/** Progress ranks for lifecycle (higher = further along). Failed/Returned are side branches. */
const STATUS_PROGRESS_RANK: Record<CanonicalOrderStatus, number> = {
  New: 0,
  Scheduled: 1,
  Assigned: 2,
  "Picked Up": 3,
  "Out for Delivery": 4,
  Delivered: 5,
  Failed: 4,
  Returned: 5,
};

export const ORDER_STATUS_DISPLAY_LABELS: Record<CanonicalOrderStatus, string> = {
  New: "New",
  Scheduled: "Scheduled",
  Assigned: "Assigned",
  "Picked Up": "Picked Up",
  "Out for Delivery": "Out for Delivery",
  Delivered: "Delivered",
  Failed: "Failed",
  Returned: "Returned",
};

export const ORDER_STATUS_TIMELINE_TITLES: Record<CanonicalOrderStatus, string> = {
  New: "Order Created",
  Scheduled: "Scheduled",
  Assigned: "Assigned to Driver",
  "Picked Up": "Picked Up",
  "Out for Delivery": "Out for Delivery",
  Delivered: "Delivered",
  Failed: "Delivery Failed",
  Returned: "Returned",
};

/**
 * Explicit allowed transitions.
 * Assigned → Out for Delivery is a transitional compatibility edge when the
 * outForDelivery step is completed without a prior pickedUp status write.
 */
export const ORDER_STATUS_TRANSITIONS: Record<
  CanonicalOrderStatus,
  readonly CanonicalOrderStatus[]
> = {
  New: ["Assigned", "Scheduled", "Failed"],
  Scheduled: ["Assigned", "New", "Failed"],
  Assigned: ["Picked Up", "Out for Delivery", "New", "Failed"],
  "Picked Up": ["Out for Delivery", "Failed"],
  "Out for Delivery": ["Delivered", "Failed"],
  Failed: ["Assigned", "Returned"],
  Delivered: [],
  Returned: [],
};

export type OrderStatusActionType =
  | "status_transition"
  | "assignment"
  | "reassignment"
  | "unassign"
  | "retry";

export type DashboardStatusGroup =
  | "awaiting_assignment"
  | "active"
  | "completed"
  | "issues"
  | "closed_unsuccessful"
  | "other";

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isCanonicalOrderStatus(value: unknown): value is CanonicalOrderStatus {
  return (
    typeof value === "string" &&
    (CANONICAL_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Normalize raw status strings (aliases, casing, spacing) to canonical.
 * Returns null for unrecognized values (safe review — do not invent New/Delivered).
 */
export function tryNormalizeOrderStatus(raw: unknown): CanonicalOrderStatus | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = collapseWhitespace(raw);
  if (!trimmed) return null;

  if (isCanonicalOrderStatus(trimmed)) return trimmed;

  const alias =
    LEGACY_ORDER_STATUS_ALIASES[trimmed as keyof typeof LEGACY_ORDER_STATUS_ALIASES];
  if (alias) return alias;

  const lower = trimmed.toLowerCase();
  const lowerAlias =
    LEGACY_ORDER_STATUS_ALIASES[lower as keyof typeof LEGACY_ORDER_STATUS_ALIASES];
  if (lowerAlias) return lowerAlias;

  const titleCased = trimmed
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  if (isCanonicalOrderStatus(titleCased)) return titleCased;

  return null;
}

/**
 * Normalize for write paths. Unknown throws INVALID_ORDER_STATUS.
 * Missing/empty uses defaultOnMissing (create-path default New).
 */
export function normalizeOrderStatus(
  raw: unknown,
  options?: { defaultOnMissing?: CanonicalOrderStatus },
): CanonicalOrderStatus {
  if (raw == null || (typeof raw === "string" && !raw.trim())) {
    return options?.defaultOnMissing ?? "New";
  }
  const normalized = tryNormalizeOrderStatus(raw);
  if (normalized) return normalized;
  throw new OrderStatusConflict(
    "Order has an unrecognized status value",
    "INVALID_ORDER_STATUS",
  );
}

/**
 * Read-safe normalize: unknown statuses do not throw.
 *
 * When unrecognizedRaw is set, the companion `status` is a typed placeholder only —
 * never treat it as a trusted lifecycle state for assignment, transitions, or
 * dashboard/tab counts. Callers must check `orderNeedsStatusReview` /
 * `unrecognizedStatusRaw` before operational actions.
 */
export function normalizeOrderStatusForRead(raw: unknown): {
  status: CanonicalOrderStatus;
  unrecognizedRaw: string | null;
} {
  if (raw == null || (typeof raw === "string" && !raw.trim())) {
    return { status: "New", unrecognizedRaw: null };
  }
  const normalized = tryNormalizeOrderStatus(raw);
  if (normalized) return { status: normalized, unrecognizedRaw: null };
  const rawStr = typeof raw === "string" ? collapseWhitespace(raw) : String(raw);
  // Typed placeholder only — quarantine via unrecognizedRaw / orderNeedsStatusReview.
  return { status: "Scheduled", unrecognizedRaw: rawStr };
}

/** True when Firestore retained an unrecognized status that must not be actionable. */
export function orderNeedsStatusReview(
  order: Pick<Order, "unrecognizedStatusRaw"> | { unrecognizedStatusRaw?: string | null },
): boolean {
  return Boolean(order.unrecognizedStatusRaw);
}

/**
 * Dashboard / Orders-tab grouping that respects quarantine.
 * Prefer this over dashboardGroupForStatus when unrecognizedStatusRaw may be present.
 */
export function dashboardGroupForOrder(
  order: Pick<Order, "status" | "unrecognizedStatusRaw">,
): DashboardStatusGroup {
  if (orderNeedsStatusReview(order)) return "other";
  return dashboardGroupForStatus(order.status);
}

export function isTerminalOrderStatus(status: OrderStatus | string): boolean {
  const n = tryNormalizeOrderStatus(status);
  if (!n) return false;
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(n);
}

export function statusProgressRank(status: OrderStatus | string): number {
  const n = tryNormalizeOrderStatus(status);
  if (!n) return -1;
  return STATUS_PROGRESS_RANK[n];
}

export function canTransitionOrderStatus(
  from: OrderStatus | string,
  to: OrderStatus | string,
): boolean {
  const fromN = tryNormalizeOrderStatus(from);
  const toN = tryNormalizeOrderStatus(to);
  if (!fromN || !toN) return false;
  if (fromN === toN) return true;
  return ORDER_STATUS_TRANSITIONS[fromN].includes(toN);
}

export function assertOrderStatusTransition(
  from: OrderStatus | string,
  to: OrderStatus | string,
): { from: CanonicalOrderStatus; to: CanonicalOrderStatus } {
  const fromN = tryNormalizeOrderStatus(from);
  const toN = tryNormalizeOrderStatus(to);

  if (!fromN || !toN) {
    throw new OrderStatusConflict(
      "Invalid order status value",
      "INVALID_ORDER_STATUS",
    );
  }

  if (fromN === toN) {
    return { from: fromN, to: toN };
  }

  if (isTerminalOrderStatus(fromN) && fromN !== "Failed") {
    throw new OrderStatusConflict(
      "This order is in a terminal status and cannot be updated",
      "TERMINAL_ORDER",
    );
  }

  if (!ORDER_STATUS_TRANSITIONS[fromN].includes(toN)) {
    throw new OrderStatusConflict(
      `Cannot transition order from ${fromN} to ${toN}`,
      "INVALID_STATUS_TRANSITION",
    );
  }

  return { from: fromN, to: toN };
}

export function isNewOrderStatus(status: OrderStatus | string): boolean {
  return tryNormalizeOrderStatus(status) === "New";
}

export function isActiveDeliveryStatus(status: OrderStatus | string): boolean {
  const n = tryNormalizeOrderStatus(status);
  return n != null && (ACTIVE_DELIVERY_ORDER_STATUSES as readonly string[]).includes(n);
}

export function isAwaitingAssignment(
  order: Pick<Order, "status" | "assignedDriverId" | "unrecognizedStatusRaw">,
): boolean {
  if (orderNeedsStatusReview(order)) return false;
  if (order.assignedDriverId) return false;
  if (isTerminalOrderStatus(order.status)) return false;
  const n = tryNormalizeOrderStatus(order.status);
  return n != null && (AWAITING_ASSIGNMENT_ORDER_STATUSES as readonly string[]).includes(n);
}

export function dashboardGroupForStatus(status: OrderStatus | string): DashboardStatusGroup {
  const n = tryNormalizeOrderStatus(status);
  if (!n) return "other";
  if ((AWAITING_ASSIGNMENT_ORDER_STATUSES as readonly string[]).includes(n)) {
    return "awaiting_assignment";
  }
  if ((ACTIVE_DELIVERY_ORDER_STATUSES as readonly string[]).includes(n)) return "active";
  if ((COMPLETED_ORDER_STATUSES as readonly string[]).includes(n)) return "completed";
  if ((ISSUE_ORDER_STATUSES as readonly string[]).includes(n)) return "issues";
  if ((CLOSED_UNSUCCESSFUL_ORDER_STATUSES as readonly string[]).includes(n)) {
    return "closed_unsuccessful";
  }
  return "other";
}

/** Map delivery steps to the status they advance toward. */
export const STEP_TO_ORDER_STATUS: Partial<
  Record<DeliveryStepKey, CanonicalOrderStatus>
> = {
  pickedUp: "Picked Up",
  outForDelivery: "Out for Delivery",
};

/**
 * Resolve the intended next status from a client status update + optional step.
 * Does not enforce the graph — call assertOrderStatusTransition separately.
 */
export function resolveRequestedOrderStatus(
  currentStatus: OrderStatus | string,
  requestedStatus: OrderStatus | string,
  stepKey?: DeliveryStepKey,
): CanonicalOrderStatus {
  const current = tryNormalizeOrderStatus(currentStatus) ?? "New";
  const requested = tryNormalizeOrderStatus(requestedStatus);
  if (!requested) {
    throw new OrderStatusConflict(
      "Invalid order status value",
      "INVALID_ORDER_STATUS",
    );
  }

  if (stepKey) {
    const fromStep = STEP_TO_ORDER_STATUS[stepKey];
    if (fromStep) {
      if (
        requested === current ||
        statusProgressRank(fromStep) >= statusProgressRank(requested)
      ) {
        return fromStep;
      }
    }
  }

  return requested;
}

/** Statuses where operational reassignment may preserve progress. */
export function isPostPickupStatus(status: OrderStatus | string): boolean {
  const n = tryNormalizeOrderStatus(status);
  return n === "Picked Up" || n === "Out for Delivery";
}

/** Unassign (Assigned → New) only before pickup. */
export function canUnassignDriver(status: OrderStatus | string): boolean {
  return tryNormalizeOrderStatus(status) === "Assigned";
}

/**
 * Filter options for admin Orders UI — canonical only.
 * Scheduled included for legacy filterability; En Route removed (use Out for Delivery).
 */
export const ORDER_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: CanonicalOrderStatus | "";
  label: string;
}> = [
  { value: "", label: "All Statuses" },
  ...CANONICAL_ORDER_STATUSES.map((value) => ({
    value,
    label: ORDER_STATUS_DISPLAY_LABELS[value],
  })),
];
