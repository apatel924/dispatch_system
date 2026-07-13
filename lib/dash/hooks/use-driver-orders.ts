"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import { ORDER_SYNC_POLL_MS } from "@/lib/delivery-workflow";
import {
  getMockActiveOrders,
  getMockCompletedOrders,
  orderToDriverOrder,
  splitDriverOrders,
} from "@/lib/dash/api/driver-adapters";
import { fetchDriverOrders } from "@/lib/dash/api/driver-client";
import type { DriverOrder as UiDriverOrder } from "@/lib/dash/driver-mock-data";
import { usePolling } from "@/lib/dash/hooks/use-polling";

type CompletedRow = Pick<UiDriverOrder, "id" | "customer" | "eta">;

export function useDriverOrders() {
  const [activeOrders, setActiveOrders] = useState<UiDriverOrder[]>(getMockActiveOrders);
  const [completedOrders, setCompletedOrders] = useState<CompletedRow[]>(getMockCompletedOrders);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiEnabled = isApiEnabled();

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!apiEnabled) {
      setActiveOrders(getMockActiveOrders());
      setCompletedOrders(getMockCompletedOrders());
      setSource("mock");
      setError(null);
      return;
    }

    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetchDriverOrders("active"),
        fetchDriverOrders("completed"),
      ]);

      const active = activeRes.orders.map(orderToDriverOrder);
      const completedFromApi = completedRes.orders.map(orderToDriverOrder);
      const { completed: splitCompleted } = splitDriverOrders(completedFromApi);

      setActiveOrders(active);
      setCompletedOrders(
        splitCompleted.length > 0
          ? splitCompleted
          : completedFromApi.map((o) => ({
              id: o.id,
              customer: o.customer,
              eta: o.eta,
            })),
      );
      setSource("api");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load driver orders");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(
    () => load({ silent: true }),
    ORDER_SYNC_POLL_MS,
    apiEnabled,
  );

  return {
    activeOrders,
    completedOrders,
    source,
    loading,
    error,
    refresh: load,
  };
}

export function useDriverRouteOrders() {
  const [stops, setStops] = useState<UiDriverOrder[]>(getMockActiveOrders);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setStops(getMockActiveOrders());
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { orders } = await fetchDriverOrders("route");
      setStops(orders.map(orderToDriverOrder));
      setSource("api");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load route stops");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stops, source, loading, error, refresh: load };
}
