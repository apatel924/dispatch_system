import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { executeBarnetCronSync } from "@/lib/integrations/order-provider/barnet-cron-sync.server";
import {
  CRON_NO_STORE_HEADERS,
  validateCronSecret,
} from "@/lib/server/cron-auth.server";
import { ensureFirebaseConfigured } from "@/lib/server/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Hobby caps at 10s; Pro supports up to 300s. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const configError = ensureFirebaseConfigured();
  if (configError) {
    return NextResponse.json(
      { ok: false, error: "firebase_not_configured" },
      { status: 500, headers: CRON_NO_STORE_HEADERS },
    );
  }

  const runId = randomUUID();
  const result = await executeBarnetCronSync(runId);

  if (!result.ok && result.error === "upstream_timeout") {
    return NextResponse.json(result, {
      status: 504,
      headers: CRON_NO_STORE_HEADERS,
    });
  }

  if (!result.ok) {
    return NextResponse.json(result, {
      status: 500,
      headers: CRON_NO_STORE_HEADERS,
    });
  }

  // Successful runs and intentional skips (quiet hours, locked, disabled) → 200
  return NextResponse.json(result, { headers: CRON_NO_STORE_HEADERS });
}
