import { nowIso, omitUndefined } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

export type AdminNotificationType = "new_order";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  read: boolean;
  source: string;
  externalOrderId?: string | null;
  dispatchOrderId?: string | null;
  link?: string | null;
  createdAt: string;
}

const COLLECTION = "adminNotifications";

/** Deterministic ID so re-running cron cannot duplicate a notification. */
export function barnetNewOrderNotificationId(externalOrderId: string): string {
  return `barnet_new_order_${externalOrderId}`;
}

export function dispatchOrderDetailLink(dispatchOrderId: string): string {
  return `/orders/${encodeURIComponent(dispatchOrderId)}`;
}

/**
 * Creates an unread admin notification when a new Barnet delivery is imported.
 * Idempotent on document ID — existing docs are left unchanged.
 */
export async function createBarnetNewOrderNotification(input: {
  externalOrderId: string;
  externalOrderNumber?: string | null;
  dispatchOrderId: string;
  source?: string;
}): Promise<{ created: boolean; notificationId: string }> {
  const db = getAdminFirestore();
  const notificationId = barnetNewOrderNotificationId(input.externalOrderId);
  const ref = db.collection(COLLECTION).doc(notificationId);
  const existing = await ref.get();
  if (existing.exists) {
    return { created: false, notificationId };
  }

  const orderLabel =
    input.externalOrderNumber?.trim() || input.externalOrderId;
  const createdAt = nowIso();
  const record = omitUndefined({
    type: "new_order" satisfies AdminNotificationType,
    title: "New delivery order received",
    message: `Barnet order #${orderLabel} was imported and is awaiting dispatch.`,
    read: false,
    source: input.source ?? "barnet_cron",
    externalOrderId: input.externalOrderId,
    dispatchOrderId: input.dispatchOrderId,
    link: dispatchOrderDetailLink(input.dispatchOrderId),
    createdAt,
  });

  await ref.create(record);
  return { created: true, notificationId };
}

function docToNotification(
  id: string,
  data: Record<string, unknown>,
): AdminNotification {
  return {
    id,
    type: (data.type as AdminNotificationType) ?? "new_order",
    title: typeof data.title === "string" ? data.title : "",
    message: typeof data.message === "string" ? data.message : "",
    read: data.read === true,
    source: typeof data.source === "string" ? data.source : "",
    externalOrderId:
      typeof data.externalOrderId === "string" ? data.externalOrderId : null,
    dispatchOrderId:
      typeof data.dispatchOrderId === "string" ? data.dispatchOrderId : null,
    link: typeof data.link === "string" ? data.link : null,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
  };
}

export async function listAdminNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
  const db = getAdminFirestore();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

  // Single-field orderBy avoids a composite index; filter unread in memory.
  const snap = await db
    .collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(options?.unreadOnly ? Math.min(limit * 3, 150) : limit)
    .get();

  let notifications = snap.docs.map((doc) =>
    docToNotification(doc.id, doc.data() as Record<string, unknown>),
  );
  if (options?.unreadOnly) {
    notifications = notifications.filter((n) => !n.read).slice(0, limit);
  } else {
    notifications = notifications.slice(0, limit);
  }

  const unreadSnap = await db
    .collection(COLLECTION)
    .where("read", "==", false)
    .select()
    .get();

  return {
    notifications,
    unreadCount: unreadSnap.size,
  };
}

export async function markAdminNotificationRead(
  id: string,
): Promise<AdminNotification | null> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  await ref.set(
    { read: true, readAt: nowIso() },
    { merge: true },
  );

  const updated = await ref.get();
  return docToNotification(updated.id, updated.data() as Record<string, unknown>);
}

export async function markAllAdminNotificationsRead(): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTION)
    .where("read", "==", false)
    .limit(200)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  const readAt = nowIso();
  for (const doc of snap.docs) {
    batch.set(doc.ref, { read: true, readAt }, { merge: true });
  }
  await batch.commit();
  return snap.size;
}

export const ADMIN_NOTIFICATIONS_COLLECTION = COLLECTION;
