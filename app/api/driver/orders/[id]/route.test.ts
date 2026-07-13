import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";

const {
  requireRole,
  requireDriverId,
  assertDriverOwnsOrder,
  getStatusEvents,
  getConsumerNotes,
  listProofs,
  ensureFirebaseConfigured,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireDriverId: vi.fn(),
  assertDriverOwnsOrder: vi.fn(),
  getStatusEvents: vi.fn(),
  getConsumerNotes: vi.fn(),
  listProofs: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/driver-context", () => ({ requireDriverId }));
vi.mock("@/lib/server/services/orders", () => ({
  assertDriverOwnsOrder,
  getStatusEvents,
}));
vi.mock("@/lib/server/services/consumer-tracking", () => ({
  getConsumerNotes,
}));
vi.mock("@/lib/server/services/proofs", () => ({
  listProofs,
}));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { GET } from "@/app/api/driver/orders/[id]/route";

const driverUser = { uid: "user-1", role: "driver" as const, driverId: "driver-1" };

const sampleOrder = {
  id: "QRX-1",
  trackingId: "QRX-1",
  customerName: "Acme",
  customerPhone: "555",
  pickupName: "Pharmacy",
  pickupAddress: "123 Main",
  deliveryAddress: "456 Oak",
  assignedDriverId: "driver-1",
  assignedDriverName: "James",
  status: "Assigned" as const,
  paymentStatus: "Pending" as const,
  totalCents: 1000,
  totalDisplay: "$10.00",
  completedSteps: [],
  createdAt: "2026-07-13T10:00:00.000Z",
  updatedAt: "2026-07-13T10:00:00.000Z",
  source: "manual" as const,
  notes: "Leave at desk",
};

const sampleConsumerNotes = [
  {
    id: "cn-1",
    orderId: "QRX-1",
    source: "consumer" as const,
    text: "Buzzer 402",
    createdAt: "2026-07-13T11:00:00.000Z",
    trackingLinkVersion: 1,
  },
];

describe("GET /api/driver/orders/[id]", () => {
  afterEach(() => vi.clearAllMocks());

  it("allows assigned driver to view consumer notes", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);
    requireDriverId.mockResolvedValue("driver-1");
    assertDriverOwnsOrder.mockResolvedValue(sampleOrder);
    getStatusEvents.mockResolvedValue([]);
    listProofs.mockResolvedValue([]);
    getConsumerNotes.mockResolvedValue(sampleConsumerNotes);

    const response = await GET(new Request("http://localhost/api/driver/orders/QRX-1"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.consumerNotes).toHaveLength(1);
    expect(body.consumerNotes[0].text).toBe("Buzzer 402");
    expect(assertDriverOwnsOrder).toHaveBeenCalledWith("QRX-1", "driver-1");
  });

  it("blocks unassigned driver from viewing order notes", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);
    requireDriverId.mockResolvedValue("driver-2");
    assertDriverOwnsOrder.mockRejectedValue(
      new ServiceError("Order not found: QRX-1", "NOT_FOUND", 404),
    );

    const response = await GET(new Request("http://localhost/api/driver/orders/QRX-1"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });

    expect(response.status).toBe(404);
    expect(getConsumerNotes).not.toHaveBeenCalled();
  });

  it("returns updated notes on subsequent fetch (refresh simulation)", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);
    requireDriverId.mockResolvedValue("driver-1");
    assertDriverOwnsOrder.mockResolvedValue(sampleOrder);
    getStatusEvents.mockResolvedValue([]);
    listProofs.mockResolvedValue([]);

    getConsumerNotes.mockResolvedValueOnce(sampleConsumerNotes);
    const first = await GET(new Request("http://localhost/api/driver/orders/QRX-1"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });
    expect((await first.json()).consumerNotes).toHaveLength(1);

    getConsumerNotes.mockResolvedValueOnce([
      ...sampleConsumerNotes,
      {
        id: "cn-2",
        orderId: "QRX-1",
        source: "consumer" as const,
        text: "Use back door",
        createdAt: "2026-07-13T12:00:00.000Z",
        trackingLinkVersion: 1,
      },
    ]);
    const second = await GET(new Request("http://localhost/api/driver/orders/QRX-1"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });
    expect((await second.json()).consumerNotes).toHaveLength(2);
  });
});
