/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { postOrderProof, postOrderStatus } = vi.hoisted(() => ({
  postOrderProof: vi.fn(),
  postOrderStatus: vi.fn(),
}));

vi.mock("@/lib/dash/api/config", () => ({ isApiEnabled: () => true }));
vi.mock("@/lib/dash/api/driver-client", () => ({
  postOrderProof,
  postOrderStatus,
}));

import { AdminApiError } from "@/lib/dash/api/client";
import {
  areRequiredProofsSynced,
  completeDeliveryAsync,
  getOrderProofs,
  resetProofUploadStateForTests,
  saveOrderProofs,
  saveProof,
  saveProofAsync,
} from "@/lib/dash/driver-store";

const DRIVER = "DRV-TEST";

describe("driver proof sync + completion gating", () => {
  beforeEach(() => {
    localStorage.clear();
    resetProofUploadStateForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    resetProofUploadStateForTests();
  });

  it("keeps a locally captured proof as unsynced until upload succeeds", async () => {
    postOrderProof.mockRejectedValueOnce(
      new AdminApiError(
        "Proof storage is temporarily unavailable. Please retry.",
        503,
        "STORAGE_UNAVAILABLE",
      ),
    );

    const result = await saveProofAsync(
      DRIVER,
      "ORD-1",
      "signature",
      "data:image/png;base64,aaa",
    );
    expect(result.synced).toBe(false);
    expect(result.error).toContain("kept so you can retry");
    expect(getOrderProofs(DRIVER, "ORD-1").proofSync.signature?.syncStatus).toBe("failed");
    expect(getOrderProofs(DRIVER, "ORD-1").completedSteps).not.toContain("signature");
    expect(areRequiredProofsSynced(DRIVER, "ORD-1")).toBe(false);
  });

  it("marks a proof synced only after server confirmation", async () => {
    postOrderProof.mockResolvedValueOnce({ proof: { id: "signature" } });
    const result = await saveProofAsync(
      DRIVER,
      "ORD-1",
      "signature",
      "data:image/png;base64,aaa",
    );
    expect(result.synced).toBe(true);
    expect(getOrderProofs(DRIVER, "ORD-1").proofSync.signature?.syncStatus).toBe("synced");
    expect(getOrderProofs(DRIVER, "ORD-1").completedSteps).toContain("signature");
    expect(getOrderProofs(DRIVER, "ORD-1").proofs.signature).toBeUndefined();
  });

  it("blocks completeDeliveryAsync when proofs are only local", async () => {
    saveProof(DRIVER, "ORD-1", "signature", "data:image/png;base64,aaa", {
      markStepComplete: false,
      syncStatus: "captured_locally",
    });
    saveProof(DRIVER, "ORD-1", "exteriorPhoto", "data:image/jpeg;base64,bbb", {
      markStepComplete: false,
      syncStatus: "captured_locally",
    });

    await expect(completeDeliveryAsync(DRIVER, "ORD-1")).rejects.toThrow(
      /Upload all required proofs/,
    );
    expect(postOrderStatus).not.toHaveBeenCalled();
  });

  it("blocks completeDeliveryAsync while a proof upload is in flight", async () => {
    let resolveUpload!: (value: { proof: { id: string } }) => void;
    postOrderProof.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const upload = saveProofAsync(DRIVER, "ORD-1", "signature", "data:image/png;base64,aaa");
    await expect(completeDeliveryAsync(DRIVER, "ORD-1")).rejects.toThrow(
      /Wait for proof uploads/,
    );
    resolveUpload({ proof: { id: "signature" } });
    await upload;
  });

  it("allows completeDeliveryAsync when required proofs are synced", async () => {
    saveOrderProofs(DRIVER, "ORD-1", {
      completedSteps: ["signature", "exteriorPhoto"],
      stepTimestamps: {},
      proofs: {},
      proofSync: {
        signature: { syncStatus: "synced", serverProofId: "signature" },
        exteriorPhoto: { syncStatus: "synced", serverProofId: "exteriorPhoto" },
      },
    });
    postOrderStatus.mockResolvedValueOnce({
      order: { id: "ORD-1", status: "Delivered" },
      event: {},
    });

    await completeDeliveryAsync(DRIVER, "ORD-1");
    expect(postOrderStatus).toHaveBeenCalledWith("ORD-1", {
      status: "Delivered",
      note: "Delivery completed by driver",
    });
  });

  it("deduplicates concurrent completeDeliveryAsync calls", async () => {
    saveOrderProofs(DRIVER, "ORD-1", {
      completedSteps: ["signature", "exteriorPhoto"],
      stepTimestamps: {},
      proofs: {},
      proofSync: {
        signature: { syncStatus: "synced" },
        exteriorPhoto: { syncStatus: "synced" },
      },
    });

    let resolveStatus!: (value: unknown) => void;
    postOrderStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
    );

    const first = completeDeliveryAsync(DRIVER, "ORD-1");
    const second = completeDeliveryAsync(DRIVER, "ORD-1");
    resolveStatus({ order: { id: "ORD-1", status: "Delivered" }, event: {} });
    await Promise.all([first, second]);
    expect(postOrderStatus).toHaveBeenCalledTimes(1);
  });
});
