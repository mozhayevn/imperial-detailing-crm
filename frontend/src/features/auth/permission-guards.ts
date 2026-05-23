import type { AuthSession } from "@/src/types/auth";
import type { RoleCode } from "@/src/types/rbac";
import { hasAnyPermission, hasPermission, hasRoleAtLeast } from "@/src/types/rbac";

export function canAccessByPermission(
  session: AuthSession | null,
  permission: string,
): boolean {
  if (!session) {
    return false;
  }

  if (session.is_super_admin) {
    return true;
  }

  return hasPermission(session.permissions, permission);
}

export function canAccessByAnyPermission(
  session: AuthSession | null,
  permissions: string[],
): boolean {
  if (!session) {
    return false;
  }

  if (session.is_super_admin) {
    return true;
  }

  return hasAnyPermission(session.permissions, permissions);
}

export function canAccessByRole(
  session: AuthSession | null,
  minimumRole: "viewer" | "master" | "manager" | "admin",
): boolean {
  if (!session) {
    return false;
  }

  if (session.is_super_admin) {
    return true;
  }

  return session.roles.some((role: RoleCode) => hasRoleAtLeast(role, minimumRole));
}