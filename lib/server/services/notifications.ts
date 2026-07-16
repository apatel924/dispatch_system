import type { Order } from "@/lib/types/backend";
import { writeNotificationAudit } from "@/lib/server/notifications/audit";
import { getAppBaseUrl } from "@/lib/server/notifications/config";
import { normalizeNorthAmericanPhone } from "@/lib/server/notifications/phone";
import { createSmsProvider } from "@/lib/server/notifications/sms-provider";
import type {
  DriverAssignmentNotificationResult,
  NotificationAuditRecord,
  SmsFailureCategory,
  TrackingLinkNotificationResult,
  TrackingLinkNotificationType,
} from "@/lib/server/notifications/types";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { nowIso, omitUndefined } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { rotateTrackingLinkForOrder } from "@/lib/server/services/tracking-links";

export type { TrackingLinkNotificationResult, TrackingLinkNotificationType };
export type { DriverAssignmentNotificationResult };

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
  notificationType: TrackingLinkNotificationType | "status_update" | "driver_assignment";
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
 * Optional SMS to the newly assigned driver. Never throws; never includes
 * customer PII or tracking tokens. Idempotent when idempotencyKey is provided.
 */
export async function notifyDriverOrderAssigned(params: {
  orderId: string;
  driverId: string;
  driverPhone: string | null | undefined;
  idempotencyKey?: string;
}): Promise<DriverAssignmentNotificationResult> {
  const { orderId, driverId, driverPhone, idempotencyKey } = params;
  const db = getAdminFirestore();

  if (idempotencyKey) {
    const dedupeRef = db
      .collection(COLLECTIONS.notificationLogs)
      .doc(`driver_assign_${orderId}_${idempotencyKey}`);
    const existing = await dedupeRef.get();
    if (existing.exists) {
      const data = existing.data() as { success?: boolean } | undefined;
      if (data?.success) {
        return {
          requested: true,
          sent: true,
          reason: "already_sent",
          provider: typeof existing.data()?.provider === "string"
            ? (existing.data()!.provider as string)
            : undefined,
        };
      }
    }
  }

  const phone = normalizeNorthAmericanPhone(driverPhone);
  if (!phone.ok) {
    const attemptedAt = nowIso();
    await persistDriverAssignAudit({
      orderId,
      driverId,
      idempotencyKey,
      attemptedAt,
      provider: "none",
      success: false,
      failureCategory: "INVALID_PHONE",
      smsAttempted: false,
    });
    return {
      requested: true,
      sent: false,
      reason: "INVALID_PHONE",
    };
  }

  const portalHint = `${getAppBaseUrl()}/driver-login`;
  const body =
    `Quick Run Express: A delivery has been assigned to you. Order ${orderId}. ` +
    `Sign in to your driver portal to view the details: ${portalHint}`;

  const provider = createSmsProvider();
  const smsResult = await provider.sendSms({
    toE164: phone.e164,
    body,
  });

  const attemptedAt = nowIso();
  await persistDriverAssignAudit({
    orderId,
    driverId,
    idempotencyKey,
    attemptedAt,
    provider: smsResult.provider,
    success: smsResult.ok,
    messageSid: smsResult.messageSid,
    failureCategory: smsResult.failureCategory,
    smsAttempted: true,
  });

  logSafeNotification({
    orderId,
    notificationType: "driver_assignment",
    smsAttempted: true,
    smsSucceeded: smsResult.ok,
    provider: smsResult.provider,
    failureCategory: smsResult.failureCategory,
    providerErrorCode: smsResult.providerErrorCode,
  });

  if (smsResult.ok) {
    return {
      requested: true,
      sent: true,
      provider: smsResult.provider,
      messageSid: smsResult.messageSid,
    };
  }

  return {
    requested: true,
    sent: false,
    reason: smsResult.failureCategory ?? "PROVIDER_ERROR",
    provider: smsResult.provider,
  };
}

async function persistDriverAssignAudit(params: {
  orderId: string;
  driverId: string;
  idempotencyKey?: string;
  attemptedAt: string;
  provider: string;
  success: boolean;
  messageSid?: string;
  failureCategory?: SmsFailureCategory;
  smsAttempted: boolean;
}): Promise<void> {
  const record: NotificationAuditRecord = {
    orderId: params.orderId,
    notificationType: "driver_assignment",
    attemptedAt: params.attemptedAt,
    provider: params.provider,
    success: params.success,
    messageSid: params.messageSid,
    failureCategory: params.failureCategory,
    linkCreated: false,
    smsAttempted: params.smsAttempted,
    driverId: params.driverId,
    idempotencyKey: params.idempotencyKey,
  };

  if (params.idempotencyKey) {
    try {
      const db = getAdminFirestore();
      const ref = db
        .collection(COLLECTIONS.notificationLogs)
        .doc(`driver_assign_${params.orderId}_${params.idempotencyKey}`);
      await ref.set(
        omitUndefined({
          ...record,
          createdAt: nowIso(),
        }),
        { merge: true },
      );
      return;
    } catch (err) {
      logSafeNotification({
        orderId: params.orderId,
        notificationType: "driver_assignment",
        smsAttempted: params.smsAttempted,
        smsSucceeded: params.success,
        provider: params.provider,
        failureCategory: params.failureCategory,
        providerErrorCode: sanitizeProviderErrorCode(err),
      });
    }
  }

  await persistAudit(record);
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
