import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import {
  getExternalOrderProviderSyncState,
  listExternalOrderIntakeRows,
} from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);
    const [orders, syncState] = await Promise.all([
      listExternalOrderIntakeRows(limit),
      getExternalOrderProviderSyncState(),
    ]);

    const summary = {
      ordersScanned: syncState.lastSyncSummary?.pagesScanned ?? 0,
      deliveryOrdersFound: syncState.lastSyncSummary?.deliveryOrdersFound ?? orders.length,
      readyToDispatch: orders.filter((o) => o.dispatchReady && o.assignmentStatus !== "assigned").length,
      needsReview: orders.filter((o) => !o.dispatchReady && o.assignmentStatus !== "assigned").length,
      alreadyImported: orders.length,
      assigned: orders.filter((o) => o.assignmentStatus === "assigned").length,
    };

    return NextResponse.json({ orders, syncState, summary, total: orders.length });
  } catch (err) {
    console.error("[order-provider] intake list failed:", err instanceof Error ? err.message : err);
    return handleServiceError(err);
  }
}
