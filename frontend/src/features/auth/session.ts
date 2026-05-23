import { getCurrentUser, getMyPermissions } from "@/src/features/auth/api";
import type { AuthSession } from "@/src/types/auth";

export async function loadAuthSession(token?: string | null): Promise<AuthSession> {
  const [user, permissionInfo] = await Promise.all([
    getCurrentUser(token),
    getMyPermissions(token),
  ]);

  return {
    user,
    roles: permissionInfo.roles,
    permissions: permissionInfo.permissions,
    is_super_admin: permissionInfo.is_super_admin,
  };
}