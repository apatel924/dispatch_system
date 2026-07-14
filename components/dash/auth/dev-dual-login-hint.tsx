"use client";

/** Shown on both login portals — dual sessions are first-class via named Auth apps. */
export function DualPortalHint() {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <p className="mt-4 rounded-lg border border-info/30 bg-info-soft/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <span className="font-semibold text-foreground">Admin + driver in the same browser?</span>{" "}
      Each portal keeps its own Firebase Auth session. Sign in on this page for this role only —
      signing out here will not sign out the other portal.
    </p>
  );
}

/** @deprecated Use DualPortalHint */
export function DevDualLoginHint() {
  return <DualPortalHint />;
}
