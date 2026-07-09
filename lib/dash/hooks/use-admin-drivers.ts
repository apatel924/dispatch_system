"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import { LIST_SYNC_POLL_MS } from "@/lib/delivery-workflow";
import {
  driverToAdminRow,
  getMockAdminDrivers,
  mockDriverToAdminRow,
  type AdminDriverRow,
} from "@/lib/dash/api/adapters";
import { fetchDriverDetail, fetchDriversList } from "@/lib/dash/api/client";
import { drivers as mockDrivers } from "@/lib/dash/mock-data";
import {
  adminQueryKeys,
  DRIVERS_POLL_ROUTES,
  shouldPollQuery,
} from "@/lib/dash/query/admin-query-keys";

const DRIVERS_FETCH_LIMIT = 50;

function mockDriversFor(limit?: number): AdminDriverRow[] {
  const rows = getMockAdminDrivers();
  return limit ? rows.slice(0, limit) : rows.slice(0, DRIVERS_FETCH_LIMIT);
}

async function fetchAdminDriversList(): Promise<{
  rows: AdminDriverRow[];
  source: DataSource;
  error?: string;
}> {
  if (!isApiEnabled()) {
    return { rows: mockDriversFor(), source: "mock" };
  }

  try {
    const result = await fetchDriversList({ limit: DRIVERS_FETCH_LIMIT });
    return {
      rows: result.drivers.map(driverToAdminRow),
      source: "api",
    };
  } catch (err) {
    return {
      rows: mockDriversFor(),
      source: "mock",
      error: err instanceof Error ? err.message : "Failed to load drivers",
    };
  }
}

export function useAdminDrivers(options?: { limit?: number }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const listKey = adminQueryKeys.drivers.list();
  const displayLimit = options?.limit ?? DRIVERS_FETCH_LIMIT;

  const query = useQuery({
    queryKey: listKey,
    queryFn: fetchAdminDriversList,
    placeholderData: keepPreviousData,
    refetchInterval: apiEnabled
      ? () =>
          shouldPollQuery(pathname, DRIVERS_POLL_ROUTES)
            ? LIST_SYNC_POLL_MS
            : false
      : false,
  });

  const drivers = useMemo(() => {
    if (!query.data) return [];
    return query.data.rows.slice(0, displayLimit);
  }, [query.data, displayLimit]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: listKey });
  }, [queryClient, listKey]);

  return {
    drivers,
    source: query.data?.source ?? (apiEnabled ? "api" : "mock"),
    loading: query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error: query.data?.error ?? (query.error instanceof Error ? query.error.message : null),
    refresh,
  };
}

export function useAdminDriver(driverId: string) {
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const detailKey = adminQueryKeys.drivers.detail(driverId);

  const mockFallback = () => {
    const d = mockDrivers.find((x) => x.id === driverId);
    return d ? mockDriverToAdminRow(d) : null;
  };

  const query = useQuery({
    queryKey: detailKey,
    queryFn: async (): Promise<{ driver: AdminDriverRow | null; source: DataSource }> => {
      if (!isApiEnabled()) {
        return { driver: mockFallback(), source: "mock" };
      }

      try {
        const { driver: apiDriver } = await fetchDriverDetail(driverId);
        return { driver: driverToAdminRow(apiDriver), source: "api" };
      } catch {
        return { driver: mockFallback(), source: "mock" };
      }
    },
    placeholderData: keepPreviousData,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: detailKey });
  }, [queryClient, detailKey]);

  return {
    driver: query.data?.driver ?? null,
    source: query.data?.source ?? (apiEnabled ? "api" : "mock"),
    loading: query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}
