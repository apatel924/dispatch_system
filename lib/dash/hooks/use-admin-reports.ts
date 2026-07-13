"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled, isDevMockEnabled } from "@/lib/dash/api/config";
import {
  getMockAdminReports,
  reportsOverviewToAdminView,
  type AdminReportsView,
} from "@/lib/dash/api/adapters";
import { fetchReportsOverview } from "@/lib/dash/api/client";
import { adminQueryKeys } from "@/lib/dash/query/admin-query-keys";

const EMPTY_REPORTS: AdminReportsView = {
  period: { from: "", to: "" },
  comparePeriod: null,
  totals: {
    deliveries: 0,
    completed: 0,
    failed: 0,
    returned: 0,
    avgDeliveryTime: "—",
  },
  comparisons: null,
  statusBreakdown: { completed: 0, failed: 0, returned: 0 },
  drivers: [],
  trendDays: [],
  compareTrendDays: null,
};

async function fetchAdminReports(): Promise<{ reports: AdminReportsView; source: DataSource }> {
  if (isDevMockEnabled()) {
    return { reports: getMockAdminReports(), source: "mock" };
  }

  if (!isApiEnabled()) {
    throw new Error("API is not enabled. Set NEXT_PUBLIC_USE_API=true to load reports.");
  }

  const { overview } = await fetchReportsOverview();
  return { reports: reportsOverviewToAdminView(overview), source: "api" };
}

export function useAdminReports() {
  const queryClient = useQueryClient();
  const listKey = adminQueryKeys.reports.overview();

  const query = useQuery({
    queryKey: listKey,
    queryFn: fetchAdminReports,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: listKey });
  }, [queryClient, listKey]);

  return {
    reports: query.data?.reports ?? EMPTY_REPORTS,
    source: query.data?.source ?? (isDevMockEnabled() ? "mock" : "api"),
    loading: query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}
