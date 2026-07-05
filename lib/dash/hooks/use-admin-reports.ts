"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  getMockAdminReports,
  reportsOverviewToAdminView,
  type AdminReportsView,
} from "@/lib/dash/api/adapters";
import { fetchReportsOverview } from "@/lib/dash/api/client";

export function useAdminReports() {
  const [reports, setReports] = useState<AdminReportsView>(getMockAdminReports);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setReports(getMockAdminReports());
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { overview } = await fetchReportsOverview();
      setReports(reportsOverviewToAdminView(overview));
      setSource("api");
    } catch (err) {
      setReports(getMockAdminReports());
      setSource("mock");
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { reports, source, loading, error, refresh: load };
}
