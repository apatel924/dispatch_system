import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { isErrorResponse } from "@/lib/server/route-utils";
import { fetchBarnetLocations } from "@/lib/integrations/order-provider/barnet-client.server";
import { getLiveOrderProviderHealth } from "@/lib/integrations/order-provider/index.server";

const ADMIN_ROLES = ["admin"] as const;

export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const probe = url.searchParams.get("probe") === "true";
    const health = getLiveOrderProviderHealth();

    if (!probe) {
      return NextResponse.json(health);
    }

    if (!health.liveReadsEnabled) {
      return NextResponse.json({
        ...health,
        probe: {
          attempted: false,
          ok: false,
          error: "Live reads are disabled (EXTERNAL_ORDER_LIVE_READS_ENABLED=false)",
        },
      });
    }

    try {
      const { locationCount } = await fetchBarnetLocations();
      return NextResponse.json({
        ...health,
        probe: {
          attempted: true,
          ok: true,
          locationCount,
        },
      });
    } catch (probeErr) {
      const message =
        probeErr instanceof Error ? probeErr.message : "Live probe failed";
      console.error("[order-provider] live health probe failed:", message);
      return NextResponse.json({
        ...health,
        probe: {
          attempted: true,
          ok: false,
          error: message,
        },
      });
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "External order provider configuration is invalid";
    console.error("[order-provider] live health check failed:", message);
    return handleServiceError(err);
  }
}
