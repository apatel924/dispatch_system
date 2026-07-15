/**
 * @deprecated Prefer `@/lib/order-status` — this module re-exports for compatibility.
 */
export {
  NEW_ORDER_STATUSES,
  ACTIVE_DELIVERY_ORDER_STATUSES,
  ACTIVE_DELIVERY_QUERY_STATUSES,
  AWAITING_ASSIGNMENT_ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  ACTIVE_ORDER_STATUSES,
  COMPLETED_ORDER_STATUSES,
  ISSUE_ORDER_STATUSES,
  CLOSED_UNSUCCESSFUL_ORDER_STATUSES,
  isTerminalOrderStatus,
  isNewOrderStatus,
  isActiveDeliveryStatus,
  isAwaitingAssignment,
  dashboardGroupForStatus,
  dashboardGroupForOrder,
  normalizeOrderStatus,
  tryNormalizeOrderStatus,
  normalizeOrderStatusForRead,
  canTransitionOrderStatus,
  assertOrderStatusTransition,
  statusProgressRank,
} from "@/lib/order-status";
