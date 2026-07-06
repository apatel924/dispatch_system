"use client";

import { isUserRole } from "@/lib/server/roles";
import type { UserRole } from "@/lib/types/backend";

const TAB_SESSION_KEY = "qre-tab-session";

export interface TabAuthSession {
  idToken: string;
  role: UserRole;
  expiresAt: number;
  driverId?: string;
}

/** Per-tab auth so admin + driver can be open in separate tabs during local dev. */
export function isTabSessionEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_TAB_SCOPED_AUTH === "true") return true;
  if (process.env.NEXT_PUBLIC_TAB_SCOPED_AUTH === "false") return false;
  return process.env.NODE_ENV === "development";
}

export function getValidTabSession(): TabAuthSession | null {
  if (typeof window === "undefined" || !isTabSessionEnabled()) return null;

  try {
    const raw = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TabAuthSession;
    if (
      !parsed.idToken ||
      !parsed.role ||
      !isUserRole(parsed.role) ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(TAB_SESSION_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveTabSession(session: TabAuthSession): void {
  if (typeof window === "undefined" || !isTabSessionEnabled()) return;
  sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(session));
}

export function clearTabSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TAB_SESSION_KEY);
}
