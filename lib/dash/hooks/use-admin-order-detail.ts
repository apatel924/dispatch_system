"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled, shouldUseMockData } from "@/lib/dash/api/config";
import {
  CACHE_ORDER_DETAIL_MS,
  ORDER_SYNC_POLL_MS,
} from "@/lib/dash/query/cache-policy";
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
import type { ConsumerNote } from "@/lib/types/backend";
import { orderKeys } from "@/lib/dash/query/query-keys";

type AdminOrderDetailBundle = {
  detail: AdminOrderDetail;
  proofs: AdminProofItem[];
  consumerNotes: ConsumerNote[];
  source: DataSource;
};

export function useAdminOrderDetail(orderId: string) {
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const mockMode = shouldUseMockData();

  const query = useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: async (): Promise<AdminOrderDetailBundle> => {
      if (shouldUseMockData()) {
        const detail = mockOrderToAdminDetail(orderId);
        if (!detail) throw new Error("Order not found");
        return { detail, proofs: [], consumerNotes: [], source: "mock" };
      }
      if (!apiEnabled) {
        throw new Error(
          "API is not enabled. Set NEXT_PUBLIC_USE_API=true to load order details.",
        );
      }

      const [{ order, statusEvents, consumerNotes: notes }, proofsRes] =
        await Promise.all([
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

      return {
        detail: orderToAdminDetail(order, statusEvents, assignedDriver),
        proofs: proofsRes.proofs.map(proofToAdminItem),
        consumerNotes: notes ?? [],
        source: "api",
      };
    },
    enabled: Boolean(orderId) && (mockMode || apiEnabled),
    staleTime: CACHE_ORDER_DETAIL_MS,
    placeholderData: keepPreviousData,
    refetchInterval: () => {
      if (!apiEnabled) return false;
      if (typeof document !== "undefined" && document.hidden) return false;
      return ORDER_SYNC_POLL_MS;
    },
  });

  const refresh = useCallback(
    async (_options?: { silent?: boolean }) => {
      await queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
    [queryClient, orderId],
  );

  return {
    detail: query.data?.detail ?? null,
    proofs: query.data?.proofs ?? [],
    consumerNotes: query.data?.consumerNotes ?? [],
    source: query.data?.source ?? (mockMode ? "mock" : "api"),
    loading: mockMode ? false : query.isPending && !query.data,
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}
