import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import { writeAuditLog } from "@/lib/server/services/audit";
import { syncLiveExternalOrders } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

export async function POST(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  let overrideQuietHours = false;
  try {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && body.overrideQuietHours === true) {
      overrideQuietHours = true;
    }
  } catch {
    overrideQuietHours = false;
  }

  try {
    if (overrideQuietHours) {
      await writeAuditLog({
        action: "barnet_sync_quiet_hours_override",
        entityType: "import",
        entityId: "orderProvider",
        actorId: user.uid,
        actorRole: user.role,
        metadata: {
          source: "manual",
          overrideQuietHours: true,
        },
      });
    }

    const result = await syncLiveExternalOrders({
      actorId: user.uid,
      overrideQuietHours,
    });

    if (result.skipped) {
      const message =
        result.reason === "outside_operating_hours"
          ? "Scanning is paused until 8:30 AM Edmonton time."
          : result.reason === "sync_already_running"
            ? "Sync already in progress."
            : result.reason === "sync_disabled"
              ? "Live sync is disabled."
              : "Synchronization skipped.";

      return NextResponse.json({
        ok: true,
        mode: "live",
        skipped: true,
        reason: result.reason,
        status: result.status,
        message,
        nextEligibleAt: result.nextEligibleAt,
        durationMs: result.durationMs,
        pagesScanned: 0,
        totalOrdersSeen: 0,
        deliveryOrdersFound: 0,
        pickupOrdersIgnored: 0,
        unknownOrdersIgnored: 0,
        inserted: 0,
        updated: 0,
        total: 0,
      });
    }

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
