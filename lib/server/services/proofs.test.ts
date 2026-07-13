import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";
import { resetRateLimitsForTests } from "@/lib/server/rate-limit";

const mockSave = vi.fn();
const mockDelete = vi.fn();
const mockFile = vi.fn(() => ({
  save: mockSave,
  delete: mockDelete,
  getSignedUrl: vi.fn().mockResolvedValue(["https://signed.example/proof"]),
}));

const mockBucket = vi.fn(() => ({ file: mockFile }));
const mockRefSet = vi.fn();
const mockRef = { id: "proof-1", set: mockRefSet };
const mockOrderProofsCollection = vi.fn((_db: unknown, _orderId: string) => ({
  doc: vi.fn(() => mockRef),
  orderBy: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue({ docs: [] }),
}));

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminStorage: () => ({ bucket: mockBucket }),
  getAdminFirestore: () => ({}),
}));

vi.mock("@/lib/server/firestore/collections", () => ({
  orderProofsCollection: (db: unknown, orderId: string) => mockOrderProofsCollection(db, orderId),
}));

vi.mock("@/lib/server/services/orders", () => ({
  getOrderById: vi.fn().mockResolvedValue({
    id: "ORD-1",
    status: "Out for Delivery",
    completedSteps: [],
  }),
  updateOrder: vi.fn(),
  addStatusEvent: vi.fn(),
}));

vi.mock("@/lib/server/services/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import {
  buildProofStoragePath,
  createProof,
  decodeProofDataUrl,
  deleteProofFile,
  proofSignedUrlTtlMs,
  uploadProofFile,
} from "@/lib/server/services/proofs";

const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const pngDataUrl = `data:image/png;base64,${MINIMAL_PNG.toString("base64")}`;

const actor = { uid: "user-1", role: "driver" as const };

describe("proof upload helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitsForTests();
    mockSave.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockRefSet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.PROOF_SIGNED_URL_TTL_MS;
  });

  it("decodes a PNG data URL (legacy helper)", () => {
    const decoded = decodeProofDataUrl(pngDataUrl);
    expect(decoded.mimeType).toBe("image/png");
    expect(decoded.buffer.equals(MINIMAL_PNG)).toBe(true);
  });

  it("builds scoped storage paths under the order proofs prefix", () => {
    const path = buildProofStoragePath("ORD-1001", "signature", "png");
    expect(path).toMatch(/^orders\/ORD-1001\/proofs\/signature-\d+\.png$/);
  });

  it("defaults signed URL TTL to 15 minutes", () => {
    expect(proofSignedUrlTtlMs()).toBe(15 * 60 * 1000);
  });

  it("uploads validated proof bytes via Admin SDK", async () => {
    const result = await uploadProofFile("ORD-1", "signature", pngDataUrl);
    expect(result.mimeType).toBe("image/png");
    expect(result.fileSizeBytes).toBe(MINIMAL_PNG.length);
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("does not create metadata when file upload fails", async () => {
    mockSave.mockRejectedValueOnce(new Error("storage down"));

    await expect(
      createProof(
        "ORD-1",
        { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
        actor,
        "driver-1",
      ),
    ).rejects.toThrow("storage down");

    expect(mockRefSet).not.toHaveBeenCalled();
  });

  it("deletes uploaded file when metadata creation fails", async () => {
    mockRefSet.mockRejectedValueOnce(new Error("firestore down"));

    await expect(
      createProof(
        "ORD-1",
        { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
        actor,
        "driver-1",
      ),
    ).rejects.toThrow("firestore down");

    expect(mockSave).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("creates metadata after successful upload", async () => {
    const proof = await createProof(
      "ORD-1",
      { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
      actor,
      "driver-1",
    );

    expect(proof.id).toBe("proof-1");
    expect(mockRefSet).toHaveBeenCalledOnce();
  });

  it("rejects duplicate proof-type burst (double tap)", async () => {
    await createProof(
      "ORD-1",
      { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
      actor,
      "driver-1",
    );

    await expect(
      createProof(
        "ORD-1",
        { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
        actor,
        "driver-1",
      ),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it("deleteProofFile ignores missing objects", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    await expect(deleteProofFile("orders/ORD-1/proofs/x.png")).resolves.toBeUndefined();
  });
});
