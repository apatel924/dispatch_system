import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { isErrorResponse } from "@/lib/server/route-utils";
import { fetchSafeBarnetLocations } from "@/lib/integrations/order-provider/barnet-client.server";
import { getExternalOrderProviderConfig } from "@/lib/integrations/order-provider/env.server";

const ADMIN_ROLES = ["admin"] as const;

export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const config = getExternalOrderProviderConfig();

    if (config.mode !== "live") {
      return NextResponse.json(
        { error: "Discover Locations requires EXTERNAL_ORDER_PROVIDER_MODE=live" },
        { status: 400 },
      );
    }

    if (!config.liveReadsEnabled) {
      return NextResponse.json(
        {
          error:
            "Live reads are disabled (set EXTERNAL_ORDER_LIVE_READS_ENABLED=true)",
        },
        { status: 400 },
      );
    }

    const { locations, meta } = await fetchSafeBarnetLocations();
    return NextResponse.json({ ok: true, locations, meta });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Discover live locations failed";
    console.error("[order-provider] live locations discovery failed:", message);
    return handleServiceError(err);
  }
}
