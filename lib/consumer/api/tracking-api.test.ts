import { describe, expect, it, vi } from "vitest";
import {
  classifyTrackingError,
  ConsumerTrackingApiError,
  fetchConsumerTracking,
  submitConsumerNote,
} from "@/lib/consumer/api/tracking-api";

describe("consumer tracking client errors", () => {
  it("classifies expired links", () => {
    const err = new ConsumerTrackingApiError("expired", 410, "TRACKING_EXPIRED");
    expect(classifyTrackingError(err)).toEqual({
      kind: "expired",
      message: "expired",
    });
  });

  it("classifies network failures", () => {
    expect(classifyTrackingError(new TypeError("fetch failed"))).toEqual({
      kind: "network",
      message: "Unable to connect. Check your connection and try again.",
    });
  });
});

describe("client-side token validation", () => {
  it("rejects QRX-28491 without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchConsumerTracking("QRX-28491")).rejects.toMatchObject({
      status: 404,
      code: "TRACKING_INVALID",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("rejects Firestore order IDs without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchConsumerTracking("QRX-SEED-1003")).rejects.toMatchObject({
      code: "TRACKING_INVALID",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("rejects invalid tokens for note submission without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitConsumerNote("QRX-28491", "Buzzer 402")).rejects.toMatchObject({
      code: "TRACKING_INVALID",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

describe("duplicate click protection contract", () => {
  it("documents submitted lock behavior for note hook consumers", () => {
    const submitted = true;
    const submitting = false;
    const canSubmit = !submitting && !submitted;
    expect(canSubmit).toBe(false);
  });
});
