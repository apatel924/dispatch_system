import type { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { UserRole } from "@/lib/types/backend";
import { forbidden, unauthorized } from "@/lib/server/api-response";
import { getAdminAuth } from "@/lib/server/firebase-admin";
import { isFirebaseAdminConfigured } from "@/lib/server/env";
import { isUserRole } from "@/lib/server/roles";

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
 * Verify a Firebase ID token from the Authorization header.
 * Returns null when the token is missing, invalid, or Firebase Admin is not configured.
 */
export async function verifyIdToken(request: Request): Promise<AuthUser | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const token = extractBearerToken(request);
  if (!token) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return authUserFromDecoded(decoded);
  } catch {
    return null;
  }
}

/**
 * Require a valid authenticated user.
 * Returns the user or a 401 NextResponse to return from the route handler.
 */
export async function requireAuth(
  request: Request,
): Promise<AuthUser | NextResponse> {
  const user = await verifyIdToken(request);
  if (!user) return unauthorized();
  return user;
}

/**
 * Require authentication and one of the allowed roles.
 * Returns the user or a 401/403 NextResponse to return from the route handler.
 */
export async function requireRole(
  request: Request,
  allowedRoles: readonly UserRole[],
): Promise<AuthUser | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  if (!allowedRoles.includes(authResult.role)) return forbidden();
  return authResult;
}
