/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { intakeKeys } from "@/lib/dash/query/query-keys";

const {
  runLiveOrderProviderSync,
  fetchExternalOrderIntakeList,
  fetchOrderProviderHealthWithSync,
} = vi.hoisted(() => ({
  runLiveOrderProviderSync: vi.fn(),
  fetchExternalOrderIntakeList: vi.fn(),
  fetchOrderProviderHealthWithSync: vi.fn(),
}));

vi.mock("@/lib/dash/api/config", () => ({
  isApiEnabled: () => true,
}));

vi.mock("@/lib/dash/api/client", () => ({
  runLiveOrderProviderSync,
  fetchExternalOrderIntakeList,
  fetchOrderProviderHealthWithSync,
  fetchLiveOrderProviderHealth: vi.fn(),
  fetchLiveLocations: vi.fn(),
  previewLiveExternalOrdersApi: vi.fn(),
  scanLiveDeliveryOrdersApi: vi.fn(),
  probeLiveOrderDetailApi: vi.fn(),
  fetchExternalOrderIntakeDetail: vi.fn(),
  assignExternalOrderDriverApi: vi.fn(),
  promoteExternalOrderApi: vi.fn(),
}));

import { useLiveIntake } from "@/lib/dash/hooks/use-live-intake";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, invalidateSpy };
}

const importedOrder = {
  id: "barnet_1",
  provider: "barnet",
  externalOrderId: "1",
  externalOrderNumber: "1",
  customerName: null,
  customerPhone: null,
  deliveryAddress: null,
  itemsCount: 1,
  total: 10,
  sourceStatus: "Paid",
  dispatchReady: false,
  needsReview: true,
  reviewReasons: ["missing_address"],
  customerMessagingReady: false,
  missingFields: ["address"],
  assignmentStatus: "unassigned" as const,
  dispatchStatus: "needs_review" as const,
  assignedDriverId: null,
  assignedDriverName: null,
  isPreview: false,
  alreadyImported: true,
  promoted: false,
  promotedOrderId: null,
  promotedAt: null,
  updatedAt: "2026-07-14T12:00:00Z",
  lastSyncedAt: "2026-07-14T12:00:00Z",
};

describe("useLiveIntake sync refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOrderProviderHealthWithSync.mockResolvedValue({
      mode: "live",
      liveReadsEnabled: true,
      liveSyncEnabled: true,
      ordersConfigured: true,
    });
    fetchExternalOrderIntakeList.mockResolvedValue({
      orders: [importedOrder],
      summary: {
        ordersScanned: 10,
        deliveryOrdersFound: 1,
        readyToDispatch: 0,
        needsReview: 1,
        alreadyImported: 1,
        assigned: 0,
      },
      syncState: null,
    });
  });

  it("invalidates intake query keys and reports needs-review sync metrics", async () => {
    const { Wrapper, invalidateSpy } = createWrapper();
    runLiveOrderProviderSync.mockResolvedValue({
      ok: true,
      mode: "live",
      pagesScanned: 10,
      totalOrdersSeen: 200,
      deliveryOrdersFound: 1,
      pickupOrdersIgnored: 199,
      unknownOrdersIgnored: 0,
      inserted: 1,
      updated: 0,
      total: 1,
      unchangedOrders: 0,
      needsReview: 1,
      readyToDispatch: 0,
      invalidOrders: 0,
    });

    const { result } = renderHook(() => useLiveIntake(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.orders.length).toBe(1));

    await act(async () => {
      await result.current.syncDeliveryOrders();
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: intakeKeys.all }),
    );
    expect(result.current.previewRows).toEqual([]);
    expect(result.current.message).toMatch(/Needs review: 1/);
    expect(result.current.lastSyncResult?.needsReview).toBe(1);
    expect(result.current.orders[0]?.needsReview).toBe(true);
  });

  it("keeps error when imported refresh fails after sync", async () => {
    const { Wrapper } = createWrapper();
    runLiveOrderProviderSync.mockResolvedValue({
      ok: true,
      mode: "live",
      pagesScanned: 2,
      totalOrdersSeen: 40,
      deliveryOrdersFound: 1,
      pickupOrdersIgnored: 39,
      unknownOrdersIgnored: 0,
      inserted: 1,
      updated: 0,
      total: 1,
      needsReview: 1,
      readyToDispatch: 0,
    });

    const { result } = renderHook(() => useLiveIntake(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchExternalOrderIntakeList.mockRejectedValueOnce(new Error("network"));

    await act(async () => {
      await result.current.syncDeliveryOrders();
    });

    expect(result.current.error).toMatch(/failed to refresh imported orders/i);
    expect(result.current.lastSyncResult?.inserted).toBe(1);
  });
});
