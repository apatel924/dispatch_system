"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
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

export function useAdminOrderDetail(orderId: string) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(() =>
    mockOrderToAdminDetail(orderId),
  );
  const [proofs, setProofs] = useState<AdminProofItem[]>([]);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setDetail(mockOrderToAdminDetail(orderId));
      setProofs([]);
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
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
      setDetail(mockOrderToAdminDetail(orderId));
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

  return { detail, proofs, source, loading, error, refresh: load };
}
