import type { ConsumerNote, OrderStatus, OrderStatusEvent } from "@/lib/types/backend";

const POST_PICKUP_STATUSES = new Set<OrderStatus>([
  "Picked Up",
  "En Route",
  "Out for Delivery",
]);

export function isConsumerNoteUnread(note: ConsumerNote): boolean {
  return !note.acknowledgedAt;
}

export function latestConsumerNote(notes: ConsumerNote[]): ConsumerNote | null {
  if (notes.length === 0) return null;
  return notes[notes.length - 1] ?? null;
}

export function hasUnreadConsumerNotes(notes: ConsumerNote[]): boolean {
  return notes.some(isConsumerNoteUnread);
}

export function pickupTimestamp(events: OrderStatusEvent[]): string | null {
  const pickedUp = events.find((e) => e.status === "Picked Up");
  return pickedUp?.createdAt ?? null;
}

export function isOrderPastPickup(status: OrderStatus): boolean {
  return POST_PICKUP_STATUSES.has(status);
}

/** Consumer notes submitted after pickup that remain unacknowledged. */
export function notesAddedAfterPickup(
  notes: ConsumerNote[],
  events: OrderStatusEvent[],
): ConsumerNote[] {
  const pickedUpAt = pickupTimestamp(events);
  if (!pickedUpAt) return [];

  const cutoff = new Date(pickedUpAt).getTime();
  return notes.filter(
    (n) => isConsumerNoteUnread(n) && new Date(n.createdAt).getTime() > cutoff,
  );
}

export function formatConsumerNoteTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export const CONSUMER_NOTE_SOURCE_LABEL = "Consumer";

/** Status-event notes authored by drivers (separate from internal admin notes). */
export function driverNotesFromEvents(events: OrderStatusEvent[]): OrderStatusEvent[] {
  return events.filter((e) => e.actorRole === "driver" && e.note?.trim());
}
