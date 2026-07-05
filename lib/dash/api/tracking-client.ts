import type { TrackingView } from "@/lib/types/backend";
import { DEMO_TRACKING_CODE, demoDelivery } from "@/data/trackingDemo";

export class TrackingApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TrackingApiError";
    this.status = status;
  }
}

export async function fetchTracking(
  trackingId: string,
): Promise<{ tracking: TrackingView }> {
  const res = await fetch(`/api/tracking/${encodeURIComponent(trackingId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.error === "string" ? body.error : res.statusText || "Tracking not found";
    throw new TrackingApiError(message, res.status);
  }
  return res.json() as Promise<{ tracking: TrackingView }>;
}

export function isDemoTrackingCode(trackingId: string): boolean {
  return trackingId.trim().toUpperCase() === DEMO_TRACKING_CODE;
}

export function getDemoTrackingView(): TrackingView {
  return {
    trackingId: demoDelivery.code,
    status: "En Route",
    statusLabel: demoDelivery.status,
    estimatedArrival: demoDelivery.estimatedArrival,
    deliveryType: demoDelivery.deliveryType,
    driverFirstName: demoDelivery.driverFirstName,
    pickupName: "Northside Pharmacy",
    pickupAddress: "4567 Medical Dr, Dallas, TX 75231",
    steps: demoDelivery.steps.map((s) => ({
      label: s.label,
      time: s.time,
      status: s.status,
    })),
    notifications: demoDelivery.notifications,
    lastUpdatedAt: new Date().toISOString(),
  };
}
