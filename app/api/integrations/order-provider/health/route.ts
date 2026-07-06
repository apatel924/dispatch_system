import { NextResponse } from "next/server";
import { serverError } from "@/lib/server/api-response";
import { getOrderProviderHealth } from "@/lib/integrations/order-provider/index.server";

export async function GET() {
  try {
    const health = getOrderProviderHealth();
    return NextResponse.json(health);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "External order provider configuration is invalid";
    console.error("[order-provider] health check failed:", message);
    return serverError(message);
  }
}
