import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { requireDriverId } from "@/lib/server/driver-context";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import {
  assertDriverOwnsOrder,
  getStatusEvents,
} from "@/lib/server/services/orders";
import { listProofs } from "@/lib/server/services/proofs";

const DRIVER_ROLES = ["driver"] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, DRIVER_ROLES);
  if (isErrorResponse(user)) return user;

  const driverId = await requireDriverId(user);
  if (isErrorResponse(driverId)) return driverId;

  const { id } = await context.params;

  try {
    const order = await assertDriverOwnsOrder(id, driverId);
    const [statusEvents, proofs] = await Promise.all([
      getStatusEvents(id),
      listProofs(id),
    ]);
    return NextResponse.json({ order, statusEvents, proofs });
  } catch (err) {
    return handleServiceError(err);
  }
}
