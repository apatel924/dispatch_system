import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isTrackingDemoEnabled } from "@/lib/tracking-token";

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

    expect(isTrackingDemoEnabled()).toBe(false);
    expect(existsSync(resolve(root, "lib/tracking-demo.ts"))).toBe(false);
    expect(existsSync(resolve(root, "data/trackingDemo.ts"))).toBe(false);
    expect(existsSync(resolve(root, "components/site/tracking-demo.tsx"))).toBe(false);
  });
});

describe("public tracking route imports", () => {
  const legacyPatterns = [
    /getOrderByTrackingId/,
    /getTrackingByTrackingId/,
    /buildTrackingViewFromOrder/,
    /getDemoConsumerTrackingView/,
    /isDemoTrackingToken/,
    /trackingDemo/,
    /tracking-demo/,
  ];

  const publicTrackingSources = [
    "app/api/tracking/[token]/route.ts",
    "app/api/tracking/[token]/notes/route.ts",
    "app/track/[token]/page.tsx",
    "components/consumer/consumer-tracking-page.tsx",
    "lib/consumer/hooks/use-consumer-tracking.ts",
    "lib/consumer/api/tracking-api.ts",
  ];

  it.each(publicTrackingSources)("does not import legacy lookup services in %s", (relativePath) => {
    const source = readFileSync(resolve(root, relativePath), "utf8");
    for (const pattern of legacyPatterns) {
      expect(source).not.toMatch(pattern);
    }
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
