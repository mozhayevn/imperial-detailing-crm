export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  must_change_password: boolean;
  created_at: string;
};

export type AdminRole = {
  id: number;
  name: string;
  description: string | null;
  parent_role_id: number | null;
};

export type AdminPermission = {
  id: number;
  code: string;
  description: string | null;
};

export type AdminUserCreatePayload = {
  full_name: string;
  email: string;
  phone?: string | null;
  password: string;
  is_super_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  role_ids: number[];
};

export type AdminUserRoles = {
  user_id: number;
  full_name: string;
  roles: string[];
};

export type AdminUserPermissions = {
  user_id: number;
  full_name: string;
  email: string;
  is_super_admin: boolean;
  roles: string[];
  permissions: string[];
};

export type AdminUserRoleAssignPayload = {
  user_id: number;
  role_id: number;
};

export type AdminUserRoleAuditLog = {
  id: number;
  actor_user_id: number;
  actor_user_full_name: string | null;
  target_user_id: number;
  target_user_full_name: string | null;
  role_id: number | null;
  role_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};

export type AdminRolePermissions = {
  role_id: number;
  role_name: string;
  parent_role_id: number | null;
  parent_role_name: string | null;
  direct_permissions: string[];
  inherited_permissions: string[];
  all_permissions: string[];
};