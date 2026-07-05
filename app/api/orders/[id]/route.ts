import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import {
  getOrderById,
  getStatusEvents,
  updateOrder,
} from "@/lib/server/services/orders";
import { UpdateOrderSchema } from "@/lib/server/validation/orders";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  try {
    const [order, statusEvents] = await Promise.all([
      getOrderById(id),
      getStatusEvents(id),
    ]);
    return NextResponse.json({ order, statusEvents });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const body = await parseJsonBody(request, UpdateOrderSchema);
  if (isErrorResponse(body)) return body;

  try {
    const order = await updateOrder(id, body, user);
    return NextResponse.json({ order });
  } catch (err) {
    return handleServiceError(err);
  }
}
