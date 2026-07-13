import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import { ensureFirebaseConfigured, isErrorResponse } from "@/lib/server/route-utils";
import { getOrderById } from "@/lib/server/services/orders";
import { issueAndSendTrackingLink } from "@/lib/server/services/notifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  try {
    const order = await getOrderById(id);
    const result = await issueAndSendTrackingLink(order, "tracking_link_resend");

    const body: Record<string, unknown> = {
      linkCreated: result.linkCreated,
      smsAttempted: result.smsAttempted,
      smsSent: result.smsSent,
      message: result.message,
      version: result.version,
      expiresAt: result.expiresAt,
    };

    if (!result.smsSent && result.copyUrl) {
      body.copyUrl = result.copyUrl;
    }

    return NextResponse.json(body);
  } catch (err) {
    return handleServiceError(err);
  }
}
