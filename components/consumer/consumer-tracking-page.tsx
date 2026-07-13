"use client";

import { RefreshCw } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { DeliveryInstructionsForm } from "@/components/consumer/delivery-instructions-form";
import { TrackingProgress } from "@/components/consumer/tracking-progress";
import { CONSUMER_TRACKING_LAYOUT } from "@/lib/consumer/layout";
import {
  useConsumerNoteSubmission,
  useConsumerTracking,
} from "@/lib/consumer/hooks/use-consumer-tracking";
import { siteConfig } from "@/lib/site";
import type { ConsumerTrackingErrorKind } from "@/lib/consumer/api/tracking-api";

function formatLastUpdated(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function TrackingErrorState({
  kind,
  message,
  onRetry,
}: {
  kind: ConsumerTrackingErrorKind;
  message: string;
  onRetry?: () => void;
}) {
  const titles: Record<Exclude<ConsumerTrackingErrorKind, null | "loading">, string> = {
    invalid: "Link not found",
    expired: "Link expired",
    revoked: "Link no longer active",
    unavailable: "Delivery unavailable",
    network: "Connection problem",
  };

  const title = kind && kind !== "loading" ? titles[kind] : "Unable to load tracking";

  return (
    <div className={CONSUMER_TRACKING_LAYOUT.container}>
      <div className="flex justify-center">
        <Logo className="h-10" priority />
      </div>
      <div className={`mt-8 ${CONSUMER_TRACKING_LAYOUT.card} text-center`} role="alert">
        <h1 className={CONSUMER_TRACKING_LAYOUT.heading}>{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {kind === "network" && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/30 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        ) : null}
        <p className="mt-6 text-xs text-muted-foreground">
          Need help? Call{" "}
          <a className="font-medium text-primary underline-offset-2 hover:underline" href={`tel:${siteConfig.phoneHref}`}>
            {siteConfig.phone}
          </a>{" "}
          or email{" "}
          <a className="font-medium text-primary underline-offset-2 hover:underline" href={`mailto:${siteConfig.email}`}>
            {siteConfig.email}
          </a>
        </p>
      </div>
    </div>
  );
}

function TrackingLoadingState() {
  return (
    <div className={`${CONSUMER_TRACKING_LAYOUT.page} flex items-center justify-center p-4`}>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        Loading your delivery status…
      </p>
    </div>
  );
}

export function ConsumerTrackingPage({ token }: { token: string }) {
  const { tracking, loading, errorKind, errorMessage, refresh } = useConsumerTracking(token);
  const noteSubmission = useConsumerNoteSubmission(token);

  if (loading && !tracking) {
    return <TrackingLoadingState />;
  }

  if (!tracking) {
    return (
      <div className={CONSUMER_TRACKING_LAYOUT.page}>
        <TrackingErrorState
          kind={errorKind ?? "invalid"}
          message={errorMessage ?? "This tracking link is not valid."}
          onRetry={errorKind === "network" ? refresh : undefined}
        />
      </div>
    );
  }

  const isDelivered = tracking.terminalState === "delivered";
  const isFailed =
    tracking.terminalState === "failed" || tracking.terminalState === "cancelled";

  return (
    <div className={CONSUMER_TRACKING_LAYOUT.page}>
      <div className={CONSUMER_TRACKING_LAYOUT.container}>
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-10" priority />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Quick Run Express
          </p>
        </header>

        <section className={`mt-6 ${CONSUMER_TRACKING_LAYOUT.card}`} aria-labelledby="status-heading">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Order reference</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-tight">
            {tracking.publicReference.toUpperCase()}
          </p>

          <h1 id="status-heading" className={`mt-4 ${CONSUMER_TRACKING_LAYOUT.heading}`}>
            {tracking.statusHeading}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            Last updated {formatLastUpdated(tracking.lastUpdatedAt)}
          </p>

          {tracking.estimatedArrival ? (
            <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-3 text-left">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Estimated arrival
              </p>
              <p className="mt-1 text-sm font-semibold">{tracking.estimatedArrival}</p>
            </div>
          ) : null}

          {isDelivered ? (
            <p
              className="mt-4 rounded-xl bg-success-soft px-3 py-2 text-sm font-medium text-success"
              role="status"
            >
              Your order has been delivered. Thank you for choosing Quick Run Express.
            </p>
          ) : null}

          {isFailed ? (
            <p
              className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
              role="alert"
            >
              {tracking.terminalState === "cancelled"
                ? "This delivery was returned. Please contact support if you need assistance."
                : "We could not complete this delivery. Our team will follow up with next steps."}
            </p>
          ) : null}
        </section>

        <section
          className={`mt-4 ${CONSUMER_TRACKING_LAYOUT.card}`}
          aria-labelledby="progress-heading"
        >
          <h2 id="progress-heading" className={CONSUMER_TRACKING_LAYOUT.subheading}>
            Delivery progress
          </h2>
          <div className="mt-4">
            <TrackingProgress steps={tracking.steps} />
          </div>
        </section>

        {tracking.pickupName ? (
          <section
            className={`mt-4 ${CONSUMER_TRACKING_LAYOUT.card}`}
            aria-labelledby="pickup-heading"
          >
            <h2 id="pickup-heading" className={CONSUMER_TRACKING_LAYOUT.subheading}>
              Pickup location
            </h2>
            <p className="mt-2 text-sm font-medium">{tracking.pickupName}</p>
          </section>
        ) : null}

        <section
          className={`mt-4 ${CONSUMER_TRACKING_LAYOUT.card}`}
          aria-labelledby="destination-heading"
        >
          <h2 id="destination-heading" className={CONSUMER_TRACKING_LAYOUT.subheading}>
            Delivery destination
          </h2>
          <p className="mt-2 text-sm">{tracking.deliveryDestination}</p>
          {tracking.deliveryInstructions ? (
            <div className="mt-3 rounded-xl bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                On-file instructions
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                {tracking.deliveryInstructions}
              </p>
            </div>
          ) : null}
        </section>

        <section
          className={`mt-4 ${CONSUMER_TRACKING_LAYOUT.card}`}
          aria-labelledby="instructions-heading"
        >
          <h2 id="instructions-heading" className={CONSUMER_TRACKING_LAYOUT.subheading}>
            Add delivery instructions
          </h2>
          <div className="mt-3">
            <DeliveryInstructionsForm
              disabled={!tracking.notesEnabled}
              submitting={noteSubmission.submitting}
              submitted={noteSubmission.submitted}
              submitError={noteSubmission.submitError}
              onSubmit={noteSubmission.submit}
              existingNotes={tracking.consumerNotes}
              lastSubmittedNote={noteSubmission.lastSubmittedNote}
            />
          </div>
        </section>

        <section
          className={`mt-4 ${CONSUMER_TRACKING_LAYOUT.card}`}
          aria-labelledby="support-heading"
        >
          <h2 id="support-heading" className={CONSUMER_TRACKING_LAYOUT.subheading}>
            Need help?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{tracking.supportHours}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={`tel:${siteConfig.phoneHref}`}
              className={`inline-flex ${CONSUMER_TRACKING_LAYOUT.touchTarget} items-center justify-center rounded-xl border border-input bg-background text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              Call {tracking.supportPhone}
            </a>
            <a
              href={`mailto:${tracking.supportEmail}`}
              className={`inline-flex ${CONSUMER_TRACKING_LAYOUT.touchTarget} items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              Email support
            </a>
          </div>
        </section>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className={`mt-4 inline-flex ${CONSUMER_TRACKING_LAYOUT.touchTarget} w-full items-center justify-center gap-2 rounded-xl border border-primary/30 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh status
        </button>

        <footer className="mt-8 pb-4 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-semibold text-primary">Quick Run Express</span>
        </footer>
      </div>
    </div>
  );
}
