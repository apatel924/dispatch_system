import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole, assignDriver, ensureFirebaseConfigured, parseJsonBody } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  assignDriver: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
  parseJsonBody: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/services/orders", () => ({ assignDriver }));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured, parseJsonBody };
});

import { POST } from "@/app/api/orders/[id]/assign-driver/route";

const order = {
  id: "QRX-1",
  trackingId: "QRX-1",
  customerName: "Test",
  customerPhone: "4035551234",
  pickupName: "Pharmacy",
  pickupAddress: "1 Main St",
  deliveryAddress: "2 Oak Ave",
  status: "Assigned",
  paymentStatus: "Paid",
  totalCents: 1000,
  totalDisplay: "$10.00",
  completedSteps: [],
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
  source: "manual",
};

describe("POST /api/orders/[id]/assign-driver", () => {
  afterEach(() => vi.clearAllMocks());

  it("succeeds even when SMS delivery fails", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "admin-1", role: "admin" });
    parseJsonBody.mockResolvedValue({ driverId: "drv-1" });
    assignDriver.mockResolvedValue({
      order,
      trackingNotification: {
        linkCreated: true,
        smsAttempted: true,
        smsSent: false,
        message: "Tracking link created, but SMS could not be sent.",
        failureCategory: "SMS_NOT_CONFIGURED",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/orders/QRX-1/assign-driver", {
        method: "POST",
        body: JSON.stringify({ driverId: "drv-1" }),
      }),
      { params: Promise.resolve({ id: "QRX-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.order.status).toBe("Assigned");
    expect(body.warning).toContain("SMS could not be sent");
    expect(body.trackingNotification.smsSent).toBe(false);
    expect(body.trackingNotification.copyUrl).toBeUndefined();
  });

  it("omits warning when SMS succeeds", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "admin-1", role: "admin" });
    parseJsonBody.mockResolvedValue({ driverId: "drv-1" });
    assignDriver.mockResolvedValue({
      order,
      trackingNotification: {
        linkCreated: true,
        smsAttempted: true,
        smsSent: true,
        message: "New tracking link sent successfully.",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/orders/QRX-1/assign-driver", {
        method: "POST",
        body: JSON.stringify({ driverId: "drv-1" }),
      }),
      { params: Promise.resolve({ id: "QRX-1" }) },
    );

    const body = await response.json();
    expect(body.warning).toBeUndefined();
    expect(body.trackingNotification).toBeUndefined();
  });
});
