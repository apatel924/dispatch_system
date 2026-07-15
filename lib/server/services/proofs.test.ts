import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";
import { resetRateLimitsForTests } from "@/lib/server/rate-limit";

const {
  mockSave,
  mockDelete,
  mockDocGet,
  mockFile,
  mockBucket,
  mockRefSet,
  mockRef,
  mockCollectionGet,
  mockOrderProofsCollection,
  updateOrder,
  addStatusEvent,
  getOrderById,
  mockStorageConfigured,
} = vi.hoisted(() => {
  const mockSave = vi.fn();
  const mockDelete = vi.fn();
  const mockDocGet = vi.fn();
  const mockFile = vi.fn(() => ({
    save: mockSave,
    delete: mockDelete,
    getSignedUrl: vi.fn().mockResolvedValue(["https://signed.example/proof"]),
  }));
  const mockBucket = vi.fn(() => ({ file: mockFile }));
  const mockRefSet = vi.fn();
  const mockRef = { id: "signature", set: mockRefSet, get: mockDocGet };
  const mockCollectionGet = vi.fn().mockResolvedValue({ docs: [] });
  const mockOrderProofsCollection = vi.fn((_db: unknown, _orderId: string) => ({
    doc: vi.fn((id?: string) => ({ ...mockRef, id: id ?? mockRef.id })),
    orderBy: vi.fn().mockReturnThis(),
    get: mockCollectionGet,
  }));
  return {
    mockSave,
    mockDelete,
    mockDocGet,
    mockFile,
    mockBucket,
    mockRefSet,
    mockRef,
    mockCollectionGet,
    mockOrderProofsCollection,
    updateOrder: vi.fn(),
    addStatusEvent: vi.fn(),
    getOrderById: vi.fn().mockResolvedValue({
      id: "ORD-1",
      status: "Out for Delivery",
      completedSteps: [],
    }),
    mockStorageConfigured: vi.fn(() => true),
  };
});

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminStorage: () => ({ bucket: mockBucket }),
  getAdminFirestore: () => ({}),
}));

vi.mock("@/lib/server/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/env")>("@/lib/server/env");
  return {
    ...actual,
    isFirebaseStorageConfigured: () => mockStorageConfigured(),
    getFirebaseStorageBucketName: () =>
      mockStorageConfigured() ? "test-bucket" : undefined,
  };
});

vi.mock("@/lib/server/firestore/collections", () => ({
  orderProofsCollection: (db: unknown, orderId: string) => mockOrderProofsCollection(db, orderId),
}));

vi.mock("@/lib/server/services/orders", () => ({
  getOrderById,
  updateOrder,
  addStatusEvent,
}));

vi.mock("@/lib/server/services/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import {
  buildProofStoragePath,
  createProof,
  decodeProofDataUrl,
  deleteProofFile,
  proofDocumentIdForType,
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
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockResolvedValue({ docs: [] });
    mockStorageConfigured.mockReturnValue(true);
    getOrderById.mockResolvedValue({
      id: "ORD-1",
      status: "Out for Delivery",
      completedSteps: [],
    });
    updateOrder.mockResolvedValue({});
    addStatusEvent.mockResolvedValue({});
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "test-bucket";
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

  it("uses a deterministic proof document id per type", () => {
    expect(proofDocumentIdForType("signature")).toBe("signature");
    expect(proofDocumentIdForType("exteriorPhoto")).toBe("exteriorPhoto");
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
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });

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
    ).rejects.toMatchObject({
      code: "PROOF_PERSIST_FAILED",
      status: 503,
    });

    expect(mockSave).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("keeps storage object when order step update fails after proof doc write", async () => {
    updateOrder.mockRejectedValueOnce(new Error("order update failed"));

    await expect(
      createProof(
        "ORD-1",
        { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
        actor,
        "driver-1",
      ),
    ).rejects.toMatchObject({
      code: "PROOF_STEP_UPDATE_FAILED",
      status: 503,
    });

    expect(mockRefSet).toHaveBeenCalledOnce();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("creates metadata after successful upload", async () => {
    const proof = await createProof(
      "ORD-1",
      { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
      actor,
      "driver-1",
    );

    expect(proof.id).toBe("signature");
    expect(mockRefSet).toHaveBeenCalledOnce();
  });

  it("returns existing proof on retry without duplicating storage upload", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      id: "signature",
      data: () => ({
        orderId: "ORD-1",
        type: "signature",
        stepKey: "signature",
        storagePath: "orders/ORD-1/proofs/signature-1.png",
        mimeType: "image/png",
        fileSizeBytes: 12,
        uploadedBy: "user-1",
        uploadedAt: "2024-01-01T00:00:00.000Z",
        reviewStatus: "pending",
      }),
    });

    const proof = await createProof(
      "ORD-1",
      { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
      actor,
      "driver-1",
    );

    expect(proof.storagePath).toBe("orders/ORD-1/proofs/signature-1.png");
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockRefSet).not.toHaveBeenCalled();
  });

  it("retries missing completed-step after proof doc exists without re-uploading", async () => {
    // Simulate prior partial success: Storage + Firestore exist, completedSteps missing.
    getOrderById.mockResolvedValue({
      id: "ORD-1",
      status: "Out for Delivery",
      completedSteps: [],
    });
    mockDocGet.mockResolvedValue({
      exists: true,
      id: "signature",
      data: () => ({
        orderId: "ORD-1",
        type: "signature",
        stepKey: "signature",
        storagePath: "orders/ORD-1/proofs/signature-1.png",
        mimeType: "image/png",
        fileSizeBytes: 12,
        uploadedBy: "user-1",
        uploadedAt: "2024-01-01T00:00:00.000Z",
        reviewStatus: "pending",
      }),
    });
    updateOrder.mockResolvedValueOnce({});

    const proof = await createProof(
      "ORD-1",
      { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
      actor,
      "driver-1",
    );

    expect(proof.storagePath).toBe("orders/ORD-1/proofs/signature-1.png");
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockRefSet).not.toHaveBeenCalled();
    expect(updateOrder).toHaveBeenCalledWith(
      "ORD-1",
      { completedSteps: ["signature"] },
      actor,
    );
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

  it("maps missing bucket configuration to STORAGE_NOT_CONFIGURED", async () => {
    mockStorageConfigured.mockReturnValue(false);
    await expect(uploadProofFile("ORD-1", "signature", pngDataUrl)).rejects.toMatchObject({
      code: "STORAGE_NOT_CONFIGURED",
      status: 503,
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("maps bucket-not-found (404) to STORAGE_NOT_CONFIGURED without Firestore writes", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    mockSave.mockRejectedValueOnce(Object.assign(new Error("The specified bucket does not exist."), { code: 404 }));

    await expect(
      createProof(
        "ORD-1",
        { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
        actor,
        "driver-1",
      ),
    ).rejects.toMatchObject({
      code: "STORAGE_NOT_CONFIGURED",
      status: 503,
    });

    expect(mockRefSet).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
    const proofLogs = logSpy.mock.calls
      .filter((c) => c[0] === "[proof]")
      .map((c) => JSON.parse(String(c[1])));
    expect(proofLogs.some((l) => l.stage === "storage_upload" && l.firebaseCode === "404")).toBe(
      true,
    );
    expect(JSON.stringify(proofLogs)).not.toContain("data:image");
    logSpy.mockRestore();
  });

  it("maps permission denied to STORAGE_UNAVAILABLE with safe log fields", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    mockSave.mockRejectedValueOnce(
      Object.assign(new Error("Permission denied"), { code: 403, status: 403 }),
    );

    await expect(
      createProof(
        "ORD-1",
        { type: "signature", stepKey: "signature", dataUrl: pngDataUrl },
        actor,
        "driver-1",
      ),
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });

    expect(mockRefSet).not.toHaveBeenCalled();
    const proofLogs = logSpy.mock.calls
      .filter((c) => c[0] === "[proof]")
      .map((c) => JSON.parse(String(c[1])));
    const uploadLog = proofLogs.find((l) => l.stage === "storage_upload");
    expect(uploadLog).toMatchObject({
      firebaseCode: "403",
      message: "permission_denied",
      bucketResolved: true,
    });
    expect(JSON.stringify(uploadLog)).not.toContain(pngDataUrl);
    logSpy.mockRestore();
  });

  it("maps transient storage failures to retryable STORAGE_UNAVAILABLE", async () => {
    mockSave.mockRejectedValueOnce(Object.assign(new Error("backend timeout"), { code: 503 }));

    await expect(uploadProofFile("ORD-1", "signature", pngDataUrl)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });
  });
});
