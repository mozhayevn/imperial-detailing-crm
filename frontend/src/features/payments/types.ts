export type PaymentMethod =
  | "cash"
  | "kaspi"
  | "card"
  | "bank_transfer"
  | "other"
  | string;

export type PaymentStatus =
  | "completed"
  | "canceled"
  | "refunded"
  | string;

export type PaymentSummaryStatus =
  | "unpriced"
  | "unpaid"
  | "partial"
  | "paid"
  | "overpaid"
  | string;

export type Payment = {
  id: number;
  order_id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  comment: string | null;

  paid_at: string;
  created_at: string;

  created_by_user_id: number;
  created_by_user_full_name: string | null;

  canceled_at: string | null;
  canceled_by_user_id: number | null;
  canceled_by_user_full_name: string | null;
  cancel_reason: string | null;
};

export type PaymentCreatePayload = {
  amount: number;
  method: PaymentMethod;
  paid_at: string | null;
  comment: string | null;
};

export type PaymentCancelPayload = {
  reason: string;
};

export type PaymentSummary = {
  order_id: number;
  total_price: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentSummaryStatus;
};

export type PaymentAuditLog = {
  id: number;
  order_id: number;
  payment_id: number | null;
  actor_user_id: number;
  actor_user_full_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};

export type PaymentFormValues = {
  amount: string;
  method: PaymentMethod;
  paid_at: string;
  comment: string;
};

export type PaymentCancelFormValues = {
  reason: string;
};