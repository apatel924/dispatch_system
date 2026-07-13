import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/server/errors";

const state = vi.hoisted(() => ({
  drivers: new Map<string, Record<string, unknown>>(),
  orders: [] as Array<{ assignedDriverId: string; status: string }>,
  authUsers: new Map<
    string,
    {
      email?: string;
      displayName?: string;
      disabled?: boolean;
      customClaims?: Record<string, unknown>;
    }
  >(),
  auditLogs: [] as Record<string, unknown>[],
}));

const updateUser = vi.fn();
const getUser = vi.fn();
const revokeRefreshTokens = vi.fn();
const setCustomUserClaims = vi.fn();

const { getAdminAuth, getAdminFirestore } = vi.hoisted(() => {
  function driverRef(id: string) {
    return {
      id,
      update: vi.fn(async (patch: Record<string, unknown>) => {
        const existing = state.drivers.get(id) ?? {};
        state.drivers.set(id, { ...existing, ...patch });
      }),
      get: vi.fn(async () => {
        const data = state.drivers.get(id);
        return { exists: data !== undefined, data: () => data, ref: driverRef(id) };
      }),
    };
  }

  return {
    getAdminAuth: vi.fn(() => ({
      updateUser,
      getUser,
      revokeRefreshTokens,
      setCustomUserClaims,
    })),
    getAdminFirestore: vi.fn(() => ({
      collection: vi.fn((name: string) => {
        if (name === "drivers") {
          return {
            doc: vi.fn((id: string) => driverRef(id)),
            where: vi.fn((field: string, _op: string, value: unknown) => ({
              limit: vi.fn(() => ({
                get: vi.fn(async () => ({
                  docs: [...state.drivers.entries()]
                    .filter(([, data]) => data[field] === value)
                    .map(([id, data]) => ({ id, data: () => data })),
                })),
              })),
            })),
          };
        }
        if (name === "orders") {
          return {
            where: vi.fn((field: string, _op: string, value: unknown) => ({
              where: vi.fn((_field2: string, _op2: string, statuses: string[]) => ({
                get: vi.fn(async () => ({
                  size: state.orders.filter(
                    (o) =>
                      o.assignedDriverId === value &&
                      (statuses as string[]).includes(o.status),
                  ).length,
                  docs: [],
                })),
              })),
              get: vi.fn(async () => ({ size: 0, docs: [] })),
            })),
          };
        }
        return { doc: vi.fn(() => ({ set: vi.fn() })) };
      }),
    })),
  };
});

vi.mock("@/lib/server/firebase-admin", () => ({ getAdminAuth, getAdminFirestore }));
vi.mock("@/lib/server/services/audit", () => ({
  writeAuditLog: vi.fn(async (input: Record<string, unknown>) => {
    state.auditLogs.push(input);
    return { id: "audit-1", ...input };
  }),
}));

import {
  getDriverAccountAccess,
  linkDriverAuthUid,
  updateDriverAccount,
} from "@/lib/server/services/driver-account";

const adminActor = { uid: "admin-uid", role: "admin" as const };

function seedDriver(
  id: string,
  data: Record<string, unknown> = {},
): void {
  state.drivers.set(id, {
    name: "Alex Driver",
    email: "alex@example.com",
    ...data,
  });
}

beforeEach(() => {
  state.drivers.clear();
  state.orders = [];
  state.authUsers.clear();
  state.auditLogs = [];
  vi.clearAllMocks();

  getUser.mockImplementation(async (uid: string) => {
    const user = state.authUsers.get(uid);
    if (!user) {
      const err = new Error("not found") as Error & { code?: string };
      err.code = "auth/user-not-found";
      throw err;
    }
    return { uid, ...user };
  });

  updateUser.mockImplementation(async (uid: string, patch: Record<string, unknown>) => {
    const user = state.authUsers.get(uid) ?? {};
    state.authUsers.set(uid, { ...user, ...patch });
  });

  revokeRefreshTokens.mockResolvedValue(undefined);
  setCustomUserClaims.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getDriverAccountAccess", () => {
  it("reports unlinked driver without authUid", async () => {
    seedDriver("DRV-1", { userId: "", authUid: "" });
    const account = await getDriverAccountAccess("DRV-1");
    expect(account.linked).toBe(false);
    expect(account.loginEmail).toBeUndefined();
  });

  it("returns missing driver error", async () => {
    await expect(getDriverAccountAccess("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("updateDriverAccount", () => {
  it("rejects missing authUid", async () => {
    seedDriver("DRV-1");
    await expect(
      updateDriverAccount("DRV-1", { password: "Secret1a", confirmPassword: "Secret1a" }, adminActor),
    ).rejects.toMatchObject({ code: "AUTH_NOT_LINKED" });
  });

  it("prevents admin from modifying their own account", async () => {
    seedDriver("DRV-1", { authUid: "admin-uid", userId: "admin-uid" });
    state.authUsers.set("admin-uid", {
      email: "admin@example.com",
      customClaims: { role: "driver", driverId: "DRV-1" },
    });

    await expect(
      updateDriverAccount(
        "DRV-1",
        { password: "Secret1a", confirmPassword: "Secret1a" },
        adminActor,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("updates email, revokes tokens, and syncs Firestore", async () => {
    seedDriver("DRV-1", { authUid: "driver-auth-1", userId: "driver-auth-1" });
    state.authUsers.set("driver-auth-1", {
      email: "old@example.com",
      customClaims: { role: "driver", driverId: "DRV-1" },
    });

    const account = await updateDriverAccount(
      "DRV-1",
      { loginEmail: "new@example.com" },
      adminActor,
    );

    expect(updateUser).toHaveBeenCalledWith("driver-auth-1", { email: "new@example.com" });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("driver-auth-1");
    expect(state.drivers.get("DRV-1")?.email).toBe("new@example.com");
    expect(account.loginEmail).toBe("new@example.com");
    expect(state.auditLogs[0]?.metadata).toMatchObject({
      emailChanged: true,
      targetAuthUid: "driver-auth-1",
    });
  });

  it("updates password and revokes tokens without storing password", async () => {
    seedDriver("DRV-1", { authUid: "driver-auth-1", userId: "driver-auth-1" });
    state.authUsers.set("driver-auth-1", {
      email: "driver@example.com",
      customClaims: { role: "driver", driverId: "DRV-1" },
    });

    await updateDriverAccount(
      "DRV-1",
      { password: "Secret1a", confirmPassword: "Secret1a" },
      adminActor,
    );

    expect(updateUser).toHaveBeenCalledWith("driver-auth-1", { password: "Secret1a" });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("driver-auth-1");
    expect(JSON.stringify(state.drivers.get("DRV-1"))).not.toContain("Secret1a");
    expect(state.auditLogs[0]?.metadata).toMatchObject({ passwordChanged: true });
    expect(JSON.stringify(state.auditLogs)).not.toContain("Secret1a");
  });

  it("maps duplicate email errors", async () => {
    seedDriver("DRV-1", { authUid: "driver-auth-1", userId: "driver-auth-1" });
    state.authUsers.set("driver-auth-1", {
      email: "old@example.com",
      customClaims: { role: "driver", driverId: "DRV-1" },
    });
    updateUser.mockRejectedValueOnce(Object.assign(new Error("exists"), { code: "auth/email-already-exists" }));

    await expect(
      updateDriverAccount("DRV-1", { loginEmail: "taken@example.com" }, adminActor),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("blocks disable when active orders exist", async () => {
    seedDriver("DRV-1", { authUid: "driver-auth-1", userId: "driver-auth-1" });
    state.authUsers.set("driver-auth-1", {
      email: "driver@example.com",
      customClaims: { role: "driver", driverId: "DRV-1" },
    });
    state.orders.push({ assignedDriverId: "DRV-1", status: "Assigned" });

    await expect(
      updateDriverAccount("DRV-1", { disabled: true }, adminActor),
    ).rejects.toMatchObject({ code: "ACTIVE_ORDERS" });
  });

  it("maps duplicate email errors without logging the email in thrown message", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    seedDriver("DRV-1", { authUid: "driver-auth-1", userId: "driver-auth-1" });
    state.authUsers.set("driver-auth-1", {
      email: "old@example.com",
      customClaims: { role: "driver", driverId: "DRV-1" },
    });
    updateUser.mockRejectedValueOnce(
      Object.assign(new Error("exists"), { code: "auth/email-already-exists" }),
    );

    await expect(
      updateDriverAccount("DRV-1", { loginEmail: "taken@example.com" }, adminActor),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });

    const logged = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join(" ");
    expect(logged).not.toContain("taken@example.com");
    errorSpy.mockRestore();
  });
});

describe("linkDriverAuthUid", () => {
  it("links authUid when driver is unlinked", async () => {
    seedDriver("DRV-1");
    state.authUsers.set("firebase-uid-1", {
      email: "driver@example.com",
      customClaims: { role: "driver" },
    });

    const account = await linkDriverAuthUid("DRV-1", "firebase-uid-1", adminActor);
    expect(account.linked).toBe(true);
    expect(state.drivers.get("DRV-1")?.authUid).toBe("firebase-uid-1");
    expect(setCustomUserClaims).toHaveBeenCalledWith(
      "firebase-uid-1",
      expect.objectContaining({ role: "driver", driverId: "DRV-1" }),
    );
  });

  it("rejects when auth user is missing", async () => {
    seedDriver("DRV-1");
    await expect(
      linkDriverAuthUid("DRV-1", "missing-uid", adminActor),
    ).rejects.toMatchObject({ code: "AUTH_USER_NOT_FOUND" });
  });
});
