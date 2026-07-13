/**
 * @vitest-environment happy-dom
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConsumerTracking } from "@/lib/consumer/hooks/use-consumer-tracking";

vi.mock("@/lib/dash/api/config", () => ({
  isApiEnabled: () => true,
}));

const VALID_TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

describe("useConsumerTracking security", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: "This tracking link is not valid.",
          code: "TRACKING_INVALID",
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not render demo data for QRX-28491 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { result } = renderHook(() => useConsumerTracking("QRX-28491"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tracking).toBeNull();
    expect(result.current.errorKind).toBe("invalid");
    expect(fetch).toHaveBeenCalledWith(
      "/api/tracking/QRX-28491",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("routes QRX order references through the secure API invalid-link path", async () => {
    const { result } = renderHook(() => useConsumerTracking("QRX-10004"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tracking).toBeNull();
    expect(result.current.errorKind).toBe("invalid");
    expect(fetch).toHaveBeenCalledWith("/api/tracking/QRX-10004", expect.any(Object));
  });

  it("loads valid opaque tokens from the secure API", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tracking: {
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
        },
      }),
    } as Response);

    const { result } = renderHook(() => useConsumerTracking(VALID_TOKEN));

    await waitFor(() => expect(result.current.tracking).not.toBeNull());

    expect(result.current.errorKind).toBeNull();
    expect(result.current.tracking?.publicReference).toBe("QRX-1001");
    expect(fetch).toHaveBeenCalledWith(
      `/api/tracking/${VALID_TOKEN}`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
