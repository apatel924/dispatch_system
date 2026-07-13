import type {
  ConsumerNote,
  ConsumerTerminalState,
  ConsumerTrackingView,
  Order,
  PublicConsumerNote,
} from "@/lib/types/backend";
import { siteConfig } from "@/lib/site";
import {
  buildConsumerTrackingSteps,
  getConsumerStatusHeading,
} from "@/lib/consumer-tracking-status";
import { formatConsumerDeliveryDestination } from "@/lib/consumer-text";
import { orderConsumerNotesCollection } from "@/lib/server/firestore/collections";
import {
  docToConsumerNote,
  nowIso,
  omitUndefined,
} from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { notFoundError, trackingInvalidError } from "@/lib/server/errors";
import { getOrderById, getStatusEvents } from "@/lib/server/services/orders";
import {
  assertNotesAllowedForLink,
  enforceTrackingNotesRateLimit,
  resolveTrackingLink,
} from "@/lib/server/services/tracking-links";
import type { TrackingLink } from "@/lib/types/backend";

const TERMINAL_STATUSES = new Set(["Delivered", "Failed", "Returned"]);

export function toPublicConsumerNote(note: ConsumerNote): PublicConsumerNote {
  return {
    id: note.id,
    source: note.source,
    text: note.text,
    createdAt: note.createdAt,
  };
}

function terminalStateForOrder(order: Order): ConsumerTerminalState | undefined {
  if (order.status === "Delivered") return "delivered";
  if (order.status === "Failed") return "failed";
  if (order.status === "Returned") return "cancelled";
  return undefined;
}

function notesEnabledForOrder(order: Order, link: TrackingLink): boolean {
  if (link.revokedAt || link.replacedByVersion !== undefined) return false;
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) return false;
  if (order.status === "Failed" || order.status === "Returned") return false;

  const terminalHours = Number.parseInt(process.env.TRACKING_NOTE_TERMINAL_HOURS ?? "72", 10);
  if (order.deliveredAt && Number.isFinite(terminalHours) && terminalHours > 0) {
    const deliveredAt = new Date(order.deliveredAt).getTime();
    const cutoff = deliveredAt + terminalHours * 60 * 60 * 1000;
    if (Date.now() > cutoff) return false;
  }

  return true;
}

export async function getConsumerNotes(orderId: string): Promise<ConsumerNote[]> {
  const db = getAdminFirestore();
  const snap = await orderConsumerNotesCollection(db, orderId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((doc) => docToConsumerNote(doc.id, doc.data()));
}

export function buildConsumerTrackingView(
  order: Order,
  link: TrackingLink,
  events: Awaited<ReturnType<typeof getStatusEvents>>,
  consumerNotes: ConsumerNote[],
): ConsumerTrackingView {
  const steps = buildConsumerTrackingSteps(order, events);

  return {
    publicReference: link.publicReference,
    status: order.status,
    statusHeading: getConsumerStatusHeading(order, events),
    estimatedArrival: order.eta?.trim() || undefined,
    lastUpdatedAt: order.updatedAt,
    pickupName: order.pickupName?.trim() || undefined,
    deliveryDestination: formatConsumerDeliveryDestination(order),
    deliveryInstructions: order.deliveryInstructions?.trim() || undefined,
    steps,
    consumerNotes: consumerNotes.map(toPublicConsumerNote),
    notesEnabled: notesEnabledForOrder(order, link),
    supportPhone: siteConfig.phone,
    supportEmail: siteConfig.email,
    supportHours: siteConfig.hoursShort,
    terminalState: terminalStateForOrder(order),
  };
}

export async function getConsumerTrackingByToken(token: string): Promise<ConsumerTrackingView> {
  const { link } = await resolveTrackingLink(token);
  const order = await getOrderById(link.orderId);
  const [events, consumerNotes] = await Promise.all([
    getStatusEvents(order.id),
    getConsumerNotes(order.id),
  ]);

  return buildConsumerTrackingView(order, link, events, consumerNotes);
}

export async function addConsumerNoteByToken(
  token: string,
  text: string,
  clientIp: string,
): Promise<PublicConsumerNote> {
  await enforceTrackingNotesRateLimit(token, clientIp);

  const { link } = await resolveTrackingLink(token);
  const order = await getOrderById(link.orderId);
  assertNotesAllowedForLink(link, order.deliveredAt);

  if (TERMINAL_STATUSES.has(order.status) && order.status !== "Delivered") {
    throw trackingInvalidError("Delivery instructions cannot be added for this order.");
  }

  const db = getAdminFirestore();
  const ref = orderConsumerNotesCollection(db, order.id).doc();
  const createdAt = nowIso();

  const note: Omit<ConsumerNote, "id"> = {
    orderId: order.id,
    source: "consumer",
    text,
    createdAt,
    trackingLinkVersion: link.version,
  };

  await ref.set(omitUndefined(note));
  return toPublicConsumerNote({ id: ref.id, ...note });
}

export async function acknowledgeConsumerNote(
  orderId: string,
  noteId: string,
  actorUid: string,
): Promise<ConsumerNote> {
  const db = getAdminFirestore();
  const ref = orderConsumerNotesCollection(db, orderId).doc(noteId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw notFoundError("Consumer note", noteId);
  }

  const existing = docToConsumerNote(snap.id, snap.data()!);
  if (existing.acknowledgedAt) {
    return existing;
  }

  const acknowledgedAt = nowIso();
  await ref.update({ acknowledgedAt, acknowledgedByUid: actorUid });
  return { ...existing, acknowledgedAt, acknowledgedByUid: actorUid };
}
