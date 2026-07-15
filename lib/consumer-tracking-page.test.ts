import { describe, expect, it } from "vitest";
import { buildConsumerTrackingView } from "@/lib/server/services/consumer-tracking";
import type { Order, TrackingLink } from "@/lib/types/backend";
import { CONSUMER_TRACKING_LAYOUT } from "@/lib/consumer/layout";

function makeOrder(): Order {
  return {
    id: "internal-order-123",
    trackingId: "QRX-9001",
    customerName: "Hidden Customer",
    customerPhone: "555-9999",
    customerEmail: "secret@example.com",
    pickupName: "North Pharmacy",
    pickupAddress: "999 Internal Rd",
    deliveryAddress: "123 Secret St",
    deliveryArea: "Edmonton",
    deliveryUnit: "12A",
    assignedDriverId: "DRV-9",
    assignedDriverName: "Alex Driver",
    status: "Out for Delivery",
    paymentStatus: "Paid",
    totalCents: 1500,
    totalDisplay: "$15.00",
    completedSteps: ["arrivedPickup", "pickedUp", "outForDelivery"],
    createdAt: "2026-07-13T09:00:00.000Z",
    updatedAt: "2026-07-13T10:30:00.000Z",
    source: "manual",
  };
}

describe("consumer tracking view privacy", () => {
  it("does not expose private customer or payment fields", () => {
    const link: TrackingLink = {
      id: "a".repeat(64),
      orderId: "internal-order-123",
      publicReference: "QRX-9001",
      version: 1,
      createdAt: "2026-07-13T09:00:00.000Z",
    };

    const view = buildConsumerTrackingView(makeOrder(), link, [], []);
    const serialized = JSON.stringify(view);

    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain("555-9999");
    expect(serialized).not.toContain("Hidden Customer");
    expect(serialized).not.toContain("999 Internal Rd");
    expect(serialized).not.toContain("123 Secret St");
    expect(serialized).not.toContain("Alex Driver");
    expect(serialized).not.toContain("internal-order-123");
    expect(view.publicReference).toBe("QRX-9001");
    expect(view.deliveryDestination).toBe("Edmonton · Unit 12A");
    expect(view.pickupName).toBe("North Pharmacy");
  });

  it("strips internal ids from consumer notes in the public view", () => {
    const link: TrackingLink = {
      id: "a".repeat(64),
      orderId: "internal-order-123",
      publicReference: "QRX-9001",
      version: 1,
      createdAt: "2026-07-13T09:00:00.000Z",
    };

    const view = buildConsumerTrackingView(makeOrder(), link, [], [
      {
        id: "cn-1",
        orderId: "internal-order-123",
        source: "consumer",
        text: "Buzzer 402",
        createdAt: "2026-07-13T11:00:00.000Z",
        trackingLinkVersion: 1,
        acknowledgedByUid: "admin-uid",
      },
    ]);

    expect(view.consumerNotes).toEqual([
      {
        id: "cn-1",
        source: "consumer",
        text: "Buzzer 402",
        createdAt: "2026-07-13T11:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(view.consumerNotes)).not.toContain("admin-uid");
    expect(JSON.stringify(view.consumerNotes)).not.toContain("QRX-9001");
    expect(JSON.stringify(view.consumerNotes)).not.toContain("internal-order-123");
  });

  it("only includes ETA when present on the order", () => {
    const link: TrackingLink = {
      id: "a".repeat(64),
      orderId: "internal-order-123",
      publicReference: "QRX-9001",
      version: 1,
      createdAt: "2026-07-13T09:00:00.000Z",
    };

    const withoutEta = buildConsumerTrackingView(makeOrder(), link, [], []);
    expect(withoutEta.estimatedArrival).toBeUndefined();

    const withEta = buildConsumerTrackingView(
      { ...makeOrder(), eta: "11:45 AM" },
      link,
      [],
      [],
    );
    expect(withEta.estimatedArrival).toBe("11:45 AM");
  });
});

describe("consumer tracking mobile layout", () => {
  it("uses a narrow max width and touch-friendly targets", () => {
    expect(CONSUMER_TRACKING_LAYOUT.container).toContain("max-w-md");
    expect(CONSUMER_TRACKING_LAYOUT.container).toContain("px-4");
    expect(CONSUMER_TRACKING_LAYOUT.touchTarget).toContain("min-h-11");
  });
});
