import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getAdminFirestore } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/server/firebase-admin", () => ({
  getAdminAuth: () => ({ getUser }),
  getAdminFirestore,
}));

import {
  ACCOUNT_DISABLED_CODE,
  assertAccountActive,
  assertActiveClaim,
  isAccountDisabledInFirestore,
  resetAccountDisabledLogThrottleForTests,
} from "@/lib/server/account-active";

describe("assertActiveClaim / assertAccountActive", () => {
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

  it("allows active: true claim", async () => {
    const denial = await assertAccountActive({
      decoded: { uid: "u1", active: true } as never,
      role: "admin",
    });
    expect(denial).toBeNull();
  });

  it("allows missing active claim (legacy)", async () => {
    const denial = await assertAccountActive({
      decoded: { uid: "u1" } as never,
      role: "driver",
      driverId: "DRV-1",
    });
    expect(denial).toBeNull();
  });

  it("returns ACCOUNT_DISABLED for active: false claim", async () => {
    const denial = assertActiveClaim({ uid: "u1", active: false, role: "admin" });
    expect(denial).not.toBeNull();
    expect(denial!.status).toBe(403);
    const body = await denial!.json();
    expect(body).toMatchObject({
      code: ACCOUNT_DISABLED_CODE,
      error: expect.stringContaining("disabled"),
    });
  });

  it("denies when Firebase Auth user is disabled even if claim is still active", async () => {
    getUser.mockResolvedValue({ disabled: true });
    const denial = await assertAccountActive({
      decoded: { uid: "u1", active: true } as never,
      role: "admin",
    });
    expect(denial).not.toBeNull();
    expect(denial!.status).toBe(403);
    const body = await denial!.json();
    expect(body.code).toBe(ACCOUNT_DISABLED_CODE);
  });

  it("denies driver when Firestore accountDisabled is true", async () => {
    getAdminFirestore.mockReturnValue({
      collection: (name: string) => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () =>
              name === "drivers" ? { accountDisabled: true } : { isActive: true },
          }),
        }),
      }),
    });
    const denial = await assertAccountActive({
      decoded: { uid: "drv-auth", active: true } as never,
      role: "driver",
      driverId: "DRV-1",
    });
    expect(denial).not.toBeNull();
    const body = await denial!.json();
    expect(body.code).toBe(ACCOUNT_DISABLED_CODE);
  });

  it("denies admin when users.isActive is false", async () => {
    getAdminFirestore.mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ isActive: false }),
          }),
        }),
      }),
    });
    const denial = await assertAccountActive({
      decoded: { uid: "admin-1", active: true } as never,
      role: "admin",
    });
    expect(denial).not.toBeNull();
    const body = await denial!.json();
    expect(body.code).toBe(ACCOUNT_DISABLED_CODE);
  });

  it("isAccountDisabledInFirestore ignores missing docs", async () => {
    expect(
      await isAccountDisabledInFirestore({ uid: "x", role: "admin" }),
    ).toBe(false);
  });
});
