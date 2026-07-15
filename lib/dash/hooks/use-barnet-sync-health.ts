"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  fetchOrderProviderHealthWithSync,
  runLiveOrderProviderSync,
  type BarnetSyncHealthView,
  type OrderProviderHealthWithSync,
  type OrderProviderSyncResponse,
} from "@/lib/dash/api/client";
import { integrationKeys } from "@/lib/dash/query/query-keys";

/** Moderate poll while the Settings/integrations surface is mounted. */
const SYNC_HEALTH_POLL_MS = 30_000;

export function useBarnetSyncHealth(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const enabled = (options?.enabled ?? true) && isApiEnabled();

  const query = useQuery({
    queryKey: integrationKeys.barnetSyncHealth(),
    queryFn: fetchOrderProviderHealthWithSync,
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled
      ? () => {
          if (typeof document !== "undefined" && document.hidden) return false;
          return SYNC_HEALTH_POLL_MS;
        }
      : false,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: integrationKeys.barnetSyncHealth(),
    });
  }, [queryClient]);

  const runManualSync = useCallback(
    async (opts?: { overrideQuietHours?: boolean }) => {
      const result = await runLiveOrderProviderSync(opts);
      await queryClient.invalidateQueries({
        queryKey: integrationKeys.barnetSyncHealth(),
      });
      return result;
    },
    [queryClient],
  );

  const health: OrderProviderHealthWithSync | null = query.data ?? null;
  const syncHealth: BarnetSyncHealthView | null = health?.syncHealth ?? null;

  return {
    health,
    syncHealth,
    syncState: health?.syncState ?? null,
    loading: enabled && query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
    runManualSync,
  };
}

export type { OrderProviderSyncResponse };
