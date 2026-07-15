/**
 * Single-flight handler for ACCOUNT_DISABLED API responses.
 * Clears cache, signs out, and clears driver-local proof scope when needed.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { AuthPortal } from "@/lib/auth/firebase-client";
import {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
} from "@/lib/auth/account-status";

type AccountDisabledHandler = (input: {
  portal: AuthPortal;
  message: string;
}) => Promise<void>;

let registeredHandler: AccountDisabledHandler | null = null;
let inFlight: Promise<void> | null = null;
let sessionLocked = false;

export function isAccountDisabledSession(): boolean {
  return sessionLocked;
}

/** Clear the disabled-session lock after reaching login (or in tests). */
export function clearAccountDisabledSession(): void {
  sessionLocked = false;
  inFlight = null;
}

/** @deprecated Prefer clearAccountDisabledSession */
export function resetAccountDisabledSessionForTests(): void {
  clearAccountDisabledSession();
}

export function registerAccountDisabledHandler(
  handler: AccountDisabledHandler | null,
): void {
  registeredHandler = handler;
}

/**
 * Invoke exactly once per disabled session until reset (logout complete).
 * Concurrent callers share the same promise — no toast/query storms.
 */
export async function handleAccountDisabledResponse(
  portal: AuthPortal,
  message = ACCOUNT_DISABLED_MESSAGE,
): Promise<void> {
  sessionLocked = true;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      if (registeredHandler) {
        await registeredHandler({ portal, message });
      }
    } finally {
      // Keep sessionLocked=true until a new login; clear inFlight so a later
      // register+login cycle can run again if resetAccountDisabledSessionForTests
      // / successful login clears the lock.
      inFlight = null;
    }
  })();

  return inFlight;
}

export function isAccountDisabledError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === ACCOUNT_DISABLED_CODE
  );
}

/** Convenience for QueryProvider registration. */
export function createAccountDisabledHandler(deps: {
  queryClient: QueryClient;
  clearAuthenticatedQueryCache: (client: QueryClient) => void;
  getDriverIdClaims: () => Promise<string | undefined>;
  prepareDriverProofLogout: (driverId: string) => {
    hasUnsynced: boolean;
    clear: () => void;
  };
  signOutPortal: (portal: AuthPortal) => Promise<void>;
  setLoginMessage?: (message: string) => void;
}): AccountDisabledHandler {
  return async ({ portal, message }) => {
    deps.clearAuthenticatedQueryCache(deps.queryClient);
    deps.queryClient.cancelQueries();

    if (portal === "driver") {
      try {
        const driverId = await deps.getDriverIdClaims();
        if (driverId) {
          // Forced sign-out: clear local scope so the next user cannot see proofs.
          deps.prepareDriverProofLogout(driverId).clear();
        }
      } catch {
        // Best-effort proof clear
      }
    }

    deps.setLoginMessage?.(message || ACCOUNT_DISABLED_MESSAGE);

    try {
      await deps.signOutPortal(portal);
    } catch {
      // Proceed to redirect even if sign-out throws
    }

    if (typeof window !== "undefined") {
      const loginPath = portal === "driver" ? "/driver-login" : "/";
      const params = new URLSearchParams({
        reason: ACCOUNT_DISABLED_CODE,
      });
      window.location.assign(`${loginPath}?${params.toString()}`);
    }
  };
}
