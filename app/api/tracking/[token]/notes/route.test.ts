import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";

const { addConsumerNoteByToken, ensureFirebaseConfigured } = vi.hoisted(() => ({
  addConsumerNoteByToken: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/services/consumer-tracking", () => ({
  addConsumerNoteByToken,
}));

vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return {
    ...actual,
    ensureFirebaseConfigured,
  };
});

import { POST } from "@/app/api/tracking/[token]/notes/route";

describe("POST /api/tracking/[token]/notes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a consumer note", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    addConsumerNoteByToken.mockResolvedValue({
      id: "note-1",
      orderId: "QRX-1",
      source: "consumer",
      text: "Buzzer 402",
      createdAt: "2026-07-13T10:00:00.000Z",
      trackingLinkVersion: 1,
    });

    const response = await POST(
      new Request("http://localhost/api/tracking/abc/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Buzzer 402" }),
      }),
      { params: Promise.resolve({ token: "abc" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      note: { text: "Buzzer 402", source: "consumer" },
    });
  });

  it("rejects empty notes", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/tracking/abc/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   " }),
      }),
      { params: Promise.resolve({ token: "abc" }) },
    );

    expect(response.status).toBe(400);
    expect(addConsumerNoteByToken).not.toHaveBeenCalled();
  });

  it("rejects oversized notes", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/tracking/abc/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "a".repeat(751) }),
      }),
      { params: Promise.resolve({ token: "abc" }) },
    );

    expect(response.status).toBe(400);
    expect(addConsumerNoteByToken).not.toHaveBeenCalled();
  });

  it("returns expired token response", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    addConsumerNoteByToken.mockRejectedValue(
      new ServiceError("This tracking link has expired.", "TRACKING_EXPIRED", 410),
    );

    const response = await POST(
      new Request("http://localhost/api/tracking/expired/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Side door" }),
      }),
      { params: Promise.resolve({ token: "expired" }) },
    );

    expect(response.status).toBe(410);
  });
});
