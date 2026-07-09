import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { isErrorResponse } from "@/lib/server/route-utils";
import { probeLiveCustomerDetail } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

/** Read-only Barnet customer detail probe with safe diagnostics only. */
export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId") ?? undefined;
    if (!customerId?.trim()) {
      return NextResponse.json(
        { error: "customerId query parameter is required" },
        { status: 400 },
      );
    }

    const result = await probeLiveCustomerDetail(customerId);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Live customer detail probe failed";
    console.error("[order-provider] live customer detail probe failed:", message);
    return handleServiceError(err);
  }
}
