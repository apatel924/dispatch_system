import type { Order, OrderStatus } from "@/lib/types/backend";

/**
 * Shared operational order status groups for dashboard counts and driver metrics.
 *
 * Note: "Arrived at Pickup" and "Arrived at Destination" are delivery steps
 * (completedSteps), not stored OrderStatus values. In-progress delivery is
 * represented by the ACTIVE_DELIVERY_ORDER_STATUSES below.
 */

/** Newly imported or created orders that have not entered dispatch processing. */
export const NEW_ORDER_STATUSES = ["New"] as const satisfies readonly OrderStatus[];

/** Orders in active delivery workflow (assigned through out-for-delivery). */
export const ACTIVE_DELIVERY_ORDER_STATUSES = [
  "Assigned",
  "Picked Up",
  "En Route",
  "Out for Delivery",
] as const satisfies readonly OrderStatus[];

/** Non-terminal statuses that may still need a driver assignment. */
export const AWAITING_ASSIGNMENT_ORDER_STATUSES = [
  "New",
  "Scheduled",
] as const satisfies readonly OrderStatus[];

/** Terminal outcomes — no further dispatch action. */
export const TERMINAL_ORDER_STATUSES = [
  "Delivered",
  "Failed",
  "Returned",
] as const satisfies readonly OrderStatus[];

/** @deprecated Use ACTIVE_DELIVERY_ORDER_STATUSES — kept for existing imports. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [...ACTIVE_DELIVERY_ORDER_STATUSES];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isNewOrderStatus(status: OrderStatus): boolean {
  return (NEW_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isActiveDeliveryStatus(status: OrderStatus): boolean {
  return (ACTIVE_DELIVERY_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

/** Orders requiring delivery with no assigned driver; excludes terminal orders. */
export function isAwaitingAssignment(
  order: Pick<Order, "status" | "assignedDriverId">,
): boolean {
  if (order.assignedDriverId) return false;
  if (isTerminalOrderStatus(order.status)) return false;
  return (AWAITING_ASSIGNMENT_ORDER_STATUSES as readonly OrderStatus[]).includes(
    order.status,
  );
}
