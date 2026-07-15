import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";

const mockGet = vi.fn();

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminFirestore: () => ({}),
}));

vi.mock("@/lib/server/firestore/collections", () => ({
  orderProofsCollection: () => ({
    get: mockGet,
  }),
}));

import { assertRequiredProofsForDelivery } from "@/lib/server/services/required-proofs";

describe("assertRequiredProofsForDelivery", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("rejects completion when required proofs are missing", async () => {
    mockGet.mockResolvedValue({
      docs: [
        {
          data: () => ({
            type: "signature",
            storagePath: "orders/ORD-1/proofs/signature-1.png",
          }),
        },
      ],
    });

    await expect(assertRequiredProofsForDelivery("ORD-1")).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("allows completion when all required proofs exist with storage paths", async () => {
    mockGet.mockResolvedValue({
      docs: [
        {
          data: () => ({
            type: "signature",
            storagePath: "orders/ORD-1/proofs/signature-1.png",
          }),
        },
        {
          data: () => ({
            type: "exteriorPhoto",
            storagePath: "orders/ORD-1/proofs/exteriorPhoto-1.jpg",
          }),
        },
      ],
    });

    await expect(assertRequiredProofsForDelivery("ORD-1")).resolves.toBeUndefined();
  });

  it("ignores proof docs without storage paths", async () => {
    mockGet.mockResolvedValue({
      docs: [
        { data: () => ({ type: "signature", storagePath: "" }) },
        { data: () => ({ type: "exteriorPhoto", storagePath: "orders/x.jpg" }) },
      ],
    });

    await expect(assertRequiredProofsForDelivery("ORD-1")).rejects.toBeInstanceOf(ServiceError);
  });
});
