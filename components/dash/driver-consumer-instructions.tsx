"use client";

import { AlertTriangle, MessageSquare } from "lucide-react";
import type { ConsumerNote, OrderStatus, OrderStatusEvent } from "@/lib/types/backend";
import { isOrderPastPickup, notesAddedAfterPickup } from "@/lib/consumer-notes";
import { ConsumerDeliveryInstructions } from "@/components/dash/consumer-delivery-instructions";

export interface DriverConsumerInstructionsSectionProps {
  notes: ConsumerNote[];
  status: OrderStatus;
  statusEvents: OrderStatusEvent[];
  onAcknowledge?: (noteId: string) => void | Promise<void>;
  acknowledgingId?: string | null;
}

export function DriverConsumerInstructionsSection({
  notes,
  status,
  statusEvents,
  onAcknowledge,
  acknowledgingId,
}: DriverConsumerInstructionsSectionProps) {
  if (notes.length === 0) return null;

  const afterPickupNotes = notesAddedAfterPickup(notes, statusEvents);
  const showLateNotice = isOrderPastPickup(status) && afterPickupNotes.length > 0;

  return (
    <section className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold">Consumer Delivery Instructions</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Customer-submitted access details (buzzer, entrance, etc.)
      </p>

      {showLateNotice && (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-orange/30 bg-orange-soft/60 p-3 text-sm"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
          <p>
            <span className="font-semibold">Instructions updated after pickup.</span>{" "}
            Review the new note{afterPickupNotes.length > 1 ? "s" : ""} before completing delivery.
          </p>
        </div>
      )}

      <div className="mt-3">
        <ConsumerDeliveryInstructions
          notes={notes}
          variant="driver"
          onAcknowledge={onAcknowledge}
          acknowledgingId={acknowledgingId}
          showEmpty={false}
        />
      </div>
    </section>
  );
}
