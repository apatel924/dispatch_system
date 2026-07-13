/**
 * Single source of truth for driver operational statuses.
 *
 * Status semantics:
 * - Available: ready for new assignments when not on active deliveries
 * - Busy: on active deliveries; may still receive additional assignments
 * - Inactive: account exists but cannot receive new assignments or go online
 * - Suspended: cannot sign in or operate (Firebase Auth disabling is separate)
 *
 * "Offline" is a UI label for drivers who are not online — not a stored status.
 */

export const DRIVER_STATUSES = [
  "Available",
  "Busy",
  "Inactive",
  "Suspended",
] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

/** Status values a driver may set for themselves via the availability toggle. */
export const DRIVER_SELF_SERVICE_STATUSES = ["Available", "Inactive"] as const;

export type DriverSelfServiceStatus = (typeof DRIVER_SELF_SERVICE_STATUSES)[number];

export const UNAVAILABLE_DRIVER_STATUSES: DriverStatus[] = ["Inactive", "Suspended"];

/** Drivers on the active roster (Suspended accounts are excluded from roster totals). */
export const ACTIVE_ROSTER_DRIVER_STATUSES: DriverStatus[] = [
  "Available",
  "Busy",
  "Inactive",
];

export function isOnActiveRoster(status: DriverStatus | string): boolean {
  return status !== "Suspended";
}

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  Available: "Available",
  Busy: "Busy",
  Inactive: "Inactive",
  Suspended: "Suspended",
};

export const DRIVER_STATUS_DESCRIPTIONS: Record<DriverStatus, string> = {
  Available: "Ready to receive assignments when not on active deliveries.",
  Busy: "On active deliveries; may still receive additional assignments.",
  Inactive:
    "Account remains on the roster but cannot receive new assignments or go online.",
  Suspended:
    "Cannot sign in or operate. Firebase Auth credential disabling is handled separately.",
};

export function normalizeDriverStatus(value: unknown): DriverStatus | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = DRIVER_STATUSES.find(
    (status) => status.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? null;
}

export function isDriverAssignable(status: DriverStatus | string): boolean {
  return status === "Available" || status === "Busy";
}

export function isDriverUnavailable(status: DriverStatus | string): boolean {
  return status === "Inactive" || status === "Suspended";
}

/**
 * Avoid contradictory stored state such as Available while active deliveries exist.
 * Busy may also be derived from active assignments at read time.
 */
export function resolveStoredDriverStatus(
  requested: DriverStatus,
  activeDeliveries: number,
): DriverStatus {
  if (requested === "Available" && activeDeliveries > 0) {
    return "Busy";
  }
  return requested;
}
