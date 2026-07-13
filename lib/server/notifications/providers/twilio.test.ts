import { afterEach, describe, expect, it, vi } from "vitest";
import { createTwilioSmsProvider } from "@/lib/server/notifications/providers/twilio";

describe("Twilio SMS provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends tracking link SMS via Twilio REST API", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ sid: "SM_real_sid_123" }),
    })) as ReturnType<typeof vi.fn>;
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTwilioSmsProvider({
      accountSid: "AC_test_sid",
      authToken: "test_auth_token",
      fromNumber: "+15559876543",
    });

    const result = await provider.sendTrackingLink({
      orderId: "QRX-1001",
      trackingId: "QRX-1001",
      customerName: "Alex",
      phoneE164: "+14035551234",
      trackingUrl: "https://app.example/track/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR",
    });

    expect(result.ok).toBe(true);
    expect(result.messageSid).toBe("SM_real_sid_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const [requestUrl, requestInit] = calls[0]!;
    expect(requestUrl).toContain("/Accounts/AC_test_sid/Messages.json");
    expect(requestInit.method).toBe("POST");
    const body = String(requestInit.body ?? "");
    expect(body).toContain("To=%2B14035551234");
    expect(body).not.toContain("test_auth_token");
    expect(body).toContain(encodeURIComponent("https://app.example/track/"));
  });

  it("returns sanitized failure on Twilio rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ code: 21211, message: "Invalid 'To' Phone Number: +1555XXXX" }),
      })),
    );

    const provider = createTwilioSmsProvider({
      accountSid: "AC_test_sid",
      authToken: "test_auth_token",
      fromNumber: "+15559876543",
    });

    const result = await provider.sendTrackingLink({
      orderId: "QRX-1001",
      trackingId: "QRX-1001",
      customerName: "Alex",
      phoneE164: "+14035551234",
      trackingUrl: "https://app.example/track/token",
    });

    expect(result.ok).toBe(false);
    expect(result.failureCategory).toBe("PROVIDER_REJECTED");
    expect(result.providerErrorCode).toBe("TWILIO_21211");
  });

  it("returns network failure without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    const provider = createTwilioSmsProvider({
      accountSid: "AC_test_sid",
      authToken: "test_auth_token",
      fromNumber: "+15559876543",
    });

    const result = await provider.sendTrackingLink({
      orderId: "QRX-1001",
      trackingId: "QRX-1001",
      customerName: "Alex",
      phoneE164: "+14035551234",
      trackingUrl: "https://app.example/track/token",
    });

    expect(result.ok).toBe(false);
    expect(result.failureCategory).toBe("NETWORK_ERROR");
  });
});
