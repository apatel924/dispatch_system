import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { promoteExternalOrderToDispatch } from "@/lib/integrations/order-provider/promote-external-order.server";

const ADMIN_ROLES = ["admin"] as const;

const PromoteExternalOrderSchema = z.object({
  overrideMissingFields: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  let body: z.infer<typeof PromoteExternalOrderSchema> = {};
  const contentType = request.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const parsed = await parseJsonBody(request, PromoteExternalOrderSchema);
    if (isErrorResponse(parsed)) return parsed;
    body = parsed;
  }

  try {
    const result = await promoteExternalOrderToDispatch(id, user, {
      overrideMissingFields: body.overrideMissingFields,
    });
    return NextResponse.json({
      order: result.order,
      externalOrder: result.externalOrder,
      alreadyPromoted: result.alreadyPromoted,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
