"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import { ORDER_SYNC_POLL_MS } from "@/lib/delivery-workflow";
import {
  mockOrderToAdminDetail,
  orderToAdminDetail,
  proofToAdminItem,
  type AdminOrderDetail,
  type AdminProofItem,
} from "@/lib/dash/api/adapters";
import {
  fetchDriverDetail,
  fetchOrderDetail,
  fetchOrderProofs,
} from "@/lib/dash/api/client";
import { usePolling } from "@/lib/dash/hooks/use-polling";

export function useAdminOrderDetail(orderId: string) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(() =>
    mockOrderToAdminDetail(orderId),
  );
  const [proofs, setProofs] = useState<AdminProofItem[]>([]);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiEnabled = isApiEnabled();

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!apiEnabled) {
      setDetail(mockOrderToAdminDetail(orderId));
      setProofs([]);
      setSource("mock");
      setError(null);
      return;
    }

    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const [{ order, statusEvents }, proofsRes] = await Promise.all([
        fetchOrderDetail(orderId),
        fetchOrderProofs(orderId).catch(() => ({ proofs: [] })),
      ]);

      let assignedDriver = null;
      if (order.assignedDriverId) {
        try {
          const { driver } = await fetchDriverDetail(order.assignedDriverId);
          assignedDriver = driver;
        } catch {
          assignedDriver = null;
        }
      }

      setDetail(orderToAdminDetail(order, statusEvents, assignedDriver));
      setProofs(proofsRes.proofs.map(proofToAdminItem));
      setSource("api");
    } catch (err) {
      if (!options?.silent) {
        setDetail(mockOrderToAdminDetail(orderId));
        setProofs([]);
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

  return { detail, proofs, source, loading, error, refresh: load };
}
