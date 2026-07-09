import type { DeliveryStepKey, OrderStatus, OrderStatusEvent } from "@/lib/types/backend";

export const DELIVERY_STEP_LABELS: Record<DeliveryStepKey, string> = {
  arrivedPickup: "Arrived at Pickup",
  pickedUp: "Picked Up",
  outForDelivery: "Out for Delivery",
  arrivedDestination: "Arrived at Destination",
  verifyId: "ID Verified",
  signature: "Signature Captured",
  exteriorPhoto: "Exterior Photo Uploaded",
};

export const STATUS_TITLES: Record<OrderStatus, string> = {
  New: "Order Created",
  Assigned: "Assigned to Driver",
  "Picked Up": "Picked Up",
  "En Route": "En Route",
  "Out for Delivery": "Out for Delivery",
  Delivered: "Delivered",
  Failed: "Delivery Failed",
  Returned: "Returned",
  Scheduled: "Scheduled",
};

const STATUS_PROGRESSION: OrderStatus[] = [
  "New",
  "Scheduled",
  "Assigned",
  "Picked Up",
  "En Route",
  "Out for Delivery",
  "Delivered",
];

const TERMINAL_STATUSES: OrderStatus[] = ["Delivered", "Failed", "Returned"];

const STEP_TO_STATUS: Partial<Record<DeliveryStepKey, OrderStatus>> = {
  pickedUp: "Picked Up",
  outForDelivery: "Out for Delivery",
};

/** Top-to-bottom timeline order (matches driver delivery steps). */
const TIMELINE_POSITIONS: Array<
  { type: "status"; value: OrderStatus } | { type: "step"; value: DeliveryStepKey }
> = [
  { type: "status", value: "New" },
  { type: "status", value: "Scheduled" },
  { type: "status", value: "Assigned" },
  { type: "step", value: "arrivedPickup" },
  { type: "step", value: "pickedUp" },
  { type: "status", value: "Picked Up" },
  { type: "status", value: "En Route" },
  { type: "step", value: "outForDelivery" },
  { type: "status", value: "Out for Delivery" },
  { type: "step", value: "arrivedDestination" },
  { type: "step", value: "verifyId" },
  { type: "step", value: "signature" },
  { type: "step", value: "exteriorPhoto" },
  { type: "status", value: "Delivered" },
  { type: "status", value: "Failed" },
  { type: "status", value: "Returned" },
];

function timelineRankForEvent(
  event: Pick<OrderStatusEvent, "status" | "stepKey">,
): number {
  if (event.stepKey) {
    const idx = TIMELINE_POSITIONS.findIndex(
      (p) => p.type === "step" && p.value === event.stepKey,
    );
    if (idx >= 0) return idx;
  }
  const idx = TIMELINE_POSITIONS.findIndex(
    (p) => p.type === "status" && p.value === event.status,
  );
  return idx >= 0 ? idx : TIMELINE_POSITIONS.length;
}

/** Sort status events in workflow order (top to bottom), matching the driver view. */
export function compareStatusEventsForTimeline(
  a: OrderStatusEvent,
  b: OrderStatusEvent,
): number {
  const rankDiff = timelineRankForEvent(a) - timelineRankForEvent(b);
  if (rankDiff !== 0) return rankDiff;
  return a.createdAt.localeCompare(b.createdAt);
}

function statusRank(status: OrderStatus): number {
  const idx = STATUS_PROGRESSION.indexOf(status);
  return idx >= 0 ? idx : -1;
}

/** Derive the next order status after a driver step (never regress). */
export function resolveStatusAfterStep(
  currentStatus: OrderStatus,
  stepKey: DeliveryStepKey | undefined,
  requestedStatus: OrderStatus,
): OrderStatus {
  if (TERMINAL_STATUSES.includes(requestedStatus)) {
    return requestedStatus;
  }

  let next = currentStatus;

  if (stepKey) {
    const fromStep = STEP_TO_STATUS[stepKey];
    if (fromStep && statusRank(fromStep) > statusRank(next)) {
      next = fromStep;
    }
  }

  if (statusRank(requestedStatus) > statusRank(next)) {
    next = requestedStatus;
  }

  return next;
}

export function eventTitleForStatusEvent(
  event: Pick<OrderStatusEvent, "status" | "stepKey" | "note">,
): string {
  if (event.stepKey) {
    return DELIVERY_STEP_LABELS[event.stepKey];
  }
  return STATUS_TITLES[event.status] ?? event.status;
}

export function actorLabelForEvent(
  event: Pick<OrderStatusEvent, "actorId" | "actorRole">,
  driverName?: string | null,
): string {
  if (event.actorRole === "system") return "System";
  if (event.actorRole === "driver") return driverName ?? "Driver";
  if (event.actorRole === "admin") return "Admin";
  if (event.actorRole === "dispatcher") return "Dispatcher";
  return event.actorId;
}

/** Poll interval for live order detail / driver views (ms). */
export const ORDER_SYNC_POLL_MS = 5000;

/** Poll interval for admin list pages (dashboard, orders, drivers) (ms). */
export const LIST_SYNC_POLL_MS = 20_000;
