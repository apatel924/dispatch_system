import { describe, expect, it } from "vitest";
import {
  aggregateDriverMetricsFromOrders,
  deliveryDurationMs,
  isDriverAvailable,
  isDriverBusy,
  localDayKey,
  percentChange,
} from "@/lib/delivery-metrics";
import type { Order } from "@/lib/types/backend";

const EDMONTON = "America/Edmonton";

function makeOrder(overrides: Partial<Order> & Pick<Order, "id" | "status">): Order {
  return {
    id: overrides.id,
    trackingId: overrides.trackingId ?? "TRK-1",
    customerName: "Customer",
    customerPhone: "555-0100",
    pickupName: "Pickup",
    pickupAddress: "123 Pickup St",
    deliveryAddress: "456 Delivery Ave",
    assignedDriverId: overrides.assignedDriverId ?? "DRV-1",
    assignedDriverName: overrides.assignedDriverName ?? "Driver One",
    status: overrides.status,
    paymentStatus: "Paid",
    totalCents: 1000,
    totalDisplay: "$10.00",
    completedSteps: [],
    createdAt: overrides.createdAt ?? "2026-07-13T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-13T10:00:00.000Z",
    assignedAt: overrides.assignedAt,
    deliveredAt: overrides.deliveredAt,
    failedAt: overrides.failedAt,
    source: "manual",
  };
}

describe("delivery-metrics", () => {
  it("computes delivery duration from assignedAt to deliveredAt", () => {
    const order = makeOrder({
      id: "QRX-1",
      status: "Delivered",
      assignedAt: "2026-07-13T10:00:00.000Z",
      deliveredAt: "2026-07-13T10:30:00.000Z",
    });
    expect(deliveryDurationMs(order)).toBe(30 * 60 * 1000);
  });

  it("returns null duration without assignedAt", () => {
    const order = makeOrder({
      id: "QRX-2",
      status: "Delivered",
      deliveredAt: "2026-07-13T10:30:00.000Z",
    });
    expect(deliveryDurationMs(order)).toBeNull();
  });

  it("aggregates driver metrics using Edmonton today boundaries", () => {
    const orders = [
      makeOrder({
        id: "QRX-3",
        status: "Assigned",
        assignedDriverId: "DRV-1",
      }),
      makeOrder({
        id: "QRX-4",
        status: "Delivered",
        assignedDriverId: "DRV-1",
        assignedAt: "2026-07-13T08:00:00.000Z",
        deliveredAt: "2026-07-13T08:20:00.000Z",
        updatedAt: "2026-07-13T08:20:00.000Z",
      }),
      makeOrder({
        id: "QRX-5",
        status: "Failed",
        assignedDriverId: "DRV-1",
        failedAt: "2026-07-13T09:00:00.000Z",
        updatedAt: "2026-07-13T09:00:00.000Z",
      }),
    ];

    const todayKey = localDayKey("2026-07-13T12:00:00.000Z", EDMONTON);
    const metrics = aggregateDriverMetricsFromOrders(orders, ["DRV-1"], EDMONTON);
    const row = metrics.get("DRV-1")!;

    expect(row.activeDeliveries).toBe(1);
    expect(row.completedToday).toBe(1);
    expect(row.failedToday).toBe(1);
    expect(row.totalDeliveries).toBe(2);
    expect(row.averageDeliveryTimeMs).toBe(20 * 60 * 1000);
    expect(todayKey).toBe("2026-07-13");
  });

  it("uses deliveredAt for today counts even when updatedAt is later", () => {
    const orders = [
      makeOrder({
        id: "QRX-6",
        status: "Delivered",
        deliveredAt: "2026-07-13T08:20:00.000Z",
        updatedAt: "2026-07-14T12:00:00.000Z",
      }),
    ];

    const metrics = aggregateDriverMetricsFromOrders(orders, ["DRV-1"], EDMONTON, "2026-07-13");
    expect(metrics.get("DRV-1")!.completedToday).toBe(1);

    const nextDay = aggregateDriverMetricsFromOrders(orders, ["DRV-1"], EDMONTON, "2026-07-14");
    expect(nextDay.get("DRV-1")!.completedToday).toBe(0);
  });

  it("classifies busy and available drivers", () => {
    expect(isDriverBusy("Busy", 0)).toBe(true);
    expect(isDriverBusy("Available", 2)).toBe(true);
    expect(isDriverAvailable("Available", 0)).toBe(true);
    expect(isDriverAvailable("Available", 1)).toBe(false);
  });

  it("returns null percent change when previous is zero and current is non-zero", () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 5)).toBe(100);
  });
});
