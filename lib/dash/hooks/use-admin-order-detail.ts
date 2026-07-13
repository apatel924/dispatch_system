"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled, isDevMockEnabled } from "@/lib/dash/api/config";
import { ORDER_SYNC_POLL_MS } from "@/lib/delivery-workflow";
import {
  mockOrderToAdminDetail,
  orderToAdminDetail,
  proofToAdminItem,
  type AdminOrderDetail,
  type AdminProofItem,
} from "@/lib/dash/api/adapters";
import {
  acknowledgeConsumerNoteApi,
  fetchDriverDetail,
  fetchOrderDetail,
  fetchOrderProofs,
} from "@/lib/dash/api/client";
import { usePolling } from "@/lib/dash/hooks/use-polling";
import type { ConsumerNote } from "@/lib/types/backend";

export function useAdminOrderDetail(orderId: string) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [proofs, setProofs] = useState<AdminProofItem[]>([]);
  const [consumerNotes, setConsumerNotes] = useState<ConsumerNote[]>([]);
  const [source, setSource] = useState<DataSource>("api");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiEnabled = isApiEnabled();

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (isDevMockEnabled()) {
      setDetail(mockOrderToAdminDetail(orderId));
      setProofs([]);
      setConsumerNotes([]);
      setSource("mock");
      setError(null);
      setLoading(false);
      return;
    }

    if (!apiEnabled) {
      setDetail(null);
      setProofs([]);
      setConsumerNotes([]);
      setSource("api");
      setError("API is not enabled. Set NEXT_PUBLIC_USE_API=true to load order details.");
      setLoading(false);
      return;
    }

    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const [{ order, statusEvents, consumerNotes: notes }, proofsRes] = await Promise.all([
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
      setConsumerNotes(notes ?? []);
      setSource("api");
    } catch (err) {
      if (!options?.silent) {
        setDetail(null);
        setProofs([]);
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

  return { detail, proofs, consumerNotes, source, loading, error, refresh: load };
}
