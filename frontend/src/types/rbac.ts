export type RoleCode =
  | "viewer"
  | "master"
  | "manager"
  | "admin"
  | "super_admin"
  | string;

export const roleHierarchy: Record<string, number> = {
  viewer: 10,
  master: 20,
  manager: 30,
  admin: 40,
  super_admin: 100,
};

export function hasRoleAtLeast(
  role: RoleCode | undefined,
  minimumRole: "viewer" | "master" | "manager" | "admin",
): boolean {
  if (!role) {
    return false;
  }

  if (role === "super_admin") {
    return true;
  }

  return (roleHierarchy[role] ?? 0) >= roleHierarchy[minimumRole];
}

export function hasPermission(
  permissions: string[] | undefined,
  permission: string,
): boolean {
  return Boolean(permissions?.includes(permission));
}

export function hasAnyPermission(
  permissions: string[] | undefined,
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.some((permission) =>
    permissions?.includes(permission),
  );
}