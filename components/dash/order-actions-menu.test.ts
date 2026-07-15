import { describe, expect, it } from "vitest";
import { __orderActionsTest } from "@/components/dash/order-actions-menu";

const { contextualActionsForStatus } = __orderActionsTest;

describe("OrderActionsMenu contextual actions", () => {
  it("New shows Assign but not Delivered", () => {
    const ctx = contextualActionsForStatus("New", false);
    expect(ctx.showAssign).toBe(true);
    expect(ctx.assignLabel).toBe("Assign Driver");
    expect(ctx.showMarkDelivered).toBe(false);
    expect(ctx.showMarkFailed).toBe(true);
  });

  it("Assigned shows Reassign and Mark Picked Up", () => {
    const ctx = contextualActionsForStatus("Assigned", true);
    expect(ctx.showAssign).toBe(true);
    expect(ctx.assignLabel).toBe("Reassign Driver");
    expect(ctx.showMarkPickedUp).toBe(true);
    expect(ctx.showMarkDelivered).toBe(false);
    expect(ctx.showBeginDelivery).toBe(false);
  });

  it("Picked Up offers Begin Delivery and Reassign, not Mark Delivered", () => {
    const ctx = contextualActionsForStatus("Picked Up", true);
    expect(ctx.showBeginDelivery).toBe(true);
    expect(ctx.showAssign).toBe(true);
    expect(ctx.assignLabel).toBe("Reassign Driver");
    expect(ctx.showMarkDelivered).toBe(false);
  });

  it("Out for Delivery is the only normal state that offers Mark Delivered", () => {
    expect(contextualActionsForStatus("Out for Delivery", true).showMarkDelivered).toBe(true);
    expect(contextualActionsForStatus("Out for Delivery", true).viewLabel).toBe("View Delivery");
    expect(contextualActionsForStatus("Assigned", true).showMarkDelivered).toBe(false);
    expect(contextualActionsForStatus("Picked Up", true).showMarkDelivered).toBe(false);
    expect(contextualActionsForStatus("New", false).showMarkDelivered).toBe(false);
  });

  it("Failed shows Retry and Returned", () => {
    const ctx = contextualActionsForStatus("Failed", false);
    expect(ctx.showRetryAssign).toBe(true);
    expect(ctx.showMarkReturned).toBe(true);
    expect(ctx.showMarkDelivered).toBe(false);
    expect(ctx.showAssign).toBe(false);
  });

  it("Delivered and Returned do not offer lifecycle mutations", () => {
    for (const status of ["Delivered", "Returned"] as const) {
      const ctx = contextualActionsForStatus(status, false);
      expect(ctx.readonly).toBe(true);
      expect(ctx.showAssign).toBe(false);
      expect(ctx.showMarkDelivered).toBe(false);
      expect(ctx.showMarkFailed).toBe(false);
      expect(ctx.showBeginDelivery).toBe(false);
      expect(ctx.showRetryAssign).toBe(false);
    }
  });

  it("Scheduled can return to New", () => {
    expect(contextualActionsForStatus("Scheduled", false).showReturnToNew).toBe(true);
  });

  it("null status (needs review) is readonly", () => {
    const ctx = contextualActionsForStatus(null, false);
    expect(ctx.readonly).toBe(true);
    expect(ctx.showAssign).toBe(false);
    expect(ctx.showMarkDelivered).toBe(false);
    expect(ctx.showMarkFailed).toBe(false);
  });
});
