export type OrderChecklistItemStatus = "pending" | "done" | string;

export type OrderChecklistItem = {
  id: number;
  order_id: number;

  key: string | null;
  title: string;
  description: string | null;

  status: OrderChecklistItemStatus;
  is_required: boolean;
  sort_order: number;

  comment: string | null;

  completed_at: string | null;
  completed_by_user_id: number | null;
  completed_by_user_full_name: string | null;

  created_at: string;
  updated_at: string;
};

export type OrderChecklistItemCreatePayload = {
  title: string;
  description: string | null;
  key: string | null;
  is_required: boolean;
  sort_order: number;
  comment: string | null;
};

export type OrderChecklistItemUpdatePayload = {
  title?: string | null;
  description?: string | null;
  is_required?: boolean;
  sort_order?: number;
  comment?: string | null;
};

export type OrderChecklistItemCompletePayload = {
  comment: string | null;
};

export type OrderChecklistAuditLog = {
  id: number;
  order_id: number;
  checklist_item_id: number | null;
  actor_user_id: number;
  actor_user_full_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};