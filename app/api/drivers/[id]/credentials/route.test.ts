import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole, updateDriverAccount, ensureFirebaseConfigured } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  updateDriverAccount: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/services/driver-account", () => ({ updateDriverAccount }));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { PATCH } from "@/app/api/drivers/[id]/credentials/route";

describe("PATCH /api/drivers/[id]/credentials", () => {
  afterEach(() => vi.clearAllMocks());

  it("requires admin role (rejects dispatcher)", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    );

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "Secret1a" }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(response.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(expect.any(Request), ["admin"]);
    expect(updateDriverAccount).not.toHaveBeenCalled();
  });

  it("updates credentials without returning password", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue({ uid: "admin-1", role: "admin" });
    updateDriverAccount.mockResolvedValue({ linked: true });

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginEmail: "driver@example.com",
          password: "Secret1a",
        }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain("Secret1a");
    expect(updateDriverAccount).toHaveBeenCalledWith(
      "DRV-1",
      {
        loginEmail: "driver@example.com",
        password: "Secret1a",
        confirmPassword: "Secret1a",
      },
      { uid: "admin-1", role: "admin" },
    );
  });
});
