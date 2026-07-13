import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole, issueAndSendTrackingLink, ensureFirebaseConfigured, getOrderById } =
  vi.hoisted(() => ({
    requireRole: vi.fn(),
    issueAndSendTrackingLink: vi.fn(),
    ensureFirebaseConfigured: vi.fn(),
    getOrderById: vi.fn(),
  }));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/services/notifications", () => ({ issueAndSendTrackingLink }));
vi.mock("@/lib/server/services/orders", () => ({ getOrderById }));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { POST } from "@/app/api/orders/[id]/tracking-link/route";

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

describe("POST /api/orders/[id]/tracking-link", () => {
  afterEach(() => vi.clearAllMocks());

  it("requires admin authentication", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    const response = await POST(new Request("http://localhost/api/orders/QRX-1/tracking-link"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns success without copyUrl when SMS is sent", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "admin-1", role: "admin" });
    getOrderById.mockResolvedValue(order);
    issueAndSendTrackingLink.mockResolvedValue({
      linkCreated: true,
      smsAttempted: true,
      smsSent: true,
      message: "New tracking link sent successfully.",
      version: 2,
      expiresAt: "2026-08-13T00:00:00.000Z",
    });

    const response = await POST(new Request("http://localhost/api/orders/QRX-1/tracking-link"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.smsSent).toBe(true);
    expect(body.copyUrl).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(body.trackingUrl).toBeUndefined();
  });

  it("returns copyUrl once when SMS fails", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "admin-1", role: "admin" });
    getOrderById.mockResolvedValue(order);
    issueAndSendTrackingLink.mockResolvedValue({
      linkCreated: true,
      smsAttempted: true,
      smsSent: false,
      copyUrl: "https://app.example/track/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVW",
      message: "Tracking link created, but SMS could not be sent.",
      version: 3,
      failureCategory: "SMS_NOT_CONFIGURED",
    });

    const response = await POST(new Request("http://localhost/api/orders/QRX-1/tracking-link"), {
      params: Promise.resolve({ id: "QRX-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.smsSent).toBe(false);
    expect(body.copyUrl).toContain("/track/");
    expect(body.token).toBeUndefined();
  });
});
