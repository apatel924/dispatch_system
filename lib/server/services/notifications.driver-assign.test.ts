import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTestSmsMessages,
  resetTestSmsProvider,
  setTestSmsProviderFailure,
} from "@/lib/server/notifications/providers/test";
import { setSmsProviderForTests } from "@/lib/server/notifications/sms-provider";
import { testSmsProvider } from "@/lib/server/notifications/providers/test";

const firestoreState = vi.hoisted(() => ({
  notificationLogs: new Map<string, Record<string, unknown>>(),
}));

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn((name: string) => {
      if (name !== "notificationLogs") {
        return { doc: vi.fn() };
      }
      return {
        doc: vi.fn((id: string) => ({
          id,
          get: vi.fn(async () => {
            const data = firestoreState.notificationLogs.get(id);
            return {
              exists: data !== undefined,
              data: () => data,
            };
          }),
          set: vi.fn(async (data: Record<string, unknown>) => {
            const existing = firestoreState.notificationLogs.get(id) ?? {};
            firestoreState.notificationLogs.set(id, { ...existing, ...data });
          }),
        })),
      };
    }),
  })),
}));

vi.mock("@/lib/server/notifications/audit", () => ({
  writeNotificationAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/server/notifications/config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/notifications/config")>();
  return {
    ...actual,
    getAppBaseUrl: () => "https://www.quickrunexpress.ca",
  };
});

import { notifyDriverOrderAssigned } from "@/lib/server/services/notifications";

describe("notifyDriverOrderAssigned", () => {
  beforeEach(() => {
    firestoreState.notificationLogs.clear();
    resetTestSmsProvider();
    setSmsProviderForTests(testSmsProvider);
  });

  afterEach(() => {
    setSmsProviderForTests(null);
    resetTestSmsProvider();
  });

  it("sends a privacy-conscious driver SMS after assignment", async () => {
    const result = await notifyDriverOrderAssigned({
      orderId: "QRX-10007",
      driverId: "drv-2",
      driverPhone: "8254013481",
      idempotencyKey: "op-1-unique",
    });

    expect(result.requested).toBe(true);
    expect(result.sent).toBe(true);
    const messages = getTestSmsMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]?.kind).toBe("sms");
    const body = (messages[0]?.input as { body: string }).body;
    expect(body).toContain("QRX-10007");
    expect(body).toContain("driver portal");
    expect(body).not.toContain("track/");
    expect(body).not.toContain("Abigail");
  });

  it("does not send when phone is invalid", async () => {
    const result = await notifyDriverOrderAssigned({
      orderId: "QRX-10007",
      driverId: "drv-2",
      driverPhone: "unknown",
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("INVALID_PHONE");
    expect(getTestSmsMessages()).toHaveLength(0);
  });

  it("dedupes successful SMS by idempotency key", async () => {
    const first = await notifyDriverOrderAssigned({
      orderId: "QRX-10007",
      driverId: "drv-2",
      driverPhone: "8254013481",
      idempotencyKey: "same-op-key",
    });
    expect(first.sent).toBe(true);

    const second = await notifyDriverOrderAssigned({
      orderId: "QRX-10007",
      driverId: "drv-2",
      driverPhone: "8254013481",
      idempotencyKey: "same-op-key",
    });
    expect(second.sent).toBe(true);
    expect(second.reason).toBe("already_sent");
    expect(getTestSmsMessages()).toHaveLength(1);
  });

  it("returns failure without throwing when provider errors", async () => {
    setTestSmsProviderFailure("PROVIDER_ERROR");
    const result = await notifyDriverOrderAssigned({
      orderId: "QRX-10007",
      driverId: "drv-2",
      driverPhone: "8254013481",
      idempotencyKey: "fail-op",
    });
    expect(result.requested).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("PROVIDER_ERROR");
  });
});
