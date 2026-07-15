"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled, shouldUseMockData } from "@/lib/dash/api/config";
import {
  CACHE_DRIVERS_LIST_MS,
  LIST_SYNC_POLL_MS,
} from "@/lib/dash/query/cache-policy";
import {
  driverToAdminRow,
  getMockAdminDrivers,
  mockDriverToAdminRow,
  type AdminDriverRow,
} from "@/lib/dash/api/adapters";
import { fetchDriverDetail, fetchDriversList } from "@/lib/dash/api/client";
import { drivers as mockDrivers } from "@/lib/dash/mock-data";
import {
  driverKeys,
  DRIVERS_POLL_ROUTES,
  shouldPollQuery,
} from "@/lib/dash/query/query-keys";

const DRIVERS_FETCH_LIMIT = 50;

function mockDriversFor(limit?: number): AdminDriverRow[] {
  const rows = getMockAdminDrivers();
  return limit ? rows.slice(0, limit) : rows.slice(0, DRIVERS_FETCH_LIMIT);
}

async function fetchAdminDriversList(): Promise<{
  rows: AdminDriverRow[];
  source: DataSource;
}> {
  if (shouldUseMockData()) {
    return { rows: mockDriversFor(), source: "mock" };
  }

  if (!isApiEnabled()) {
    throw new Error("API is not enabled. Set NEXT_PUBLIC_USE_API=true to load drivers.");
  }

  const result = await fetchDriversList({ limit: DRIVERS_FETCH_LIMIT });
  return {
    rows: result.drivers.map(driverToAdminRow),
    source: "api",
  };
}

export function useAdminDrivers(options?: { limit?: number }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const listKey = driverKeys.list();
  const displayLimit = options?.limit ?? DRIVERS_FETCH_LIMIT;

  const query = useQuery({
    queryKey: listKey,
    queryFn: fetchAdminDriversList,
    staleTime: CACHE_DRIVERS_LIST_MS,
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
    source: query.data?.source ?? (shouldUseMockData() ? "mock" : "api"),
    loading: query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}

export function useAdminDriver(driverId: string) {
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const detailKey = driverKeys.detail(driverId);

  const mockFallback = () => {
    const d = mockDrivers.find((x) => x.id === driverId);
    return d ? mockDriverToAdminRow(d) : null;
  };

  const query = useQuery({
    queryKey: detailKey,
    queryFn: async (): Promise<{ driver: AdminDriverRow | null; source: DataSource }> => {
      if (shouldUseMockData()) {
        return { driver: mockFallback(), source: "mock" };
      }

      if (!isApiEnabled()) {
        throw new Error("API is not enabled. Set NEXT_PUBLIC_USE_API=true to load driver details.");
      }

      const { driver: apiDriver } = await fetchDriverDetail(driverId);
      return { driver: driverToAdminRow(apiDriver), source: "api" };
    },
    staleTime: CACHE_DRIVERS_LIST_MS,
    placeholderData: keepPreviousData,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: detailKey });
    await queryClient.invalidateQueries({ queryKey: driverKeys.list() });
    await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  }, [queryClient, detailKey]);

  const applyDriverUpdate = useCallback(
    (row: AdminDriverRow) => {
      queryClient.setQueryData(detailKey, { driver: row, source: "api" as const });
      queryClient.setQueryData(
        driverKeys.list(),
        (current: { rows: AdminDriverRow[]; source: DataSource } | undefined) => {
          if (!current) return current;
          return {
            ...current,
            rows: current.rows.map((entry) => (entry.id === row.id ? row : entry)),
          };
        },
      );
    },
    [queryClient, detailKey],
  );

  return {
    driver: query.data?.driver ?? null,
    source: query.data?.source ?? (shouldUseMockData() ? "mock" : "api"),
    loading: query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
    applyDriverUpdate,
  };
}
