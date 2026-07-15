"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled, shouldUseMockData } from "@/lib/dash/api/config";
import {
  CACHE_DRIVER_ORDERS_MS,
  ORDER_SYNC_POLL_MS,
} from "@/lib/dash/query/cache-policy";
import {
  getMockActiveOrders,
  getMockCompletedOrders,
  orderToDriverOrder,
  splitDriverOrders,
} from "@/lib/dash/api/driver-adapters";
import { fetchDriverOrders } from "@/lib/dash/api/driver-client";
import type { DriverOrder as UiDriverOrder } from "@/lib/dash/driver-mock-data";
import { useDriverSession } from "@/lib/dash/hooks/use-driver-session";
import {
  DRIVER_ORDERS_POLL_ROUTES,
  driverKeys,
  shouldPollQuery,
} from "@/lib/dash/query/query-keys";

type CompletedRow = Pick<UiDriverOrder, "id" | "customer" | "eta">;

type OrdersBundle = {
  activeOrders: UiDriverOrder[];
  completedOrders: CompletedRow[];
  source: DataSource;
};

async function fetchDriverOrdersBundle(): Promise<OrdersBundle> {
  if (shouldUseMockData()) {
    return {
      activeOrders: getMockActiveOrders(),
      completedOrders: getMockCompletedOrders(),
      source: "mock",
    };
  }
  if (!isApiEnabled()) {
    throw new Error("API is not enabled. Set NEXT_PUBLIC_USE_API=true.");
  }

  const [activeRes, completedRes] = await Promise.all([
    fetchDriverOrders("active"),
    fetchDriverOrders("completed"),
  ]);

  const active = activeRes.orders.map(orderToDriverOrder);
  const completedFromApi = completedRes.orders.map(orderToDriverOrder);
  const { completed: splitCompleted } = splitDriverOrders(completedFromApi);

  return {
    activeOrders: active,
    completedOrders:
      splitCompleted.length > 0
        ? splitCompleted
        : completedFromApi.map((o) => ({
            id: o.id,
            customer: o.customer,
            eta: o.eta,
          })),
    source: "api",
  };
}

export function useDriverOrders() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { driverId } = useDriverSession();
  const apiEnabled = isApiEnabled();
  const mockMode = shouldUseMockData();
  const scopeKey = driverId ?? (mockMode ? "mock" : "pending");

  const query = useQuery({
    queryKey: driverKeys.orders(scopeKey, "active"),
    queryFn: fetchDriverOrdersBundle,
    enabled: mockMode || (apiEnabled && Boolean(driverId)),
    staleTime: CACHE_DRIVER_ORDERS_MS,
    placeholderData: keepPreviousData,
    refetchInterval: () => {
      if (!apiEnabled || !driverId) return false;
      if (!shouldPollQuery(pathname, DRIVER_ORDERS_POLL_ROUTES)) return false;
      return ORDER_SYNC_POLL_MS;
    },
  });

  const refresh = useCallback(
    async (_opts?: { silent?: boolean }) => {
      await queryClient.invalidateQueries({
        queryKey: driverKeys.orders(scopeKey, "active"),
      });
    },
    [queryClient, scopeKey],
  );

  return {
    activeOrders: query.data?.activeOrders ?? [],
    completedOrders: query.data?.completedOrders ?? [],
    source: query.data?.source ?? (mockMode ? "mock" : "api"),
    loading:
      mockMode
        ? false
        : (apiEnabled && !driverId) || (query.isPending && !query.data),
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}

export function useDriverRouteOrders() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { driverId } = useDriverSession();
  const apiEnabled = isApiEnabled();
  const mockMode = shouldUseMockData();
  const scopeKey = driverId ?? (mockMode ? "mock" : "pending");

  const query = useQuery({
    queryKey: driverKeys.orders(scopeKey, "route"),
    queryFn: async (): Promise<{ stops: UiDriverOrder[]; source: DataSource }> => {
      if (shouldUseMockData()) {
        return { stops: getMockActiveOrders(), source: "mock" };
      }
      if (!isApiEnabled()) {
        throw new Error("API is not enabled. Set NEXT_PUBLIC_USE_API=true.");
      }
      const { orders } = await fetchDriverOrders("route");
      return { stops: orders.map(orderToDriverOrder), source: "api" };
    },
    enabled: mockMode || (apiEnabled && Boolean(driverId)),
    staleTime: CACHE_DRIVER_ORDERS_MS,
    placeholderData: keepPreviousData,
    refetchInterval: () => {
      if (!apiEnabled || !driverId) return false;
      if (!shouldPollQuery(pathname, DRIVER_ORDERS_POLL_ROUTES)) return false;
      return ORDER_SYNC_POLL_MS;
    },
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: driverKeys.orders(scopeKey, "route"),
    });
  }, [queryClient, scopeKey]);

  return {
    stops: query.data?.stops ?? [],
    source: query.data?.source ?? (mockMode ? "mock" : "api"),
    loading:
      mockMode
        ? false
        : (apiEnabled && !driverId) || (query.isPending && !query.data),
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}
