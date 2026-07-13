import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/server/rate-limit";

describe("rate limiter", () => {
  afterEach(() => {
    resetRateLimitsForTests();
  });

  it("allows requests under the limit", () => {
    const config = { key: "test", limit: 2, windowMs: 60_000 };
    expect(checkRateLimit(config).allowed).toBe(true);
    expect(checkRateLimit(config).allowed).toBe(true);
    expect(checkRateLimit(config).allowed).toBe(false);
  });
});
