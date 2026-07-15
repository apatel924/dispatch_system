import { describe, expect, it } from "vitest";
import {
  isRetryableBarnetFetchError,
  BarnetUpstreamHttpError,
  BarnetUpstreamTimeoutError,
} from "@/lib/integrations/order-provider/barnet-client.server";

describe("Barnet fetch retry policy", () => {
  it("retries timeout, 429, and 5xx", () => {
    expect(isRetryableBarnetFetchError(new BarnetUpstreamTimeoutError("/orders", 1))).toBe(
      true,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 429))).toBe(
      true,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 503))).toBe(
      true,
    );
  });

  it("does not retry auth or client errors", () => {
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 401))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 403))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 400))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new Error("Barnet provider credentials are not configured"))).toBe(
      false,
    );
  });
});
