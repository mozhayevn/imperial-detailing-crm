export type Profile = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  must_change_password: boolean;
  created_at: string;

  privacy_show_phone: boolean;
  privacy_show_email: boolean;
  privacy_show_activity: boolean;
  privacy_show_online_status: boolean;
  privacy_show_order_load: boolean;
  privacy_show_audit_history: boolean;
};

export type ProfileUpdatePayload = {
  full_name?: string | null;
  phone?: string | null;
};

export type ProfilePrivacyUpdatePayload = {
  privacy_show_phone: boolean;
  privacy_show_email: boolean;
  privacy_show_activity: boolean;
  privacy_show_online_status: boolean;
  privacy_show_order_load: boolean;
  privacy_show_audit_history: boolean;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export type UserSession = {
  id: number;
  user_agent: string | null;
  ip_address: string | null;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

export type TwoFactorStatus = {
  enabled: boolean;
  method: string | null;
  destination_masked: string | null;
  email_verified: boolean;
  phone_verified: boolean;
};

export type TwoFactorSendCodePayload = {
  method: "email";
};

export type TwoFactorSendCodeResponse = {
  challenge_id: number;
  method: string;
  destination_masked: string;
};

export type TwoFactorEnablePayload = {
  challenge_id: number;
  code: string;
};

export type TwoFactorDisablePayload = {
  current_password: string;
};