import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firestoreState = vi.hoisted(() => ({
  drivers: new Map<string, Record<string, unknown>>(),
  orders: new Map<string, Record<string, unknown>>(),
}));

function isDeleteSentinel(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("operand" in value || "_methodName" in value),
  );
}

const { getAdminFirestore, COLLECTIONS, writeAuditLog } = vi.hoisted(() => {
  const drivers = firestoreState.drivers;
  const orders = firestoreState.orders;

  function makeDocRef(id: string, collection: Map<string, Record<string, unknown>>) {
    return {
      id,
      set: vi.fn(async (data: Record<string, unknown>) => {
        collection.set(id, { ...data });
      }),
      update: vi.fn(async (patch: Record<string, unknown>) => {
        const existing = collection.get(id) ?? {};
        const next = { ...existing };
        for (const [key, value] of Object.entries(patch)) {
          if (isDeleteSentinel(value)) {
            delete next[key];
          } else if (key === "updatedAt" && isDeleteSentinel(value) === false && value) {
            next[key] = new Date().toISOString();
          } else {
            next[key] = value;
          }
        }
        collection.set(id, next);
      }),
      get: vi.fn(async () => {
        const data = collection.get(id);
        return {
          exists: data !== undefined,
          id,
          data: () => data,
        };
      }),
    };
  }

  return {
    COLLECTIONS: { drivers: "drivers", orders: "orders", auditLogs: "auditLogs" },
    writeAuditLog: vi.fn(async () => undefined),
    getAdminFirestore: vi.fn(() => ({
      collection: vi.fn((name: string) => {
        const collection = name === "drivers" ? drivers : orders;
        return {
          doc: vi.fn((id: string) => makeDocRef(id, collection)),
          where: vi.fn((_field: string, _op: string, value: unknown) => ({
            get: vi.fn(async () => ({
              docs: [...orders.entries()]
                .filter(([, data]) => {
                  if (_field === "status") {
                    return Array.isArray(value) && value.includes(data.status);
                  }
                  if (_field === "assignedDriverId") return data.assignedDriverId === value;
                  return true;
                })
                .map(([id, data]) => ({ id, data: () => data })),
            })),
          })),
        };
      }),
    })),
  };
});

vi.mock("@/lib/server/firebase-admin", () => ({ getAdminFirestore }));
vi.mock("@/lib/server/firestore/collections", () => ({ COLLECTIONS }));
vi.mock("@/lib/server/services/audit", () => ({ writeAuditLog }));

import {
  assertDriverAssignable,
  getDriverById,
  updateDriverAdmin,
  validateDriverForAssignment,
} from "@/lib/server/services/drivers";

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

function seedAssignedOrder() {
  firestoreState.orders.set("QRX-20001", {
    id: "QRX-20001",
    trackingId: "QRX-20001",
    customerName: "Customer",
    customerPhone: "555-0100",
    pickupName: "Pickup",
    pickupAddress: "123 Main",
    deliveryAddress: "456 Oak",
    assignedDriverId: "DRV-10012",
    assignedDriverName: "Alex Rivera",
    status: "Assigned",
    paymentStatus: "Paid",
    totalCents: 1000,
    totalDisplay: "$10.00",
    completedSteps: [],
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    source: "manual",
  });
}

describe("drivers service", () => {
  beforeEach(() => {
    firestoreState.drivers.clear();
    firestoreState.orders.clear();
    seedDriver();
  });

  afterEach(() => vi.clearAllMocks());

  it("sets updatedByUid on successful admin update", async () => {
    const driver = await updateDriverAdmin(
      "DRV-10012",
      { name: "Alex Updated" },
      adminActor,
    );

    expect(driver.name).toBe("Alex Updated");
    expect(driver.updatedByUid).toBe("admin-1");
    expect(firestoreState.drivers.get("DRV-10012")?.updatedByUid).toBe("admin-1");
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("does not rewrite historical order assignment names when driver is renamed", async () => {
    seedAssignedOrder();

    await updateDriverAdmin("DRV-10012", { name: "Alex Updated" }, adminActor);

    const order = firestoreState.orders.get("QRX-20001");
    expect(order?.assignedDriverId).toBe("DRV-10012");
    expect(order?.assignedDriverName).toBe("Alex Rivera");
  });

  it("rejects assignment to inactive drivers", async () => {
    seedDriver({ status: "Inactive" });
    const driver = await getDriverById("DRV-10012");

    expect(() => assertDriverAssignable(driver)).toThrow(/cannot receive new assignments/i);
    expect(() => validateDriverForAssignment(driver)).toThrow(/cannot receive new assignments/i);
  });

  it("rejects assignment when driver login account is disabled", () => {
    const driver = {
      ...(firestoreState.drivers.get("DRV-10012") as object),
      accountDisabled: true,
    } as Awaited<ReturnType<typeof getDriverById>>;

    expect(() => validateDriverForAssignment(driver)).toThrow(/login account is disabled/i);
  });

  it("requires acknowledgement before deactivating with active assignments", async () => {
    seedAssignedOrder();

    await expect(
      updateDriverAdmin("DRV-10012", { status: "Inactive" }, adminActor),
    ).rejects.toMatchObject({ code: "ACTIVE_ASSIGNMENTS", status: 409 });
  });

  it("allows deactivation with acknowledgement while keeping assignments", async () => {
    seedAssignedOrder();

    const driver = await updateDriverAdmin(
      "DRV-10012",
      { status: "Inactive", acknowledgeActiveAssignments: true },
      adminActor,
    );

    expect(driver.status).toBe("Inactive");
    expect(firestoreState.orders.get("QRX-20001")?.assignedDriverId).toBe("DRV-10012");
  });
});
