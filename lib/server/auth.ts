import type { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { UserRole } from "@/lib/types/backend";
import { forbidden, unauthorized } from "@/lib/server/api-response";
import { getAdminAuth } from "@/lib/server/firebase-admin";
import { isFirebaseAdminConfigured } from "@/lib/server/env";
import { isUserRole } from "@/lib/server/roles";
import { assertAccountActive } from "@/lib/server/account-active";

export interface AuthUser {
  uid: string;
  email?: string;
  role: UserRole;
  driverId?: string;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function requestRoute(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

function authUserFromDecoded(decoded: DecodedIdToken): AuthUser | null {
  const role = decoded.role;
  if (!isUserRole(role)) return null;

  const driverId =
    typeof decoded.driverId === "string" ? decoded.driverId : undefined;

  return {
    uid: decoded.uid,
    email: decoded.email,
    role,
    driverId,
  };
}

/**
 * True when the ID token was issued before refresh tokens were revoked.
 * Mirrors Firebase Admin `verifyIdToken(..., checkRevoked: true)` semantics.
 */
export function isIdTokenRevoked(
  decoded: Pick<DecodedIdToken, "iat">,
  tokensValidAfterTime?: string,
): boolean {
  if (!tokensValidAfterTime) return false;
  const revokedAtSeconds = Math.floor(
    new Date(tokensValidAfterTime).getTime() / 1000,
  );
  return decoded.iat < revokedAtSeconds;
}

/**
 * Verify a Firebase ID token from the Authorization header.
 * Returns null when the token is missing, invalid, revoked, or Firebase Admin
 * is not configured. Callers that need disabled-account semantics should use
 * `requireAuth` / `requireRole` (which return ACCOUNT_DISABLED).
 */
export async function verifyIdToken(request: Request): Promise<AuthUser | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const token = extractBearerToken(request);
  if (!token) return null;

  try {
    const auth = getAdminAuth();
    // checkRevoked: rejects tokens after revokeRefreshTokens (e.g. disable flow).
    const decoded = await auth.verifyIdToken(token, true);
    return authUserFromDecoded(decoded);
  } catch {
    return null;
  }
}

type AuthGateResult = AuthUser | NextResponse;

/**
 * Verify token + enforce account activation (claims, Auth.disabled, Firestore).
 * Separated from `verifyIdToken` so callers can distinguish unauthorized vs disabled.
 */
async function authenticateActiveUser(
  request: Request,
): Promise<AuthGateResult | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const token = extractBearerToken(request);
  if (!token) return null;

  let decoded: DecodedIdToken;
  try {
    // checkRevoked catches disable → revokeRefreshTokens within tokensValidAfterTime.
    decoded = await getAdminAuth().verifyIdToken(token, true);
  } catch {
    return null;
  }

  const user = authUserFromDecoded(decoded);
  if (!user) return null;

  const route = requestRoute(request);
  const denial = await assertAccountActive({
    decoded,
    role: user.role,
    driverId: user.driverId,
    route,
  });
  if (denial) return denial;

  return user;
}

/**
 * Require a valid authenticated + active user.
 * Returns the user or a 401 / 403 (ACCOUNT_DISABLED) NextResponse.
 */
export async function requireAuth(
  request: Request,
): Promise<AuthUser | NextResponse> {
  const result = await authenticateActiveUser(request);
  if (!result) return unauthorized();
  if (result instanceof Response) return result;
  return result;
}

/**
 * Require authentication, an active account, and one of the allowed roles.
 * Activation is checked before role authorization.
 */
export async function requireRole(
  request: Request,
  allowedRoles: readonly UserRole[],
): Promise<AuthUser | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  if (!allowedRoles.includes(authResult.role)) {
    return forbidden();
  }
  return authResult;
}
