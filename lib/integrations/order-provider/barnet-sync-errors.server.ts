import {
  isBarnetUpstreamHttpError,
  isBarnetUpstreamTimeoutError,
} from "@/lib/integrations/order-provider/barnet-client.server";

/** Typed Barnet sync failure codes persisted in lastAttemptResult. */
export type BarnetSyncFailureCode =
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_http_error"
  | "provider_network_error"
  | "execution_budget_exhausted"
  | "firestore_error"
  | "unknown_sync_error";

export const TRANSIENT_BARNET_PROVIDER_FAILURE_CODES: ReadonlySet<BarnetSyncFailureCode> =
  new Set([
    "provider_timeout",
    "provider_rate_limited",
    "provider_http_error",
    "provider_network_error",
    "execution_budget_exhausted",
  ]);

export interface PageFetchOutcomeDiagnostics {
  page: number;
  success: boolean;
  timedOut: boolean;
  attempts: number;
  durationMs: number;
  failureCode?: BarnetSyncFailureCode;
}

export interface PageBatchDiagnostics {
  successfulPages: number[];
  failedPages: number[];
  timedOutPages: number[];
  attemptsByPage: Record<number, number>;
  durationByPageMs: Record<number, number>;
  batchDurationMs: number;
  pageOutcomes: PageFetchOutcomeDiagnostics[];
}

export class BarnetSyncFailureError extends Error {
  readonly code: BarnetSyncFailureCode;
  readonly pageBatchDiagnostics?: PageBatchDiagnostics;

  constructor(
    code: BarnetSyncFailureCode,
    message: string,
    options?: { pageBatchDiagnostics?: PageBatchDiagnostics; cause?: unknown },
  ) {
    super(message);
    this.name = "BarnetSyncFailureError";
    this.code = code;
    this.pageBatchDiagnostics = options?.pageBatchDiagnostics;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isBarnetSyncFailureError(
  error: unknown,
): error is BarnetSyncFailureError {
  return error instanceof BarnetSyncFailureError;
}

export function isTransientBarnetProviderFailure(
  code: BarnetSyncFailureCode,
): boolean {
  return TRANSIENT_BARNET_PROVIDER_FAILURE_CODES.has(code);
}

export function classifyBarnetFetchError(error: unknown): BarnetSyncFailureCode {
  if (isBarnetSyncFailureError(error)) {
    return error.code;
  }
  if (isBarnetUpstreamTimeoutError(error)) {
    return "provider_timeout";
  }
  if (isBarnetUpstreamHttpError(error)) {
    if (error.status === 429) return "provider_rate_limited";
    return "provider_http_error";
  }
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    if (
      name === "typeerror" ||
      message.includes("fetch failed") ||
      message.includes("econnreset") ||
      message.includes("enotfound") ||
      message.includes("network") ||
      message.includes("socket")
    ) {
      return "provider_network_error";
    }
    if (message.includes("firestore") || message.includes("firebase")) {
      return "firestore_error";
    }
  }
  return "unknown_sync_error";
}

export function toSafeMessageForFailureCode(
  code: BarnetSyncFailureCode,
): string {
  switch (code) {
    case "provider_timeout":
      return "Barnet request timed out.";
    case "provider_rate_limited":
      return "Barnet rate-limited the request.";
    case "provider_http_error":
      return "Barnet returned an upstream HTTP error.";
    case "provider_network_error":
      return "Barnet request failed due to a network error.";
    case "execution_budget_exhausted":
      return "Sync stopped — execution time budget exhausted.";
    case "firestore_error":
      return "Sync failed while writing to Firestore.";
    default:
      return "Synchronization failed.";
  }
}

export function buildPageBatchDiagnostics(
  outcomes: PageFetchOutcomeDiagnostics[],
  batchDurationMs: number,
): PageBatchDiagnostics {
  const successfulPages: number[] = [];
  const failedPages: number[] = [];
  const timedOutPages: number[] = [];
  const attemptsByPage: Record<number, number> = {};
  const durationByPageMs: Record<number, number> = {};

  for (const outcome of outcomes) {
    attemptsByPage[outcome.page] = outcome.attempts;
    durationByPageMs[outcome.page] = outcome.durationMs;
    if (outcome.success) {
      successfulPages.push(outcome.page);
    } else {
      failedPages.push(outcome.page);
      if (outcome.timedOut) {
        timedOutPages.push(outcome.page);
      }
    }
  }

  return {
    successfulPages,
    failedPages,
    timedOutPages,
    attemptsByPage,
    durationByPageMs,
    batchDurationMs,
    pageOutcomes: outcomes,
  };
}
