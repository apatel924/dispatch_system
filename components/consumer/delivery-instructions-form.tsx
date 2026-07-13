"use client";

import { useId, useState } from "react";
import type { PublicConsumerNote } from "@/lib/types/backend";
import {
  CONSUMER_NOTE_MAX_LENGTH,
  isConsumerNoteValid,
  sanitizeConsumerText,
} from "@/lib/consumer-text";

function formatNoteTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DeliveryInstructionsForm({
  disabled,
  submitting,
  submitted,
  submitError,
  onSubmit,
  existingNotes,
  lastSubmittedNote,
}: {
  disabled: boolean;
  submitting: boolean;
  submitted: boolean;
  submitError: string | null;
  onSubmit: (text: string) => Promise<PublicConsumerNote | null>;
  existingNotes: PublicConsumerNote[];
  lastSubmittedNote: PublicConsumerNote | null;
}) {
  const fieldId = useId();
  const counterId = useId();
  const feedbackId = useId();
  const [text, setText] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const sanitized = sanitizeConsumerText(text);
  const charCount = sanitized.length;
  const canSubmit =
    !disabled && !submitting && !submitted && isConsumerNoteValid(text);

  const allNotes = lastSubmittedNote
    ? [...existingNotes.filter((n) => n.id !== lastSubmittedNote.id), lastSubmittedNote]
    : existingNotes;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const note = await onSubmit(sanitized);
    if (note) {
      setConfirmation("Your delivery instructions were submitted.");
      setText("");
    }
  }

  if (disabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Delivery instructions can no longer be added for this order.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {allNotes.length > 0 ? (
        <div className="space-y-3" aria-label="Submitted delivery instructions">
          {allNotes.map((note) => (
            <article
              key={note.id}
              className="rounded-xl border border-border/70 bg-muted/30 p-3"
            >
              <p className="text-sm whitespace-pre-wrap break-words">{note.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                You · {formatNoteTime(note.createdAt)}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {submitted ? (
        <div
          className="rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success"
          role="status"
          aria-live="polite"
        >
          {confirmation ?? "Your delivery instructions were submitted."}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div>
            <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
              Delivery instructions
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Buzzer number, entrance details, unit clarification, PO/reference, parking or
              access notes.
            </p>
            <textarea
              id={fieldId}
              name="deliveryInstructions"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={CONSUMER_NOTE_MAX_LENGTH}
              disabled={submitting || submitted}
              aria-describedby={`${counterId} ${feedbackId}`}
              placeholder="Example: Buzzer 402 · use side entrance · safe to leave with concierge"
              className="w-full min-h-[6rem] resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <p id={counterId} className="text-xs text-muted-foreground" aria-live="polite">
                {charCount} / {CONSUMER_NOTE_MAX_LENGTH}
              </p>
            </div>
          </div>

          <div id={feedbackId} role="alert" aria-live="assertive">
            {submitError ? (
              <p className="text-sm text-destructive">{submitError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Submit instructions"}
          </button>
        </form>
      )}
    </div>
  );
}
