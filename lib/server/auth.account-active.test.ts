import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdToken, getUser, getAdminFirestore } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getUser: vi.fn(),
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/server/env", () => ({
  isFirebaseAdminConfigured: () => true,
}));

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken, getUser }),
  getAdminFirestore,
}));

import { requireAuth, requireRole } from "@/lib/server/auth";
import { ACCOUNT_DISABLED_CODE } from "@/lib/auth/account-status";
import { resetAccountDisabledLogThrottleForTests } from "@/lib/server/account-active";

function requestWithBearer(token = "tok"): Request {
  return new Request("https://app.example/api/orders", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("requireAuth / requireRole account activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAccountDisabledLogThrottleForTests();
    getUser.mockResolvedValue({ disabled: false });
    getAdminFirestore.mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false, data: () => undefined }),
        }),
      }),
    });
  });

  it("allows an active admin through requireRole", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "admin-1",
      email: "a@example.com",
      role: "admin",
      active: true,
      iat: 1_700_000_000,
    });

    const result = await requireRole(requestWithBearer(), ["admin"]);
    expect(result).toMatchObject({ uid: "admin-1", role: "admin" });
  });

  it("allows legacy tokens without an active claim", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "admin-legacy",
      role: "admin",
      iat: 1_700_000_000,
    });
    const result = await requireAuth(requestWithBearer());
    expect(result).toMatchObject({ uid: "admin-legacy", role: "admin" });
  });

  it("returns ACCOUNT_DISABLED when claim active is false", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "disabled-admin",
      role: "admin",
      active: false,
      iat: 1_700_000_000,
    });
    const result = await requireRole(requestWithBearer(), ["admin"]);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: ACCOUNT_DISABLED_CODE });
  });

  it("returns ACCOUNT_DISABLED for disabled Auth user with stale active claim", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "disabled-drv",
      role: "driver",
      driverId: "DRV-1",
      active: true,
      iat: 1_700_000_000,
    });
    getUser.mockResolvedValue({ disabled: true });

    const result = await requireRole(requestWithBearer(), ["driver"]);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toMatchObject({
      code: ACCOUNT_DISABLED_CODE,
    });
  });

  it("still enforces role after activation passes", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "drv-1",
      role: "driver",
      driverId: "DRV-1",
      active: true,
      iat: 1_700_000_000,
    });
    const result = await requireRole(requestWithBearer(), ["admin"]);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    const body = await (result as Response).json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns unauthorized when token verification fails", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    const result = await requireAuth(requestWithBearer());
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
