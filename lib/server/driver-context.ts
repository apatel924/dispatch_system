import type { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/server/auth";
import { forbidden } from "@/lib/server/api-response";
import { getDriverByUserId } from "@/lib/server/services/drivers";

/**
 * Resolve the driver's roster id from the auth token claim or Firestore lookup.
 */
export async function resolveDriverId(user: AuthUser): Promise<string | null> {
  if (user.driverId) return user.driverId;
  const driver = await getDriverByUserId(user.uid);
  return driver?.id ?? null;
}

export async function requireDriverId(
  user: AuthUser,
): Promise<string | NextResponse> {
  const driverId = await resolveDriverId(user);
  if (!driverId) {
    return forbidden("Driver profile is not linked to this account");
  }
  return driverId;
}
