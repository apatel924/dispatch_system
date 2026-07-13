import { afterEach, describe, expect, it, vi } from "vitest";

const { getAdminFirestore, orderConsumerNotesCollection, nowIso } = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
  orderConsumerNotesCollection: vi.fn(),
  nowIso: vi.fn(() => "2026-07-13T12:00:00.000Z"),
}));

vi.mock("@/lib/server/firebase-admin", () => ({ getAdminFirestore }));
vi.mock("@/lib/server/firestore/collections", () => ({ orderConsumerNotesCollection }));
vi.mock("@/lib/server/firestore/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/firestore/helpers")>();
  return { ...actual, nowIso };
});

import { acknowledgeConsumerNote } from "@/lib/server/services/consumer-tracking";

describe("acknowledgeConsumerNote", () => {
  afterEach(() => vi.clearAllMocks());

  it("preserves consumer-authored text when acknowledging", async () => {
    const update = vi.fn();
    const get = vi.fn().mockResolvedValue({
      exists: true,
      id: "cn-1",
      data: () => ({
        orderId: "QRX-1",
        source: "consumer",
        text: "Buzzer 402",
        createdAt: "2026-07-13T11:00:00.000Z",
        trackingLinkVersion: 1,
      }),
    });
    const doc = vi.fn(() => ({ get, update }));
    orderConsumerNotesCollection.mockReturnValue({ doc });
    getAdminFirestore.mockReturnValue({});

    const result = await acknowledgeConsumerNote("QRX-1", "cn-1", "driver-uid");

    expect(result.text).toBe("Buzzer 402");
    expect(result.acknowledgedAt).toBe("2026-07-13T12:00:00.000Z");
    expect(result.acknowledgedByUid).toBe("driver-uid");
    expect(update).toHaveBeenCalledWith({
      acknowledgedAt: "2026-07-13T12:00:00.000Z",
      acknowledgedByUid: "driver-uid",
    });
  });
});
