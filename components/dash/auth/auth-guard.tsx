"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
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

export function AuthGuard({
  children,
  allowedRoles,
  loginPath,
  wrongRoleRedirect,
}: AuthGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(isAuthConfigured());
  const [allowed, setAllowed] = useState(!isAuthConfigured());

  useEffect(() => {
    if (!isAuthConfigured()) {
      setAllowed(true);
      setChecking(false);
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
    return <>{children}</>;
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
