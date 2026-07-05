import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { assignDriver } from "@/lib/server/services/orders";
import { AssignDriverSchema } from "@/lib/server/validation/orders";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const body = await parseJsonBody(request, AssignDriverSchema);
  if (isErrorResponse(body)) return body;

  try {
    const order = await assignDriver(id, body.driverId, user);
    return NextResponse.json({ order });
  } catch (err) {
    return handleServiceError(err);
  }
}
