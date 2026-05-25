export type SecurityAuditLog = {
  id: number;

  actor_user_id: number | null;
  actor_user_full_name: string | null;

  target_user_id: number | null;
  target_user_full_name: string | null;

  action: string;
  details: string | null;

  ip_address: string | null;
  user_agent: string | null;

  created_at: string;
};