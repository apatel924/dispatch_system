"use client";

import type { ReactNode } from "react";
import {
  AdminAuthProvider,
  DriverAuthProvider,
} from "@/lib/auth/portal-auth";

/**
 * Mounts both portal auth providers once for the whole app so:
 * - Firebase can restore admin + driver sessions independently
 * - Route changes do not remount auth observers / re-flash loading
 */
export function PortalAuthProviders({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <DriverAuthProvider>{children}</DriverAuthProvider>
    </AdminAuthProvider>
  );
}
