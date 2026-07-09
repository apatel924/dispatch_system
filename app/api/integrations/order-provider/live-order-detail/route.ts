import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { isErrorResponse } from "@/lib/server/route-utils";
import { probeLiveOrderDetail } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

/** Read-only Barnet order detail probe with customer-link diagnostics. */
export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? undefined;
    const number = url.searchParams.get("number") ?? undefined;
    const result = await probeLiveOrderDetail({ id, number });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Live order detail probe failed";
    console.error("[order-provider] live order detail probe failed:", message);
    return handleServiceError(err);
  }
}
