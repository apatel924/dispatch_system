import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  issueAndSendTrackingLink,
  notifyCustomerOrderAssigned,
  notifyCustomerStatusUpdate,
} from "@/lib/server/services/notifications";
import {
  getTestSmsMessages,
  resetTestSmsProvider,
  setTestSmsProviderFailure,
} from "@/lib/server/notifications/providers/test";
import { setSmsProviderForTests } from "@/lib/server/notifications/sms-provider";
import { testSmsProvider } from "@/lib/server/notifications/providers/test";
import { disabledSmsProvider } from "@/lib/server/notifications/providers/disabled";

const rotateTrackingLinkForOrder = vi.fn();
const writeNotificationAudit = vi.fn();

vi.mock("@/lib/server/services/tracking-links", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/services/tracking-links")>();
  return {
    ...actual,
    rotateTrackingLinkForOrder: (...args: unknown[]) => rotateTrackingLinkForOrder(...args),
  };
});

vi.mock("@/lib/server/notifications/audit", () => ({
  writeNotificationAudit: (...args: unknown[]) => writeNotificationAudit(...args),
}));

const SAMPLE_TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR";
const SAMPLE_URL = `https://app.example/track/${SAMPLE_TOKEN}`;

const order = {
  id: "QRX-1001",
  trackingId: "QRX-1001",
  customerName: "Test Customer",
  customerPhone: "4035551234",
  customerEmail: "customer@example.com",
  pickupName: "Pharmacy",
  pickupAddress: "1 Main St",
  deliveryAddress: "2 Oak Ave",
  assignedDriverId: "drv-1",
  assignedDriverName: "Alex",
  status: "Assigned" as const,
  paymentStatus: "Paid" as const,
  totalCents: 1000,
  totalDisplay: "$10.00",
  completedSteps: [],
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
  source: "manual" as const,
};

function mockRotation(version = 2) {
  rotateTrackingLinkForOrder.mockResolvedValue({
    link: {
      id: "abc123hash",
      token: SAMPLE_TOKEN,
      orderId: "QRX-1001",
      publicReference: "QRX-1001",
      version,
      createdAt: "2026-07-13T00:00:00.000Z",
      expiresAt: "2026-08-13T00:00:00.000Z",
    },
    trackingUrl: SAMPLE_URL,
  });
}

describe("tracking link notifications", () => {
  beforeEach(() => {
    resetTestSmsProvider();
    setSmsProviderForTests(testSmsProvider);
    vi.stubEnv("SMS_PROVIDER", "test");
    writeNotificationAudit.mockResolvedValue(undefined);
    mockRotation();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    setSmsProviderForTests(null);
    resetTestSmsProvider();
  });

  it("rotates link and sends SMS on assignment notification", async () => {
    const result = await notifyCustomerOrderAssigned(order);

    expect(rotateTrackingLinkForOrder).toHaveBeenCalledWith("QRX-1001");
    expect(result.linkCreated).toBe(true);
    expect(result.smsAttempted).toBe(true);
    expect(result.smsSent).toBe(true);
    expect(result.copyUrl).toBeUndefined();
    expect(getTestSmsMessages()).toHaveLength(1);
    expect(getTestSmsMessages()[0]?.input.trackingUrl).toBe(SAMPLE_URL);
  });

  it("manual resend rotates prior token via shared issuance flow", async () => {
    const first = await issueAndSendTrackingLink(order, "tracking_link_resend");
    mockRotation(3);
    const second = await issueAndSendTrackingLink(order, "tracking_link_resend");

    expect(rotateTrackingLinkForOrder).toHaveBeenCalledTimes(2);
    expect(first.version).toBe(2);
    expect(second.version).toBe(3);
  });

  it("returns SMS_NOT_CONFIGURED when Twilio is not configured", async () => {
    setSmsProviderForTests(disabledSmsProvider);

    const result = await notifyCustomerOrderAssigned(order);

    expect(result.linkCreated).toBe(true);
    expect(result.smsAttempted).toBe(true);
    expect(result.smsSent).toBe(false);
    expect(result.failureCategory).toBe("SMS_NOT_CONFIGURED");
    expect(result.copyUrl).toBe(SAMPLE_URL);
  });

  it("rejects invalid customer phone before provider call", async () => {
    const result = await notifyCustomerOrderAssigned({
      ...order,
      customerPhone: "invalid",
    });

    expect(result.smsAttempted).toBe(false);
    expect(result.smsSent).toBe(false);
    expect(result.failureCategory).toBe("INVALID_PHONE");
    expect(result.copyUrl).toBe(SAMPLE_URL);
    expect(getTestSmsMessages()).toHaveLength(0);
  });

  it("returns copyUrl when provider fails but link was created", async () => {
    setTestSmsProviderFailure("PROVIDER_ERROR");

    const result = await notifyCustomerOrderAssigned(order);

    expect(result.linkCreated).toBe(true);
    expect(result.smsAttempted).toBe(true);
    expect(result.smsSent).toBe(false);
    expect(result.copyUrl).toBe(SAMPLE_URL);
  });

  it("logs only safe metadata without phone, url, or token", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await notifyCustomerOrderAssigned(order);

    const logged = logSpy.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).toContain("order_assigned");
    expect(logged).toContain("smsSucceeded");
    expect(logged).not.toContain("+14035551234");
    expect(logged).not.toContain("4035551234");
    expect(logged).not.toContain("customer@example.com");
    expect(logged).not.toContain(SAMPLE_TOKEN);
    expect(logged).not.toContain("/track/");
    expect(logged).not.toContain("abc123hash");
  });

  it("writes sanitized audit metadata", async () => {
    await notifyCustomerOrderAssigned(order);

    expect(writeNotificationAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "QRX-1001",
        notificationType: "order_assigned",
        provider: "test",
        success: true,
        messageSid: expect.stringMatching(/^SM_test_/),
        linkCreated: true,
        smsAttempted: true,
      }),
    );

    const auditPayload = JSON.stringify(writeNotificationAudit.mock.calls[0]?.[0]);
    expect(auditPayload).not.toContain(SAMPLE_TOKEN);
    expect(auditPayload).not.toContain("+14035551234");
    expect(auditPayload).not.toContain("/track/");
  });

  it("does not include tracking URL in status update notifications", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await notifyCustomerStatusUpdate(order, "Out for Delivery");

    expect(result.trackingLinkIncluded).toBe(false);
    expect(rotateTrackingLinkForOrder).not.toHaveBeenCalled();
    const logged = logSpy.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).toContain("status_update");
    expect(logged).not.toContain("/track/");
  });
});
