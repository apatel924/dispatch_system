"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsumerTrackingView, PublicConsumerNote } from "@/lib/types/backend";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  classifyTrackingError,
  fetchConsumerTracking,
  submitConsumerNote,
  type ConsumerTrackingErrorKind,
} from "@/lib/consumer/api/tracking-api";

export function useConsumerTracking(token: string) {
  const [tracking, setTracking] = useState<ConsumerTrackingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<ConsumerTrackingErrorKind>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const normalized = token.trim();
    if (!normalized) {
      setTracking(null);
      setErrorKind("invalid");
      setErrorMessage("This tracking link is not valid.");
      setLoading(false);
      return;
    }

    if (!isApiEnabled()) {
      setTracking(null);
      setErrorKind("unavailable");
      setErrorMessage("Tracking is temporarily unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorKind(null);
    setErrorMessage(null);
    try {
      const { tracking: apiTracking } = await fetchConsumerTracking(normalized);
      setTracking(apiTracking);
    } catch (err) {
      const classified = classifyTrackingError(err);
      setTracking(null);
      setErrorKind(classified.kind);
      setErrorMessage(classified.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { tracking, loading, errorKind, errorMessage, refresh: load };
}

export function useConsumerNoteSubmission(token: string) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmittedNote, setLastSubmittedNote] = useState<PublicConsumerNote | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = useCallback(
    async (text: string) => {
      if (submitting || submitted) return null;

      setSubmitting(true);
      setSubmitError(null);
      try {
        const { note } = await submitConsumerNote(token, text);
        setLastSubmittedNote(note);
        setSubmitted(true);
        return note;
      } catch (err) {
        const classified = classifyTrackingError(err);
        setSubmitError(classified.message);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [token, submitting, submitted],
  );

  return {
    submit,
    submitting,
    submitError,
    lastSubmittedNote,
    submitted,
  };
}
