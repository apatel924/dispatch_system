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
  getMockAdminOrders,
  orderToAdminRow,
  type AdminOrderRow,
} from "@/lib/dash/api/adapters";
import { fetchOrdersList } from "@/lib/dash/api/client";
import { drivers as mockDrivers } from "@/lib/dash/mock-data";
import {
  adminQueryKeys,
  ORDERS_POLL_ROUTES,
  shouldPollQuery,
} from "@/lib/dash/query/admin-query-keys";

const ORDERS_FETCH_LIMIT = 50;

function filterMockByDriverId(rows: AdminOrderRow[], driverId?: string): AdminOrderRow[] {
  if (!driverId) return rows;
  const d = mockDrivers.find((x) => x.id === driverId);
  if (!d) return [];
  return rows.filter((o) => o.driver === d.name);
}

function mockOrdersFor(options?: { driverId?: string; limit?: number }): AdminOrderRow[] {
  const rows = filterMockByDriverId(getMockAdminOrders(), options?.driverId);
  const limit = options?.limit ?? ORDERS_FETCH_LIMIT;
  return rows.slice(0, limit);
}

async function fetchAdminOrdersList(options?: {
  driverId?: string;
}): Promise<{ rows: AdminOrderRow[]; source: DataSource; fetchError?: string }> {
  if (!isApiEnabled()) {
    return { rows: mockOrdersFor(options), source: "mock" };
  }

  try {
    const result = await fetchOrdersList({
      limit: ORDERS_FETCH_LIMIT,
      driverId: options?.driverId,
    });
    return {
      rows: result.orders.map(orderToAdminRow),
      source: "api",
    };
  } catch (err) {
    return {
      rows: filterMockByDriverId(getMockAdminOrders(), options?.driverId).slice(
        0,
        ORDERS_FETCH_LIMIT,
      ),
      source: "mock",
      fetchError: err instanceof Error ? err.message : "Failed to load orders",
    };
  }
}

export function useAdminOrders(options?: { driverId?: string; limit?: number }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const listKey = adminQueryKeys.orders.list({ driverId: options?.driverId });
  const displayLimit = options?.limit ?? ORDERS_FETCH_LIMIT;

  const query = useQuery({
    queryKey: listKey,
    queryFn: () => fetchAdminOrdersList({ driverId: options?.driverId }),
    placeholderData: keepPreviousData,
    refetchInterval: apiEnabled
      ? () =>
          shouldPollQuery(pathname, ORDERS_POLL_ROUTES)
            ? LIST_SYNC_POLL_MS
            : false
      : false,
  });

  const orders = useMemo(() => {
    if (!query.data) return [];
    return query.data.rows.slice(0, displayLimit);
  }, [query.data, displayLimit]);

  const refresh = useCallback(
    async (_opts?: { silent?: boolean }) => {
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
    [queryClient, listKey],
  );

  return {
    orders,
    source: query.data?.source ?? (apiEnabled ? "api" : "mock"),
    loading: query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error:
      query.error instanceof Error
        ? query.error.message
        : (query.data?.fetchError ?? null),
    refresh,
  };
}
