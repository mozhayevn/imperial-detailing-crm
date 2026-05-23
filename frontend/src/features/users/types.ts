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