"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  getMockActiveOrders,
  getMockCompletedOrders,
  orderToDriverOrder,
  splitDriverOrders,
} from "@/lib/dash/api/driver-adapters";
import { fetchDriverOrders } from "@/lib/dash/api/driver-client";
import type { DriverOrder as UiDriverOrder } from "@/lib/dash/driver-mock-data";

type CompletedRow = Pick<UiDriverOrder, "id" | "customer" | "eta">;

export function useDriverOrders() {
  const [activeOrders, setActiveOrders] = useState<UiDriverOrder[]>(getMockActiveOrders);
  const [completedOrders, setCompletedOrders] = useState<CompletedRow[]>(getMockCompletedOrders);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setActiveOrders(getMockActiveOrders());
      setCompletedOrders(getMockCompletedOrders());
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetchDriverOrders("active"),
        fetchDriverOrders("completed"),
      ]);

      const active = activeRes.orders.map(orderToDriverOrder);
      const completedFromApi = completedRes.orders.map(orderToDriverOrder);
      const { completed: splitCompleted } = splitDriverOrders(completedFromApi);

      setActiveOrders(active.length > 0 ? active : getMockActiveOrders());
      setCompletedOrders(
        splitCompleted.length > 0 ? splitCompleted : completedFromApi.map((o) => ({
          id: o.id,
          customer: o.customer,
          eta: o.eta,
        })),
      );
      setSource("api");
    } catch (err) {
      setActiveOrders(getMockActiveOrders());
      setCompletedOrders(getMockCompletedOrders());
      setSource("mock");
      setError(err instanceof Error ? err.message : "Failed to load driver orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setStops(getMockActiveOrders());
      setSource("mock");
      return;
    }

    setLoading(true);
    try {
      const { orders } = await fetchDriverOrders("route");
      const mapped = orders.map(orderToDriverOrder);
      setStops(mapped.length > 0 ? mapped : getMockActiveOrders());
      setSource("api");
    } catch {
      setStops(getMockActiveOrders());
      setSource("mock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stops, source, loading, refresh: load };
}
