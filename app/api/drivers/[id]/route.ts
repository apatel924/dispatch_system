import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { requireDriverId, resolveDriverId } from "@/lib/server/driver-context";
import { badRequest, forbidden } from "@/lib/server/api-response";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import {
  getDriverById,
  toDriverDto,
  updateDriverAdmin,
  updateDriverSelf,
} from "@/lib/server/services/drivers";
import {
  AdminUpdateDriverSchema,
  DriverIdParamSchema,
  DriverSelfUpdateSchema,
} from "@/lib/server/validation/drivers";

type RouteContext = { params: Promise<{ id: string }> };

function parseDriverId(id: string): string | NextResponse {
  const parsed = DriverIdParamSchema.safeParse(id);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid driver ID");
  }
  return parsed.data;
}

export async function GET(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, [...ADMIN_ROLES, "driver"]);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const driverId = parseDriverId(id);
  if (driverId instanceof NextResponse) return driverId;

  try {
    if (user.role === "driver") {
      const selfDriverId = await resolveDriverId(user);
      if (selfDriverId !== driverId) return forbidden();
    }

    const driver = toDriverDto(await getDriverById(driverId));
    return NextResponse.json({ driver });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, [...ADMIN_ROLES, "driver"]);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const driverId = parseDriverId(id);
  if (driverId instanceof NextResponse) return driverId;

  try {
    if (user.role === "driver") {
      const selfDriverId = await requireDriverId(user);
      if (isErrorResponse(selfDriverId)) return selfDriverId;
      if (selfDriverId !== driverId) return forbidden();

      const body = await parseJsonBody(request, DriverSelfUpdateSchema);
      if (isErrorResponse(body)) return body;

      const driver = await updateDriverSelf(driverId, body, user);
      return NextResponse.json({ driver });
    }

    const body = await parseJsonBody(request, AdminUpdateDriverSchema);
    if (isErrorResponse(body)) return body;

    const driver = await updateDriverAdmin(driverId, body, user);
    return NextResponse.json({ driver });
  } catch (err) {
    return handleServiceError(err);
  }
}
