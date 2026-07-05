import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { requireDriverId } from "@/lib/server/driver-context";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseQueryParams,
} from "@/lib/server/route-utils";
import { listOrdersForDriver } from "@/lib/server/services/orders";
import { DriverOrdersQuerySchema } from "@/lib/server/validation/orders";

const DRIVER_ROLES = ["driver"] as const;

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, DRIVER_ROLES);
  if (isErrorResponse(user)) return user;

  const driverId = await requireDriverId(user);
  if (isErrorResponse(driverId)) return driverId;

  const query = parseQueryParams(request, DriverOrdersQuerySchema);
  if (isErrorResponse(query)) return query;

  try {
    const orders = await listOrdersForDriver(driverId, query);
    return NextResponse.json({ orders });
  } catch (err) {
    return handleServiceError(err);
  }
}
