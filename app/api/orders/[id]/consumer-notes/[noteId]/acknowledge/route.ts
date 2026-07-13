import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { requireDriverId } from "@/lib/server/driver-context";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { STAFF_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import { acknowledgeConsumerNote } from "@/lib/server/services/consumer-tracking";
import { assertDriverOwnsOrder } from "@/lib/server/services/orders";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, STAFF_ROLES);
  if (isErrorResponse(user)) return user;

  const { id, noteId } = await context.params;

  if (user.role === "driver") {
    const driverId = await requireDriverId(user);
    if (isErrorResponse(driverId)) return driverId;
    try {
      await assertDriverOwnsOrder(id, driverId);
    } catch (err) {
      return handleServiceError(err);
    }
  }

  try {
    const note = await acknowledgeConsumerNote(id, noteId, user.uid);
    return NextResponse.json({ note });
  } catch (err) {
    return handleServiceError(err);
  }
}
