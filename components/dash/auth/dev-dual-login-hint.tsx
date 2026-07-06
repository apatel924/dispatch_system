"use client";

import { isTabSessionEnabled } from "@/lib/auth/tab-session";

export function DevDualLoginHint() {
  if (!isTabSessionEnabled()) return null;

  return (
    <p className="mt-4 rounded-lg border border-info/30 bg-info-soft/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <span className="font-semibold text-foreground">Testing admin + driver together?</span>{" "}
      Sign in separately in each browser tab — this tab keeps its own session, so you can
      have admin open in one tab and driver in another without getting kicked out.
    </p>
  );
}
