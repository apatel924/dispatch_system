import { afterEach, describe, expect, it, vi } from "vitest";

const { executeBarnetCronSync, validateCronSecret, ensureFirebaseConfigured } = vi.hoisted(
  () => ({
    executeBarnetCronSync: vi.fn(),
    validateCronSecret: vi.fn(),
    ensureFirebaseConfigured: vi.fn(),
  }),
);

vi.mock("@/lib/integrations/order-provider/barnet-cron-sync.server", () => ({
  executeBarnetCronSync,
}));

vi.mock("@/lib/server/cron-auth.server", () => ({
  validateCronSecret,
  CRON_NO_STORE_HEADERS: {
    "Cache-Control": "no-store",
  },
}));

vi.mock("@/lib/server/route-utils", () => ({
  ensureFirebaseConfigured,
}));

import { GET, maxDuration } from "@/app/api/cron/barnet-sync/route";

describe("GET /api/cron/barnet-sync", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("configures a 300s function duration for multi-page Barnet scans", () => {
    expect(maxDuration).toBe(300);
  });

  it("returns auth response when cron secret validation fails", async () => {
    const unauthorized = new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
    });
    validateCronSecret.mockReturnValue(unauthorized);
    ensureFirebaseConfigured.mockReturnValue(null);

    const response = await GET(
      new Request("http://localhost/api/cron/barnet-sync"),
    );

    expect(response.status).toBe(401);
    expect(executeBarnetCronSync).not.toHaveBeenCalled();
  });

  it("returns cron aggregate payload with no-store cache headers", async () => {
    validateCronSecret.mockReturnValue(null);
    ensureFirebaseConfigured.mockReturnValue(null);
    executeBarnetCronSync.mockResolvedValue({
      ok: true,
      trigger: "cron",
      pagesScanned: 1,
      ordersSeen: 20,
      totalSeen: 20,
      deliveryCandidates: 0,
      deliveryFound: 0,
      newDeliveries: 0,
      imported: 0,
      updatedDeliveries: 0,
      unchangedOrders: 20,
      alreadyImported: 20,
      needsReview: 0,
      readyToDispatch: 0,
      pickupOrdersIgnored: 20,
      pickupIgnored: 20,
      unknownOrdersIgnored: 0,
      invalid: 0,
      enrichmentErrors: 0,
      syncErrors: 0,
      failed: 0,
      dispatchOrdersCreated: 0,
      adminNotificationsCreated: 0,
      durationMs: 2500,
      status: "success",
    });

    const response = await GET(
      new Request("http://localhost/api/cron/barnet-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      trigger: "cron",
      pagesScanned: 1,
      totalSeen: 20,
      deliveryFound: 0,
      imported: 0,
      alreadyImported: 20,
      failed: 0,
    });
  });

  it("returns 503 for transient provider failures", async () => {
    validateCronSecret.mockReturnValue(null);
    ensureFirebaseConfigured.mockReturnValue(null);
    executeBarnetCronSync.mockResolvedValue({
      ok: false,
      error: "provider_timeout",
      status: "failed",
      durationMs: 1000,
      safeErrorMessage: "Barnet request timed out.",
      transientProviderFailure: true,
    });

    const response = await GET(
      new Request("http://localhost/api/cron/barnet-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(503);
  });

  it("returns 500 for internal unexpected failures", async () => {
    validateCronSecret.mockReturnValue(null);
    ensureFirebaseConfigured.mockReturnValue(null);
    executeBarnetCronSync.mockResolvedValue({
      ok: false,
      error: "unknown_sync_error",
      status: "failed",
      durationMs: 1000,
      safeErrorMessage: "Synchronization failed.",
      transientProviderFailure: false,
    });

    const response = await GET(
      new Request("http://localhost/api/cron/barnet-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(500);
  });
});
