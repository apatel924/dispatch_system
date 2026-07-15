import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { ACCOUNT_DISABLED_CODE, ACCOUNT_DISABLED_MESSAGE } from "@/lib/auth/account-status";

const {
  requireRole,
  requireDriverId,
  listOrdersForDriver,
  createProof,
  updateOrderStatus,
  assertDriverOwnsOrder,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireDriverId: vi.fn(),
  listOrdersForDriver: vi.fn(),
  createProof: vi.fn(),
  updateOrderStatus: vi.fn(),
  assertDriverOwnsOrder: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/driver-context", () => ({ requireDriverId }));
vi.mock("@/lib/server/route-utils", () => ({
  ensureFirebaseConfigured: () => null,
  isErrorResponse: (value: unknown): value is Response => value instanceof Response,
  parseJsonBody: vi.fn(),
  parseQueryParams: vi.fn(),
}));
vi.mock("@/lib/server/services/orders", () => ({
  listOrdersForDriver,
  updateOrderStatus,
  assertDriverOwnsOrder,
  getStatusEvents: vi.fn(),
}));
vi.mock("@/lib/server/services/consumer-tracking", () => ({
  getConsumerNotes: vi.fn(),
}));
vi.mock("@/lib/server/services/proofs", () => ({
  createProof,
  listProofs: vi.fn(),
}));
vi.mock("@/lib/server/handle-service-error", () => ({
  handleServiceError: () => NextResponse.json({ error: "err" }, { status: 500 }),
}));

describe("disabled driver cannot use protected driver APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(
      NextResponse.json(
        { error: ACCOUNT_DISABLED_MESSAGE, code: ACCOUNT_DISABLED_CODE },
        { status: 403 },
      ),
    );
  });

  it("blocks driver order list", async () => {
    const { GET } = await import("@/app/api/driver/orders/route");
    const res = await GET(new Request("https://app.example/api/driver/orders"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: ACCOUNT_DISABLED_CODE });
    expect(listOrdersForDriver).not.toHaveBeenCalled();
  });

  it("blocks driver order detail by direct URL", async () => {
    const { GET } = await import("@/app/api/driver/orders/[id]/route");
    const res = await GET(
      new Request("https://app.example/api/driver/orders/ORD-1"),
      { params: Promise.resolve({ id: "ORD-1" }) },
    );
    expect(res.status).toBe(403);
    expect(assertDriverOwnsOrder).not.toHaveBeenCalled();
  });

  it("blocks proof upload", async () => {
    const { POST } = await import("@/app/api/orders/[id]/proofs/route");
    const res = await POST(
      new Request("https://app.example/api/orders/ORD-1/proofs", { method: "POST" }),
      { params: Promise.resolve({ id: "ORD-1" }) },
    );
    expect(res.status).toBe(403);
    expect(createProof).not.toHaveBeenCalled();
  });

  it("blocks status update / delivery completion", async () => {
    const { POST } = await import("@/app/api/orders/[id]/status/route");
    const res = await POST(
      new Request("https://app.example/api/orders/ORD-1/status", { method: "POST" }),
      { params: Promise.resolve({ id: "ORD-1" }) },
    );
    expect(res.status).toBe(403);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
