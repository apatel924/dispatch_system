import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";

const {
  requireRole,
  requireDriverId,
  assertDriverOwnsOrder,
  createProof,
  ensureFirebaseConfigured,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireDriverId: vi.fn(),
  assertDriverOwnsOrder: vi.fn(),
  createProof: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/driver-context", () => ({ requireDriverId }));
vi.mock("@/lib/server/services/orders", () => ({ assertDriverOwnsOrder }));
vi.mock("@/lib/server/services/proofs", () => ({ createProof, listProofs: vi.fn() }));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { validateAndDecodeProofDataUrl } from "@/lib/server/proof-validation";
import { POST } from "@/app/api/orders/[id]/proofs/route";

const driverUser = { uid: "user-1", role: "driver" as const, driverId: "driver-1" };

const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const pngDataUrl = `data:image/png;base64,${MINIMAL_PNG.toString("base64")}`;

function postProof(body: unknown) {
  return POST(
    new Request("http://localhost/api/orders/ORD-1/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "ORD-1" }) },
  );
}

describe("POST /api/orders/[id]/proofs", () => {
  afterEach(() => vi.clearAllMocks());

  it("uploads a valid proof for assigned driver", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);
    requireDriverId.mockResolvedValue("driver-1");
    assertDriverOwnsOrder.mockResolvedValue({});
    createProof.mockResolvedValue({ id: "proof-1", type: "signature" });

    const response = await postProof({
      type: "signature",
      stepKey: "signature",
      dataUrl: pngDataUrl,
    });

    expect(response.status).toBe(201);
    expect(createProof).toHaveBeenCalledWith(
      "ORD-1",
      expect.objectContaining({ type: "signature" }),
      driverUser,
      "driver-1",
    );
  });

  it("rejects unauthorized driver role", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    const { NextResponse } = await import("next/server");
    requireRole.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

    const response = await postProof({
      type: "signature",
      stepKey: "signature",
      dataUrl: pngDataUrl,
    });

    expect(response.status).toBe(403);
    expect(createProof).not.toHaveBeenCalled();
  });

  it("blocks driver not assigned to order", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);
    requireDriverId.mockResolvedValue("driver-2");
    assertDriverOwnsOrder.mockRejectedValue(
      new ServiceError("Order not found: ORD-1", "NOT_FOUND", 404),
    );

    const response = await postProof({
      type: "signature",
      stepKey: "signature",
      dataUrl: pngDataUrl,
    });

    expect(response.status).toBe(404);
    expect(createProof).not.toHaveBeenCalled();
  });

  it("rejects oversized encoded payload via validation", () => {
    const prev = process.env.PROOF_MAX_DATA_URL_CHARS;
    process.env.PROOF_MAX_DATA_URL_CHARS = "50";

    const huge = `data:image/png;base64,${"A".repeat(100)}`;
    try {
      validateAndDecodeProofDataUrl(huge, "signature");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ServiceError).status).toBe(413);
    } finally {
      process.env.PROOF_MAX_DATA_URL_CHARS = prev;
    }
  });

  it("surfaces Admin SDK upload failure", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);
    requireDriverId.mockResolvedValue("driver-1");
    assertDriverOwnsOrder.mockResolvedValue({});
    createProof.mockRejectedValue(new ServiceError("storage down", "INTERNAL_ERROR", 500));

    const response = await postProof({
      type: "signature",
      stepKey: "signature",
      dataUrl: pngDataUrl,
    });

    expect(response.status).toBe(500);
  });
});
