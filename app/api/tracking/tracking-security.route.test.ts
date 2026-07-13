import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";

const {
  getConsumerTrackingByToken,
  addConsumerNoteByToken,
  ensureFirebaseConfigured,
  enforceTrackingReadRateLimit,
  enforceTrackingInvalidRateLimit,
} = vi.hoisted(() => ({
  getConsumerTrackingByToken: vi.fn(),
  addConsumerNoteByToken: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
  enforceTrackingReadRateLimit: vi.fn(),
  enforceTrackingInvalidRateLimit: vi.fn(),
}));

vi.mock("@/lib/server/services/consumer-tracking", () => ({
  getConsumerTrackingByToken,
  addConsumerNoteByToken,
}));

vi.mock("@/lib/server/services/tracking-links", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/services/tracking-links")>();
  return {
    ...actual,
    enforceTrackingReadRateLimit,
    enforceTrackingInvalidRateLimit,
  };
});

vi.mock("@/lib/server/route-utils", () => ({
  ensureFirebaseConfigured,
  parseJsonBody: async (request: Request, schema: { parse: (v: unknown) => unknown }) => {
    const body = await request.json();
    return schema.parse(body);
  },
}));

import { GET } from "@/app/api/tracking/[token]/route";
import { POST } from "@/app/api/tracking/[token]/notes/route";

describe("GET /api/tracking/[token]", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns consumer tracking payload", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    enforceTrackingReadRateLimit.mockResolvedValue(undefined);
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

    const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR";
    const response = await GET(new Request("http://localhost/api/tracking/" + token), {
      params: Promise.resolve({ token }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tracking: { publicReference: "QRX-1001" },
    });
    expect(enforceTrackingReadRateLimit).toHaveBeenCalled();
  });

  it("rejects QRX-number URLs in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    ensureFirebaseConfigured.mockReturnValue(null);
    enforceTrackingReadRateLimit.mockResolvedValue(undefined);
    getConsumerTrackingByToken.mockRejectedValue(
      new ServiceError("This tracking link is not valid.", "TRACKING_INVALID", 404),
    );
    enforceTrackingInvalidRateLimit.mockResolvedValue(undefined);

    const response = await GET(new Request("http://localhost/api/tracking/QRX-10004"), {
      params: Promise.resolve({ token: "QRX-10004" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("TRACKING_INVALID");
    expect(enforceTrackingInvalidRateLimit).toHaveBeenCalled();
  });
});

describe("POST /api/tracking/[token]/notes", () => {
  afterEach(() => vi.clearAllMocks());

  it("derives order context only from hashed-token resolution", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    addConsumerNoteByToken.mockResolvedValue({
      id: "note-1",
      source: "consumer",
      text: "Buzzer 402",
      createdAt: "2026-07-13T10:00:00.000Z",
    });

    const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR";
    const response = await POST(
      new Request("http://localhost/api/tracking/" + token + "/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Buzzer 402" }),
      }),
      { params: Promise.resolve({ token }) },
    );

    expect(response.status).toBe(201);
    expect(addConsumerNoteByToken).toHaveBeenCalledWith(
      token,
      "Buzzer 402",
      expect.any(String),
    );
    const body = await response.json();
    expect(body.note.orderId).toBeUndefined();
  });
});
