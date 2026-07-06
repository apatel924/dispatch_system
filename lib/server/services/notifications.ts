import type { Order, OrderStatus } from "@/lib/types/backend";

export type NotificationChannel = "sms" | "email";

export interface NotificationResult {
  ok: boolean;
  provider: "dev-log";
  channel: NotificationChannel;
  messagePreview: string;
  trackingUrl: string;
}

function buildTrackingUrl(order: Order): string {
  if (order.trackingUrl) return order.trackingUrl;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/track/${order.trackingId}`;
}

function preferredChannel(order: Order): NotificationChannel {
  const pref = order.notificationPreference ?? "sms";
  if (pref === "email") return "email";
  return "sms";
}

function logNotification(payload: Record<string, unknown>) {
  console.log("[dev-log notification]", payload);
}

/**
 * Simulated customer notification when a driver is assigned.
 * Real Twilio/SMS integration is reserved for a future phase.
 */
export async function notifyCustomerOrderAssigned(
  order: Order,
): Promise<NotificationResult> {
  const channel = preferredChannel(order);
  const trackingUrl = buildTrackingUrl(order);
  const driverName = order.assignedDriverName ?? "your driver";
  const messagePreview =
    channel === "email"
      ? `Your delivery (${order.trackingId}) has been assigned to ${driverName}. Track your order: ${trackingUrl}`
      : `Quick-Run Express: Your delivery ${order.trackingId} is on the way with ${driverName}. Track: ${trackingUrl}`;

  logNotification({
    event: "order_assigned",
    orderId: order.id,
    trackingId: order.trackingId,
    channel,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    messagePreview,
    trackingUrl,
  });

  return {
    ok: true,
    provider: "dev-log",
    channel,
    messagePreview,
    trackingUrl,
  };
}

/**
 * Simulated customer notification on order status change.
 */
export async function notifyCustomerStatusUpdate(
  order: Order,
  status: OrderStatus,
): Promise<NotificationResult> {
  const channel = preferredChannel(order);
  const trackingUrl = buildTrackingUrl(order);
  const messagePreview =
    channel === "email"
      ? `Delivery update for ${order.trackingId}: status is now "${status}". ${trackingUrl}`
      : `Quick-Run Express: Order ${order.trackingId} — ${status}. Track: ${trackingUrl}`;

  logNotification({
    event: "status_update",
    orderId: order.id,
    trackingId: order.trackingId,
    status,
    channel,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    messagePreview,
    trackingUrl,
  });

  return {
    ok: true,
    provider: "dev-log",
    channel,
    messagePreview,
    trackingUrl,
  };
}
