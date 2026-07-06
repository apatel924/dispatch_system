import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { isErrorResponse } from "@/lib/server/route-utils";
import { scanLiveExternalDeliveryOrders } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

/** Read-only multi-page Barnet delivery order scan — does not write to Firestore. */
export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const result = await scanLiveExternalDeliveryOrders();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delivery scan failed";
    console.error("[order-provider] delivery scan failed:", message);
    return handleServiceError(err);
  }
}
