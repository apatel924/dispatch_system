import { afterEach, describe, expect, it, vi } from "vitest";

const {
  requireRole,
  getOrderById,
  getStatusEvents,
  getConsumerNotes,
  ensureFirebaseConfigured,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getOrderById: vi.fn(),
  getStatusEvents: vi.fn(),
  getConsumerNotes: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/services/orders", () => ({
  getOrderById,
  getStatusEvents,
  updateOrder: vi.fn(),
}));
vi.mock("@/lib/server/services/consumer-tracking", () => ({
  getConsumerNotes,
}));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { GET } from "@/app/api/orders/[id]/route";

const adminUser = { uid: "admin-1", role: "admin" as const };

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
  notes: "Internal admin note text",
};

const sampleConsumerNotes = [
  {
    id: "cn-1",
    orderId: "QRX-1",
    source: "consumer" as const,
    text: "Side entrance",
    createdAt: "2026-07-13T11:00:00.000Z",
    trackingLinkVersion: 1,
  },
];

describe("GET /api/orders/[id]", () => {
  afterEach(() => vi.clearAllMocks());

  it("allows admin to view consumer notes separate from internal notes", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    getOrderById.mockResolvedValue(sampleOrder);
    getStatusEvents.mockResolvedValue([]);
    getConsumerNotes.mockResolvedValue(sampleConsumerNotes);

    const response = await GET(new Request("http://localhost/api/orders/QRX-1"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.order.notes).toBe("Internal admin note text");
    expect(body.consumerNotes).toHaveLength(1);
    expect(body.consumerNotes[0].text).toBe("Side entrance");
    expect(body.consumerNotes[0].source).toBe("consumer");
  });

  it("rejects unauthenticated requests", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    const response = await GET(new Request("http://localhost/api/orders/QRX-1"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });

    expect(response.status).toBe(401);
    expect(getConsumerNotes).not.toHaveBeenCalled();
  });
});
