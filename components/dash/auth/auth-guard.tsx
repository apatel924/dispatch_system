"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AUTH_NOT_CONFIGURED_MESSAGE,
  isAuthConfigured,
  requireClientAuthRedirect,
  type AuthPortal,
} from "@/lib/auth/firebase-client";
import {
  useAdminAuth,
  useDriverAuth,
  type PortalAuthState,
} from "@/lib/auth/portal-auth";
import { ADMIN_ROLES } from "@/lib/server/roles";
import type { UserRole } from "@/lib/types/backend";

interface AuthGuardProps {
  children: ReactNode;
  portal: AuthPortal;
  auth: PortalAuthState;
  allowedRoles: readonly UserRole[];
  loginPath: string;
  wrongRoleRedirect?: string;
}

function AuthNotConfiguredPanel() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <AlertTriangle className="h-8 w-8 text-warning" />
      <p className="max-w-md text-sm text-muted-foreground">{AUTH_NOT_CONFIGURED_MESSAGE}</p>
    </div>
  );
}

function AuthCheckingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function AuthGuard({
  children,
  portal,
  auth,
  allowedRoles,
  loginPath,
  wrongRoleRedirect,
}: AuthGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isAuthConfigured()) {
      setChecking(false);
      setAllowed(false);
      return;
    }

    // Never redirect while Firebase is still restoring persisted auth.
    if (!auth.authReady) {
      setChecking(true);
      setAllowed(false);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      setChecking(true);
      const result = await requireClientAuthRedirect(
        portal,
        allowedRoles,
        loginPath,
        wrongRoleRedirect,
      );
      if (cancelled) return;

      if (!result.allowed && result.redirectTo) {
        if (process.env.NODE_ENV === "development") {
          console.info("[auth] Guard redirecting", {
            portal,
            redirectTo: result.redirectTo,
            error: result.error,
          });
        }
        router.replace(result.redirectTo);
        return;
      }

      setAllowed(result.allowed);
      setChecking(false);
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [
    auth.authReady,
    auth.user,
    auth.role,
    portal,
    allowedRoles,
    loginPath,
    wrongRoleRedirect,
    router,
  ]);

  if (!isAuthConfigured()) {
    return <AuthNotConfiguredPanel />;
  }

  if (!auth.authReady || checking || !allowed) {
    return (
      <AuthCheckingPanel
        label={auth.authReady ? "Checking sign-in…" : "Restoring session…"}
      />
    );
  }

  return <>{children}</>;
}

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const auth = useAdminAuth();
  return (
    <AuthGuard
      portal="admin"
      auth={auth}
      allowedRoles={ADMIN_ROLES}
      loginPath="/"
      wrongRoleRedirect="/driver-dashboard"
    >
      {children}
    </AuthGuard>
  );
}

export function DriverAuthGuard({ children }: { children: ReactNode }) {
  const auth = useDriverAuth();
  return (
    <AuthGuard
      portal="driver"
      auth={auth}
      allowedRoles={["driver"]}
      loginPath="/driver-login"
      wrongRoleRedirect="/dashboard"
    >
      {children}
    </AuthGuard>
  );
}
