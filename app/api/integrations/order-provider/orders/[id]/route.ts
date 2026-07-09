import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import { getExternalOrderIntakeDetail } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(_request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  try {
    const order = await getExternalOrderIntakeDetail(id);
    return NextResponse.json({ order });
  } catch (err) {
    return handleServiceError(err);
  }
}
