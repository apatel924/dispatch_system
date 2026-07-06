import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import { syncMockExternalOrders } from "@/lib/integrations/order-provider/index.server";

const SYNC_ROLES = ["admin"] as const;

export async function POST(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, SYNC_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const result = await syncMockExternalOrders();
    return NextResponse.json({
      ok: true,
      mode: "mock",
      ...result,
    });
  } catch (err) {
    console.error("[order-provider] mock sync failed:", err instanceof Error ? err.message : err);
    return handleServiceError(err);
  }
}
