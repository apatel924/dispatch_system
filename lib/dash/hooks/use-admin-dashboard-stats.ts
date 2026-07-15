"use client";

import { useQuery } from "@tanstack/react-query";
import { isApiEnabled } from "@/lib/dash/api/config";
import { fetchDashboardStats } from "@/lib/dash/api/client";
import { CACHE_DASHBOARD_STATS_MS } from "@/lib/dash/query/cache-policy";
import { dashboardKeys } from "@/lib/dash/query/query-keys";

export interface DashboardStatsView {
  newOrders: number;
  awaitingAssignment: number;
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
  returnedToday: number;
  failedReturnedToday: number;
  availableDrivers: number;
  busyDrivers: number;
  totalActiveDrivers: number;
  partialData: boolean;
  partialDataMessage?: string;
}

export function useAdminDashboardStats() {
  const apiEnabled = isApiEnabled();

  const query = useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async (): Promise<DashboardStatsView> => {
      const { stats } = await fetchDashboardStats();
      return {
        newOrders: stats.newOrders,
        awaitingAssignment: stats.awaitingAssignment,
        activeDeliveries: stats.activeDeliveries,
        completedToday: stats.completedToday,
        failedToday: stats.failedToday,
        returnedToday: stats.returnedToday,
        failedReturnedToday: stats.failedReturnedToday,
        availableDrivers: stats.availableDrivers,
        busyDrivers: stats.busyDrivers,
        totalActiveDrivers: stats.totalActiveDrivers,
        partialData: !stats.dataCoverage.complete,
        partialDataMessage: stats.dataCoverage.message,
      };
    },
    enabled: apiEnabled,
    staleTime: CACHE_DASHBOARD_STATS_MS,
  });

  return {
    /** Null until the first successful fetch — do not treat as genuine zeros. */
    stats: query.data ?? null,
    loading: apiEnabled && query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    hasData: Boolean(query.data),
  };
}
