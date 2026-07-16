import { DEFAULT_APP_TIMEZONE } from "@/lib/app-timezone";

const TZ = DEFAULT_APP_TIMEZONE;

export function formatEdmontonRelative(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "Never";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "Unknown";
  const deltaSec = Math.max(0, Math.floor((now.getTime() - ms) / 1000));
  if (deltaSec < 60) return "just now";
  const mins = Math.floor(deltaSec / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatEdmontonExact(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("en-US", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Compact absolute time for dense tables (e.g. Jul 15, 6:45 PM). */
export function formatEdmontonCompact(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isBarnetSyncLeaseActive(input: {
  lastRunStatus?: string | null;
  lastStartedAt?: string | null;
  lastRunId?: string | null;
  lockRunId?: string | null;
  lockExpiresAt?: string | null;
  nowMs?: number;
}): boolean {
  if (input.lastRunStatus !== "running") return false;
  if (!input.lastStartedAt) return false;
  const expires = input.lockExpiresAt ? Date.parse(input.lockExpiresAt) : NaN;
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isFinite(expires) || expires <= nowMs) return false;
  if (!input.lockRunId || !input.lastRunId) return false;
  return input.lockRunId === input.lastRunId;
}

export function describeBarnetSyncResult(input: {
  lastResult?: string | null;
  lastRunStatus?: string | null;
  lastAttemptResult?: string | null;
  isRunning?: boolean;
  /** When false, never show “currently running”. When omitted, trust `isRunning`. */
  leaseActive?: boolean;
  inserted?: number | null;
}): string | null {
  const leaseActive = input.leaseActive ?? Boolean(input.isRunning);
  if (
    (input.isRunning && leaseActive) ||
    (input.lastResult === "running" && leaseActive) ||
    (input.lastRunStatus === "running" && leaseActive)
  ) {
    return "Sync currently running";
  }

  if (
    input.lastRunStatus === "running" ||
    input.lastResult === "running" ||
    input.lastAttemptResult === "timed_out_or_expired" ||
    input.lastResult === "timed_out_or_expired" ||
    input.lastRunStatus === "timed_out_or_expired"
  ) {
    return "Previous sync did not complete — awaiting the next scheduled run";
  }

  switch (input.lastResult) {
    case "skipped_quiet_hours":
      return "Skipped during quiet hours";
    case "skipped_locked":
    case "skipped_lock_active":
      return "Skipped — sync already running";
    case "skipped_disabled":
      return "Sync disabled";
    case "skipped_not_configured":
      return "Provider not configured";
    case "failed":
      return "Last scan failed";
    case "imported_new": {
      const n = input.inserted ?? 0;
      return n === 1
        ? "Last scan imported 1 new delivery order"
        : `Last scan imported ${n} new delivery orders`;
    }
    case "no_new_orders":
      return "Last scan found no new delivery orders";
    default:
      if (input.lastRunStatus === "failed") return "Last scan failed";
      if (input.lastRunStatus === "skipped_outside_hours") {
        return "Skipped during quiet hours";
      }
      if (input.lastAttemptResult === "skipped_lock_active") {
        return "Skipped — sync already running";
      }
      if (input.lastAttemptResult === "skipped_quiet_hours") {
        return "Skipped during quiet hours";
      }
      return null;
  }
}
