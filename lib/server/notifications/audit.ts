import type { NotificationAuditRecord } from "@/lib/server/notifications/types";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { nowIso, omitUndefined } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

export async function writeNotificationAudit(
  record: NotificationAuditRecord,
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.notificationLogs).doc();

  await ref.set(
    omitUndefined({
      orderId: record.orderId,
      notificationType: record.notificationType,
      attemptedAt: record.attemptedAt,
      provider: record.provider,
      success: record.success,
      messageSid: record.messageSid,
      failureCategory: record.failureCategory,
      linkCreated: record.linkCreated,
      smsAttempted: record.smsAttempted,
      driverId: record.driverId,
      idempotencyKey: record.idempotencyKey,
      createdAt: nowIso(),
    }),
  );
}
