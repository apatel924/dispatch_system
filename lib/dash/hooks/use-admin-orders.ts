"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  getMockAdminOrders,
  orderToAdminRow,
  type AdminOrderRow,
} from "@/lib/dash/api/adapters";
import { fetchOrdersList } from "@/lib/dash/api/client";
import { drivers as mockDrivers } from "@/lib/dash/mock-data";

function filterMockByDriverId(rows: AdminOrderRow[], driverId?: string): AdminOrderRow[] {
  if (!driverId) return rows;
  const d = mockDrivers.find((x) => x.id === driverId);
  if (!d) return [];
  return rows.filter((o) => o.driver === d.name);
}

export function useAdminOrders(options?: { driverId?: string; limit?: number }) {
  const [orders, setOrders] = useState<AdminOrderRow[]>(getMockAdminOrders);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const applyLimit = (rows: AdminOrderRow[]) =>
      options?.limit ? rows.slice(0, options.limit) : rows;

    if (!isApiEnabled()) {
      setOrders(applyLimit(filterMockByDriverId(getMockAdminOrders(), options?.driverId)));
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchOrdersList({
        limit: options?.limit ?? 50,
        driverId: options?.driverId,
      });
      setOrders(result.orders.map(orderToAdminRow));
      setSource("api");
    } catch (err) {
      setOrders(
        applyLimit(filterMockByDriverId(getMockAdminOrders(), options?.driverId)),
      );
      setSource("mock");
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [options?.driverId, options?.limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { orders, source, loading, error, refresh: load };
}
