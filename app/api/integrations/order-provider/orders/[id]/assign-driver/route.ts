import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { assignExternalOrderDriver } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

const AssignExternalOrderDriverSchema = z.object({
  driverId: z.string().min(1),
  overrideMissingFields: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const body = await parseJsonBody(request, AssignExternalOrderDriverSchema);
  if (isErrorResponse(body)) return body;

  try {
    const order = await assignExternalOrderDriver(id, body.driverId, user, {
      overrideMissingFields: body.overrideMissingFields,
    });
    return NextResponse.json({ order });
  } catch (err) {
    return handleServiceError(err);
  }
}
