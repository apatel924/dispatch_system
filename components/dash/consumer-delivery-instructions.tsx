"use client";

import { MessageSquareText, Eye } from "lucide-react";
import type { ConsumerNote } from "@/lib/types/backend";
import {
  CONSUMER_NOTE_SOURCE_LABEL,
  formatConsumerNoteTimestamp,
  isConsumerNoteUnread,
  latestConsumerNote,
} from "@/lib/consumer-notes";

export interface ConsumerDeliveryInstructionsProps {
  notes: ConsumerNote[];
  variant?: "admin" | "driver";
  onAcknowledge?: (noteId: string) => void | Promise<void>;
  acknowledgingId?: string | null;
  showEmpty?: boolean;
}

export function ConsumerDeliveryInstructions({
  notes,
  variant = "admin",
  onAcknowledge,
  acknowledgingId,
  showEmpty = true,
}: ConsumerDeliveryInstructionsProps) {
  if (notes.length === 0) {
    if (!showEmpty) return null;
    return (
      <p className="text-sm text-muted-foreground">
        No consumer delivery instructions submitted yet.
      </p>
    );
  }

  const latest = latestConsumerNote(notes);
  const isDriver = variant === "driver";

  return (
    <ol className={isDriver ? "space-y-3" : "space-y-4"}>
      {notes.map((note) => {
        const unread = isConsumerNoteUnread(note);
        const isLatest = latest?.id === note.id;
        const canAcknowledge = unread && isLatest && onAcknowledge;

        return (
          <li
            key={note.id}
            className={
              isDriver
                ? `rounded-xl border p-4 ${
                    unread
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-secondary/30"
                  }`
                : `rounded-lg border p-3 ${
                    unread ? "border-primary/30 bg-primary/5" : "border-border"
                  }`
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                <span>Source: {CONSUMER_NOTE_SOURCE_LABEL}</span>
                {unread && (
                  <span
                    className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground"
                    aria-label="New instruction"
                  >
                    New
                  </span>
                )}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={note.createdAt}>
                {formatConsumerNoteTimestamp(note.createdAt)}
              </time>
            </div>
            <p className={`mt-2 whitespace-pre-wrap ${isDriver ? "text-base leading-relaxed" : "text-sm"}`}>
              {note.text}
            </p>
            {note.acknowledgedAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Seen {formatConsumerNoteTimestamp(note.acknowledgedAt)}
              </p>
            )}
            {canAcknowledge && (
              <button
                type="button"
                disabled={acknowledgingId === note.id}
                onClick={() => void onAcknowledge(note.id)}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50 ${
                  isDriver ? "min-h-10 text-sm" : ""
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {acknowledgingId === note.id ? "Marking…" : "Mark as seen"}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
