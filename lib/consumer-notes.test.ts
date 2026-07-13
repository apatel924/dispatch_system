import { describe, expect, it } from "vitest";
import type { ConsumerNote, OrderStatusEvent } from "@/lib/types/backend";
import {
  hasUnreadConsumerNotes,
  isConsumerNoteUnread,
  isOrderPastPickup,
  latestConsumerNote,
  notesAddedAfterPickup,
} from "@/lib/consumer-notes";

const baseNote = (overrides: Partial<ConsumerNote> = {}): ConsumerNote => ({
  id: "note-1",
  orderId: "QRX-1",
  source: "consumer",
  text: "Buzzer 402",
  createdAt: "2026-07-13T12:00:00.000Z",
  trackingLinkVersion: 1,
  ...overrides,
});

describe("consumer-notes helpers", () => {
  it("detects unread notes", () => {
    expect(isConsumerNoteUnread(baseNote())).toBe(true);
    expect(isConsumerNoteUnread(baseNote({ acknowledgedAt: "2026-07-13T13:00:00.000Z" }))).toBe(false);
    expect(hasUnreadConsumerNotes([baseNote(), baseNote({ id: "note-2", acknowledgedAt: "2026-07-13T13:00:00.000Z" })])).toBe(true);
  });

  it("returns latest note in chronological order", () => {
    const notes = [
      baseNote({ id: "a", createdAt: "2026-07-13T10:00:00.000Z" }),
      baseNote({ id: "b", createdAt: "2026-07-13T11:00:00.000Z" }),
    ];
    expect(latestConsumerNote(notes)?.id).toBe("b");
  });

  it("flags notes added after pickup", () => {
    const events: OrderStatusEvent[] = [
      {
        id: "e1",
        orderId: "QRX-1",
        status: "Picked Up",
        actorId: "driver-1",
        actorRole: "driver",
        createdAt: "2026-07-13T11:00:00.000Z",
      },
    ];
    const notes = [
      baseNote({ id: "before", createdAt: "2026-07-13T10:00:00.000Z" }),
      baseNote({ id: "after", createdAt: "2026-07-13T12:00:00.000Z" }),
    ];
    const afterPickup = notesAddedAfterPickup(notes, events);
    expect(afterPickup.map((n) => n.id)).toEqual(["after"]);
    expect(isOrderPastPickup("En Route")).toBe(true);
    expect(isOrderPastPickup("Assigned")).toBe(false);
  });
});
