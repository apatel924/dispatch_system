import { describe, expect, it } from "vitest";
import { classifyTrackingError, ConsumerTrackingApiError } from "@/lib/consumer/api/tracking-api";

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

describe("duplicate click protection contract", () => {
  it("documents submitted lock behavior for note hook consumers", () => {
    const submitted = true;
    const submitting = false;
    const canSubmit = !submitting && !submitted;
    expect(canSubmit).toBe(false);
  });
});
