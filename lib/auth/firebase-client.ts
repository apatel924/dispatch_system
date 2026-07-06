"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  getFirebaseClientConfig,
  isFirebaseClientConfigured,
} from "@/lib/auth/config";
import {
  clearTabSession,
  getValidTabSession,
  isTabSessionEnabled,
  saveTabSession,
} from "@/lib/auth/tab-session";
import { isUserRole } from "@/lib/server/roles";
import type { UserRole } from "@/lib/types/backend";

export const AUTH_NOT_CONFIGURED_MESSAGE =
  "Firebase auth is not configured. Check .env.local.";

let firebaseApp: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error(
      "Firebase client is not configured. Set NEXT_PUBLIC_FIREBASE_* variables in .env.local.",
    );
  }

  if (firebaseApp) return firebaseApp;

  const existing = getApps()[0];
  if (existing) {
    firebaseApp = existing;
    return firebaseApp;
  }

  firebaseApp = initializeApp(getFirebaseClientConfig());
  return firebaseApp;
}

export function getClientAuth(): Auth {
  return getAuth(getFirebaseApp());
}

async function persistTabSessionFromUser(user: User): Promise<void> {
  if (!isTabSessionEnabled()) return;

  const tokenResult = await user.getIdTokenResult(true);
  const role = tokenResult.claims.role;
  if (!isUserRole(role)) return;

  saveTabSession({
    idToken: tokenResult.token,
    role,
    expiresAt: new Date(tokenResult.expirationTime).getTime(),
    driverId:
      typeof tokenResult.claims.driverId === "string"
        ? tokenResult.claims.driverId
        : undefined,
  });
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const result = await signInWithEmailAndPassword(getClientAuth(), email, password);
  await persistTabSessionFromUser(result.user);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  clearTabSession();
  await signOut(getClientAuth());
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  const tabSession = getValidTabSession();
  if (isTabSessionEnabled() && tabSession && !forceRefresh) {
    return tabSession.idToken;
  }

  const user = getClientAuth().currentUser;
  if (!user) return null;
  const token = await user.getIdToken(forceRefresh);
  if (isTabSessionEnabled() && !forceRefresh) {
    await persistTabSessionFromUser(user);
  }
  return token;
}

export interface AuthClaims {
  role?: string;
  driverId?: string;
  active?: boolean;
}

/** @deprecated Use AuthClaims / getIdTokenClaims instead */
export type DriverAuthClaims = AuthClaims;

export async function getIdTokenClaims(forceRefresh = false): Promise<AuthClaims | null> {
  const tabSession = getValidTabSession();
  if (isTabSessionEnabled() && tabSession && !forceRefresh) {
    return {
      role: tabSession.role,
      driverId: tabSession.driverId,
      active: true,
    };
  }

  const user = getClientAuth().currentUser;
  if (!user) return null;
  const result = await user.getIdTokenResult(forceRefresh);
  const claims = result.claims;
  return {
    role: typeof claims.role === "string" ? claims.role : undefined,
    driverId: typeof claims.driverId === "string" ? claims.driverId : undefined,
    active: typeof claims.active === "boolean" ? claims.active : undefined,
  };
}

export async function getDriverAuthClaims(): Promise<AuthClaims | null> {
  return getIdTokenClaims();
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const claims = await getIdTokenClaims();
  if (!claims?.role || !isUserRole(claims.role)) return null;
  return claims.role;
}

export interface AuthRedirectResult {
  allowed: boolean;
  redirectTo?: string;
  error?: string;
}

function homePathForRole(role: UserRole): string {
  return role === "driver" ? "/driver-dashboard" : "/dashboard";
}

function isAccountActive(claims: AuthClaims): boolean {
  return claims.active !== false;
}

/**
 * Resolve whether the signed-in user may access a route and where to redirect otherwise.
 */
export async function requireClientAuthRedirect(
  allowedRoles: readonly UserRole[],
  loginPath: string,
  wrongRoleRedirect?: string,
): Promise<AuthRedirectResult> {
  if (!isAuthConfigured()) {
    return { allowed: false, error: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const tabSession = getValidTabSession();
  if (isTabSessionEnabled() && tabSession) {
    if (!allowedRoles.includes(tabSession.role)) {
      return {
        allowed: false,
        redirectTo: wrongRoleRedirect ?? homePathForRole(tabSession.role),
      };
    }
    return { allowed: true };
  }

  const user = getClientAuth().currentUser;
  if (!user) {
    return { allowed: false, redirectTo: loginPath };
  }

  const claims = await getIdTokenClaims();
  if (!claims?.role || !isUserRole(claims.role)) {
    await signOutUser();
    return {
      allowed: false,
      redirectTo: loginPath,
      error: "This account has no assigned role. Contact your administrator.",
    };
  }

  if (!isAccountActive(claims)) {
    await signOutUser();
    return {
      allowed: false,
      redirectTo: loginPath,
      error: "This account has been deactivated.",
    };
  }

  if (!allowedRoles.includes(claims.role)) {
    return {
      allowed: false,
      redirectTo: wrongRoleRedirect ?? homePathForRole(claims.role),
      error: "You do not have access to this area.",
    };
  }

  if (isTabSessionEnabled()) {
    await persistTabSessionFromUser(user);
  }

  return { allowed: true };
}

/**
 * After sign-in, resolve the dashboard path for the user's role or an error message.
 */
export async function resolvePostLoginRedirect(
  context: "admin" | "driver",
): Promise<{ redirectTo?: string; error?: string }> {
  const claims = await getIdTokenClaims(true);
  if (!claims?.role || !isUserRole(claims.role)) {
    await signOutUser();
    return { error: "This account has no assigned role. Contact your administrator." };
  }

  if (!isAccountActive(claims)) {
    await signOutUser();
    return { error: "This account has been deactivated." };
  }

  if (context === "admin") {
    if (claims.role === "driver") {
      return { redirectTo: "/driver-dashboard" };
    }
    if (claims.role === "admin" || claims.role === "dispatcher") {
      return { redirectTo: "/dashboard" };
    }
  }

  if (context === "driver") {
    if (claims.role === "driver") {
      return { redirectTo: "/driver-dashboard" };
    }
    if (claims.role === "admin" || claims.role === "dispatcher") {
      return {
        redirectTo: "/dashboard",
        error: "Signed in as staff — redirected to the dispatch dashboard.",
      };
    }
  }

  await signOutUser();
  return { error: "Unrecognized account role." };
}

export function subscribeToAuthState(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getClientAuth(), callback);
}

export function isAuthConfigured(): boolean {
  return isFirebaseClientConfigured();
}
