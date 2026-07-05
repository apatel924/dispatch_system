import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { requireDriverId } from "@/lib/server/driver-context";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { STAFF_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import {
  assertDriverOwnsOrder,
  updateOrderStatus,
} from "@/lib/server/services/orders";
import { OrderStatusUpdateSchema } from "@/lib/server/validation/orders";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, STAFF_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const body = await parseJsonBody(request, OrderStatusUpdateSchema);
  if (isErrorResponse(body)) return body;

  try {
    if (user.role === "driver") {
      const driverId = await requireDriverId(user);
      if (isErrorResponse(driverId)) return driverId;
      await assertDriverOwnsOrder(id, driverId);
    }

    const result = await updateOrderStatus(id, body.status, user, {
      stepKey: body.stepKey,
      note: body.note,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
