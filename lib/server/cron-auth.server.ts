import { NextResponse } from "next/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Validates Vercel cron / scheduled job requests via CRON_SECRET.
 * Never logs or returns the configured secret.
 */
export function validateCronSecret(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error("[cron] CRON_SECRET is not configured");
    return NextResponse.json(
      { ok: false, error: "cron_not_configured" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  const provided = readBearerToken(request);
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  return null;
}

export { NO_STORE_HEADERS as CRON_NO_STORE_HEADERS };
