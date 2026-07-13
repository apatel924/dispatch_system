import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";

const { fetchBarnetOrders, enrichBarnetDeliveryOrder, assertLiveSyncAllowed, docStore } =
  vi.hoisted(() => ({
    fetchBarnetOrders: vi.fn(),
    enrichBarnetDeliveryOrder: vi.fn(),
    assertLiveSyncAllowed: vi.fn(),
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

vi.mock("@/lib/integrations/order-provider/sync-pagination.server", () => ({
  getExternalOrderSyncPaginationConfig: () => ({
    pages: 3,
    itemsPerPage: 20,
  }),
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
    docStore.clear();
    Object.keys(integrationDocData).forEach((key) => delete integrationDocData[key]);

    enrichBarnetDeliveryOrder.mockImplementation(async (order) => ({
      ...order,
      customerName: "Test Customer",
      customerPhone: "555-0100",
      customerEnrichmentStatus: "success",
      customerMessagingReady: true,
      dispatchReady: true,
      missingFields: [],
      dispatchStatus: "ready",
    }));
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

  it("stops early after consecutive known pickup orders", async () => {
    fetchBarnetOrders
      .mockResolvedValueOnce([
        pickupOrder(1),
        pickupOrder(2),
        pickupOrder(3),
        pickupOrder(4),
        pickupOrder(5),
      ])
      .mockResolvedValueOnce([pickupOrder(6)]);

    const result = await runBarnetOrderSync();

    expect(result.pagesScanned).toBe(1);
    expect(result.ordersSeen).toBe(5);
    expect(fetchBarnetOrders).toHaveBeenCalledTimes(1);
  });
});
