import type { Order, OrderStatus, OrderStatusEvent, TrackingView } from "@/lib/types/backend";
import { getOrderByTrackingId, getStatusEvents } from "@/lib/server/services/orders";
import { getDriverById } from "@/lib/server/services/drivers";

const STATUS_LABELS: Record<OrderStatus, string> = {
  New: "Order received",
  Assigned: "Driver assigned",
  "Picked Up": "Picked up",
  "En Route": "In transit",
  "Out for Delivery": "Out for delivery",
  Delivered: "Delivered",
  Failed: "Delivery failed",
  Returned: "Returned",
  Scheduled: "Scheduled",
};

const TIMELINE_STATUSES: OrderStatus[] = [
  "New",
  "Assigned",
  "Picked Up",
  "En Route",
  "Out for Delivery",
  "Delivered",
];

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

function buildSteps(
  order: Order,
  events: OrderStatusEvent[],
): TrackingView["steps"] {
  const eventByStatus = new Map<OrderStatus, OrderStatusEvent>();
  for (const event of events) eventByStatus.set(event.status, event);

  const currentIndex = TIMELINE_STATUSES.indexOf(order.status);
  const effectiveCurrent = currentIndex >= 0 ? currentIndex : 0;

  return TIMELINE_STATUSES.map((status, index) => {
    const event = eventByStatus.get(status);
    let stepStatus: "complete" | "current" | "pending" = "pending";

    if (index < effectiveCurrent) stepStatus = "complete";
    else if (index === effectiveCurrent) stepStatus = "current";
    else if (order.status === "Delivered" && status === "Delivered") stepStatus = "complete";

    return {
      label: STATUS_LABELS[status],
      time: event ? formatEventTime(event.createdAt) : undefined,
      status: stepStatus,
    };
  });
}

function buildNotifications(events: OrderStatusEvent[]): TrackingView["notifications"] {
  return events.slice(-6).map((event) => ({
    title: STATUS_LABELS[event.status] ?? event.status,
    time: formatEventTime(event.createdAt),
  }));
}

export async function getTrackingByTrackingId(trackingId: string): Promise<TrackingView> {
  const order = await getOrderByTrackingId(trackingId);
  const events = await getStatusEvents(order.id);

  let driverFirstName: string | undefined;
  let vehicleDescription: string | undefined;

  if (order.assignedDriverId) {
    try {
      const driver = await getDriverById(order.assignedDriverId);
      driverFirstName = driver.name.split(/\s+/)[0];
      vehicleDescription = driver.vehicle;
    } catch {
      driverFirstName = "Your assigned driver";
    }
  }

  return {
    trackingId: order.trackingId,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] ?? order.status,
    estimatedArrival: order.eta ?? order.deliveryWindow,
    deliveryType: order.deliveryArea ? `Express — ${order.deliveryArea}` : "Express delivery",
    driverFirstName,
    vehicleDescription,
    pickupName: order.pickupName,
    pickupAddress: order.pickupAddress,
    steps: buildSteps(order, events),
    notifications: buildNotifications(events),
    lastUpdatedAt: order.updatedAt,
  };
}

export function buildTrackingViewFromOrder(
  order: Order,
  events: OrderStatusEvent[],
): TrackingView {
  return {
    trackingId: order.trackingId,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] ?? order.status,
    estimatedArrival: order.eta ?? order.deliveryWindow,
    deliveryType: order.deliveryArea ? `Express — ${order.deliveryArea}` : "Express delivery",
    driverFirstName: order.assignedDriverName?.split(/\s+/)[0],
    pickupName: order.pickupName,
    pickupAddress: order.pickupAddress,
    steps: buildSteps(order, events),
    notifications: buildNotifications(events),
    lastUpdatedAt: order.updatedAt,
  };
}
