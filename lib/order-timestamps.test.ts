import { describe, expect, it } from "vitest";
import {
  orderDeliveredAt,
  orderFailedAt,
  orderPickedUpAt,
  orderReturnedAt,
  orderUsesLegacyReportingTimestamp,
} from "@/lib/order-timestamps";
import type { Order } from "@/lib/types/backend";

function makeOrder(overrides: Partial<Order> & Pick<Order, "id" | "status">): Order {
  return {
    id: overrides.id,
    trackingId: "TRK-1",
    customerName: "Customer",
    customerPhone: "555-0100",
    pickupName: "Pickup",
    pickupAddress: "123 Pickup St",
    deliveryAddress: "456 Delivery Ave",
    assignedDriverId: "DRV-1",
    assignedDriverName: "Driver",
    status: overrides.status,
    paymentStatus: "Paid",
    totalCents: 1000,
    totalDisplay: "$10.00",
    completedSteps: [],
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-16T12:00:00.000Z",
    deliveredAt: overrides.deliveredAt,
    failedAt: overrides.failedAt,
    pickedUpAt: overrides.pickedUpAt,
    returnedAt: overrides.returnedAt,
    assignedAt: overrides.assignedAt,
    source: "manual",
  };
}

describe("order-timestamps", () => {
  it("prefers deliveredAt over updatedAt for delivered orders", () => {
    const order = makeOrder({
      id: "QRX-1",
      status: "Delivered",
      deliveredAt: "2026-01-15T20:00:00.000Z",
      updatedAt: "2026-01-16T12:00:00.000Z",
    });
    expect(orderDeliveredAt(order)).toBe("2026-01-15T20:00:00.000Z");
    expect(orderUsesLegacyReportingTimestamp(order)).toBe(false);
  });

  it("falls back to updatedAt for legacy delivered orders", () => {
    const order = makeOrder({
      id: "QRX-2",
      status: "Delivered",
      updatedAt: "2026-01-15T21:00:00.000Z",
    });
    expect(orderDeliveredAt(order)).toBe("2026-01-15T21:00:00.000Z");
    expect(orderUsesLegacyReportingTimestamp(order)).toBe(true);
  });

  it("prefers failedAt over updatedAt for failed orders", () => {
    const order = makeOrder({
      id: "QRX-3",
      status: "Failed",
      failedAt: "2026-01-15T18:00:00.000Z",
      updatedAt: "2026-01-16T12:00:00.000Z",
    });
    expect(orderFailedAt(order)).toBe("2026-01-15T18:00:00.000Z");
  });

  it("returns pickedUpAt without fallback", () => {
    const withPickup = makeOrder({
      id: "QRX-4",
      status: "Picked Up",
      pickedUpAt: "2026-01-15T16:00:00.000Z",
    });
    const withoutPickup = makeOrder({ id: "QRX-5", status: "Picked Up" });
    expect(orderPickedUpAt(withPickup)).toBe("2026-01-15T16:00:00.000Z");
    expect(orderPickedUpAt(withoutPickup)).toBeUndefined();
  });

  it("prefers returnedAt for returned orders", () => {
    const order = makeOrder({
      id: "QRX-6",
      status: "Returned",
      returnedAt: "2026-01-15T19:00:00.000Z",
    });
    expect(orderReturnedAt(order)).toBe("2026-01-15T19:00:00.000Z");
  });
});
