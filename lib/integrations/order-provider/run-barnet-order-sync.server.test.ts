import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";

const { fetchBarnetOrders, enrichBarnetDeliveryOrder, assertLiveSyncAllowed, finalizeBarnetDeliveryImport, docStore } =
  vi.hoisted(() => ({
    fetchBarnetOrders: vi.fn(),
    enrichBarnetDeliveryOrder: vi.fn(),
    assertLiveSyncAllowed: vi.fn(),
    finalizeBarnetDeliveryImport: vi.fn(),
    docStore: new Map<string, Record<string, unknown>>(),
  }));

function createDocRef(id: string) {
  return {
    get: vi.fn(async () => {
      const data = docStore.get(id);
      return {
        exists: data !== undefined,
        data: () => data,
      };
    }),
    set: vi.fn(async (data: Record<string, unknown>) => {
      docStore.set(id, data);
    }),
  };
}

const integrationDocData: Record<string, unknown> = {};
const integrationDoc = {
  set: vi.fn(async (data: Record<string, unknown>) => {
    Object.assign(integrationDocData, data);
  }),
  get: vi.fn(async () => ({
    exists: true,
    data: () => integrationDocData,
  })),
};

vi.mock("@/lib/integrations/order-provider/barnet-client.server", () => ({
  fetchBarnetOrders,
}));

vi.mock("@/lib/integrations/order-provider/barnet-customer-enrichment.server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/integrations/order-provider/barnet-customer-enrichment.server")
  >();
  return {
    ...actual,
    enrichBarnetDeliveryOrder,
  };
});

vi.mock("@/lib/integrations/order-provider/env.server", () => ({
  assertLiveSyncAllowed,
  getExternalOrderProviderConfig: () => ({
    locationId: "loc-1",
  }),
}));

vi.mock("@/lib/integrations/order-provider/barnet-sync-config.server", () => ({
  getBarnetSyncConsecutiveKnownThreshold: () => 5,
  getBarnetEnrichmentConcurrency: () => 2,
}));

vi.mock("@/lib/integrations/order-provider/finalize-barnet-import.server", () => ({
  finalizeBarnetDeliveryImport,
}));

const paginationState = vi.hoisted(() => ({
  pages: 3,
  itemsPerPage: 20,
  concurrency: 2,
}));

vi.mock("@/lib/integrations/order-provider/sync-pagination.server", () => ({
  getExternalOrderSyncPaginationConfig: () => ({
    pages: paginationState.pages,
    itemsPerPage: paginationState.itemsPerPage,
  }),
  getExternalOrderSyncPageConcurrency: () => paginationState.concurrency,
}));

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminFirestore: () => ({
    collection: vi.fn(() => ({
      doc: vi.fn((id: string) => createDocRef(id)),
    })),
    doc: vi.fn(() => integrationDoc),
  }),
}));

import { computeBarnetOrderSourceHash } from "@/lib/integrations/order-provider/barnet-sync-hash.server";
import { runBarnetOrderSync } from "@/lib/integrations/order-provider/run-barnet-order-sync.server";

function pickupOrder(id: number): BarnetOrderRaw {
  return {
    id,
    number: id,
    is_delivery: false,
    total: 10,
    timestamp: "2026-07-12T10:00:00Z",
  };
}

function deliveryOrder(id: number, overrides: Partial<BarnetOrderRaw> = {}): BarnetOrderRaw {
  return {
    id,
    number: id,
    is_delivery: true,
    total: 25,
    timestamp: "2026-07-12T10:00:00Z",
    address: "123 Main St",
    city: "Edmonton",
    state: "AB",
    zip: "T5J 0A1",
    customer_id: 99,
    items: [{ name: "Item", quantity: 1, price: 25 }],
    ...overrides,
  };
}

describe("runBarnetOrderSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchBarnetOrders.mockReset();
    enrichBarnetDeliveryOrder.mockReset();
    docStore.clear();
    paginationState.pages = 3;
    paginationState.itemsPerPage = 20;
    paginationState.concurrency = 2;
    Object.keys(integrationDocData).forEach((key) => delete integrationDocData[key]);

    enrichBarnetDeliveryOrder.mockImplementation(async (order) => ({
      ...order,
      customerName: "Test Customer",
      customerPhone: "555-0100",
      customerEnrichmentStatus: "success",
      customerMessagingReady: true,
      dispatchReady: true,
      needsReview: false,
      reviewReasons: [],
      missingFields: [],
      dispatchStatus: "ready",
    }));
    finalizeBarnetDeliveryImport.mockResolvedValue({
      dispatchOrderId: "ORD-1",
      alreadyPromoted: false,
      notificationCreated: true,
      failed: false,
    });
  });

  it("ignores pickup orders and does not enrich them", async () => {
    fetchBarnetOrders.mockResolvedValueOnce([
      pickupOrder(1),
      pickupOrder(2),
    ]).mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.deliveryCandidates).toBe(0);
    expect(result.pickupOrdersIgnored).toBe(2);
    expect(result.newDeliveries).toBe(0);
    expect(enrichBarnetDeliveryOrder).not.toHaveBeenCalled();
  });

  it("enriches only new delivery orders", async () => {
    fetchBarnetOrders
      .mockResolvedValueOnce([deliveryOrder(101)])
      .mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.deliveryCandidates).toBe(1);
    expect(result.newDeliveries).toBe(1);
    expect(result.updatedDeliveries).toBe(0);
    expect(enrichBarnetDeliveryOrder).toHaveBeenCalledTimes(1);
    expect(docStore.has("barnet_101")).toBe(true);
  });

  it("skips enrichment for unchanged delivery orders (idempotent)", async () => {
    const raw = deliveryOrder(202);
    const hash = computeBarnetOrderSourceHash(raw);
    docStore.set("barnet_202", {
      provider: "barnet",
      externalOrderId: "202",
      syncSourceHash: hash,
      rawPayload: raw,
      items: [],
      deliveryAddress: "123 Main St",
      customer: { name: null, phone: null, email: null },
      createdAt: "2026-07-12T09:00:00Z",
      updatedAt: "2026-07-12T09:00:00Z",
      assignmentStatus: "unassigned",
      promoted: false,
    });

    fetchBarnetOrders
      .mockResolvedValueOnce([raw])
      .mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.unchangedOrders).toBe(1);
    expect(result.newDeliveries).toBe(0);
    expect(result.updatedDeliveries).toBe(0);
    expect(enrichBarnetDeliveryOrder).not.toHaveBeenCalled();
  });

  it("updates changed delivery orders without duplicating documents", async () => {
    const raw = deliveryOrder(303, { total: 30 });
    const staleHash = computeBarnetOrderSourceHash(
      deliveryOrder(303, { total: 20 }),
    );
    docStore.set("barnet_303", {
      provider: "barnet",
      externalOrderId: "303",
      syncSourceHash: staleHash,
      rawPayload: deliveryOrder(303, { total: 20 }),
      items: [],
      deliveryAddress: "123 Main St",
      customer: { name: null, phone: null, email: null },
      createdAt: "2026-07-12T09:00:00Z",
      updatedAt: "2026-07-12T09:00:00Z",
      assignmentStatus: "unassigned",
      promoted: false,
    });

    fetchBarnetOrders
      .mockResolvedValueOnce([raw])
      .mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.updatedDeliveries).toBe(1);
    expect(result.newDeliveries).toBe(0);
    expect(enrichBarnetDeliveryOrder).toHaveBeenCalledTimes(1);
    expect(docStore.size).toBe(1);
    expect(docStore.get("barnet_303")?.syncSourceHash).toBe(
      computeBarnetOrderSourceHash(raw),
    );
  });

  it("does not stop early on consecutive pickup orders (deliveries on later pages must be reachable)", async () => {
    fetchBarnetOrders
      .mockResolvedValueOnce([
        pickupOrder(1),
        pickupOrder(2),
        pickupOrder(3),
        pickupOrder(4),
        pickupOrder(5),
      ])
      .mockResolvedValueOnce([deliveryOrder(600)])
      .mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.pagesScanned).toBeGreaterThanOrEqual(2);
    expect(result.deliveryCandidates).toBe(1);
    expect(result.newDeliveries).toBe(1);
    expect(result.needsReview).toBe(0);
    expect(docStore.has("barnet_600")).toBe(true);
    expect(fetchBarnetOrders).toHaveBeenCalledTimes(3);
  });

  it("persists missing-address delivery as needs-review and finalizes import", async () => {
    const raw = deliveryOrder(701, {
      address: undefined,
      city: undefined,
      state: undefined,
      zip: undefined,
    });
    // Remove address keys entirely
    delete (raw as { address?: string }).address;
    delete (raw as { city?: string }).city;
    delete (raw as { state?: string }).state;
    delete (raw as { zip?: string }).zip;

    enrichBarnetDeliveryOrder.mockImplementation(async (order) => ({
      ...order,
      customerName: "Test Customer",
      customerPhone: "555-0100",
      customerEnrichmentStatus: "success",
      customerMessagingReady: true,
      dispatchReady: false,
      needsReview: true,
      reviewReasons: ["missing_address"],
      missingFields: ["address", "city", "state", "zip"],
      dispatchStatus: "needs_review",
    }));

    fetchBarnetOrders.mockResolvedValueOnce([raw]).mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.deliveryCandidates).toBe(1);
    expect(result.newDeliveries).toBe(1);
    expect(result.needsReview).toBe(1);
    expect(result.readyToDispatch).toBe(0);
    const stored = docStore.get("barnet_701");
    expect(stored).toBeTruthy();
    expect(stored?.dispatchReady).toBe(false);
    expect(stored?.needsReview).toBe(true);
    expect(stored?.reviewReasons).toContain("missing_address");
    expect(stored?.assignedDriverId ?? null).toBeNull();
    expect(finalizeBarnetDeliveryImport).toHaveBeenCalledWith(
      expect.objectContaining({
        docId: "barnet_701",
        externalOrderId: "701",
        isNew: true,
      }),
    );
  });

  it("counts unchanged needs-review orders without losing them", async () => {
    const raw = deliveryOrder(702, {
      address: undefined,
      city: undefined,
      state: undefined,
      zip: undefined,
    });
    delete (raw as { address?: string }).address;
    delete (raw as { city?: string }).city;
    delete (raw as { state?: string }).state;
    delete (raw as { zip?: string }).zip;

    const hash = computeBarnetOrderSourceHash(raw);
    docStore.set("barnet_702", {
      provider: "barnet",
      externalOrderId: "702",
      syncSourceHash: hash,
      rawPayload: raw,
      items: [{ name: "Item", quantity: 1 }],
      deliveryAddress: null,
      customer: { name: null, phone: null, email: null },
      isDelivery: true,
      dispatchReady: false,
      needsReview: true,
      reviewReasons: ["missing_address"],
      createdAt: "2026-07-12T09:00:00Z",
      updatedAt: "2026-07-12T09:00:00Z",
      assignmentStatus: "unassigned",
      promoted: false,
    });

    fetchBarnetOrders.mockResolvedValueOnce([raw]).mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.unchangedOrders).toBe(1);
    expect(result.newDeliveries).toBe(0);
    expect(result.updatedDeliveries).toBe(0);
    expect(result.needsReview).toBe(1);
    expect(docStore.size).toBe(1);
  });

  it("updates the same document when a valid address later appears", async () => {
    const stale = deliveryOrder(703);
    delete (stale as { address?: string }).address;
    delete (stale as { city?: string }).city;
    delete (stale as { state?: string }).state;
    delete (stale as { zip?: string }).zip;
    const staleHash = computeBarnetOrderSourceHash(stale);
    docStore.set("barnet_703", {
      provider: "barnet",
      externalOrderId: "703",
      syncSourceHash: staleHash,
      rawPayload: stale,
      items: [{ name: "Item", quantity: 1 }],
      deliveryAddress: null,
      customer: { name: null, phone: null, email: null },
      isDelivery: true,
      dispatchReady: false,
      needsReview: true,
      reviewReasons: ["missing_address"],
      createdAt: "2026-07-12T09:00:00Z",
      updatedAt: "2026-07-12T09:00:00Z",
      assignmentStatus: "unassigned",
      promoted: false,
    });

    const fixed = deliveryOrder(703);
    enrichBarnetDeliveryOrder.mockImplementation(async (order) => ({
      ...order,
      customerName: "Test Customer",
      customerPhone: "555-0100",
      customerEnrichmentStatus: "success",
      customerMessagingReady: true,
      dispatchReady: true,
      needsReview: false,
      reviewReasons: [],
      missingFields: [],
      dispatchStatus: "ready",
    }));

    fetchBarnetOrders.mockResolvedValueOnce([fixed]).mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.updatedDeliveries).toBe(1);
    expect(result.newDeliveries).toBe(0);
    expect(result.readyToDispatch).toBe(1);
    expect(result.needsReview).toBe(0);
    expect(docStore.size).toBe(1);
    expect(docStore.get("barnet_703")?.dispatchReady).toBe(true);
    expect(docStore.get("barnet_703")?.needsReview).toBe(false);
  });

  it("continues scanning all configured pages even when many deliveries are already known", async () => {
    const known = [deliveryOrder(801), deliveryOrder(802), deliveryOrder(803), deliveryOrder(804), deliveryOrder(805)];
    for (const raw of known) {
      const hash = computeBarnetOrderSourceHash(raw);
      docStore.set(`barnet_${raw.id}`, {
        provider: "barnet",
        externalOrderId: String(raw.id),
        syncSourceHash: hash,
        rawPayload: raw,
        items: raw.items,
        deliveryAddress: "123 Main St, Edmonton, AB, T5J 0A1",
        customer: { name: null, phone: null, email: null },
        isDelivery: true,
        dispatchReady: true,
        needsReview: false,
        reviewReasons: [],
        createdAt: "2026-07-12T09:00:00Z",
        updatedAt: "2026-07-12T09:00:00Z",
        assignmentStatus: "unassigned",
        promoted: true,
        promotedOrderId: "ORD-EXISTING",
      });
    }

    fetchBarnetOrders
      .mockResolvedValueOnce(known)
      .mockResolvedValueOnce([deliveryOrder(806)])
      .mockResolvedValueOnce([]);

    const result = await runBarnetOrderSync();

    expect(result.pagesScanned).toBe(3);
    expect(result.unchangedOrders).toBe(5);
    expect(result.newDeliveries).toBe(1);
    expect(fetchBarnetOrders).toHaveBeenCalledTimes(3);
    expect(docStore.has("barnet_806")).toBe(true);
  });

  it("continues when one enrichment fails and counts the error", async () => {
    fetchBarnetOrders
      .mockResolvedValueOnce([deliveryOrder(501), deliveryOrder(502)])
      .mockResolvedValueOnce([]);

    enrichBarnetDeliveryOrder
      .mockImplementationOnce(async () => {
        throw new Error("enrichment failed");
      })
      .mockImplementationOnce(async (order) => ({
        ...order,
        customerName: "Test Customer",
        customerPhone: "555-0100",
        customerEnrichmentStatus: "success",
        customerMessagingReady: true,
        dispatchReady: true,
        needsReview: false,
        reviewReasons: [],
        missingFields: [],
        dispatchStatus: "ready",
      }));

    const result = await runBarnetOrderSync();

    expect(result.deliveryCandidates).toBe(2);
    expect(result.enrichmentErrors).toBe(1);
    expect(result.newDeliveries).toBe(1);
    expect(docStore.has("barnet_502")).toBe(true);
    expect(docStore.has("barnet_501")).toBe(false);
  });

  it("fetches ten pages with bounded concurrency and never exceeds the limit", async () => {
    paginationState.pages = 10;
    paginationState.concurrency = 3;
    let inFlight = 0;
    let maxInFlight = 0;
    const started: number[] = [];

    fetchBarnetOrders.mockImplementation(async ({ page }: { page: number }) => {
      started.push(page);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return [pickupOrder(page * 100)];
    });

    const result = await runBarnetOrderSync();

    expect(result.pagesScanned).toBe(10);
    expect(started).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(fetchBarnetOrders).toHaveBeenCalledTimes(10);
  });

  it("allows a scan wall-clock over 60s without application-level cancellation", async () => {
    paginationState.pages = 2;
    paginationState.concurrency = 1;
    vi.useFakeTimers();
    try {
      fetchBarnetOrders.mockImplementation(async ({ page }: { page: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 35_000));
        return page === 1 ? [pickupOrder(1)] : [];
      });

      const pending = runBarnetOrderSync();
      await vi.advanceTimersByTimeAsync(70_000);
      const result = await pending;

      expect(result.pagesScanned).toBe(2);
      expect(fetchBarnetOrders).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails the run when a page fetch errors so success is not misleading", async () => {
    paginationState.pages = 3;
    paginationState.concurrency = 3;
    fetchBarnetOrders.mockImplementation(async ({ page }: { page: number }) => {
      if (page === 2) throw new Error("upstream boom");
      return [pickupOrder(page)];
    });

    await expect(runBarnetOrderSync()).rejects.toThrow(/page\(s\): 2/);
  });
});
