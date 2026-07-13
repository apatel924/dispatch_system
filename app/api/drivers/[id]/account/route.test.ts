import { afterEach, describe, expect, it, vi } from "vitest";

const {
  requireRole,
  getDriverAccountAccess,
  updateDriverAccount,
  ensureFirebaseConfigured,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getDriverAccountAccess: vi.fn(),
  updateDriverAccount: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/services/driver-account", () => ({
  getDriverAccountAccess,
  updateDriverAccount,
}));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { GET, PATCH } from "@/app/api/drivers/[id]/account/route";

const adminUser = { uid: "admin-1", role: "admin" as const };
const dispatcherUser = { uid: "disp-1", role: "dispatcher" as const };
const driverUser = { uid: "driver-auth-1", role: "driver" as const, driverId: "DRV-1" };

describe("GET /api/drivers/[id]/account", () => {
  afterEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    const response = await GET(new Request("http://localhost/api/drivers/DRV-1/account"), {
      params: Promise.resolve({ id: "DRV-1" }),
    });

    expect(response.status).toBe(401);
    expect(getDriverAccountAccess).not.toHaveBeenCalled();
  });

  it("rejects dispatcher access", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    );

    const response = await GET(new Request("http://localhost/api/drivers/DRV-1/account"), {
      params: Promise.resolve({ id: "DRV-1" }),
    });

    expect(response.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(expect.any(Request), ["admin"]);
  });

  it("returns account metadata for admin", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    getDriverAccountAccess.mockResolvedValue({
      driverId: "DRV-1",
      driverName: "Alex",
      linked: true,
      loginEmail: "driver@example.com",
      disabled: false,
    });

    const response = await GET(new Request("http://localhost/api/drivers/DRV-1/account"), {
      params: Promise.resolve({ id: "DRV-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      account: { driverId: "DRV-1", loginEmail: "driver@example.com" },
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });
});

describe("PATCH /api/drivers/[id]/account", () => {
  afterEach(() => vi.clearAllMocks());

  it("rejects driver access", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    );

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "Secret1a", confirmPassword: "Secret1a" }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(response.status).toBe(403);
    expect(updateDriverAccount).not.toHaveBeenCalled();
  });

  it("rejects arbitrary authUid in request body", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUid: "some-other-uid", password: "Secret1a" }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(response.status).toBe(400);
    expect(updateDriverAccount).not.toHaveBeenCalled();
  });

  it("rejects weak password", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "short", confirmPassword: "short" }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(response.status).toBe(400);
    expect(updateDriverAccount).not.toHaveBeenCalled();
  });

  it("rejects password confirmation mismatch", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "Secret1a", confirmPassword: "Secret1b" }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(response.status).toBe(400);
    expect(updateDriverAccount).not.toHaveBeenCalled();
  });

  it("updates account without returning password", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    updateDriverAccount.mockResolvedValue({
      driverId: "DRV-1",
      driverName: "Alex",
      linked: true,
      loginEmail: "new@example.com",
    });

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginEmail: "new@example.com",
          password: "Secret1a",
          confirmPassword: "Secret1a",
        }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.account.loginEmail).toBe("new@example.com");
    expect(JSON.stringify(body)).not.toContain("Secret1a");
    expect(updateDriverAccount).toHaveBeenCalledWith(
      "DRV-1",
      {
        loginEmail: "new@example.com",
        password: "Secret1a",
        confirmPassword: "Secret1a",
      },
      adminUser,
    );
  });

  it("passes driverId only — never client-supplied target uid for credential updates", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    updateDriverAccount.mockResolvedValue({ driverId: "DRV-1", linked: true });

    await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: true }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(updateDriverAccount).toHaveBeenCalledWith(
      "DRV-1",
      { disabled: true },
      adminUser,
    );
  });
});

describe("PATCH /api/drivers/[id]/account authorization policy", () => {
  it("uses admin-only roles", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(dispatcherUser);

    await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: false }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(requireRole).toHaveBeenCalledWith(expect.any(Request), ["admin"]);
  });

  it("does not accept driver role", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);

    const response = await PATCH(
      new Request("http://localhost/api/drivers/DRV-1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "Secret1a", confirmPassword: "Secret1a" }),
      }),
      { params: Promise.resolve({ id: "DRV-1" }) },
    );

    expect(requireRole).toHaveBeenCalledWith(expect.any(Request), ["admin"]);
    void response;
  });
});
