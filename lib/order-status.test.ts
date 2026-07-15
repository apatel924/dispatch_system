import { describe, expect, it } from "vitest";
import {
  CANONICAL_ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  assertOrderStatusTransition,
  canTransitionOrderStatus,
  dashboardGroupForStatus,
  dashboardGroupForOrder,
  isActiveDeliveryStatus,
  isAwaitingAssignment,
  isTerminalOrderStatus,
  normalizeOrderStatusForRead,
  tryNormalizeOrderStatus,
} from "@/lib/order-status";
import { OrderStatusConflict } from "@/lib/order-status";

describe("order-status model", () => {
  it("normalizes En Route and casing aliases to Out for Delivery", () => {
    expect(tryNormalizeOrderStatus("En Route")).toBe("Out for Delivery");
    expect(tryNormalizeOrderStatus("en route")).toBe("Out for Delivery");
    expect(tryNormalizeOrderStatus("out for delivery")).toBe("Out for Delivery");
    expect(normalizeOrderStatusForRead("En Route").status).toBe("Out for Delivery");
  });

  it("flags unknown statuses for quarantine without inventing trusted lifecycle grouping", () => {
    const result = normalizeOrderStatusForRead("Weird Legacy");
    expect(result.unrecognizedRaw).toBe("Weird Legacy");
    expect(result.status).toBe("Scheduled"); // typed placeholder only
    expect(tryNormalizeOrderStatus("Weird Legacy")).toBeNull();
    expect(
      dashboardGroupForOrder({
        status: result.status,
        unrecognizedStatusRaw: result.unrecognizedRaw,
      }),
    ).toBe("other");
    expect(dashboardGroupForStatus("Weird Legacy")).toBe("other");
    expect(
      isAwaitingAssignment({
        status: result.status,
        assignedDriverId: null,
        unrecognizedStatusRaw: result.unrecognizedRaw,
      }),
    ).toBe(false);
  });

  it("allows every declared transition", () => {
    for (const from of CANONICAL_ORDER_STATUSES) {
      for (const to of ORDER_STATUS_TRANSITIONS[from]) {
        expect(canTransitionOrderStatus(from, to)).toBe(true);
        expect(assertOrderStatusTransition(from, to)).toEqual({ from, to });
      }
    }
  });

  it("rejects disallowed transitions with INVALID_STATUS_TRANSITION", () => {
    expect(() => assertOrderStatusTransition("New", "Delivered")).toThrow(
      OrderStatusConflict,
    );
    try {
      assertOrderStatusTransition("New", "Delivered");
    } catch (err) {
      expect(err).toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    }
  });

  it("blocks reopening Delivered and Returned", () => {
    expect(() => assertOrderStatusTransition("Delivered", "Assigned")).toThrow(
      OrderStatusConflict,
    );
    try {
      assertOrderStatusTransition("Delivered", "Assigned");
    } catch (err) {
      expect(err).toMatchObject({ code: "TERMINAL_ORDER" });
    }
    expect(() => assertOrderStatusTransition("Returned", "New")).toThrow(
      OrderStatusConflict,
    );
  });

  it("allows Failed → Assigned (retry) and Failed → Returned", () => {
    expect(canTransitionOrderStatus("Failed", "Assigned")).toBe(true);
    expect(canTransitionOrderStatus("Failed", "Returned")).toBe(true);
  });

  it("groups dashboard statuses consistently", () => {
    expect(dashboardGroupForStatus("New")).toBe("awaiting_assignment");
    expect(dashboardGroupForStatus("Scheduled")).toBe("awaiting_assignment");
    expect(dashboardGroupForStatus("Assigned")).toBe("active");
    expect(dashboardGroupForStatus("Picked Up")).toBe("active");
    expect(dashboardGroupForStatus("En Route")).toBe("active");
    expect(dashboardGroupForStatus("Out for Delivery")).toBe("active");
    expect(dashboardGroupForStatus("Delivered")).toBe("completed");
    expect(dashboardGroupForStatus("Failed")).toBe("issues");
    expect(dashboardGroupForStatus("Returned")).toBe("closed_unsuccessful");
    expect(isActiveDeliveryStatus("Returned")).toBe(false);
    expect(isTerminalOrderStatus("Failed")).toBe(true);
    expect(dashboardGroupForStatus("Failed")).not.toBe("completed");
  });
});
