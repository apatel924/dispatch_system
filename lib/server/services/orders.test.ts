import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firestoreState = vi.hoisted(() => ({
  drivers: new Map<string, Record<string, unknown>>(),
  orders: new Map<string, Record<string, unknown>>(),
  orderEvents: new Map<string, Map<string, Record<string, unknown>>>(),
  nextOrderId: 1,
}));

const computeDriverMetricsBatch = vi.hoisted(() =>
  vi.fn(async (driverIds: Iterable<string>) => {
    const map = new Map();
    for (const id of driverIds) {
      map.set(id, {
        activeDeliveries: 0,
        completedToday: 0,
        failedToday: 0,
        averageDeliveryTimeMs: null,
        totalDeliveries: 0,
        successRate: null,
      });
    }
    return map;
  }),
);

function isDeleteSentinel(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("operand" in value || "_methodName" in value),
  );
}

const {
  getAdminFirestore,
  COLLECTIONS,
  writeAuditLog,
  generateOrderId,
  createTrackingLinkForOrder,
} = vi.hoisted(() => {
  function makeDocRef(
    id: string,
    collection: Map<string, Record<string, unknown>>,
  ) {
    return {
      id,
      set: vi.fn(async (data: Record<string, unknown>) => {
        collection.set(id, { ...data });
      }),
      update: vi.fn(async (patch: Record<string, unknown>) => {
        const existing = collection.get(id) ?? {};
        const next = { ...existing };
        for (const [key, value] of Object.entries(patch)) {
          if (isDeleteSentinel(value)) delete next[key];
          else next[key] = value;
        }
        collection.set(id, next);
      }),
      get: vi.fn(async () => {
        const data = collection.get(id);
        return { exists: data !== undefined, id, data: () => data };
      }),
    };
  }

  return {
    COLLECTIONS: {
      drivers: "drivers",
      orders: "orders",
      auditLogs: "auditLogs",
    },
    writeAuditLog: vi.fn(async () => undefined),
    generateOrderId: vi.fn(async () => `QRX-TEST-${firestoreState.nextOrderId++}`),
    createTrackingLinkForOrder: vi.fn(async () => ({
      version: 1,
      token: "tok",
      expiresAt: "2099-01-01T00:00:00.000Z",
    })),
    getAdminFirestore: vi.fn(() => ({
      collection: vi.fn((name: string) => {
        if (name === "drivers") {
          return {
            doc: vi.fn((id: string) => makeDocRef(id, firestoreState.drivers)),
          };
        }
        if (name === "orders") {
          return {
            doc: vi.fn((id: string) => {
              const ref = makeDocRef(id, firestoreState.orders);
              return {
                ...ref,
                collection: vi.fn((sub: string) => {
                  if (sub !== "events") throw new Error(`unexpected sub ${sub}`);
                  const events =
                    firestoreState.orderEvents.get(id) ?? new Map();
                  firestoreState.orderEvents.set(id, events);
                  return {
                    doc: vi.fn((eventId: string) => makeDocRef(eventId, events)),
                  };
                }),
              };
            }),
            where: vi.fn(() => ({
              get: vi.fn(async () => ({ docs: [] })),
            })),
          };
        }
        return {
          doc: vi.fn((id: string) =>
            makeDocRef(id, new Map<string, Record<string, unknown>>()),
          ),
        };
      }),
    })),
  };
});

vi.mock("@/lib/server/firebase-admin", () => ({ getAdminFirestore }));
vi.mock("@/lib/server/firestore/collections", () => ({
  COLLECTIONS,
  orderDoc: (
    db: { collection: (name: string) => { doc: (id: string) => unknown } },
    id: string,
  ) => db.collection("orders").doc(id),
  orderEventsCollection: (
    db: { collection: (name: string) => { doc: (id: string) => unknown } },
    orderId: string,
  ) =>
    (
      db.collection("orders").doc(orderId) as {
        collection: (sub: string) => unknown;
      }
    ).collection("events"),
}));
vi.mock("@/lib/server/services/audit", () => ({ writeAuditLog }));
vi.mock("@/lib/server/firestore/ids", () => ({ generateOrderId }));
vi.mock("@/lib/server/services/tracking-links", () => ({
  createTrackingLinkForOrder,
}));
vi.mock("@/lib/server/services/notifications", () => ({
  notifyCustomerOrderAssigned: vi.fn(async () => ({
    linkCreated: true,
    smsAttempted: false,
    smsSent: false,
    message: "mock",
  })),
}));
vi.mock("@/lib/server/services/drivers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/services/drivers")>();
  return {
    ...actual,
    computeDriverMetricsBatch,
  };
});

import { createOrder } from "@/lib/server/services/orders";

const adminActor = { uid: "admin-1", role: "admin" as const };

function seedDriver(overrides?: Partial<Record<string, unknown>>) {
  firestoreState.drivers.set("DRV-10012", {
    id: "DRV-10012",
    userId: "auth-1",
    authUid: "auth-1",
    name: "Alex Rivera",
    phone: "(555) 123-4567",
    email: "alex@example.com",
    status: "Available",
    avatarColor: "bg-info-soft text-info",
    initials: "AR",
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

const baseCreateInput = {
  customerName: "Customer",
  customerPhone: "555-0100",
  pickupName: "Pickup",
  pickupAddress: "123 Main St",
  deliveryAddress: "456 Oak Ave",
  totalCents: 1500,
  paymentStatus: "Pending" as const,
  source: "manual",
};

describe("createOrder driver assignment validation", () => {
  beforeEach(() => {
    firestoreState.drivers.clear();
    firestoreState.orders.clear();
    firestoreState.orderEvents.clear();
    firestoreState.nextOrderId = 1;
    seedDriver();
  });

  afterEach(() => vi.clearAllMocks());

  it("rejects createOrder when assigned driver account is disabled", async () => {
    seedDriver({ accountDisabled: true });

    await expect(
      createOrder({ ...baseCreateInput, assignedDriverId: "DRV-10012" }, adminActor),
    ).rejects.toMatchObject({
      code: "DRIVER_ACCOUNT_DISABLED",
      status: 409,
    });

    expect(firestoreState.orders.size).toBe(0);
  });

  it("rejects createOrder when assigned driver is inactive", async () => {
    seedDriver({ status: "Inactive" });

    await expect(
      createOrder({ ...baseCreateInput, assignedDriverId: "DRV-10012" }, adminActor),
    ).rejects.toMatchObject({
      code: "DRIVER_UNAVAILABLE",
      status: 409,
    });

    expect(firestoreState.orders.size).toBe(0);
  });

  it("creates an assigned order when the driver is assignable", async () => {
    const order = await createOrder(
      { ...baseCreateInput, assignedDriverId: "DRV-10012" },
      adminActor,
    );

    expect(order.status).toBe("Assigned");
    expect(order.assignedDriverId).toBe("DRV-10012");
    expect(firestoreState.orders.size).toBe(1);
  });
});
