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

import { GET } from "@/app/api/cron/barnet-sync/route";

describe("GET /api/cron/barnet-sync", () => {
  afterEach(() => {
    vi.clearAllMocks();
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
      pagesScanned: 1,
      ordersSeen: 20,
      deliveryCandidates: 0,
      newDeliveries: 0,
      updatedDeliveries: 0,
      unchangedOrders: 20,
      durationMs: 2500,
    });

    const response = await GET(
      new Request("http://localhost/api/cron/barnet-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      pagesScanned: 1,
      ordersSeen: 20,
      deliveryCandidates: 0,
      newDeliveries: 0,
      updatedDeliveries: 0,
      unchangedOrders: 20,
      durationMs: 2500,
    });
  });

  it("returns 504 for upstream timeout", async () => {
    validateCronSecret.mockReturnValue(null);
    ensureFirebaseConfigured.mockReturnValue(null);
    executeBarnetCronSync.mockResolvedValue({
      ok: false,
      error: "upstream_timeout",
      durationMs: 1000,
    });

    const response = await GET(
      new Request("http://localhost/api/cron/barnet-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(504);
  });
});
