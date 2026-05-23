import { apiRequest } from "@/src/lib/api/client";
import type {
  AdminPermission,
  AdminRole,
  AdminRolePermissions,
  AdminUser,
  AdminUserCreatePayload,
  AdminUserPermissions,
  AdminUserRoleAssignPayload,
  AdminUserRoleAuditLog,
  AdminUserRoles,
} from "@/src/features/admin/types";

export async function getAdminUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/users/", {
    method: "GET",
  });
}

export async function createAdminUser(
  payload: AdminUserCreatePayload,
): Promise<AdminUser> {
  return apiRequest<AdminUser>("/users/", {
    method: "POST",
    body: payload,
  });
}

export async function getAdminUserRoles(
  userId: number,
): Promise<AdminUserRoles> {
  return apiRequest<AdminUserRoles>(`/users/${userId}/roles`, {
    method: "GET",
  });
}

export async function getAdminUserPermissions(
  userId: number,
): Promise<AdminUserPermissions> {
  return apiRequest<AdminUserPermissions>(`/users/${userId}/permissions`, {
    method: "GET",
  });
}

export async function getAdminUserAuditLogs(
  userId: number,
): Promise<AdminUserRoleAuditLog[]> {
  return apiRequest<AdminUserRoleAuditLog[]>(`/users/${userId}/audit-logs`, {
    method: "GET",
  });
}

export async function assignRoleToAdminUser(
  payload: AdminUserRoleAssignPayload,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/users/assign-role", {
    method: "POST",
    body: payload,
  });
}

export async function removeRoleFromAdminUser(
  userId: number,
  roleId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/users/${userId}/roles/${roleId}`, {
    method: "DELETE",
  });
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  return apiRequest<AdminRole[]>("/roles/", {
    method: "GET",
  });
}

export async function getAdminPermissions(): Promise<AdminPermission[]> {
  return apiRequest<AdminPermission[]>("/roles/permissions", {
    method: "GET",
  });
}

export async function getAdminRolePermissions(
  roleId: number,
): Promise<AdminRolePermissions> {
  return apiRequest<AdminRolePermissions>(`/roles/${roleId}/permissions`, {
    method: "GET",
  });
}