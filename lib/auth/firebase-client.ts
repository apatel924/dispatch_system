"use client";

import {
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import {
  getFirebaseClientConfig,
  isFirebaseClientConfigured,
} from "@/lib/auth/config";
import { isAccountActive } from "@/lib/auth/account-status";
import { isUserRole } from "@/lib/server/roles";
import type { UserRole } from "@/lib/types/backend";

export const AUTH_NOT_CONFIGURED_MESSAGE =
  "Firebase auth is not configured. Check .env.local.";

export const ADMIN_AUTH_APP_NAME = "quickrun-admin-auth";
export const DRIVER_AUTH_APP_NAME = "quickrun-driver-auth";

export type AuthPortal = "admin" | "driver";

export interface AuthClaims {
  role?: string;
  driverId?: string;
  active?: boolean;
}

/** @deprecated Use AuthClaims / getIdTokenClaims instead */
export type DriverAuthClaims = AuthClaims;

export interface AuthRedirectResult {
  allowed: boolean;
  redirectTo?: string;
  error?: string;
}

const PORTAL_APP_NAME: Record<AuthPortal, string> = {
  admin: ADMIN_AUTH_APP_NAME,
  driver: DRIVER_AUTH_APP_NAME,
};

let defaultFirebaseApp: FirebaseApp | undefined;
const portalAuthByName = new Map<string, Auth>();
const persistenceReadyByPortal = new Map<AuthPortal, Promise<void>>();

function authDebug(message: string, details?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  if (details) {
    console.info(`[auth] ${message}`, details);
  } else {
    console.info(`[auth] ${message}`);
  }
}

/**
 * Default Firebase app for shared Firestore / Storage (if used on the client).
 * Auth portals use separate named apps — do not use getAuth() on this app for role sessions.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error(
      "Firebase client is not configured. Set NEXT_PUBLIC_FIREBASE_* variables in .env.local.",
    );
  }

  if (defaultFirebaseApp) return defaultFirebaseApp;

  const existingDefault = getApps().find((app) => app.name === "[DEFAULT]");
  if (existingDefault) {
    defaultFirebaseApp = existingDefault;
    return defaultFirebaseApp;
  }

  defaultFirebaseApp = initializeApp(getFirebaseClientConfig());
  authDebug("Initialized default Firebase app", { name: "[DEFAULT]" });
  return defaultFirebaseApp;
}

function getNamedFirebaseApp(appName: string): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error(
      "Firebase client is not configured. Set NEXT_PUBLIC_FIREBASE_* variables in .env.local.",
    );
  }

  const existing = getApps().find((app) => app.name === appName);
  if (existing) return existing;

  const app = initializeApp(getFirebaseClientConfig(), appName);
  authDebug("Initialized named Firebase app", { name: appName });
  return app;
}

function createPersistentAuth(app: FirebaseApp): Auth {
  if (typeof window === "undefined") {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    // Already initialized (e.g. Next.js hot reload)
    return getAuth(app);
  }
}

function getPortalAuthInstance(portal: AuthPortal): Auth {
  const appName = PORTAL_APP_NAME[portal];
  const cached = portalAuthByName.get(appName);
  if (cached) return cached;

  const app = getNamedFirebaseApp(appName);
  const auth = createPersistentAuth(app);
  portalAuthByName.set(appName, auth);
  return auth;
}

/**
 * Auth instance for the admin / dispatcher portal (named app `quickrun-admin-auth`).
 * Isolated from driver Auth so both roles can stay signed in in one browser.
 */
export function getAdminPortalAuth(): Auth {
  return getPortalAuthInstance("admin");
}

/**
 * Auth instance for the driver portal (named app `quickrun-driver-auth`).
 * Isolated from admin Auth so both roles can stay signed in in one browser.
 */
export function getDriverPortalAuth(): Auth {
  return getPortalAuthInstance("driver");
}

/** Named admin Auth (`quickrun-admin-auth`). Pass to Firebase Auth APIs. */
export function adminAuth(): Auth {
  return getAdminPortalAuth();
}

/** Named driver Auth (`quickrun-driver-auth`). Pass to Firebase Auth APIs. */
export function driverAuth(): Auth {
  return getDriverPortalAuth();
}

export function getPortalAuth(portal: AuthPortal): Auth {
  return portal === "admin" ? getAdminPortalAuth() : getDriverPortalAuth();
}

/**
 * Ensure browser local persistence is configured before sign-in.
 * Completes before any signInWithEmailAndPassword call.
 */
export async function ensureAuthPersistence(portal: AuthPortal): Promise<void> {
  if (typeof window === "undefined") return;

  const existing = persistenceReadyByPortal.get(portal);
  if (existing) {
    await existing;
    return;
  }

  const auth = getPortalAuth(portal);
  const ready = setPersistence(auth, browserLocalPersistence)
    .then(() => {
      authDebug("Persistence ready", {
        portal,
        app: PORTAL_APP_NAME[portal],
        persistence: "browserLocalPersistence",
      });
    })
    .catch((error: unknown) => {
      // initializeAuth may already have set persistence; Auth still works.
      authDebug("Persistence setPersistence settled with error (safe to continue)", {
        portal,
        error: error instanceof Error ? error.message : "unknown",
      });
    });

  persistenceReadyByPortal.set(portal, ready);
  await ready;
}

export async function signInWithEmail(
  portal: AuthPortal,
  email: string,
  password: string,
): Promise<User> {
  await ensureAuthPersistence(portal);
  const auth = getPortalAuth(portal);
  const result = await signInWithEmailAndPassword(auth, email, password);
  authDebug("Signed in", {
    portal,
    uid: result.user.uid,
    app: PORTAL_APP_NAME[portal],
  });
  return result.user;
}

export async function signOutPortal(portal: AuthPortal): Promise<void> {
  const auth = getPortalAuth(portal);
  await signOut(auth);
  authDebug("Signed out", { portal, app: PORTAL_APP_NAME[portal] });
}

export async function signOutAdmin(): Promise<void> {
  await signOutPortal("admin");
}

export async function signOutDriver(): Promise<void> {
  await signOutPortal("driver");
}

/** @deprecated Use signOutAdmin / signOutDriver */
export async function signOutUser(): Promise<void> {
  await signOutAdmin();
}

export async function getCurrentIdToken(
  portal: AuthPortal,
  forceRefresh = false,
): Promise<string | null> {
  const user = getPortalAuth(portal).currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function getIdTokenClaims(
  portal: AuthPortal,
  forceRefresh = false,
): Promise<AuthClaims | null> {
  const user = getPortalAuth(portal).currentUser;
  if (!user) return null;
  const result = await user.getIdTokenResult(forceRefresh);
  const claims = result.claims;
  return {
    role: typeof claims.role === "string" ? claims.role : undefined,
    driverId: typeof claims.driverId === "string" ? claims.driverId : undefined,
    active: typeof claims.active === "boolean" ? claims.active : undefined,
  };
}

export async function getDriverAuthClaims(
  forceRefresh = false,
): Promise<AuthClaims | null> {
  return getIdTokenClaims("driver", forceRefresh);
}

export async function getCurrentUserRole(
  portal: AuthPortal = "admin",
): Promise<UserRole | null> {
  const claims = await getIdTokenClaims(portal);
  if (!claims?.role || !isUserRole(claims.role)) return null;
  return claims.role;
}

function homePathForRole(role: UserRole): string {
  return role === "driver" ? "/driver-dashboard" : "/dashboard";
}

/**
 * Resolve whether the signed-in portal user may access a route.
 * Call only after the portal's authReady / first observer callback.
 */
export async function requireClientAuthRedirect(
  portal: AuthPortal,
  allowedRoles: readonly UserRole[],
  loginPath: string,
  wrongRoleRedirect?: string,
): Promise<AuthRedirectResult> {
  if (!isAuthConfigured()) {
    return { allowed: false, error: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const user = getPortalAuth(portal).currentUser;
  if (!user) {
    authDebug("Guard redirect: no restored user", { portal, loginPath });
    return { allowed: false, redirectTo: loginPath };
  }

  const claims = await getIdTokenClaims(portal);
  if (!claims?.role || !isUserRole(claims.role)) {
    authDebug("Guard redirect: missing role claim", { portal, uid: user.uid });
    await signOutPortal(portal);
    return {
      allowed: false,
      redirectTo: loginPath,
      error: "This account has no assigned role. Contact your administrator.",
    };
  }

  if (!isAccountActive(claims.active)) {
    authDebug("Guard redirect: inactive account", { portal, uid: user.uid, role: claims.role });
    await signOutPortal(portal);
    return {
      allowed: false,
      redirectTo: loginPath,
      error: "This account has been disabled. Contact an administrator.",
    };
  }

  if (!allowedRoles.includes(claims.role)) {
    const redirectTo = wrongRoleRedirect ?? homePathForRole(claims.role);
    authDebug("Guard redirect: role not allowed", {
      portal,
      uid: user.uid,
      role: claims.role,
      allowedRoles: [...allowedRoles],
      redirectTo,
    });
    return {
      allowed: false,
      redirectTo,
      error: "You do not have access to this area.",
    };
  }

  authDebug("Guard allowed", { portal, uid: user.uid, role: claims.role });
  return { allowed: true };
}

/**
 * After portal sign-in, verify the expected role claim and resolve the dashboard path.
 * Signs out only this portal's Auth instance when claims are invalid for the portal.
 */
export async function resolvePostLoginRedirect(
  context: AuthPortal,
): Promise<{ redirectTo?: string; error?: string }> {
  const claims = await getIdTokenClaims(context, true);
  if (!claims?.role || !isUserRole(claims.role)) {
    await signOutPortal(context);
    return { error: "This account has no assigned role. Contact your administrator." };
  }

  if (!isAccountActive(claims.active)) {
    await signOutPortal(context);
    return { error: "This account has been disabled. Contact an administrator." };
  }

  if (context === "admin") {
    if (claims.role === "admin" || claims.role === "dispatcher") {
      return { redirectTo: "/dashboard" };
    }
    await signOutPortal(context);
    return {
      error: "This account is not authorized for the admin portal. Use driver sign-in.",
    };
  }

  if (claims.role === "driver") {
    return { redirectTo: "/driver-dashboard" };
  }

  await signOutPortal(context);
  return {
    error: "This account is not authorized for the driver portal. Use admin sign-in.",
  };
}

export function subscribeToAuthState(
  portal: AuthPortal,
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(getPortalAuth(portal), callback);
}

export function subscribeToIdTokenChanged(
  portal: AuthPortal,
  callback: (user: User | null) => void,
): Unsubscribe {
  return onIdTokenChanged(getPortalAuth(portal), (user) => {
    callback(user);
  });
}

export function isAuthConfigured(): boolean {
  return isFirebaseClientConfigured();
}
