"use client";

import { useQuery } from "@tanstack/react-query";
import { isApiEnabled } from "@/lib/dash/api/config";
import { fetchDashboardStats } from "@/lib/dash/api/client";
import { adminQueryKeys } from "@/lib/dash/query/admin-query-keys";

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

const EMPTY_STATS: DashboardStatsView = {
  newOrders: 0,
  awaitingAssignment: 0,
  activeDeliveries: 0,
  completedToday: 0,
  failedToday: 0,
  returnedToday: 0,
  failedReturnedToday: 0,
  availableDrivers: 0,
  busyDrivers: 0,
  totalActiveDrivers: 0,
  partialData: false,
};

export function useAdminDashboardStats() {
  const apiEnabled = isApiEnabled();

  const query = useQuery({
    queryKey: adminQueryKeys.dashboard.stats(),
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
  });

  return {
    stats: query.data ?? EMPTY_STATS,
    loading: apiEnabled && query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
