import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { isErrorResponse } from "@/lib/server/route-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_ROLES = ["admin"] as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  return NextResponse.json(
    {
      vercelEnvironment: process.env.VERCEL_ENV ?? null,
      providerModePresent: Boolean(process.env.EXTERNAL_ORDER_PROVIDER_MODE),
      providerMode: process.env.EXTERNAL_ORDER_PROVIDER_MODE ?? null,
      baseUrlPresent: Boolean(process.env.EXTERNAL_ORDER_API_BASE_URL),
      pathPrefixPresent: Boolean(process.env.EXTERNAL_ORDER_API_PATH_PREFIX),
      apiKeyPresent: Boolean(process.env.EXTERNAL_ORDER_API_KEY),
      apiPassPresent: Boolean(process.env.EXTERNAL_ORDER_API_PASS),
      locationIdPresent: Boolean(process.env.EXTERNAL_ORDER_LOCATION_ID),
      liveReadsValue: process.env.EXTERNAL_ORDER_LIVE_READS_ENABLED ?? null,
      liveSyncValue: process.env.EXTERNAL_ORDER_LIVE_SYNC_ENABLED ?? null,
    },
    { headers: NO_STORE_HEADERS },
  );
}
