import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextResponse } from "next/server";
import type { UserRole } from "@/lib/types/backend";
import {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
  isAccountActive,
} from "@/lib/auth/account-status";
import { jsonError } from "@/lib/server/api-response";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { getAdminAuth, getAdminFirestore } from "@/lib/server/firebase-admin";

export {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
  isAccountActive,
} from "@/lib/auth/account-status";

export function accountDisabledResponse(): NextResponse {
  return jsonError(ACCOUNT_DISABLED_MESSAGE, ACCOUNT_DISABLED_CODE, 403);
}

/** Throttle identical disabled-account logs (polling-safe). */
const lastDenialLogByUid = new Map<string, number>();
const DENIAL_LOG_COOLDOWN_MS = 60_000;

export function logAccountDisabledDenial(input: {
  uid: string;
  role?: UserRole | string;
  route?: string;
  reason: "claim" | "auth_disabled" | "firestore";
}): void {
  const now = Date.now();
  const last = lastDenialLogByUid.get(input.uid) ?? 0;
  if (now - last < DENIAL_LOG_COOLDOWN_MS) return;
  lastDenialLogByUid.set(input.uid, now);
  console.warn(
    "[auth]",
    JSON.stringify({
      code: ACCOUNT_DISABLED_CODE,
      uid: input.uid,
      role: input.role,
      route: input.route,
      reason: input.reason,
    }),
  );
}

/** Reset log throttle (tests only). */
export function resetAccountDisabledLogThrottleForTests(): void {
  lastDenialLogByUid.clear();
}

/**
 * Claim-level check from a verified ID token.
 * Does not read Firestore or Auth user records.
 */
export function assertActiveClaim(
  decoded: Pick<DecodedIdToken, "uid"> & { active?: unknown; role?: unknown },
  route?: string,
): NextResponse | null {
  if (isAccountActive(decoded.active)) return null;
  logAccountDisabledDenial({
    uid: decoded.uid,
    role: typeof decoded.role === "string" ? decoded.role : undefined,
    route,
    reason: "claim",
  });
  return accountDisabledResponse();
}

/**
 * Lightweight Firestore disable flags.
 * Driver: `drivers/{driverId}.accountDisabled === true`
 * Admin/dispatcher: `users/{uid}.isActive === false`
 * Missing documents do not disable (legacy / incomplete profiles).
 */
export async function isAccountDisabledInFirestore(input: {
  uid: string;
  role: UserRole;
  driverId?: string;
}): Promise<boolean> {
  const db = getAdminFirestore();

  if (input.role === "driver" && input.driverId) {
    const snap = await db.collection(COLLECTIONS.drivers).doc(input.driverId).get();
    if (!snap.exists) return false;
    return snap.data()?.accountDisabled === true;
  }

  const userSnap = await db.collection(COLLECTIONS.users).doc(input.uid).get();
  if (!userSnap.exists) return false;
  return userSnap.data()?.isActive === false;
}

/**
 * Auth user `disabled` flag (Firebase Authentication).
 * Used when claims may still be stale after disable + before token refresh.
 */
export async function isFirebaseAuthUserDisabled(uid: string): Promise<boolean> {
  try {
    const user = await getAdminAuth().getUser(uid);
    return user.disabled === true;
  } catch {
    // Token already verified; transient Auth lookup failures must not lock the fleet.
    return false;
  }
}

/**
 * Full post-token activation gate.
 * Explicit false from claims, Auth.disabled, or Firestore disable flags blocks access.
 */
export async function assertAccountActive(input: {
  decoded: DecodedIdToken;
  role: UserRole;
  driverId?: string;
  route?: string;
}): Promise<NextResponse | null> {
  const claimDenial = assertActiveClaim(input.decoded, input.route);
  if (claimDenial) return claimDenial;

  if (await isFirebaseAuthUserDisabled(input.decoded.uid)) {
    logAccountDisabledDenial({
      uid: input.decoded.uid,
      role: input.role,
      route: input.route,
      reason: "auth_disabled",
    });
    return accountDisabledResponse();
  }

  if (
    await isAccountDisabledInFirestore({
      uid: input.decoded.uid,
      role: input.role,
      driverId: input.driverId,
    })
  ) {
    logAccountDisabledDenial({
      uid: input.decoded.uid,
      role: input.role,
      route: input.route,
      reason: "firestore",
    });
    return accountDisabledResponse();
  }

  return null;
}
