/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dash/api/config", () => ({ isApiEnabled: () => true }));
vi.mock("@/lib/dash/api/driver-client", () => ({
  postOrderProof: vi.fn(),
  postOrderStatus: vi.fn(),
}));

import { postOrderProof } from "@/lib/dash/api/driver-client";
import { AdminApiError } from "@/lib/dash/api/client";
import {
  LEGACY_PROOF_STORAGE_KEY,
  LOCAL_PROOF_TTL_MS,
  PROOF_STORAGE_KEY,
  clearDriverProofScope,
  getOrderProofs,
  prepareDriverProofLogout,
  pruneExpiredProofsForDriver,
  reconcileLocalProofsWithServer,
  resetProofUploadStateForTests,
  saveOrderProofs,
  saveProof,
  saveProofAsync,
} from "@/lib/dash/driver-store";

describe("driver-scoped proof persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    resetProofUploadStateForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    resetProofUploadStateForTests();
  });

  it("isolates Driver A proofs from Driver B", () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,aaa", {
      syncStatus: "captured_locally",
    });
    expect(getOrderProofs("DRV-B", "ORD-1").proofs.signature).toBeUndefined();
    expect(getOrderProofs("DRV-A", "ORD-1").proofs.signature).toContain("base64,aaa");
  });

  it("keeps different orders separate for the same driver", () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,one");
    saveProof("DRV-A", "ORD-2", "signature", "data:image/png;base64,two");
    expect(getOrderProofs("DRV-A", "ORD-1").proofs.signature).toContain("one");
    expect(getOrderProofs("DRV-A", "ORD-2").proofs.signature).toContain("two");
  });

  it("removes local Data URL after successful sync", async () => {
    vi.mocked(postOrderProof).mockResolvedValueOnce({
      proof: { id: "signature", type: "signature" },
    } as never);
    const result = await saveProofAsync(
      "DRV-A",
      "ORD-1",
      "signature",
      "data:image/png;base64,aaa",
    );
    expect(result.synced).toBe(true);
    expect(result.proofs.proofs.signature).toBeUndefined();
    expect(result.proofs.proofSync.signature?.syncStatus).toBe("synced");
    expect(result.proofs.proofSync.signature?.serverProofId).toBe("signature");
  });

  it("retains local Data URL after failed sync", async () => {
    vi.mocked(postOrderProof).mockRejectedValueOnce(
      new AdminApiError("Proof storage is temporarily unavailable. Please retry.", 503),
    );
    const result = await saveProofAsync(
      "DRV-A",
      "ORD-1",
      "signature",
      "data:image/png;base64,aaa",
    );
    expect(result.synced).toBe(false);
    expect(result.proofs.proofs.signature).toContain("base64,aaa");
    expect(result.proofs.proofSync.signature?.syncStatus).toBe("failed");
  });

  it("reconciliation clears stale Data URL when server proof exists", () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,stale", {
      syncStatus: "failed",
    });
    const next = reconcileLocalProofsWithServer("DRV-A", "ORD-1", [
      {
        id: "signature",
        orderId: "ORD-1",
        type: "signature",
        stepKey: "signature",
        storagePath: "orders/ORD-1/proofs/signature.png",
        mimeType: "image/png",
        uploadedBy: "u1",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        reviewStatus: "pending",
        downloadUrl: "https://signed.example/sig",
      },
    ]);
    expect(next.proofs.signature).toBeUndefined();
    expect(next.proofSync.signature?.syncStatus).toBe("synced");
  });

  it("does not expose legacy unscoped proof Data URLs to a new driver", () => {
    localStorage.setItem(
      LEGACY_PROOF_STORAGE_KEY,
      JSON.stringify({
        "ORD-1": {
          proofs: { signature: "data:image/png;base64,LEGACY" },
          proofSync: { signature: { syncStatus: "failed" } },
          completedSteps: [],
          stepTimestamps: {},
        },
      }),
    );
    expect(getOrderProofs("DRV-NEW", "ORD-1").proofs.signature).toBeUndefined();
    expect(localStorage.getItem(LEGACY_PROOF_STORAGE_KEY)).toBeNull();
  });

  it("prunes expired abandoned proofs but not actively uploading ones", () => {
    const old = new Date(Date.now() - LOCAL_PROOF_TTL_MS - 60_000).toISOString();
    localStorage.setItem(
      PROOF_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        drivers: {
          "DRV-A": {
            "ORD-OLD": {
              completedSteps: [],
              stepTimestamps: {},
              proofs: { signature: "data:image/png;base64,old" },
              proofSync: {
                signature: {
                  syncStatus: "failed",
                  capturedAt: old,
                  updatedAt: old,
                },
              },
            },
            "ORD-UP": {
              completedSteps: [],
              stepTimestamps: {},
              proofs: { exteriorPhoto: "data:image/jpeg;base64,up" },
              proofSync: {
                exteriorPhoto: {
                  syncStatus: "uploading",
                  capturedAt: old,
                  updatedAt: old,
                },
              },
            },
          },
        },
      }),
    );

    const { prunedOrders } = pruneExpiredProofsForDriver("DRV-A");
    expect(prunedOrders).toBeGreaterThanOrEqual(1);
    expect(getOrderProofs("DRV-A", "ORD-OLD").proofs.signature).toBeUndefined();
    expect(getOrderProofs("DRV-A", "ORD-UP").proofs.exteriorPhoto).toContain("base64,up");
  });

  it("clears driver scope on logout when no unsynced proofs", () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,aaa", {
      syncStatus: "synced",
      markStepComplete: true,
    });
    // Synced with mock still keeps URL when saved via saveProof markComplete - simulate cleaned synced meta
    saveOrderProofs("DRV-A", "ORD-1", {
      completedSteps: ["signature"],
      stepTimestamps: {},
      proofs: {},
      proofSync: { signature: { syncStatus: "synced", serverProofId: "signature" } },
    });
    const logout = prepareDriverProofLogout("DRV-A");
    expect(logout.hasUnsynced).toBe(false);
    logout.clear();
    expect(getOrderProofs("DRV-A", "ORD-1").proofSync.signature).toBeUndefined();
  });

  it("flags logout warning when unsynced proofs exist", () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,aaa", {
      syncStatus: "failed",
    });
    const logout = prepareDriverProofLogout("DRV-A");
    expect(logout.hasUnsynced).toBe(true);
    clearDriverProofScope("DRV-A");
    expect(logout.hasUnsynced).toBe(true); // stale check already computed
    expect(getOrderProofs("DRV-A", "ORD-1").proofs.signature).toBeUndefined();
  });

  it("downgrades local synced when server has no proof", () => {
    saveOrderProofs("DRV-A", "ORD-1", {
      completedSteps: ["signature"],
      stepTimestamps: { signature: "2026-01-01T00:00:00.000Z" },
      proofs: {},
      proofSync: { signature: { syncStatus: "synced", serverProofId: "ghost" } },
    });
    const next = reconcileLocalProofsWithServer("DRV-A", "ORD-1", []);
    expect(next.proofSync.signature?.syncStatus).toBe("not_captured");
    expect(next.completedSteps).not.toContain("signature");
  });
});
