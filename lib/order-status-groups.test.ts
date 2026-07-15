import { describe, expect, it } from "vitest";
import {
  ACTIVE_DELIVERY_ORDER_STATUSES,
  isActiveDeliveryStatus,
  isAwaitingAssignment,
  isTerminalOrderStatus,
  dashboardGroupForStatus,
} from "@/lib/order-status-groups";
import type { OrderStatus } from "@/lib/types/backend";

describe("order-status-groups", () => {
  it("defines active delivery statuses from the authoritative model", () => {
    expect(ACTIVE_DELIVERY_ORDER_STATUSES).toEqual([
      "Assigned",
      "Picked Up",
      "Out for Delivery",
    ]);
    expect(isActiveDeliveryStatus("Assigned")).toBe(true);
    expect(isActiveDeliveryStatus("Scheduled")).toBe(false);
    expect(isActiveDeliveryStatus("New")).toBe(false);
    expect(isActiveDeliveryStatus("En Route" as OrderStatus)).toBe(true);
  });

  it("excludes terminal orders from awaiting assignment", () => {
    for (const status of ["Delivered", "Failed", "Returned"] as OrderStatus[]) {
      expect(
        isAwaitingAssignment({ status, assignedDriverId: null }),
      ).toBe(false);
      expect(isTerminalOrderStatus(status)).toBe(true);
    }
  });

  it("counts unassigned New and Scheduled as awaiting assignment", () => {
    expect(isAwaitingAssignment({ status: "New", assignedDriverId: null })).toBe(true);
    expect(
      isAwaitingAssignment({ status: "Scheduled", assignedDriverId: null }),
    ).toBe(true);
    expect(
      isAwaitingAssignment({ status: "New", assignedDriverId: "DRV-1" }),
    ).toBe(false);
  });

  it("does not treat Failed as completed or Returned as active", () => {
    expect(dashboardGroupForStatus("Failed")).toBe("issues");
    expect(dashboardGroupForStatus("Returned")).toBe("closed_unsuccessful");
    expect(isActiveDeliveryStatus("Returned")).toBe(false);
    expect(dashboardGroupForStatus("Out for Delivery")).toBe("active");
  });
});
