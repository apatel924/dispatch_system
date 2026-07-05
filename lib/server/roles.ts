import type { UserRole } from "@/lib/types/backend";

export const USER_ROLES = ["admin", "dispatcher", "driver"] as const;

export const ADMIN_ROLES: UserRole[] = ["admin", "dispatcher"];
export const STAFF_ROLES: UserRole[] = ["admin", "dispatcher", "driver"];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function hasRole(userRole: UserRole, allowed: readonly UserRole[]): boolean {
  return allowed.includes(userRole);
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "dispatcher";
}
