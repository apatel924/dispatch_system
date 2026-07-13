import type {
  ConsumerTrackingStep,
  ConsumerTrackingStepStatus,
  DeliveryStepKey,
  Order,
  OrderStatus,
  OrderStatusEvent,
} from "@/lib/types/backend";

export type ConsumerStageKey =
  | "received"
  | "assigned"
  | "heading_pickup"
  | "picked_up"
  | "out_for_delivery"
  | "arriving"
  | "delivered";

interface ConsumerStageDefinition {
  key: ConsumerStageKey;
  label: string;
}

export const CONSUMER_STAGES: ConsumerStageDefinition[] = [
  { key: "received", label: "Order received" },
  { key: "assigned", label: "Driver assigned" },
  { key: "heading_pickup", label: "Driver heading to pickup" },
  { key: "picked_up", label: "Order picked up" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "arriving", label: "Driver arriving" },
  { key: "delivered", label: "Delivered" },
];

const STAGE_ORDER: ConsumerStageKey[] = CONSUMER_STAGES.map((stage) => stage.key);

export const CONSUMER_STATUS_HEADINGS: Record<OrderStatus, string> = {
  New: "Order received",
  Scheduled: "Scheduled for delivery",
  Assigned: "Driver assigned",
  "Picked Up": "Order picked up",
  "En Route": "Out for delivery",
  "Out for Delivery": "Out for delivery",
  Delivered: "Delivered",
  Failed: "Delivery unsuccessful",
  Returned: "Returned to sender",
};

function hasCompletedStep(order: Order, stepKey: DeliveryStepKey): boolean {
  return order.completedSteps.includes(stepKey);
}

function stageIndex(key: ConsumerStageKey): number {
  return STAGE_ORDER.indexOf(key);
}

function formatEventTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function eventTimeForStatus(
  events: OrderStatusEvent[],
  status: OrderStatus,
): string | undefined {
  const match = events.find((event) => event.status === status && !event.stepKey);
  return match ? formatEventTime(match.createdAt) : undefined;
}

function eventTimeForStep(
  events: OrderStatusEvent[],
  stepKey: DeliveryStepKey,
): string | undefined {
  const match = events.find((event) => event.stepKey === stepKey);
  return match ? formatEventTime(match.createdAt) : undefined;
}

/** Resolve the furthest consumer stage reached for an order. */
export function resolveConsumerStageKey(
  order: Order,
  _events: OrderStatusEvent[],
): ConsumerStageKey {
  if (order.status === "Delivered") return "delivered";
  if (order.status === "Failed" || order.status === "Returned") {
    if (hasCompletedStep(order, "arrivedDestination")) return "arriving";
    if (hasCompletedStep(order, "outForDelivery")) return "out_for_delivery";
    if (hasCompletedStep(order, "pickedUp")) return "picked_up";
    if (hasCompletedStep(order, "arrivedPickup")) return "heading_pickup";
    if (order.assignedDriverId) return "assigned";
    return "received";
  }

  if (hasCompletedStep(order, "arrivedDestination")) return "arriving";
  if (
    order.status === "Out for Delivery" ||
    order.status === "En Route" ||
    hasCompletedStep(order, "outForDelivery")
  ) {
    return "out_for_delivery";
  }
  if (order.status === "Picked Up" || hasCompletedStep(order, "pickedUp")) {
    return "picked_up";
  }
  if (hasCompletedStep(order, "arrivedPickup")) return "heading_pickup";
  if (order.assignedDriverId || order.status === "Assigned" || order.status === "Scheduled") {
    return order.assignedDriverId || order.status === "Assigned" ? "assigned" : "received";
  }
  return "received";
}

function stageTimestamp(
  stageKey: ConsumerStageKey,
  order: Order,
  events: OrderStatusEvent[],
): string | undefined {
  switch (stageKey) {
    case "received":
      return formatEventTime(order.createdAt);
    case "assigned":
      return order.assignedAt
        ? formatEventTime(order.assignedAt)
        : eventTimeForStatus(events, "Assigned");
    case "heading_pickup":
      return eventTimeForStep(events, "arrivedPickup");
    case "picked_up":
      return (
        eventTimeForStep(events, "pickedUp") ?? eventTimeForStatus(events, "Picked Up")
      );
    case "out_for_delivery":
      return (
        eventTimeForStep(events, "outForDelivery") ??
        eventTimeForStatus(events, "En Route") ??
        eventTimeForStatus(events, "Out for Delivery")
      );
    case "arriving":
      return eventTimeForStep(events, "arrivedDestination");
    case "delivered":
      return order.deliveredAt
        ? formatEventTime(order.deliveredAt)
        : eventTimeForStatus(events, "Delivered");
    default:
      return undefined;
  }
}

export function getConsumerStatusHeading(order: Order, events: OrderStatusEvent[]): string {
  if (order.status === "Failed") return "Delivery unsuccessful";
  if (order.status === "Returned") return "Returned to sender";
  if (order.status === "Delivered") return "Delivered";

  const stage = resolveConsumerStageKey(order, events);
  if (stage === "heading_pickup") return "Driver heading to pickup";
  if (stage === "arriving") return "Driver arriving";

  return CONSUMER_STATUS_HEADINGS[order.status] ?? order.status;
}

/**
 * Build consumer-visible steps — only stages up to the current progress point.
 * Does not show future stages that have not been reached.
 */
export function buildConsumerTrackingSteps(
  order: Order,
  events: OrderStatusEvent[],
): ConsumerTrackingStep[] {
  const currentKey = resolveConsumerStageKey(order, events);
  const currentIndex = stageIndex(currentKey);
  const isTerminalFailure = order.status === "Failed" || order.status === "Returned";
  const visibleStages = CONSUMER_STAGES.slice(0, currentIndex + 1);

  return visibleStages.map((stage, index) => {
    let status: ConsumerTrackingStepStatus = "pending";
    if (isTerminalFailure && index === currentIndex) {
      status = "failed";
    } else if (index < currentIndex) {
      status = "complete";
    } else if (index === currentIndex) {
      status = order.status === "Delivered" ? "complete" : "current";
    }

    const time = stageTimestamp(stage.key, order, events);

    return {
      key: stage.key,
      label: stage.label,
      time: status === "complete" || status === "current" || status === "failed" ? time : undefined,
      status,
    };
  });
}
