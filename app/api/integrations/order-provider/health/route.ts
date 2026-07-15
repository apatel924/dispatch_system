import { NextResponse } from "next/server";
import { serverError } from "@/lib/server/api-response";
import { requireRole } from "@/lib/server/auth";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import {
  getExternalOrderProviderSyncState,
  getOrderProviderHealth,
} from "@/lib/integrations/order-provider/index.server";
import { getBarnetSyncHealthView } from "@/lib/integrations/order-provider/execute-barnet-sync.server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeSyncState = url.searchParams.get("includeSyncState") === "true";

    if (includeSyncState) {
      const configError = ensureFirebaseConfigured();
      if (configError) return configError;

      const user = await requireRole(request, ["admin"]);
      if (isErrorResponse(user)) return user;

      const [health, syncState, syncHealth] = await Promise.all([
        Promise.resolve(getOrderProviderHealth()),
        getExternalOrderProviderSyncState(),
        getBarnetSyncHealthView(),
      ]);
      return NextResponse.json({
        ...health,
        syncState,
        syncHealth: {
          state: syncHealth.state,
          message: syncHealth.message,
          outsideOperatingHours: syncHealth.outsideOperatingHours,
          isRunning: syncHealth.isRunning,
          isLocked: syncHealth.isLocked,
          lastAttemptedSyncAt: syncHealth.lastAttemptedSyncAt,
          lastSuccessfulSyncAt: syncHealth.lastSuccessfulSyncAt,
          lastScanAt: syncHealth.syncState.lastScanAt ?? null,
          lastNewOrderImportedAt: syncHealth.syncState.lastNewOrderImportedAt ?? null,
          lastResult: syncHealth.syncState.lastResult ?? null,
          lastDurationMs: syncHealth.lastDurationMs,
          lastSafeErrorMessage: syncHealth.lastSafeErrorMessage,
          lastErrorCode: syncHealth.lastErrorCode,
          lastRunStatus: syncHealth.lastRunStatus,
          counts: syncHealth.counts,
          nextExpectedEligibleScanAt: syncHealth.nextExpectedEligibleScanAt,
        },
      });
    }

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
