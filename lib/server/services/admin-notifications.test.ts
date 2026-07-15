import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, Record<string, unknown>>();

function createDocRef(id: string) {
  return {
    id,
    get: vi.fn(async () => {
      const data = store.get(id);
      return { exists: data !== undefined, data: () => data, id };
    }),
    create: vi.fn(async (data: Record<string, unknown>) => {
      if (store.has(id)) throw new Error("already-exists");
      store.set(id, data);
    }),
    set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      const prev = store.get(id) ?? {};
      store.set(id, opts?.merge ? { ...prev, ...data } : data);
    }),
  };
}

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: (id: string) => createDocRef(id),
      orderBy: () => ({
        limit: () => ({
          get: async () => ({
            docs: [...store.entries()].map(([id, data]) => ({
              id,
              data: () => data,
            })),
          }),
        }),
      }),
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({ docs: [] }),
          }),
        }),
        select: () => ({
          get: async () => ({
            size: [...store.values()].filter((d) => d.read !== true).length,
          }),
        }),
        limit: () => ({
          get: async () => ({
            empty: true,
            docs: [],
          }),
        }),
      }),
    }),
  }),
}));

import {
  createBarnetNewOrderNotification,
  dispatchOrderDetailLink,
  barnetNewOrderNotificationId,
} from "@/lib/server/services/admin-notifications";

describe("admin notifications", () => {
  beforeEach(() => {
    store.clear();
  });

  it("creates an unread new_order notification linking to the order detail page", async () => {
    const result = await createBarnetNewOrderNotification({
      externalOrderId: "826071452700",
      externalOrderNumber: "826071452700",
      dispatchOrderId: "ORD-55",
      source: "barnet_cron",
    });

    expect(result.created).toBe(true);
    const id = barnetNewOrderNotificationId("826071452700");
    const doc = store.get(id);
    expect(doc).toMatchObject({
      type: "new_order",
      title: "New delivery order received",
      message: "Barnet order #826071452700 was imported and is awaiting dispatch.",
      read: false,
      source: "barnet_cron",
      externalOrderId: "826071452700",
      dispatchOrderId: "ORD-55",
      link: "/orders/ORD-55",
    });
    expect(dispatchOrderDetailLink("ORD-55")).toBe("/orders/ORD-55");
  });

  it("does not duplicate the notification on re-run", async () => {
    await createBarnetNewOrderNotification({
      externalOrderId: "826",
      dispatchOrderId: "ORD-1",
    });
    const second = await createBarnetNewOrderNotification({
      externalOrderId: "826",
      dispatchOrderId: "ORD-1",
    });
    expect(second.created).toBe(false);
    expect(store.size).toBe(1);
  });
});
