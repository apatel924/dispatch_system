/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSetPersistence,
  mockSignIn,
  mockSignOut,
  mockOnAuthStateChanged,
  mockOnIdTokenChanged,
  mockGetIdToken,
  mockGetIdTokenResult,
  mockInitializeAuth,
  mockGetAuth,
  mockInitializeApp,
  mockGetApps,
  adminUser,
  driverUser,
  adminAuthState,
  driverAuthState,
} = vi.hoisted(() => {
  const adminUser = {
    uid: "admin-uid",
    getIdToken: vi.fn(),
    getIdTokenResult: vi.fn(),
  };
  const driverUser = {
    uid: "driver-uid",
    getIdToken: vi.fn(),
    getIdTokenResult: vi.fn(),
  };

  const adminAuthState = {
    currentUser: null as typeof adminUser | null,
  };
  const driverAuthState = {
    currentUser: null as typeof driverUser | null,
  };

  const createAuth = (state: { currentUser: unknown }) =>
    ({
      get currentUser() {
        return state.currentUser;
      },
      app: { name: "mock" },
    }) as const;

  return {
    mockSetPersistence: vi.fn(async () => undefined),
    mockSignIn: vi.fn(),
    mockSignOut: vi.fn(async () => undefined),
    mockOnAuthStateChanged: vi.fn(() => () => undefined),
    mockOnIdTokenChanged: vi.fn(() => () => undefined),
    mockGetIdToken: vi.fn(),
    mockGetIdTokenResult: vi.fn(),
    mockInitializeAuth: vi.fn(),
    mockGetAuth: vi.fn(),
    mockInitializeApp: vi.fn((config: unknown, name?: string) => ({
      name: name ?? "[DEFAULT]",
      options: config,
    })),
    mockGetApps: vi.fn(() => []),
    adminUser,
    driverUser,
    adminAuthState,
    driverAuthState,
    createAuth,
  };
});

vi.mock("firebase/app", () => ({
  getApps: mockGetApps,
  initializeApp: mockInitializeApp,
}));

vi.mock("firebase/auth", () => {
  const adminAuth = {
    get currentUser() {
      return adminAuthState.currentUser;
    },
    app: { name: "quickrun-admin-auth" },
  };
  const driverAuth = {
    get currentUser() {
      return driverAuthState.currentUser;
    },
    app: { name: "quickrun-driver-auth" },
  };

  mockInitializeAuth.mockImplementation((app: { name: string }) =>
    app.name.includes("admin") ? adminAuth : driverAuth,
  );
  mockGetAuth.mockImplementation((app: { name: string }) =>
    app.name.includes("admin") ? adminAuth : driverAuth,
  );

  return {
    browserLocalPersistence: { type: "LOCAL" },
    indexedDBLocalPersistence: { type: "INDEXED_DB" },
    initializeAuth: mockInitializeAuth,
    getAuth: mockGetAuth,
    setPersistence: mockSetPersistence,
    signInWithEmailAndPassword: mockSignIn,
    signOut: mockSignOut,
    onAuthStateChanged: mockOnAuthStateChanged,
    onIdTokenChanged: mockOnIdTokenChanged,
  };
});

vi.mock("@/lib/auth/config", () => ({
  isFirebaseClientConfigured: () => true,
  getFirebaseClientConfig: () => ({
    apiKey: "test",
    authDomain: "test.firebaseapp.com",
    projectId: "test",
    storageBucket: "test.appspot.com",
    messagingSenderId: "1",
    appId: "1:1:web:1",
  }),
}));

describe("dual portal firebase auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetApps.mockReturnValue([]);
    adminAuthState.currentUser = null;
    driverAuthState.currentUser = null;
    mockSetPersistence.mockClear();
    mockSignIn.mockClear();
    mockSignOut.mockClear();
    mockInitializeAuth.mockClear();
    mockGetAuth.mockClear();
    mockInitializeApp.mockClear();

    adminUser.getIdToken.mockReset();
    adminUser.getIdTokenResult.mockReset();
    driverUser.getIdToken.mockReset();
    driverUser.getIdTokenResult.mockReset();
  });

  it("initializes separate named apps for admin and driver auth", async () => {
    const {
      getAdminPortalAuth,
      getDriverPortalAuth,
      ADMIN_AUTH_APP_NAME,
      DRIVER_AUTH_APP_NAME,
    } = await import("@/lib/auth/firebase-client");

    const admin = getAdminPortalAuth();
    const driver = getDriverPortalAuth();

    expect(admin).not.toBe(driver);
    expect(mockInitializeApp).toHaveBeenCalledWith(
      expect.any(Object),
      ADMIN_AUTH_APP_NAME,
    );
    expect(mockInitializeApp).toHaveBeenCalledWith(
      expect.any(Object),
      DRIVER_AUTH_APP_NAME,
    );
  });

  it("awaits persistence before sign-in and uses the portal auth instance", async () => {
    mockSignIn.mockResolvedValue({ user: adminUser });
    const { signInWithEmail, getAdminPortalAuth } = await import(
      "@/lib/auth/firebase-client"
    );

    await signInWithEmail("admin", "admin@example.com", "secret");

    expect(mockSetPersistence).toHaveBeenCalled();
    expect(mockSignIn).toHaveBeenCalledWith(
      getAdminPortalAuth(),
      "admin@example.com",
      "secret",
    );
  });

  it("signs out only the requested portal", async () => {
    const { signOutAdmin, signOutDriver, getAdminPortalAuth, getDriverPortalAuth } =
      await import("@/lib/auth/firebase-client");

    await signOutAdmin();
    expect(mockSignOut).toHaveBeenCalledWith(getAdminPortalAuth());

    mockSignOut.mockClear();
    await signOutDriver();
    expect(mockSignOut).toHaveBeenCalledWith(getDriverPortalAuth());
    expect(mockSignOut).not.toHaveBeenCalledWith(getAdminPortalAuth());
  });

  it("reads id tokens from the correct portal currentUser", async () => {
    adminAuthState.currentUser = adminUser;
    driverAuthState.currentUser = driverUser;
    adminUser.getIdToken.mockResolvedValue("admin-token");
    driverUser.getIdToken.mockResolvedValue("driver-token");

    const { getCurrentIdToken } = await import("@/lib/auth/firebase-client");

    await expect(getCurrentIdToken("admin")).resolves.toBe("admin-token");
    await expect(getCurrentIdToken("driver")).resolves.toBe("driver-token");
    expect(adminUser.getIdToken).toHaveBeenCalled();
    expect(driverUser.getIdToken).toHaveBeenCalled();
  });

  it("rejects driver accounts on admin login and signs out admin portal only", async () => {
    adminAuthState.currentUser = adminUser;
    adminUser.getIdTokenResult.mockResolvedValue({
      claims: { role: "driver", active: true, driverId: "DRV-1" },
      token: "t",
      expirationTime: new Date(Date.now() + 3600_000).toISOString(),
    });

    const { resolvePostLoginRedirect } = await import("@/lib/auth/firebase-client");
    const result = await resolvePostLoginRedirect("admin");

    expect(result.redirectTo).toBeUndefined();
    expect(result.error).toMatch(/not authorized for the admin portal/i);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("rejects non-driver accounts on driver login", async () => {
    driverAuthState.currentUser = driverUser;
    driverUser.getIdTokenResult.mockResolvedValue({
      claims: { role: "admin", active: true },
      token: "t",
      expirationTime: new Date(Date.now() + 3600_000).toISOString(),
    });

    const { resolvePostLoginRedirect } = await import("@/lib/auth/firebase-client");
    const result = await resolvePostLoginRedirect("driver");

    expect(result.redirectTo).toBeUndefined();
    expect(result.error).toMatch(/not authorized for the driver portal/i);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("allows restored admin session for admin routes after auth is ready", async () => {
    adminAuthState.currentUser = adminUser;
    adminUser.getIdTokenResult.mockResolvedValue({
      claims: { role: "admin", active: true },
      token: "t",
      expirationTime: new Date(Date.now() + 3600_000).toISOString(),
    });

    const { requireClientAuthRedirect } = await import("@/lib/auth/firebase-client");
    const result = await requireClientAuthRedirect(
      "admin",
      ["admin", "dispatcher"],
      "/",
      "/driver-dashboard",
    );

    expect(result).toEqual({ allowed: true });
  });

  it("does not silently fall back across portals when currentUser is missing", async () => {
    driverAuthState.currentUser = driverUser;
    driverUser.getIdToken.mockResolvedValue("driver-token");

    const { getCurrentIdToken } = await import("@/lib/auth/firebase-client");

    await expect(getCurrentIdToken("admin")).resolves.toBeNull();
    await expect(getCurrentIdToken("driver")).resolves.toBe("driver-token");
  });
});
