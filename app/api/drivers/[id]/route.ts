import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { requireDriverId, resolveDriverId } from "@/lib/server/driver-context";
import { forbidden } from "@/lib/server/api-response";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { getDriverById, updateDriver } from "@/lib/server/services/drivers";
import {
  DriverSelfStatusSchema,
  UpdateDriverSchema,
  type UpdateDriverInput,
} from "@/lib/server/validation/drivers";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, [...ADMIN_ROLES, "driver"]);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  try {
    if (user.role === "driver") {
      const driverId = await resolveDriverId(user);
      if (driverId !== id) return forbidden();
    }

    const driver = await getDriverById(id);
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
  const body = await parseJsonBody(request, UpdateDriverSchema);
  if (isErrorResponse(body)) return body;

  try {
    if (user.role === "driver") {
      const driverId = await requireDriverId(user);
      if (isErrorResponse(driverId)) return driverId;
      if (driverId !== id) return forbidden();

      // Drivers may update profile fields and their own availability (Available / Inactive)
      const { name, phone, email, vehicle, avatarColor, status } = body;
      const driverPatch: UpdateDriverInput = {};
      if (name !== undefined) driverPatch.name = name;
      if (phone !== undefined) driverPatch.phone = phone;
      if (email !== undefined) driverPatch.email = email;
      if (vehicle !== undefined) driverPatch.vehicle = vehicle;
      if (avatarColor !== undefined) driverPatch.avatarColor = avatarColor;
      if (status !== undefined) {
        const parsed = DriverSelfStatusSchema.safeParse(status);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Drivers may only set status to Available or Inactive" },
            { status: 400 },
          );
        }
        driverPatch.status = parsed.data;
      }
      const driver = await updateDriver(id, driverPatch, user);
      return NextResponse.json({ driver });
    }

    const driver = await updateDriver(id, body, user);
    return NextResponse.json({ driver });
  } catch (err) {
    return handleServiceError(err);
  }
}
