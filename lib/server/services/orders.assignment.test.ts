import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreState = vi.hoisted(() => ({
  drivers: new Map<string, Record<string, unknown>>(),
  orders: new Map<string, Record<string, unknown>>(),
  orderEvents: new Map<string, Map<string, Record<string, unknown>>>(),
}));

const notifyCustomerOrderAssigned = vi.hoisted(() =>
  vi.fn(async () => ({
    linkCreated: true,
    smsAttempted: true,
    smsSent: true,
    message: "sent",
  })),
);

const { getAdminFirestore, COLLECTIONS, writeAuditLog } = vi.hoisted(() => {
  function makeDocRef(
    id: string,
    collection: Map<string, Record<string, unknown>>,
  ) {
    return {
      id,
      update: vi.fn(async (patch: Record<string, unknown>) => {
        const existing = collection.get(id) ?? {};
        collection.set(id, { ...existing, ...patch });
      }),
      get: vi.fn(async () => {
        const data = collection.get(id);
        return { exists: data !== undefined, id, data: () => data };
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        collection.set(id, { ...data });
      }),
    };
  }

  return {
    COLLECTIONS: { orders: "orders", drivers: "drivers", auditLogs: "auditLogs" },
    writeAuditLog: vi.fn(async () => undefined),
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
                    doc: vi.fn((eventId?: string) => {
                      const eid = eventId ?? `evt-${events.size + 1}`;
                      return makeDocRef(eid, events);
                    }),
                    orderBy: vi.fn(() => ({
                      get: vi.fn(async () => ({
                        docs: [...events.entries()].map(([eid, data]) => ({
                          id: eid,
                          data: () => data,
                        })),
                      })),
                    })),
                  };
                }),
              };
            }),
          };
        }
        return { doc: vi.fn((id: string) => makeDocRef(id, new Map())) };
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
    db: {
      collection: (name: string) => {
        doc: (id: string) => { collection: (sub: string) => unknown };
      };
    },
    orderId: string,
  ) =>
    (
      db.collection("orders").doc(orderId) as {
        collection: (sub: string) => unknown;
      }
    ).collection("events"),
}));
vi.mock("@/lib/server/services/audit", () => ({ writeAuditLog }));
vi.mock("@/lib/server/services/notifications", () => ({
  notifyCustomerOrderAssigned,
}));
vi.mock("@/lib/server/services/required-proofs", () => ({
  assertRequiredProofsForDelivery: vi.fn(async () => undefined),
}));
vi.mock("@/lib/server/firestore/ids", () => ({
  generateOrderId: vi.fn(async () => "QRX-1"),
}));
vi.mock("@/lib/server/services/drivers", () => ({
  getDriverById: vi.fn(async (id: string) => {
    const data = firestoreState.drivers.get(id);
    if (!data) throw new Error(`Driver not found: ${id}`);
    return data;
  }),
  validateDriverForAssignment: vi.fn(),
}));

import {
  assignDriver,
  updateOrderStatus,
} from "@/lib/server/services/orders";

const actor = { uid: "admin-1", role: "admin" as const };

function seedDriver(id = "DRV-1") {
  firestoreState.drivers.set(id, {
    id,
    name: "Ada Driver",
    status: "Available",
    phone: "555",
    email: "a@example.com",
    userId: "u1",
    avatarColor: "bg-primary",
    initials: "AD",
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "ORD-1",
    trackingId: "ORD-1",
    status: "New",
    completedSteps: [],
    assignedDriverId: null,
    assignedDriverName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    customerName: "Customer",
    customerPhone: "555",
    pickupName: "Pickup",
    pickupAddress: "A",
    deliveryAddress: "B",
    totalCents: 100,
    paymentStatus: "Pending",
    source: "manual",
    ...overrides,
  };
}

describe("assignDriver status integrity", () => {
  beforeEach(() => {
    firestoreState.drivers.clear();
    firestoreState.orders.clear();
    firestoreState.orderEvents.clear();
    notifyCustomerOrderAssigned.mockClear();
    writeAuditLog.mockClear();
    seedDriver("DRV-1");
    seedDriver("DRV-2");
  });

  it("moves New to Assigned on first assignment", async () => {
    firestoreState.orders.set("ORD-1", baseOrder());
    const result = await assignDriver("ORD-1", "DRV-1", actor);
    expect(result.order.status).toBe("Assigned");
    expect(result.order.assignedDriverId).toBe("DRV-1");
    expect(notifyCustomerOrderAssigned).toHaveBeenCalledTimes(1);
    const events = firestoreState.orderEvents.get("ORD-1");
    expect([...events!.values()].some((e) => e.actionType === "assignment")).toBe(
      true,
    );
  });

  it("keeps Assigned on reassignment and records reassignment", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Assigned",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada Driver",
      }),
    );
    const result = await assignDriver("ORD-1", "DRV-2", actor);
    expect(result.order.status).toBe("Assigned");
    expect(result.order.assignedDriverId).toBe("DRV-2");
    const events = [...firestoreState.orderEvents.get("ORD-1")!.values()];
    expect(events.some((e) => e.actionType === "reassignment")).toBe(true);
    expect(events.every((e) => e.status === "Assigned")).toBe(true);
  });

  it("preserves Picked Up when reassigning", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Picked Up",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada Driver",
        pickedUpAt: "2026-01-01T02:00:00.000Z",
      }),
    );
    const result = await assignDriver("ORD-1", "DRV-2", actor);
    expect(result.order.status).toBe("Picked Up");
    expect(result.order.assignedDriverId).toBe("DRV-2");
  });

  it("preserves Out for Delivery when reassigning", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Out for Delivery",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada Driver",
      }),
    );
    const result = await assignDriver("ORD-1", "DRV-2", actor);
    expect(result.order.status).toBe("Out for Delivery");
  });

  it("rejects assigning Delivered or Returned", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({ status: "Delivered", deliveredAt: "2026-01-01T03:00:00.000Z" }),
    );
    await expect(assignDriver("ORD-1", "DRV-1", actor)).rejects.toMatchObject({
      code: "TERMINAL_ORDER",
    });

    firestoreState.orders.set("ORD-1", baseOrder({ status: "Returned" }));
    await expect(assignDriver("ORD-1", "DRV-1", actor)).rejects.toMatchObject({
      code: "TERMINAL_ORDER",
    });
  });

  it("rejects assigning orders with unrecognized status (quarantine)", async () => {
    firestoreState.orders.set("ORD-1", baseOrder({ status: "Weird Legacy" }));
    await expect(assignDriver("ORD-1", "DRV-1", actor)).rejects.toMatchObject({
      code: "STATUS_NEEDS_REVIEW",
    });
  });

  it("requires explicit retry for Failed orders", async () => {
    firestoreState.orders.set("ORD-1", baseOrder({ status: "Failed" }));
    await expect(assignDriver("ORD-1", "DRV-1", actor)).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });

    const result = await assignDriver("ORD-1", "DRV-1", actor, {
      retryFailed: true,
    });
    expect(result.order.status).toBe("Assigned");
    const events = [...firestoreState.orderEvents.get("ORD-1")!.values()];
    expect(events.some((e) => e.actionType === "retry")).toBe(true);
  });

  it("does not re-notify on idempotent same-driver assignment", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Assigned",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada Driver",
      }),
    );
    await assignDriver("ORD-1", "DRV-1", actor);
    expect(notifyCustomerOrderAssigned).not.toHaveBeenCalled();
  });
});

describe("updateOrderStatus transition integrity", () => {
  beforeEach(() => {
    firestoreState.drivers.clear();
    firestoreState.orders.clear();
    firestoreState.orderEvents.clear();
    seedDriver();
  });

  it("rejects New → Delivered", async () => {
    firestoreState.orders.set("ORD-1", baseOrder({ status: "New" }));
    await expect(
      updateOrderStatus("ORD-1", "Delivered", actor),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("rejects status transitions when Firestore status is unrecognized", async () => {
    firestoreState.orders.set("ORD-1", baseOrder({ status: "Weird Legacy" }));
    await expect(
      updateOrderStatus("ORD-1", "Assigned", actor),
    ).rejects.toMatchObject({ code: "STATUS_NEEDS_REVIEW" });
  });

  it("rejects client jump from Assigned to Delivered", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Assigned",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada",
      }),
    );
    await expect(
      updateOrderStatus("ORD-1", "Delivered", actor),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("pickup produces Picked Up and begin delivery produces Out for Delivery", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Assigned",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada",
      }),
    );
    const picked = await updateOrderStatus("ORD-1", "Assigned", actor, {
      stepKey: "pickedUp",
    });
    expect(picked.order.status).toBe("Picked Up");

    const ofd = await updateOrderStatus("ORD-1", "Picked Up", actor, {
      stepKey: "outForDelivery",
    });
    expect(ofd.order.status).toBe("Out for Delivery");
  });

  it("does not append a status event when status is unchanged", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Assigned",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada",
      }),
    );
    await updateOrderStatus("ORD-1", "Assigned", actor);
    expect(firestoreState.orderEvents.get("ORD-1")?.size ?? 0).toBe(0);
  });

  it("compatibility: Assigned + outForDelivery step reaches Out for Delivery", async () => {
    firestoreState.orders.set(
      "ORD-1",
      baseOrder({
        status: "Assigned",
        assignedDriverId: "DRV-1",
        assignedDriverName: "Ada",
      }),
    );
    const result = await updateOrderStatus("ORD-1", "Assigned", actor, {
      stepKey: "outForDelivery",
    });
    expect(result.order.status).toBe("Out for Delivery");
  });
});
