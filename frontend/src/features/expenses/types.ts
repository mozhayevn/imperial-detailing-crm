export type ExpensePeriod = "today" | "7d" | "30d" | "all";

export type ExpensePaymentMethod =
  | "cash"
  | "kaspi"
  | "card"
  | "bank_transfer"
  | "other"
  | string;

export type ExpenseCategory = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type BusinessExpense = {
  id: number;

  category_id: number;
  category_name: string | null;

  amount: number;
  expense_date: string;

  title: string;
  description: string | null;
  payment_method: ExpensePaymentMethod | null;

  created_by_user_id: number;
  created_by_user_full_name: string | null;

  updated_by_user_id: number | null;
  updated_by_user_full_name: string | null;

  created_at: string;
  updated_at: string | null;

  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by_user_id: number | null;
  deleted_by_user_full_name: string | null;
};

export type ExpenseCategoryCreatePayload = {
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type ExpenseCategoryUpdatePayload = {
  name?: string;
  code?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export type BusinessExpenseCreatePayload = {
  category_id: number;
  amount: number;
  expense_date: string | null;
  title: string;
  description: string | null;
  payment_method: ExpensePaymentMethod | null;
};

export type BusinessExpenseUpdatePayload = {
  category_id?: number;
  amount?: number;
  expense_date?: string;
  title?: string;
  description?: string | null;
  payment_method?: ExpensePaymentMethod | null;
};

export type BusinessExpenseAuditLog = {
  id: number;
  expense_id: number | null;
  actor_user_id: number;
  actor_user_full_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};