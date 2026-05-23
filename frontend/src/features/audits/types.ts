export type RecentAuditEvent = {
  id: string;
  source: string;
  source_label: string;
  action: string;
  action_label: string;

  actor_user_id: number;
  actor_user_full_name: string | null;

  order_id: number | null;
  payment_id: number | null;
  checklist_item_id: number | null;
  target_user_id: number | null;
  target_user_full_name: string | null;
  role_id: number | null;
  role_name: string | null;

  details: string | null;
  created_at: string;
};