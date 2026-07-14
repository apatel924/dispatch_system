"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import {
  type AuthClaims,
  type AuthPortal,
  getIdTokenClaims,
  isAuthConfigured,
  signOutPortal,
  subscribeToIdTokenChanged,
} from "@/lib/auth/firebase-client";
import { isUserRole } from "@/lib/server/roles";
import type { UserRole } from "@/lib/types/backend";

export interface PortalAuthState {
  user: User | null;
  claims: AuthClaims | null;
  role: UserRole | null;
  /** True until the first Firebase auth observer callback for this portal. */
  loading: boolean;
  /** False until the first Firebase auth observer callback for this portal. */
  authReady: boolean;
  error: string | null;
  portal: AuthPortal;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<PortalAuthState | null>(null);
const DriverAuthContext = createContext<PortalAuthState | null>(null);

function authDebug(message: string, details?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  if (details) {
    console.info(`[auth] ${message}`, details);
  } else {
    console.info(`[auth] ${message}`);
  }
}

function usePortalAuthState(portal: AuthPortal): PortalAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthConfigured()) {
      setUser(null);
      setClaims(null);
      setError(null);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    const unsubscribe = subscribeToIdTokenChanged(portal, async (nextUser) => {
      if (cancelled) return;

      setUser(nextUser);
      setError(null);

      if (!nextUser) {
        setClaims(null);
        setLoading(false);
        setAuthReady(true);
        authDebug("Portal auth observer ready", {
          portal,
          restored: false,
        });
        return;
      }

      try {
        const nextClaims = await getIdTokenClaims(portal);
        if (cancelled) return;
        setClaims(nextClaims);
        authDebug("Portal auth observer ready", {
          portal,
          restored: true,
          uid: nextUser.uid,
          role:
            nextClaims?.role && isUserRole(nextClaims.role)
              ? nextClaims.role
              : undefined,
        });
      } catch (err) {
        if (cancelled) return;
        setClaims(null);
        setError(err instanceof Error ? err.message : "Failed to load auth claims");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setAuthReady(true);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [portal]);

  const signOut = useCallback(async () => {
    setError(null);
    await signOutPortal(portal);
  }, [portal]);

  const role =
    claims?.role && isUserRole(claims.role) ? claims.role : null;

  return useMemo(
    () => ({
      user,
      claims,
      role,
      loading,
      authReady,
      error,
      portal,
      signOut,
    }),
    [user, claims, role, loading, authReady, error, portal, signOut],
  );
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const value = usePortalAuthState("admin");
  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  );
}

export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const value = usePortalAuthState("driver");
  return (
    <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>
  );
}

export function useAdminAuth(): PortalAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}

export function useDriverAuth(): PortalAuthState {
  const ctx = useContext(DriverAuthContext);
  if (!ctx) {
    throw new Error("useDriverAuth must be used within DriverAuthProvider");
  }
  return ctx;
}

/** Optional hook when a component may render outside a provider (e.g. shared chrome). */
export function useOptionalAdminAuth(): PortalAuthState | null {
  return useContext(AdminAuthContext);
}

export function useOptionalDriverAuth(): PortalAuthState | null {
  return useContext(DriverAuthContext);
}
