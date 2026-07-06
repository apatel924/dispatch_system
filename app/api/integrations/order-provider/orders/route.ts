import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import { listSyncedExternalOrders } from "@/lib/integrations/order-provider/index.server";

const LIST_ROLES = ["admin"] as const;

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, LIST_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const orders = await listSyncedExternalOrders(limit);
    return NextResponse.json({ orders, total: orders.length });
  } catch (err) {
    console.error("[order-provider] list orders failed:", err instanceof Error ? err.message : err);
    return handleServiceError(err);
  }
}
