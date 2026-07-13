import type { Order } from "@/lib/types/backend";
import { writeNotificationAudit } from "@/lib/server/notifications/audit";
import { normalizeNorthAmericanPhone } from "@/lib/server/notifications/phone";
import { createSmsProvider } from "@/lib/server/notifications/sms-provider";
import type {
  NotificationAuditRecord,
  SmsFailureCategory,
  TrackingLinkNotificationResult,
  TrackingLinkNotificationType,
} from "@/lib/server/notifications/types";
import { rotateTrackingLinkForOrder } from "@/lib/server/services/tracking-links";
import { nowIso } from "@/lib/server/firestore/helpers";

export type { TrackingLinkNotificationResult, TrackingLinkNotificationType };

export type NotificationChannel = "sms" | "email";

export interface NotificationResult {
  ok: boolean;
  provider: string;
  channel: NotificationChannel;
  trackingLinkIncluded: boolean;
  providerErrorCode?: string;
}

interface SafeNotificationLog {
  orderId: string;
  notificationType: TrackingLinkNotificationType | "status_update";
  trackingLinkCreated?: boolean;
  smsAttempted: boolean;
  smsSucceeded: boolean;
  provider?: string;
  failureCategory?: SmsFailureCategory;
  providerErrorCode?: string;
}

function shouldAttemptSms(order: Order): { attempt: boolean; reason?: SmsFailureCategory } {
  const pref = order.notificationPreference ?? "sms";
  if (pref === "none") return { attempt: false, reason: "NOTIFICATION_DISABLED" };
  if (pref === "email") return { attempt: false, reason: "EMAIL_ONLY" };
  return { attempt: true };
}

function sanitizeProviderErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  return "PROVIDER_ERROR";
}

function logSafeNotification(payload: SafeNotificationLog): void {
  console.log("[notification]", payload);
}

async function persistAudit(record: NotificationAuditRecord): Promise<void> {
  try {
    await writeNotificationAudit(record);
  } catch (err) {
    logSafeNotification({
      orderId: record.orderId,
      notificationType: record.notificationType,
      trackingLinkCreated: record.linkCreated,
      smsAttempted: record.smsAttempted,
      smsSucceeded: record.success,
      provider: record.provider,
      failureCategory: record.failureCategory,
      providerErrorCode: sanitizeProviderErrorCode(err),
    });
  }
}

function successMessage(smsSent: boolean): string {
  return smsSent
    ? "New tracking link sent successfully."
    : "Tracking link created, but SMS could not be sent.";
}

/**
 * Rotate a secure tracking link and attempt customer SMS delivery.
 * Link generation always proceeds; SMS failure does not throw.
 */
export async function issueAndSendTrackingLink(
  order: Order,
  notificationType: TrackingLinkNotificationType,
): Promise<TrackingLinkNotificationResult> {
  const smsDecision = shouldAttemptSms(order);
  let linkCreated = false;
  let trackingUrl: string | undefined;
  let version: number | undefined;
  let expiresAt: string | undefined;

  try {
    const rotated = await rotateTrackingLinkForOrder(order.id);
    linkCreated = true;
    trackingUrl = rotated.trackingUrl;
    version = rotated.link.version;
    expiresAt = rotated.link.expiresAt;
  } catch (err) {
    const providerErrorCode = sanitizeProviderErrorCode(err);
    logSafeNotification({
      orderId: order.id,
      notificationType,
      trackingLinkCreated: false,
      smsAttempted: false,
      smsSucceeded: false,
      providerErrorCode,
    });

    return {
      linkCreated: false,
      smsAttempted: false,
      smsSent: false,
      message: "Failed to create tracking link.",
      failureCategory: "PROVIDER_ERROR",
    };
  }

  if (!smsDecision.attempt) {
    const attemptedAt = nowIso();
    await persistAudit({
      orderId: order.id,
      notificationType,
      attemptedAt,
      provider: "none",
      success: false,
      failureCategory: smsDecision.reason,
      linkCreated: true,
      smsAttempted: false,
    });

    logSafeNotification({
      orderId: order.id,
      notificationType,
      trackingLinkCreated: true,
      smsAttempted: false,
      smsSucceeded: false,
      failureCategory: smsDecision.reason,
    });

    return {
      linkCreated: true,
      smsAttempted: false,
      smsSent: false,
      copyUrl: trackingUrl,
      message: successMessage(false),
      version,
      expiresAt,
      failureCategory: smsDecision.reason,
    };
  }

  const phoneResult = normalizeNorthAmericanPhone(order.customerPhone);
  if (!phoneResult.ok) {
    const attemptedAt = nowIso();
    await persistAudit({
      orderId: order.id,
      notificationType,
      attemptedAt,
      provider: "none",
      success: false,
      failureCategory: "INVALID_PHONE",
      linkCreated: true,
      smsAttempted: false,
    });

    logSafeNotification({
      orderId: order.id,
      notificationType,
      trackingLinkCreated: true,
      smsAttempted: false,
      smsSucceeded: false,
      failureCategory: "INVALID_PHONE",
    });

    return {
      linkCreated: true,
      smsAttempted: false,
      smsSent: false,
      copyUrl: trackingUrl,
      message: "The secure link was created, but the customer phone number is invalid.",
      version,
      expiresAt,
      failureCategory: "INVALID_PHONE",
    };
  }

  const provider = createSmsProvider();
  const attemptedAt = nowIso();
  const smsResult = await provider.sendTrackingLink({
    orderId: order.id,
    trackingId: order.trackingId,
    customerName: order.customerName,
    phoneE164: phoneResult.e164,
    trackingUrl,
  });

  await persistAudit({
    orderId: order.id,
    notificationType,
    attemptedAt,
    provider: smsResult.provider,
    success: smsResult.ok,
    messageSid: smsResult.messageSid,
    failureCategory: smsResult.failureCategory,
    linkCreated: true,
    smsAttempted: true,
  });

  logSafeNotification({
    orderId: order.id,
    notificationType,
    trackingLinkCreated: true,
    smsAttempted: true,
    smsSucceeded: smsResult.ok,
    provider: smsResult.provider,
    failureCategory: smsResult.failureCategory,
    providerErrorCode: smsResult.providerErrorCode,
  });

  if (smsResult.ok) {
    return {
      linkCreated: true,
      smsAttempted: true,
      smsSent: true,
      message: successMessage(true),
      version,
      expiresAt,
      provider: smsResult.provider,
    };
  }

  return {
    linkCreated: true,
    smsAttempted: true,
    smsSent: false,
    copyUrl: trackingUrl,
    message: successMessage(false),
    version,
    expiresAt,
    provider: smsResult.provider,
    failureCategory: smsResult.failureCategory,
  };
}

/** Notify customer when a driver is assigned (rotate link + SMS). */
export async function notifyCustomerOrderAssigned(
  order: Order,
): Promise<TrackingLinkNotificationResult> {
  return issueAndSendTrackingLink(order, "order_assigned");
}

/**
 * Status updates do not include tracking URLs — plaintext tokens cannot be recovered later.
 */
export async function notifyCustomerStatusUpdate(
  order: Order,
  _status: Order["status"],
): Promise<NotificationResult> {
  const pref = order.notificationPreference ?? "sms";
  const channel: NotificationChannel = pref === "email" ? "email" : "sms";

  logSafeNotification({
    orderId: order.id,
    notificationType: "status_update",
    smsAttempted: channel === "sms",
    smsSucceeded: false,
  });

  return {
    ok: false,
    provider: "none",
    channel,
    trackingLinkIncluded: false,
  };
}
