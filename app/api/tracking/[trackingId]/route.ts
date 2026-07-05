import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ensureFirebaseConfigured } from "@/lib/server/route-utils";
import { getTrackingByTrackingId } from "@/lib/server/services/tracking";

type RouteContext = { params: Promise<{ trackingId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const { trackingId } = await context.params;

  try {
    const tracking = await getTrackingByTrackingId(trackingId);
    return NextResponse.json({ tracking });
  } catch (err) {
    return handleServiceError(err);
  }
}
