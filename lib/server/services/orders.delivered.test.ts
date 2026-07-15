import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreState = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown>>(),
  orderEvents: new Map<string, Map<string, Record<string, unknown>>>(),
  eventSeq: 0,
  transactionQueue: Promise.resolve() as Promise<unknown>,
}));

const assertRequiredProofsForDelivery = vi.hoisted(() => vi.fn(async () => undefined));
const notifyCustomerOrderAssigned = vi.hoisted(() =>
  vi.fn(async () => ({
    linkCreated: false,
    smsAttempted: false,
    smsSent: false,
    message: "unused",
  })),
);

type DocRef = {
  id: string;
  __store: Map<string, Record<string, unknown>>;
  update: (patch: Record<string, unknown>) => Promise<void>;
  get: () => Promise<{
    exists: boolean;
    id: string;
    data: () => Record<string, unknown> | undefined;
  }>;
  set: (data: Record<string, unknown>) => Promise<void>;
};

const { getAdminFirestore, COLLECTIONS, writeAuditLog } = vi.hoisted(() => {
  function makeDocRef(
    id: string,
    store: Map<string, Record<string, unknown>>,
  ): DocRef {
    return {
      id,
      __store: store,
      update: vi.fn(async (patch: Record<string, unknown>) => {
        const existing = store.get(id) ?? {};
        store.set(id, { ...existing, ...patch });
      }),
      get: vi.fn(async () => {
        const data = store.get(id);
        return { exists: data !== undefined, id, data: () => data };
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        store.set(id, { ...data });
      }),
    };
  }

  function eventsCollectionFor(orderId: string) {
    const events = firestoreState.orderEvents.get(orderId) ?? new Map();
    firestoreState.orderEvents.set(orderId, events);
    return {
      doc: vi.fn((eventId?: string) => {
        const eid = eventId ?? `evt-${++firestoreState.eventSeq}`;
        return makeDocRef(eid, events);
      }),
      orderBy: vi.fn(() => ({
        get: vi.fn(async () => {
          const docs = [...events.entries()]
            .map(([id, data]) => ({ id, data: () => data }))
            .sort((a, b) =>
              String(a.data().createdAt ?? "").localeCompare(
                String(b.data().createdAt ?? ""),
              ),
            );
          return { docs };
        }),
      })),
    };
  }

  const db = {
    runTransaction: vi.fn(
      (
        callback: (tx: {
          get: (ref: DocRef) => Promise<{
            exists: boolean;
            id: string;
            data: () => Record<string, unknown> | undefined;
          }>;
          update: (ref: DocRef, patch: Record<string, unknown>) => void;
          set: (ref: DocRef, data: Record<string, unknown>) => void;
        }) => Promise<unknown>,
      ) => {
        const run = async () => {
          const tx = {
            get: async (ref: DocRef) => {
              const data = ref.__store.get(ref.id);
              return {
                exists: data !== undefined,
                id: ref.id,
                data: () => data,
              };
            },
            update: (ref: DocRef, patch: Record<string, unknown>) => {
              const existing = ref.__store.get(ref.id) ?? {};
              ref.__store.set(ref.id, { ...existing, ...patch });
            },
            set: (ref: DocRef, data: Record<string, unknown>) => {
              ref.__store.set(ref.id, { ...data });
            },
          };
          return callback(tx);
        };
        const result = firestoreState.transactionQueue.then(run, run);
        firestoreState.transactionQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    ),
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          doc: vi.fn((id: string) => {
            const ref = makeDocRef(id, firestoreState.orders);
            return {
              ...ref,
              collection: vi.fn((sub: string) => {
                if (sub !== "events") throw new Error(`unexpected sub ${sub}`);
                return eventsCollectionFor(id);
              }),
            };
          }),
        };
      }
      return { doc: vi.fn((sid: string) => makeDocRef(sid, new Map())) };
    }),
  };

  return {
    COLLECTIONS: { orders: "orders", auditLogs: "auditLogs" },
    writeAuditLog: vi.fn(async () => undefined),
    getAdminFirestore: vi.fn(() => db),
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
vi.mock("@/lib/server/services/required-proofs", () => ({
  assertRequiredProofsForDelivery,
}));
vi.mock("@/lib/server/services/notifications", () => ({
  notifyCustomerOrderAssigned,
}));
vi.mock("@/lib/server/firestore/ids", () => ({
  generateOrderId: vi.fn(async () => "QRX-1"),
}));

import { ServiceError } from "@/lib/server/errors";
import { updateOrderStatus } from "@/lib/server/services/orders";

const actor = { uid: "driver-1", role: "driver" as const };

function seedOutForDelivery() {
  firestoreState.orders.set("ORD-1", {
    id: "ORD-1",
    status: "Out for Delivery",
    completedSteps: ["signature", "exteriorPhoto"],
    assignedDriverId: "DRV-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T01:00:00.000Z",
    customerName: "Customer",
    customerPhone: "555",
    pickupName: "Pickup",
    pickupAddress: "A",
    deliveryAddress: "B",
    totalCents: 100,
    paymentStatus: "Pending",
    source: "manual",
  });
}

function deliveredEventCount(orderId = "ORD-1"): number {
  const events = firestoreState.orderEvents.get(orderId);
  if (!events) return 0;
  return [...events.values()].filter((e) => e.status === "Delivered").length;
}

describe("updateOrderStatus Delivered idempotency", () => {
  beforeEach(() => {
    firestoreState.orders.clear();
    firestoreState.orderEvents.clear();
    firestoreState.eventSeq = 0;
    firestoreState.transactionQueue = Promise.resolve();
    assertRequiredProofsForDelivery.mockReset();
    assertRequiredProofsForDelivery.mockResolvedValue(undefined);
    notifyCustomerOrderAssigned.mockClear();
    writeAuditLog.mockClear();
    vi.clearAllMocks();
    seedOutForDelivery();
  });

  it("creates exactly one Delivered history event on sequential repeats", async () => {
    const first = await updateOrderStatus("ORD-1", "Delivered", actor, {
      note: "Delivery completed by driver",
    });
    expect(first.order.status).toBe("Delivered");
    expect(first.order.deliveredAt).toBeTruthy();
    expect(assertRequiredProofsForDelivery).toHaveBeenCalledTimes(1);
    expect(deliveredEventCount()).toBe(1);

    const deliveredAt = first.order.deliveredAt!;

    const second = await updateOrderStatus("ORD-1", "Delivered", actor, {
      note: "Delivery completed by driver",
    });
    expect(second.order.status).toBe("Delivered");
    expect(second.order.deliveredAt).toBe(deliveredAt);
    expect(assertRequiredProofsForDelivery).toHaveBeenCalledTimes(1);
    expect(deliveredEventCount()).toBe(1);
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("creates exactly one Delivered history event under concurrent first-time requests", async () => {
    const [a, b] = await Promise.all([
      updateOrderStatus("ORD-1", "Delivered", actor, {
        note: "Delivery completed by driver",
      }),
      updateOrderStatus("ORD-1", "Delivered", actor, {
        note: "Delivery completed by driver",
      }),
    ]);

    expect(a.order.status).toBe("Delivered");
    expect(b.order.status).toBe("Delivered");
    expect(a.order.deliveredAt).toBe(b.order.deliveredAt);
    expect(deliveredEventCount()).toBe(1);
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("keeps deliveredAt stable and does not notify on Delivered", async () => {
    const first = await updateOrderStatus("ORD-1", "Delivered", actor);
    const deliveredAt = first.order.deliveredAt!;
    await updateOrderStatus("ORD-1", "Delivered", actor);
    expect(firestoreState.orders.get("ORD-1")?.deliveredAt).toBe(deliveredAt);
    expect(notifyCustomerOrderAssigned).not.toHaveBeenCalled();
  });

  it("still requires proofs on the first Delivered transition", async () => {
    assertRequiredProofsForDelivery.mockRejectedValueOnce(
      new ServiceError(
        "Cannot complete delivery until required proofs are uploaded (signature).",
        "CONFLICT",
        409,
      ),
    );

    await expect(updateOrderStatus("ORD-1", "Delivered", actor)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
    expect(firestoreState.orders.get("ORD-1")?.status).toBe("Out for Delivery");
    expect(deliveredEventCount()).toBe(0);
  });

  it("treats already-Delivered legacy orders as readable and idempotent", async () => {
    firestoreState.orders.set("ORD-LEGACY", {
      id: "ORD-LEGACY",
      status: "Delivered",
      completedSteps: [],
      assignedDriverId: "DRV-1",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T02:00:00.000Z",
      deliveredAt: "2025-01-01T02:00:00.000Z",
      customerName: "Legacy",
      customerPhone: "555",
      pickupName: "Pickup",
      pickupAddress: "A",
      deliveryAddress: "B",
      totalCents: 50,
      paymentStatus: "Paid",
      source: "manual",
    });

    const result = await updateOrderStatus("ORD-LEGACY", "Delivered", actor);
    expect(result.order.status).toBe("Delivered");
    expect(result.order.deliveredAt).toBe("2025-01-01T02:00:00.000Z");
    expect(result.event.id).toBe("legacy-delivered");
    expect(assertRequiredProofsForDelivery).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
    expect(firestoreState.orderEvents.get("ORD-LEGACY")?.size ?? 0).toBe(0);
  });
});
