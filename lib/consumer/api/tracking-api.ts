import type { ConsumerTrackingView, PublicConsumerNote } from "@/lib/types/backend";
import { isValidPublicTrackingToken } from "@/lib/tracking-token";

export class ConsumerTrackingApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ConsumerTrackingApiError";
    this.status = status;
    this.code = code;
  }
}

export type ConsumerTrackingErrorKind =
  | "loading"
  | "invalid"
  | "expired"
  | "revoked"
  | "unavailable"
  | "network"
  | null;

export function classifyTrackingError(
  err: unknown,
): { kind: ConsumerTrackingErrorKind; message: string } {
  if (err instanceof ConsumerTrackingApiError) {
    if (err.code === "TRACKING_EXPIRED") {
      return { kind: "expired", message: err.message };
    }
    if (err.code === "TRACKING_REVOKED") {
      return { kind: "revoked", message: err.message };
    }
    if (err.status === 404) {
      return { kind: "invalid", message: err.message };
    }
    if (err.status >= 500) {
      return { kind: "network", message: "Unable to load tracking right now. Please try again." };
    }
    return { kind: "unavailable", message: err.message };
  }

  if (err instanceof TypeError) {
    return { kind: "network", message: "Unable to connect. Check your connection and try again." };
  }

  return { kind: "network", message: "Something went wrong. Please try again." };
}

export async function fetchConsumerTracking(
  token: string,
): Promise<{ tracking: ConsumerTrackingView }> {
  if (!isValidPublicTrackingToken(token)) {
    throw new ConsumerTrackingApiError(
      "This tracking link is not valid.",
      404,
      "TRACKING_INVALID",
    );
  }

  const res = await fetch(`/api/tracking/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.error === "string" ? body.error : "This tracking link is not valid.";
    const code = typeof body.code === "string" ? body.code : undefined;
    throw new ConsumerTrackingApiError(message, res.status, code);
  }
  return res.json() as Promise<{ tracking: ConsumerTrackingView }>;
}

export async function submitConsumerNote(
  token: string,
  text: string,
): Promise<{ note: PublicConsumerNote }> {
  if (!isValidPublicTrackingToken(token)) {
    throw new ConsumerTrackingApiError(
      "This tracking link is not valid.",
      404,
      "TRACKING_INVALID",
    );
  }

  const res = await fetch(`/api/tracking/${encodeURIComponent(token)}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.error === "string" ? body.error : "Unable to submit delivery instructions.";
    const code = typeof body.code === "string" ? body.code : undefined;
    throw new ConsumerTrackingApiError(message, res.status, code);
  }
  return res.json() as Promise<{ note: PublicConsumerNote }>;
}
