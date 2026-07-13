import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLegacyPublicReference,
  isTrackingDemoEnabled,
  isValidOpaqueTrackingToken,
  isValidPublicTrackingToken,
  OPAQUE_TRACKING_TOKEN_LENGTH,
} from "@/lib/tracking-token";

const VALID_TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

describe("isValidPublicTrackingToken", () => {
  it("accepts 43-character base64url opaque tokens", () => {
    expect(VALID_TOKEN).toHaveLength(OPAQUE_TRACKING_TOKEN_LENGTH);
    expect(isValidPublicTrackingToken(VALID_TOKEN)).toBe(true);
    expect(isValidOpaqueTrackingToken(VALID_TOKEN)).toBe(true);
  });

  it("rejects QRX-28491 and all QRX-* order references", () => {
    expect(isValidPublicTrackingToken("QRX-28491")).toBe(false);
    expect(isValidPublicTrackingToken("QRX-10004")).toBe(false);
    expect(isValidPublicTrackingToken("qrx-seed-1001")).toBe(false);
    expect(isLegacyPublicReference("QRX-28491")).toBe(true);
  });

  it("rejects Firestore order IDs used as tracking credentials", () => {
    expect(isValidPublicTrackingToken("QRX-SEED-1001")).toBe(false);
    expect(isValidPublicTrackingToken("QRX-SEED-1003")).toBe(false);
    expect(isValidPublicTrackingToken("internal-order-123")).toBe(false);
  });

  it("rejects malformed and oversized tokens", () => {
    expect(isValidPublicTrackingToken("short")).toBe(false);
    expect(isValidPublicTrackingToken("")).toBe(false);
    expect(isValidPublicTrackingToken("a".repeat(129))).toBe(false);
    expect(isValidPublicTrackingToken("a".repeat(43) + "!")).toBe(false);
  });
});

describe("isTrackingDemoEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false in production even when demo env vars are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_TRACKING_DEMO", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TRACKING_DEMO", "true");

    expect(isTrackingDemoEnabled()).toBe(false);
  });

  it("returns false in development without both demo flags", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_TRACKING_DEMO", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TRACKING_DEMO", "false");

    expect(isTrackingDemoEnabled()).toBe(false);
  });

  it("returns true in development only when both demo flags are set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_TRACKING_DEMO", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TRACKING_DEMO", "true");

    expect(isTrackingDemoEnabled()).toBe(true);
  });
});
