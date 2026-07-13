import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { DRIVER_ACCOUNT_ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import {
  getDriverAccountAccess,
  updateDriverAccount,
} from "@/lib/server/services/driver-account";
import { UpdateDriverAccountSchema } from "@/lib/server/validation/driver-account";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, DRIVER_ACCOUNT_ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  try {
    const account = await getDriverAccountAccess(id);
    return NextResponse.json({ account });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, DRIVER_ACCOUNT_ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const body = await parseJsonBody(request, UpdateDriverAccountSchema);
  if (isErrorResponse(body)) return body;

  try {
    const account = await updateDriverAccount(id, body, user);
    return NextResponse.json({ account });
  } catch (err) {
    return handleServiceError(err);
  }
}
