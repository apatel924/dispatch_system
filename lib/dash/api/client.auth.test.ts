/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentIdToken = vi.fn();
const isAuthConfigured = vi.fn(() => true);

vi.mock("@/lib/auth/firebase-client", () => ({
  getCurrentIdToken,
  isAuthConfigured,
}));

describe("portalFetch token isolation", () => {
  beforeEach(() => {
    getCurrentIdToken.mockReset();
    isAuthConfigured.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ ok: true }),
      ) as unknown as typeof fetch,
    );
  });

  it("adminFetch requests the admin portal token only", async () => {
    getCurrentIdToken.mockImplementation(async (portal: string) => {
      if (portal === "admin") return "admin-token";
      return "driver-token";
    });

    const { adminFetch } = await import("@/lib/dash/api/client");
    await adminFetch("/api/dashboard/stats");

    expect(getCurrentIdToken).toHaveBeenCalledWith("admin");
    expect(getCurrentIdToken).not.toHaveBeenCalledWith("driver");
    expect(fetch).toHaveBeenCalledWith(
      "/api/dashboard/stats",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      .headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer admin-token");
  });

  it("driverFetch requests the driver portal token only", async () => {
    getCurrentIdToken.mockImplementation(async (portal: string) => {
      if (portal === "driver") return "driver-token";
      return "admin-token";
    });

    const { driverFetch } = await import("@/lib/dash/api/client");
    await driverFetch("/api/driver/orders?scope=active");

    expect(getCurrentIdToken).toHaveBeenCalledWith("driver");
    expect(getCurrentIdToken).not.toHaveBeenCalledWith("admin");
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      .headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer driver-token");
  });
});
