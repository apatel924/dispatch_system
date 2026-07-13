import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { DRIVER_ACCOUNT_ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { updateDriverAccount } from "@/lib/server/services/driver-account";
import { UpdateDriverCredentialsSchema } from "@/lib/server/validation/drivers";

type RouteContext = { params: Promise<{ id: string }> };

/** @deprecated Use PATCH /api/drivers/[id]/account */
export async function PATCH(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, DRIVER_ACCOUNT_ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const body = await parseJsonBody(request, UpdateDriverCredentialsSchema);
  if (isErrorResponse(body)) return body;

  try {
    await updateDriverAccount(
      id,
      {
        loginEmail: body.loginEmail,
        password: body.password,
        confirmPassword: body.password,
      },
      user,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
