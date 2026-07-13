import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";

const {
  requireRole,
  requireDriverId,
  assertDriverOwnsOrder,
  acknowledgeConsumerNote,
  ensureFirebaseConfigured,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireDriverId: vi.fn(),
  assertDriverOwnsOrder: vi.fn(),
  acknowledgeConsumerNote: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/driver-context", () => ({ requireDriverId }));
vi.mock("@/lib/server/services/orders", () => ({ assertDriverOwnsOrder }));
vi.mock("@/lib/server/services/consumer-tracking", () => ({ acknowledgeConsumerNote }));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { POST } from "@/app/api/orders/[id]/consumer-notes/[noteId]/acknowledge/route";

const originalNote = {
  id: "cn-1",
  orderId: "QRX-1",
  source: "consumer" as const,
  text: "Buzzer 402",
  createdAt: "2026-07-13T11:00:00.000Z",
  trackingLinkVersion: 1,
};

describe("POST /api/orders/[id]/consumer-notes/[noteId]/acknowledge", () => {
  afterEach(() => vi.clearAllMocks());

  it("allows admin to acknowledge without altering note text", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "admin-1", role: "admin" });
    acknowledgeConsumerNote.mockResolvedValue({
      ...originalNote,
      acknowledgedAt: "2026-07-13T12:00:00.000Z",
      acknowledgedByUid: "admin-1",
    });

    const response = await POST(
      new Request("http://localhost/api/orders/QRX-1/consumer-notes/cn-1/acknowledge", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "QRX-1", noteId: "cn-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.note.text).toBe("Buzzer 402");
    expect(body.note.acknowledgedByUid).toBe("admin-1");
    expect(acknowledgeConsumerNote).toHaveBeenCalledWith("QRX-1", "cn-1", "admin-1");
    expect(assertDriverOwnsOrder).not.toHaveBeenCalled();
  });

  it("requires assigned driver ownership before acknowledging", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "user-1", role: "driver", driverId: "driver-1" });
    requireDriverId.mockResolvedValue("driver-1");
    assertDriverOwnsOrder.mockResolvedValue({ id: "QRX-1" });
    acknowledgeConsumerNote.mockResolvedValue({
      ...originalNote,
      acknowledgedAt: "2026-07-13T12:00:00.000Z",
      acknowledgedByUid: "user-1",
    });

    const response = await POST(
      new Request("http://localhost/api/orders/QRX-1/consumer-notes/cn-1/acknowledge", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "QRX-1", noteId: "cn-1" }) },
    );

    expect(response.status).toBe(200);
    expect(assertDriverOwnsOrder).toHaveBeenCalledWith("QRX-1", "driver-1");
  });

  it("blocks unassigned driver from acknowledging", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "user-2", role: "driver", driverId: "driver-2" });
    requireDriverId.mockResolvedValue("driver-2");
    assertDriverOwnsOrder.mockRejectedValue(
      new ServiceError("Order not found: QRX-1", "NOT_FOUND", 404),
    );

    const response = await POST(
      new Request("http://localhost/api/orders/QRX-1/consumer-notes/cn-1/acknowledge", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "QRX-1", noteId: "cn-1" }) },
    );

    expect(response.status).toBe(404);
    expect(acknowledgeConsumerNote).not.toHaveBeenCalled();
  });
});
