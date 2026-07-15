/**
 * Shared account-activation policy (client + server safe).
 *
 * Compatibility:
 * - `active === false` → disabled
 * - `active === true` → active
 * - missing / null / undefined → active (legacy accounts)
 * - any other value → fail closed (treat as disabled)
 */

export const ACCOUNT_DISABLED_CODE = "ACCOUNT_DISABLED" as const;

export const ACCOUNT_DISABLED_MESSAGE =
  "This account has been disabled. Contact an administrator." as const;

/**
 * Whether an account is considered active for portal / API access.
 * Only an explicit boolean `false` (or a malformed non-boolean value) disables.
 */
export function isAccountActive(active: unknown): boolean {
  if (active === false) return false;
  if (active === true || active === undefined || active === null) return true;
  return false;
}
