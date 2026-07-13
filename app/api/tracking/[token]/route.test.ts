import { afterEach, describe, expect, it, vi } from "vitest";

const { getConsumerTrackingByToken, ensureFirebaseConfigured } = vi.hoisted(() => ({
  getConsumerTrackingByToken: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/services/consumer-tracking", () => ({
  getConsumerTrackingByToken,
}));

vi.mock("@/lib/server/route-utils", () => ({
  ensureFirebaseConfigured,
}));

import { GET } from "@/app/api/tracking/[token]/route";

describe("GET /api/tracking/[token]", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns consumer tracking payload", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    getConsumerTrackingByToken.mockResolvedValue({
      publicReference: "QRX-1001",
      status: "Assigned",
      statusHeading: "Driver assigned",
      lastUpdatedAt: "2026-07-13T10:00:00.000Z",
      deliveryDestination: "Edmonton",
      steps: [],
      consumerNotes: [],
      notesEnabled: true,
      supportPhone: "(000) 000-0000",
      supportEmail: "hello@quickrunexpress.ca",
      supportHours: "Mon–Fri",
    });

    const response = await GET(new Request("http://localhost/api/tracking/abc"), {
      params: Promise.resolve({ token: "abc" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tracking: { publicReference: "QRX-1001" },
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
