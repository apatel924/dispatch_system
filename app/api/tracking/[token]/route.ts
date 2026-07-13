import { ServiceError, trackingInvalidError } from "@/lib/server/errors";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ensureFirebaseConfigured } from "@/lib/server/route-utils";
import { getClientIp } from "@/lib/server/rate-limit";
import { getConsumerTrackingByToken } from "@/lib/server/services/consumer-tracking";
import {
  enforceTrackingInvalidRateLimit,
  enforceTrackingReadRateLimit,
} from "@/lib/server/services/tracking-links";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const { token } = await context.params;
  const clientIp = getClientIp(request);

  try {
    await enforceTrackingReadRateLimit(token, clientIp);
    const tracking = await getConsumerTrackingByToken(token);
    return NextResponse.json(
      { tracking },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    if (err instanceof ServiceError && err.code === "TRACKING_INVALID") {
      try {
        await enforceTrackingInvalidRateLimit(clientIp);
      } catch (rateErr) {
        return handleServiceError(rateErr);
      }
      return handleServiceError(trackingInvalidError());
    }
    return handleServiceError(err);
  }
}
