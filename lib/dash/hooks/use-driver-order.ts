"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  getMockDriverOrder,
  orderToDriverOrder,
} from "@/lib/dash/api/driver-adapters";
import { fetchDriverOrderDetail } from "@/lib/dash/api/driver-client";
import type { DeliveryStepKey, DriverOrder } from "@/lib/dash/driver-mock-data";
import type { ProofAsset } from "@/lib/types/backend";

export function useDriverOrder(orderId: string) {
  const [order, setOrder] = useState<DriverOrder | null>(() =>
    getMockDriverOrder(orderId) ?? null,
  );
  const [completedSteps, setCompletedSteps] = useState<DeliveryStepKey[]>([]);
  const [proofs, setProofs] = useState<ProofAsset[]>([]);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mock = getMockDriverOrder(orderId) ?? null;

    if (!isApiEnabled()) {
      setOrder(mock);
      setCompletedSteps([]);
      setProofs([]);
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { order: apiOrder, proofs: apiProofs } = await fetchDriverOrderDetail(orderId);
      setOrder(orderToDriverOrder(apiOrder));
      setCompletedSteps(apiOrder.completedSteps ?? []);
      setProofs(apiProofs);
      setSource("api");
    } catch (err) {
      setOrder(mock);
      setCompletedSteps([]);
      setProofs([]);
      setSource("mock");
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  return { order, completedSteps, proofs, source, loading, error, refresh: load };
}
