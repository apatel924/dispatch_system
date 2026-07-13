import { describe, expect, it } from "vitest";
import {
  buildConsumerTrackingSteps,
  getConsumerStatusHeading,
  resolveConsumerStageKey,
} from "@/lib/consumer-tracking-status";
import type { Order, OrderStatus, OrderStatusEvent } from "@/lib/types/backend";

function makeOrder(overrides: Partial<Order> & Pick<Order, "id" | "status">): Order {
  return {
    trackingId: "QRX-1001",
    customerName: "Customer",
    customerPhone: "555-0100",
    pickupName: "Pharmacy",
    pickupAddress: "1 Main St",
    deliveryAddress: "2 Oak Ave",
    deliveryArea: "Edmonton",
    deliveryUnit: "4B",
    assignedDriverId: null,
    assignedDriverName: null,
    paymentStatus: "Paid",
    totalCents: 1000,
    totalDisplay: "$10.00",
    completedSteps: [],
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

describe("consumer tracking status mapping", () => {
  it("maps a new order to order received only", () => {
    const order = makeOrder({ id: "QRX-1", status: "New" });
    const steps = buildConsumerTrackingSteps(order, []);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.label).toBe("Order received");
    expect(steps[0]?.status).toBe("current");
  });

  it("does not show future stages before they occur", () => {
    const order = makeOrder({
      id: "QRX-2",
      status: "Assigned",
      assignedDriverId: "DRV-1",
      assignedAt: "2026-07-13T10:05:00.000Z",
    });
    const steps = buildConsumerTrackingSteps(order, []);
    expect(steps.map((step) => step.label)).toEqual(["Order received", "Driver assigned"]);
    expect(steps.at(-1)?.status).toBe("current");
  });

  it("shows driver heading to pickup after arrivedPickup step", () => {
    const order = makeOrder({
      id: "QRX-3",
      status: "Assigned",
      assignedDriverId: "DRV-1",
      completedSteps: ["arrivedPickup"],
    });
    expect(resolveConsumerStageKey(order, [])).toBe("heading_pickup");
    expect(getConsumerStatusHeading(order, [])).toBe("Driver heading to pickup");
  });

  it("shows delivered as complete terminal stage", () => {
    const order = makeOrder({
      id: "QRX-4",
      status: "Delivered",
      deliveredAt: "2026-07-13T12:00:00.000Z",
      completedSteps: ["arrivedPickup", "pickedUp", "outForDelivery", "arrivedDestination"],
    });
    const events: OrderStatusEvent[] = [
      {
        id: "e1",
        orderId: "QRX-4",
        status: "Delivered",
        actorId: "driver",
        actorRole: "driver",
        createdAt: "2026-07-13T12:00:00.000Z",
      },
    ];
    const steps = buildConsumerTrackingSteps(order, events);
    expect(steps.at(-1)?.label).toBe("Delivered");
    expect(steps.at(-1)?.status).toBe("complete");
  });

  it("marks failed delivery on the current stage", () => {
    const order = makeOrder({
      id: "QRX-5",
      status: "Failed" as OrderStatus,
      assignedDriverId: "DRV-1",
      completedSteps: ["arrivedPickup"],
    });
    const steps = buildConsumerTrackingSteps(order, []);
    expect(steps.at(-1)?.status).toBe("failed");
  });
});
