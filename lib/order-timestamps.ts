import type { Order } from "@/lib/types/backend";

/**
 * Centralized reporting timestamps for orders.
 *
 * Immutable status-entered fields (deliveredAt, failedAt, pickedUpAt, returnedAt)
 * are preferred. Legacy orders without them use documented fallbacks so unrelated
 * post-terminal edits do not move an order into a different reporting day.
 */

/** When an order first reached Delivered; legacy fallback: updatedAt. */
export function orderDeliveredAt(order: Order): string | undefined {
  if (order.status !== "Delivered") return undefined;
  return order.deliveredAt ?? order.updatedAt;
}

/** When an order first reached Failed; legacy fallback: updatedAt. */
export function orderFailedAt(order: Order): string | undefined {
  if (order.status !== "Failed") return undefined;
  return order.failedAt ?? order.updatedAt;
}

/** When an order first reached Returned; legacy fallback: updatedAt. */
export function orderReturnedAt(order: Order): string | undefined {
  if (order.status !== "Returned") return undefined;
  return order.returnedAt ?? order.updatedAt;
}

/** When an order was picked up (no legacy fallback — status events may be used elsewhere). */
export function orderPickedUpAt(order: Order): string | undefined {
  return order.pickedUpAt;
}

export type OrderReportingEvent = "delivered" | "failed" | "returned";

export function orderReportingTimestamp(
  order: Order,
  event: OrderReportingEvent,
): string | undefined {
  switch (event) {
    case "delivered":
      return orderDeliveredAt(order);
    case "failed":
      return orderFailedAt(order);
    case "returned":
      return orderReturnedAt(order);
  }
}

/** True when the order relies on updatedAt because a dedicated field is missing. */
export function orderUsesLegacyReportingTimestamp(order: Order): boolean {
  if (order.status === "Delivered" && !order.deliveredAt) return true;
  if (order.status === "Failed" && !order.failedAt) return true;
  if (order.status === "Returned" && !order.returnedAt) return true;
  return false;
}
