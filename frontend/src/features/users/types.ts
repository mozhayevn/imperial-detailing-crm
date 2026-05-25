export type UserListItem = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  must_change_password: boolean;
  created_at: string;
};

export type UserRolesResponse = {
  user_id: number;
  full_name: string;
  roles: string[];
};

export type UserWithRoles = UserListItem & {
  roles: string[];
};

export type UserPublicProfile = {
  id: number;
  full_name: string;
  avatar_url: string | null;

  is_active: boolean;
  is_super_admin: boolean;
  roles: string[];

  email: string | null;
  phone: string | null;

  can_view_full_profile: boolean;

  privacy_show_phone: boolean;
  privacy_show_email: boolean;
  privacy_show_activity: boolean;
  privacy_show_online_status: boolean;
  privacy_show_order_load: boolean;
  privacy_show_audit_history: boolean;

  created_at: string;
};