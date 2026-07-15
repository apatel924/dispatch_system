import { describe, expect, it } from "vitest";
import {
  BARNET_FETCH_MAX_ATTEMPTS,
  isRetryableBarnetFetchError,
  BarnetUpstreamHttpError,
  BarnetUpstreamTimeoutError,
} from "@/lib/integrations/order-provider/barnet-client.server";

describe("Barnet fetch retry policy", () => {
  it("allows at most two total attempts per page fetch", () => {
    expect(BARNET_FETCH_MAX_ATTEMPTS).toBe(2);
  });

  it("retries timeout, 429, 502, 503, and 504", () => {
    expect(isRetryableBarnetFetchError(new BarnetUpstreamTimeoutError("/orders", 1))).toBe(
      true,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 429))).toBe(
      true,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 502))).toBe(
      true,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 503))).toBe(
      true,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 504))).toBe(
      true,
    );
  });

  it("does not retry ordinary 4xx, 500, or configuration errors", () => {
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 401))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 403))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 400))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 404))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new BarnetUpstreamHttpError("/orders", 500))).toBe(
      false,
    );
    expect(isRetryableBarnetFetchError(new Error("Barnet provider credentials are not configured"))).toBe(
      false,
    );
  });
});
