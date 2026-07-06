"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import { ORDER_SYNC_POLL_MS } from "@/lib/delivery-workflow";
import {
  getMockDriverOrder,
  orderToDriverOrder,
} from "@/lib/dash/api/driver-adapters";
import { fetchDriverOrderDetail } from "@/lib/dash/api/driver-client";
import type { DeliveryStepKey, DriverOrder } from "@/lib/dash/driver-mock-data";
import type { OrderStatusEvent, ProofAsset } from "@/lib/types/backend";
import { usePolling } from "@/lib/dash/hooks/use-polling";

export function useDriverOrder(orderId: string) {
  const [order, setOrder] = useState<DriverOrder | null>(() =>
    getMockDriverOrder(orderId) ?? null,
  );
  const [completedSteps, setCompletedSteps] = useState<DeliveryStepKey[]>([]);
  const [proofs, setProofs] = useState<ProofAsset[]>([]);
  const [statusEvents, setStatusEvents] = useState<OrderStatusEvent[]>([]);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiEnabled = isApiEnabled();

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const mock = getMockDriverOrder(orderId) ?? null;

    if (!apiEnabled) {
      setOrder(mock);
      setCompletedSteps([]);
      setProofs([]);
      setStatusEvents([]);
      setSource("mock");
      setError(null);
      return;
    }

    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const { order: apiOrder, proofs: apiProofs, statusEvents: apiEvents } =
        await fetchDriverOrderDetail(orderId);
      setOrder(orderToDriverOrder(apiOrder));
      setCompletedSteps(apiOrder.completedSteps ?? []);
      setProofs(apiProofs);
      setStatusEvents(apiEvents);
      setSource("api");
    } catch (err) {
      if (!options?.silent) {
        setOrder(mock);
        setCompletedSteps([]);
        setProofs([]);
        setStatusEvents([]);
        setSource("mock");
      }
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [apiEnabled, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(
    () => load({ silent: true }),
    ORDER_SYNC_POLL_MS,
    apiEnabled,
  );

  return {
    order,
    completedSteps,
    proofs,
    statusEvents,
    source,
    loading,
    error,
    refresh: load,
  };
}
