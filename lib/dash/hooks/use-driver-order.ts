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
  getMockDriverOrder,
  orderToDriverOrder,
} from "@/lib/dash/api/driver-adapters";
import { fetchDriverOrderDetail } from "@/lib/dash/api/driver-client";
import type { DeliveryStepKey, DriverOrder } from "@/lib/dash/driver-mock-data";
import type { ConsumerNote, OrderStatusEvent, ProofAsset } from "@/lib/types/backend";
import { useDriverSession } from "@/lib/dash/hooks/use-driver-session";
import { driverKeys } from "@/lib/dash/query/query-keys";

type DriverOrderDetailBundle = {
  order: DriverOrder;
  completedSteps: DeliveryStepKey[];
  proofs: ProofAsset[];
  statusEvents: OrderStatusEvent[];
  consumerNotes: ConsumerNote[];
  source: DataSource;
};

const EMPTY_COMPLETED_STEPS: DeliveryStepKey[] = [];
const EMPTY_PROOFS: ProofAsset[] = [];
const EMPTY_STATUS_EVENTS: OrderStatusEvent[] = [];
const EMPTY_CONSUMER_NOTES: ConsumerNote[] = [];

/** Stable fingerprint of server proof identity — excludes rotating signed download URLs. */
export function serverProofIdentityKey(proofs: ProofAsset[]): string {
  return proofs
    .filter((p) => p.type === "signature" || p.type === "exteriorPhoto")
    .map(
      (p) =>
        `${p.type}:${p.id}:${p.storagePath ?? ""}:${p.uploadedAt ?? ""}`,
    )
    .sort()
    .join("|");
}

export function completedStepsIdentityKey(steps: DeliveryStepKey[]): string {
  return [...steps].sort().join("|");
}

export function useDriverOrder(orderId: string) {
  const queryClient = useQueryClient();
  const { driverId } = useDriverSession();
  const apiEnabled = isApiEnabled();
  const mockMode = shouldUseMockData();
  const scopeKey = driverId ?? (mockMode ? "mock" : "pending");

  const query = useQuery({
    queryKey: driverKeys.orderDetail(scopeKey, orderId),
    queryFn: async (): Promise<DriverOrderDetailBundle> => {
      if (shouldUseMockData()) {
        const mock = getMockDriverOrder(orderId);
        if (!mock) throw new Error("Order not found");
        return {
          order: mock,
          completedSteps: [],
          proofs: [],
          statusEvents: [],
          consumerNotes: [],
          source: "mock",
        };
      }
      if (!isApiEnabled()) {
        throw new Error("API is not enabled. Set NEXT_PUBLIC_USE_API=true.");
      }
      const { order: apiOrder, proofs, statusEvents, consumerNotes } =
        await fetchDriverOrderDetail(orderId);
      return {
        order: orderToDriverOrder(apiOrder),
        completedSteps: apiOrder.completedSteps ?? [],
        proofs,
        statusEvents,
        consumerNotes: consumerNotes ?? [],
        source: "api",
      };
    },
    enabled: Boolean(orderId) && (mockMode || (apiEnabled && Boolean(driverId))),
    staleTime: CACHE_ORDER_DETAIL_MS,
    placeholderData: keepPreviousData,
    refetchInterval: () => {
      if (!apiEnabled || !driverId) return false;
      if (typeof document !== "undefined" && document.hidden) return false;
      return ORDER_SYNC_POLL_MS;
    },
  });

  const refresh = useCallback(
    async (_options?: { silent?: boolean }) => {
      await queryClient.invalidateQueries({
        queryKey: driverKeys.orderDetail(scopeKey, orderId),
      });
    },
    [queryClient, scopeKey, orderId],
  );

  return {
    order: query.data?.order ?? null,
    completedSteps: query.data?.completedSteps ?? EMPTY_COMPLETED_STEPS,
    proofs: query.data?.proofs ?? EMPTY_PROOFS,
    statusEvents: query.data?.statusEvents ?? EMPTY_STATUS_EVENTS,
    consumerNotes: query.data?.consumerNotes ?? EMPTY_CONSUMER_NOTES,
    source: query.data?.source ?? (mockMode ? "mock" : "api"),
    loading:
      mockMode
        ? false
        : (apiEnabled && !driverId) || (query.isPending && !query.data),
    refreshing: query.isFetching && !!query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}
