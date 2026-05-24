import { apiRequest } from "@/src/lib/api/client";
import type {
  BusinessExpense,
  BusinessExpenseAuditLog,
  BusinessExpenseCreatePayload,
  BusinessExpenseUpdatePayload,
  ExpenseCategory,
  ExpenseCategoryCreatePayload,
  ExpenseCategoryUpdatePayload,
  ExpensePeriod,
} from "@/src/features/expenses/types";

export async function getExpenseCategories(
  includeInactive = false,
): Promise<ExpenseCategory[]> {
  const searchParams = new URLSearchParams();

  searchParams.set("include_inactive", String(includeInactive));

  return apiRequest<ExpenseCategory[]>(
    `/expenses/categories?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function createExpenseCategory(
  payload: ExpenseCategoryCreatePayload,
): Promise<ExpenseCategory> {
  return apiRequest<ExpenseCategory>("/expenses/categories", {
    method: "POST",
    body: payload,
  });
}

export async function updateExpenseCategory(
  categoryId: number,
  payload: ExpenseCategoryUpdatePayload,
): Promise<ExpenseCategory> {
  return apiRequest<ExpenseCategory>(`/expenses/categories/${categoryId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getBusinessExpenses(
  period: ExpensePeriod = "30d",
  categoryId?: number | null,
): Promise<BusinessExpense[]> {
  const searchParams = new URLSearchParams();

  searchParams.set("period", period);

  if (categoryId) {
    searchParams.set("category_id", String(categoryId));
  }

  return apiRequest<BusinessExpense[]>(
    `/expenses?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function createBusinessExpense(
  payload: BusinessExpenseCreatePayload,
): Promise<BusinessExpense> {
  return apiRequest<BusinessExpense>("/expenses", {
    method: "POST",
    body: payload,
  });
}

export async function updateBusinessExpense(
  expenseId: number,
  payload: BusinessExpenseUpdatePayload,
): Promise<BusinessExpense> {
  return apiRequest<BusinessExpense>(`/expenses/${expenseId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteBusinessExpense(
  expenseId: number,
): Promise<BusinessExpense> {
  return apiRequest<BusinessExpense>(`/expenses/${expenseId}`, {
    method: "DELETE",
  });
}

export async function getBusinessExpenseAuditLogs(
  expenseId?: number | null,
): Promise<BusinessExpenseAuditLog[]> {
  const searchParams = new URLSearchParams();

  if (expenseId) {
    searchParams.set("expense_id", String(expenseId));
  }

  return apiRequest<BusinessExpenseAuditLog[]>(
    `/expenses/audit-logs?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}