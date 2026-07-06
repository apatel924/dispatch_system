"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AUTH_NOT_CONFIGURED_MESSAGE,
  isAuthConfigured,
  requireClientAuthRedirect,
  subscribeToAuthState,
} from "@/lib/auth/firebase-client";
import { ADMIN_ROLES } from "@/lib/server/roles";
import type { UserRole } from "@/lib/types/backend";

interface AuthGuardProps {
  children: ReactNode;
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

export function AuthGuard({
  children,
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

    let cancelled = false;

    const verify = async () => {
      setChecking(true);
      const result = await requireClientAuthRedirect(
        allowedRoles,
        loginPath,
        wrongRoleRedirect,
      );
      if (cancelled) return;

      if (!result.allowed && result.redirectTo) {
        router.replace(result.redirectTo);
        return;
      }

      setAllowed(result.allowed);
      setChecking(false);
    };

    verify();
    const unsubscribe = subscribeToAuthState(() => {
      verify();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [allowedRoles, loginPath, wrongRoleRedirect, router]);

  if (!isAuthConfigured()) {
    return <AuthNotConfiguredPanel />;
  }

  if (checking || !allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Checking sign-in…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard
      allowedRoles={ADMIN_ROLES}
      loginPath="/"
      wrongRoleRedirect="/driver-dashboard"
    >
      {children}
    </AuthGuard>
  );
}

export function DriverAuthGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard
      allowedRoles={["driver"]}
      loginPath="/driver-login"
      wrongRoleRedirect="/dashboard"
    >
      {children}
    </AuthGuard>
  );
}
