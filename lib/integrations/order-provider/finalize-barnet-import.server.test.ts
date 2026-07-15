import { beforeEach, describe, expect, it, vi } from "vitest";

const { promoteExternalOrderToDispatch, createBarnetNewOrderNotification } = vi.hoisted(() => ({
  promoteExternalOrderToDispatch: vi.fn(),
  createBarnetNewOrderNotification: vi.fn(),
}));

vi.mock("@/lib/integrations/order-provider/promote-external-order.server", () => ({
  promoteExternalOrderToDispatch,
}));

vi.mock("@/lib/server/services/admin-notifications", () => ({
  createBarnetNewOrderNotification,
}));

import { finalizeBarnetDeliveryImport } from "@/lib/integrations/order-provider/finalize-barnet-import.server";

describe("finalizeBarnetDeliveryImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promoteExternalOrderToDispatch.mockResolvedValue({
      order: {
        id: "ORD-100",
        assignedDriverId: null,
        assignedDriverName: null,
        status: "New",
      },
      alreadyPromoted: false,
      externalOrder: {},
    });
    createBarnetNewOrderNotification.mockResolvedValue({
      created: true,
      notificationId: "barnet_new_order_826",
    });
  });

  it("promotes without assigning a driver and creates a notification for new imports", async () => {
    const result = await finalizeBarnetDeliveryImport({
      docId: "barnet_826",
      externalOrderId: "826",
      externalOrderNumber: "826071452700",
      isNew: true,
      trigger: "cron",
    });

    expect(promoteExternalOrderToDispatch).toHaveBeenCalledWith(
      "barnet_826",
      expect.objectContaining({ role: "system" }),
      { overrideMissingFields: true },
    );
    expect(createBarnetNewOrderNotification).toHaveBeenCalledWith({
      externalOrderId: "826",
      externalOrderNumber: "826071452700",
      dispatchOrderId: "ORD-100",
      source: "barnet_cron",
    });
    expect(result).toMatchObject({
      dispatchOrderId: "ORD-100",
      alreadyPromoted: false,
      notificationCreated: true,
      failed: false,
    });
  });

  it("does not duplicate notifications for already-promoted orders", async () => {
    promoteExternalOrderToDispatch.mockResolvedValue({
      order: {
        id: "ORD-100",
        assignedDriverId: null,
        assignedDriverName: null,
        status: "New",
      },
      alreadyPromoted: true,
      externalOrder: {},
    });

    const result = await finalizeBarnetDeliveryImport({
      docId: "barnet_826",
      externalOrderId: "826",
      isNew: true,
      trigger: "cron",
    });

    expect(createBarnetNewOrderNotification).not.toHaveBeenCalled();
    expect(result.notificationCreated).toBe(false);
    expect(result.alreadyPromoted).toBe(true);
  });

  it("does not call assignDriver or set a driver on the promote path", async () => {
    await finalizeBarnetDeliveryImport({
      docId: "barnet_1",
      externalOrderId: "1",
      isNew: true,
      trigger: "manual",
    });

    const promoteArgs = promoteExternalOrderToDispatch.mock.calls[0];
    expect(promoteArgs[2]).toEqual({ overrideMissingFields: true });
    expect(promoteExternalOrderToDispatch).toHaveBeenCalledTimes(1);
  });
});
