import {
  isBarnetUpstreamTimeoutError,
} from "@/lib/integrations/order-provider/barnet-client.server";
import {
  executeBarnetSync,
  type ExecuteBarnetSyncResult,
} from "@/lib/integrations/order-provider/execute-barnet-sync.server";

/** @deprecated Prefer ExecuteBarnetSyncResult — kept for cron route compatibility. */
export type BarnetCronSyncSkippedReason =
  | "sync_already_running"
  | "sync_disabled"
  | "provider_not_live"
  | "provider_not_configured"
  | "outside_operating_hours";

export type BarnetCronSyncResponse = ExecuteBarnetSyncResult;

/**
 * Cron entry — uses the shared sync orchestrator (operating hours + lock + metrics).
 */
export async function executeBarnetCronSync(
  runId: string,
): Promise<BarnetCronSyncResponse> {
  return executeBarnetSync({ runId, source: "cron" });
}

export { isBarnetUpstreamTimeoutError };
