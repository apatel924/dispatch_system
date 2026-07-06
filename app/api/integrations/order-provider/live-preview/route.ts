import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { isErrorResponse } from "@/lib/server/route-utils";
import { previewLiveExternalOrders } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const itemsOnPage = Math.min(
      Math.max(Number(url.searchParams.get("itemsOnPage") ?? 10), 1),
      50,
    );

    const result = await previewLiveExternalOrders({ page, itemsOnPage });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Live preview failed";
    console.error("[order-provider] live preview failed:", message);
    return handleServiceError(err);
  }
}
