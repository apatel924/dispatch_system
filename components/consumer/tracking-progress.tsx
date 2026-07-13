import type { ConsumerTrackingStep } from "@/lib/types/backend";
import { Check, Circle, X } from "lucide-react";

function StepIcon({ status }: { status: ConsumerTrackingStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
        <Check className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
        <X className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-primary bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Circle className="h-3 w-3 fill-current" />
      </span>
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
      <Circle className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

export function TrackingProgress({ steps }: { steps: ConsumerTrackingStep[] }) {
  return (
    <ol className="space-y-4" aria-label="Delivery progress">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-start gap-3">
          <StepIcon status={step.status} />
          <div className="min-w-0 flex-1 pt-1">
            <p
              className={`text-sm leading-snug ${
                step.status === "current" || step.status === "complete" || step.status === "failed"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <span className="sr-only">
                Step {index + 1} of {steps.length}, {step.status}:{" "}
              </span>
              {step.label}
            </p>
            {step.time ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{step.time}</p>
            ) : null}
            {step.status === "current" ? (
              <p className="mt-1 text-xs font-medium text-primary">In progress</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
