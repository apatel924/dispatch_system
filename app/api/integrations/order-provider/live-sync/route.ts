import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import { syncLiveExternalOrders } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

export async function POST(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const itemsOnPage = Math.min(
      Math.max(Number(url.searchParams.get("itemsOnPage") ?? 50), 1),
      100,
    );

    const result = await syncLiveExternalOrders({ page, itemsOnPage });
    return NextResponse.json({
      ok: true,
      mode: "live",
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Live sync failed";
    console.error("[order-provider] live sync failed:", message);
    return handleServiceError(err);
  }
}
