"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import { ORDER_SYNC_POLL_MS } from "@/lib/delivery-workflow";
import {
  getMockAdminOrders,
  orderToAdminRow,
  type AdminOrderRow,
} from "@/lib/dash/api/adapters";
import { fetchOrdersList } from "@/lib/dash/api/client";
import { drivers as mockDrivers } from "@/lib/dash/mock-data";
import { usePolling } from "@/lib/dash/hooks/use-polling";

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
  const apiEnabled = isApiEnabled();

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const applyLimit = (rows: AdminOrderRow[]) =>
      options?.limit ? rows.slice(0, options.limit) : rows;

    if (!apiEnabled) {
      setOrders(applyLimit(filterMockByDriverId(getMockAdminOrders(), options?.driverId)));
      setSource("mock");
      setError(null);
      return;
    }

    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchOrdersList({
        limit: options?.limit ?? 50,
        driverId: options?.driverId,
      });
      setOrders(result.orders.map(orderToAdminRow));
      setSource("api");
    } catch (err) {
      if (!opts?.silent) {
        setOrders(
          applyLimit(filterMockByDriverId(getMockAdminOrders(), options?.driverId)),
        );
        setSource("mock");
      }
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [apiEnabled, options?.driverId, options?.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(
    () => load({ silent: true }),
    ORDER_SYNC_POLL_MS,
    apiEnabled,
  );

  return { orders, source, loading, error, refresh: load };
}
