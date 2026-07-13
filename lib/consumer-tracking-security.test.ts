import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = resolve(__dirname, "..");

describe("tracking demo removal", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not export client demo bypass helpers from tracking-api", async () => {
    const api = await import("@/lib/consumer/api/tracking-api");
    expect(api).not.toHaveProperty("isDemoTrackingToken");
    expect(api).not.toHaveProperty("getDemoConsumerTrackingView");
  });

  it("removes demo modules so production cannot enable synthetic tracking", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_TRACKING_DEMO", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TRACKING_DEMO", "true");

    expect(existsSync(resolve(root, "lib/tracking-demo.ts"))).toBe(false);
    expect(existsSync(resolve(root, "data/trackingDemo.ts"))).toBe(false);
    expect(existsSync(resolve(root, "components/site/tracking-demo.tsx"))).toBe(false);
  });
});

describe("legacy public tracking lookups removed", () => {
  it("does not export trackingId-based public service functions", async () => {
    const services = await import("@/lib/server/services");
    expect(services).not.toHaveProperty("getOrderByTrackingId");
    expect(services).not.toHaveProperty("getTrackingByTrackingId");
    expect(services).not.toHaveProperty("buildTrackingViewFromOrder");
  });

  it("public consumer routes use hashed opaque-token resolution only", async () => {
    const consumerTracking = await import("@/lib/server/services/consumer-tracking");
    const trackingLinks = await import("@/lib/server/services/tracking-links");
    const token = trackingLinks.generateTrackingToken();

    expect(consumerTracking.getConsumerTrackingByToken).toBeDefined();
    expect(trackingLinks.resolveTrackingLink).toBeDefined();
    expect(trackingLinks.isValidOpaqueTrackingToken(token)).toBe(true);
    expect(trackingLinks.isValidOpaqueTrackingToken("QRX-28491")).toBe(false);
  });
});
