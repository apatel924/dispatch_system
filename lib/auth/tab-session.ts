/**
 * @deprecated Tab-scoped sessionStorage auth is no longer used.
 * Admin and driver portals now use separate named Firebase Auth instances
 * (`quickrun-admin-auth` / `quickrun-driver-auth`) with browser local persistence.
 * Kept briefly so any stale imports fail loudly at typecheck rather than silently.
 */

export function isTabSessionEnabled(): boolean {
  return false;
}

export function getValidTabSession(): null {
  return null;
}

export function saveTabSession(_session: unknown): void {
  // no-op — named Auth apps replaced tab sessionStorage
}

export function clearTabSession(): void {
  // no-op
}
