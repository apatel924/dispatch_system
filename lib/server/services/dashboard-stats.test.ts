import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firestoreState = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown>>(),
  drivers: new Map<string, Record<string, unknown>>(),
}));

function matchesWhere(
  data: Record<string, unknown>,
  field: string,
  op: string,
  value: unknown,
): boolean {
  const actual = data[field];
  if (op === "==") {
    if (value === null) return actual == null;
    return actual === value;
  }
  if (op === "in" && Array.isArray(value)) {
    return value.includes(actual);
  }
  if (op === ">=") return typeof actual === "string" && actual >= (value as string);
  if (op === "<") return typeof actual === "string" && actual < (value as string);
  return true;
}

function buildQuery(collection: Map<string, Record<string, unknown>>) {
  const filters: Array<{ field: string; op: string; value: unknown }> = [];

  const query = {
    where(field: string, op: string, value: unknown) {
      filters.push({ field, op, value });
      return query;
    },
    count() {
      return {
        get: vi.fn(async () => {
          let count = 0;
          for (const [, data] of collection) {
            if (filters.every((f) => matchesWhere(data, f.field, f.op, f.value))) {
              count += 1;
            }
          }
          return { data: () => ({ count }) };
        }),
      };
    },
    get: vi.fn(async () => ({
      docs: [...collection.entries()]
        .filter(([, data]) =>
          filters.every((f) => matchesWhere(data, f.field, f.op, f.value)),
        )
        .map(([id, data]) => ({ id, data: () => data })),
    })),
  };

  return query;
}

const { getAdminFirestore, COLLECTIONS } = vi.hoisted(() => ({
  COLLECTIONS: { orders: "orders", drivers: "drivers" },
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn((name: string) => {
      const collection =
        name === "orders" ? firestoreState.orders : firestoreState.drivers;
      return buildQuery(collection);
    }),
  })),
}));

vi.mock("@/lib/server/firebase-admin", () => ({ getAdminFirestore }));
vi.mock("@/lib/server/firestore/collections", () => ({ COLLECTIONS }));

const countTerminalOutcomesForLocalDay = vi.hoisted(() =>
  vi.fn(async () => ({
    completedToday: 4,
    failedToday: 2,
    returnedToday: 1,
    legacyFallbackCount: 0,
  })),
);

vi.mock("@/lib/server/services/order-reporting-queries", () => ({
  countTerminalOutcomesForLocalDay,
}));

import { getDashboardStats } from "@/lib/server/services/dashboard-stats";

function seedOrder(id: string, data: Record<string, unknown>) {
  firestoreState.orders.set(id, {
    id,
    trackingId: id,
    customerName: "Customer",
    customerPhone: "555-0100",
    pickupName: "Pickup",
    pickupAddress: "123 Main",
    deliveryAddress: "456 Oak",
    paymentStatus: "Paid",
    totalCents: 1000,
    totalDisplay: "$10.00",
    completedSteps: [],
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    source: "manual",
    assignedDriverId: null,
    ...data,
  });
}

function seedDriver(id: string, data: Record<string, unknown>) {
  firestoreState.drivers.set(id, {
    id,
    userId: `auth-${id}`,
    authUid: `auth-${id}`,
    name: `Driver ${id}`,
    phone: "555-0100",
    email: `${id}@example.com`,
    status: "Available",
    avatarColor: "bg-info-soft text-info",
    initials: "DR",
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...data,
  });
}

describe("getDashboardStats", () => {
  beforeEach(() => {
    firestoreState.orders.clear();
    firestoreState.drivers.clear();
    vi.stubEnv("APP_TIMEZONE", "America/Edmonton");
    countTerminalOutcomesForLocalDay.mockResolvedValue({
      completedToday: 4,
      failedToday: 2,
      returnedToday: 1,
      legacyFallbackCount: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns exact operational counts beyond a 50-order list cap", async () => {
    for (let i = 0; i < 60; i += 1) {
      seedOrder(`QRX-N${i}`, { status: "New", assignedDriverId: null });
    }
    for (let i = 0; i < 8; i += 1) {
      seedOrder(`QRX-A${i}`, {
        status: "Scheduled",
        assignedDriverId: null,
      });
    }
    for (let i = 0; i < 12; i += 1) {
      seedOrder(`QRX-D${i}`, {
        status: "Assigned",
        assignedDriverId: "DRV-1",
      });
    }
    seedOrder("QRX-TERM", { status: "Delivered", assignedDriverId: null });
    seedOrder("QRX-UNASSIGNED-ACTIVE", {
      status: "Picked Up",
      assignedDriverId: null,
    });

    seedDriver("DRV-1", { status: "Busy" });
    seedDriver("DRV-2", { status: "Available" });
    seedDriver("DRV-3", { status: "Suspended" });

    const stats = await getDashboardStats();

    expect(stats.newOrders).toBe(60);
    expect(stats.awaitingAssignment).toBe(68);
    expect(stats.activeDeliveries).toBe(13);
    expect(stats.completedToday).toBe(4);
    expect(stats.failedToday).toBe(2);
    expect(stats.returnedToday).toBe(1);
    expect(stats.failedReturnedToday).toBe(3);
    expect(stats.totalActiveDrivers).toBe(2);
    expect(stats.availableDrivers).toBe(1);
    expect(stats.busyDrivers).toBe(1);
    expect(stats.timeZone).toBe("America/Edmonton");
    expect(stats.dataCoverage.complete).toBe(true);
  });

  it("excludes terminal orders from awaiting assignment", async () => {
    seedOrder("QRX-NEW", { status: "New", assignedDriverId: null });
    seedOrder("QRX-FAIL", { status: "Failed", assignedDriverId: null });
    seedOrder("QRX-RET", { status: "Returned", assignedDriverId: null });
    seedOrder("QRX-DEL", { status: "Delivered", assignedDriverId: null });

    const stats = await getDashboardStats();

    expect(stats.awaitingAssignment).toBe(1);
  });

  it("counts active delivery statuses consistently", async () => {
    for (const status of [
      "Assigned",
      "Picked Up",
      "En Route",
      "Out for Delivery",
    ]) {
      seedOrder(`QRX-${status}`, {
        status,
        assignedDriverId: "DRV-1",
      });
    }
    seedOrder("QRX-SCHED", { status: "Scheduled", assignedDriverId: null });
    seedOrder("QRX-NEW", { status: "New", assignedDriverId: null });

    const stats = await getDashboardStats();

    expect(stats.activeDeliveries).toBe(4);
  });

  it("delegates today terminal metrics to Edmonton-bounded reporting queries", async () => {
    countTerminalOutcomesForLocalDay.mockResolvedValueOnce({
      completedToday: 7,
      failedToday: 1,
      returnedToday: 2,
      legacyFallbackCount: 1,
    });

    const stats = await getDashboardStats();

    expect(countTerminalOutcomesForLocalDay).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      "America/Edmonton",
    );
    expect(stats.completedToday).toBe(7);
    expect(stats.dataCoverage.complete).toBe(false);
    expect(stats.dataCoverage.legacyFallbackCount).toBe(1);
  });
});
