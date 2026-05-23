import type { RoleCode } from "@/src/types/rbac";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  must_change_password?: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer" | string;
};

export type MyPermissionsResponse = {
  user_id: number;
  full_name: string;
  email: string;
  is_super_admin: boolean;
  roles: RoleCode[];
  permissions: string[];
};

export type AuthSession = {
  user: AuthUser;
  roles: RoleCode[];
  permissions: string[];
  is_super_admin: boolean;
};

export type SessionState = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

export type LoginResponse = {
  access_token: string | null;
  token_type: string | null;
  requires_2fa: boolean;
  challenge_id: number | null;
  method: string | null;
  destination_masked: string | null;
};

export type VerifyTwoFactorRequest = {
  challenge_id: number;
  code: string;
};

export type ResendTwoFactorRequest = {
  challenge_id: number;
};

export type ResendTwoFactorResponse = {
  challenge_id: number;
  method: string;
  destination_masked: string;
};