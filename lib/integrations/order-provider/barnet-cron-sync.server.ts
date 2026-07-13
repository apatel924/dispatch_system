import {
  isBarnetUpstreamTimeoutError,
} from "@/lib/integrations/order-provider/barnet-client.server";
import { getExternalOrderProviderConfig } from "@/lib/integrations/order-provider/env.server";
import { runBarnetOrderSync } from "@/lib/integrations/order-provider/run-barnet-order-sync.server";
import {
  acquireBarnetSyncLock,
  releaseBarnetSyncLock,
} from "@/lib/integrations/order-provider/sync-lock.server";

export type BarnetCronSyncSkippedReason =
  | "sync_already_running"
  | "sync_disabled"
  | "provider_not_live";

export type BarnetCronSyncResponse =
  | {
      ok: true;
      skipped: true;
      reason: BarnetCronSyncSkippedReason;
    }
  | {
      ok: true;
      pagesScanned: number;
      ordersSeen: number;
      deliveryCandidates: number;
      newDeliveries: number;
      updatedDeliveries: number;
      unchangedOrders: number;
      durationMs: number;
    }
  | {
      ok: false;
      error: "upstream_timeout" | "sync_failed";
      durationMs: number;
    };

export async function executeBarnetCronSync(
  runId: string,
): Promise<BarnetCronSyncResponse> {
  const config = getExternalOrderProviderConfig();

  if (config.mode !== "live") {
    return { ok: true, skipped: true, reason: "provider_not_live" };
  }

  if (!config.liveSyncEnabled) {
    return { ok: true, skipped: true, reason: "sync_disabled" };
  }

  const lock = await acquireBarnetSyncLock(runId);
  if (lock === "skipped") {
    return { ok: true, skipped: true, reason: "sync_already_running" };
  }

  const startedAt = Date.now();

  try {
    const result = await runBarnetOrderSync();
    return {
      ok: true,
      pagesScanned: result.pagesScanned,
      ordersSeen: result.ordersSeen,
      deliveryCandidates: result.deliveryCandidates,
      newDeliveries: result.newDeliveries,
      updatedDeliveries: result.updatedDeliveries,
      unchangedOrders: result.unchangedOrders,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    if (isBarnetUpstreamTimeoutError(err)) {
      return {
        ok: false,
        error: "upstream_timeout",
        durationMs: Date.now() - startedAt,
      };
    }

    const message = err instanceof Error ? err.message : "Live sync failed";
    console.error("[cron] barnet sync failed:", message);
    return {
      ok: false,
      error: "sync_failed",
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await releaseBarnetSyncLock(runId);
  }
}
