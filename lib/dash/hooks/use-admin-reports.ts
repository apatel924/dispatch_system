"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled, shouldUseMockData } from "@/lib/dash/api/config";
import {
  getMockAdminReports,
  reportsOverviewToAdminView,
  type AdminReportsView,
} from "@/lib/dash/api/adapters";
import { fetchReportsOverview } from "@/lib/dash/api/client";
import { CACHE_REPORTS_MS } from "@/lib/dash/query/cache-policy";
import { reportKeys } from "@/lib/dash/query/query-keys";

async function fetchAdminReports(): Promise<{ reports: AdminReportsView; source: DataSource }> {
  if (shouldUseMockData()) {
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
  const listKey = reportKeys.overview();

  const query = useQuery({
    queryKey: listKey,
    queryFn: fetchAdminReports,
    staleTime: CACHE_REPORTS_MS,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: listKey });
  }, [queryClient, listKey]);

  return {
    /** Null until first success — pages must skeleton rather than showing fake zeros. */
    reports: query.data?.reports ?? null,
    source: query.data?.source ?? (shouldUseMockData() ? "mock" : "api"),
    loading: query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}
