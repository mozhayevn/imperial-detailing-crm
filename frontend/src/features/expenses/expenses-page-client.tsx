"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Combobox } from "@/src/components/ui/combobox";
import { DateTimeInput } from "@/src/components/ui/date-time-input";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import {
  createBusinessExpense,
  deleteBusinessExpense,
  getBusinessExpenseAuditLogs,
  getBusinessExpenses,
  getExpenseCategories,
  updateBusinessExpense,
} from "@/src/features/expenses/api";
import type {
  BusinessExpense,
  BusinessExpenseAuditLog,
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpensePeriod,
} from "@/src/features/expenses/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency, formatDateTime } from "@/src/lib/formatters";

type ExpenseFormState = {
  category_id: string;
  amount: string;
  expense_date: string;
  title: string;
  description: string;
  payment_method: ExpensePaymentMethod;
};

const defaultForm: ExpenseFormState = {
  category_id: "",
  amount: "",
  expense_date: "",
  title: "",
  description: "",
  payment_method: "kaspi",
};

const periodOptions: {
  value: ExpensePeriod;
  label: string;
}[] = [
  { value: "today", label: "Сегодня" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "all", label: "Все время" },
];

const paymentMethodOptions: {
  value: ExpensePaymentMethod;
  label: string;
}[] = [
  { value: "kaspi", label: "Kaspi" },
  { value: "cash", label: "Наличные" },
  { value: "card", label: "Карта" },
  { value: "bank_transfer", label: "Банковский перевод" },
  { value: "other", label: "Другое" },
];

function parseAuditDetails(details: string | null) {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details) as {
      expense?: {
        id?: number;
        category_id?: number;
        amount?: number;
        expense_date?: string;
        title?: string;
        description?: string | null;
        payment_method?: string | null;
      };
      before?: {
        category_id?: number;
        amount?: number;
        expense_date?: string;
        title?: string;
        description?: string | null;
        payment_method?: string | null;
      };
      after?: {
        category_id?: number;
        amount?: number;
        expense_date?: string;
        title?: string;
        description?: string | null;
        payment_method?: string | null;
      };
    };
  } catch {
    return null;
  }
}

function getCategoryNameById(
  categories: ExpenseCategory[],
  categoryId: number | undefined,
) {
  if (!categoryId) {
    return "Без категории";
  }

  return (
    categories.find((category) => category.id === categoryId)?.name ??
    `Категория #${categoryId}`
  );
}

function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    expense_created: "Расход создан",
    expense_updated: "Расход изменен",
    expense_deleted: "Расход удален",
  };

  return labels[action] ?? action;
}

function getAuditActionTone(action: string) {
  if (action === "expense_created") {
    return "success";
  }

  if (action === "expense_updated") {
    return "warning";
  }

  if (action === "expense_deleted") {
    return "danger";
  }

  return "muted";
}

function getPaymentMethodLabel(method: string | null) {
  if (!method) {
    return "Не указан";
  }

  return (
    paymentMethodOptions.find((item) => item.value === method)?.label ?? method
  );
}

function toApiDateTime(value: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function parseAmount(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

function ExpenseAuditLogCard({
  log,
  categories,
}: {
  log: BusinessExpenseAuditLog;
  categories: ExpenseCategory[];
}) {
  const details = parseAuditDetails(log.details);

  const expense = details?.expense;
  const before = details?.before;
  const after = details?.after;

  const title = after?.title ?? expense?.title ?? before?.title ?? "Расход";
  const amount = after?.amount ?? expense?.amount ?? before?.amount;
  const categoryId =
    after?.category_id ?? expense?.category_id ?? before?.category_id;
  const paymentMethod =
    after?.payment_method ?? expense?.payment_method ?? before?.payment_method;

  return (
    <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={getAuditActionTone(log.action)}>
              {getAuditActionLabel(log.action)}
            </Badge>

            <span className="text-sm font-semibold text-white">
              {title}
            </span>

            {amount !== undefined ? (
              <Badge tone="muted">{formatCurrency(amount)}</Badge>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="primary">
              {getCategoryNameById(categories, categoryId)}
            </Badge>

            <Badge tone="muted">
              {getPaymentMethodLabel(paymentMethod ?? null)}
            </Badge>
          </div>

          {before && after ? (
            <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 text-xs leading-5 text-[hsl(var(--muted))]">
              <div className="font-semibold text-[hsl(var(--muted-foreground))]">
                Изменения
              </div>

              {before.amount !== after.amount ? (
                <div className="mt-2">
                  Сумма: {formatCurrency(before.amount ?? 0)} →{" "}
                  {formatCurrency(after.amount ?? 0)}
                </div>
              ) : null}

              {before.title !== after.title ? (
                <div className="mt-2">
                  Название: {before.title ?? "—"} → {after.title ?? "—"}
                </div>
              ) : null}

              {before.category_id !== after.category_id ? (
                <div className="mt-2">
                  Категория:{" "}
                  {getCategoryNameById(categories, before.category_id)} →{" "}
                  {getCategoryNameById(categories, after.category_id)}
                </div>
              ) : null}

              {before.payment_method !== after.payment_method ? (
                <div className="mt-2">
                  Способ оплаты:{" "}
                  {getPaymentMethodLabel(before.payment_method ?? null)} →{" "}
                  {getPaymentMethodLabel(after.payment_method ?? null)}
                </div>
              ) : null}

              {before.description !== after.description ? (
                <div className="mt-2">
                  Описание изменено
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 text-sm leading-6 text-[hsl(var(--muted))]">
            Действие выполнил:{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              {log.actor_user_full_name ??
                `Пользователь #${log.actor_user_id}`}
            </span>
          </div>
        </div>

        <div className="text-xs text-[hsl(var(--muted))]">
          {formatDateTime(log.created_at)}
        </div>
      </div>
    </div>
  );
}

export function ExpensesPageClient() {
  const { session } = useAuth();

  const [period, setPeriod] = useState<ExpensePeriod>("30d");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [auditLogs, setAuditLogs] = useState<BusinessExpenseAuditLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(
    null,
  );

  const [form, setForm] = useState<ExpenseFormState>(defaultForm);
  const [error, setError] = useState<string | null>(null);

  const canReadExpenses = canAccessByPermission(session, "finance.read");
  const canManageExpenses = canAccessByPermission(session, "finance.manage");

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        label: category.name,
        value: String(category.id),
      })),
    [categories],
  );

  const categoryFilterOptions = useMemo(
    () =>
      categories.map((category) => ({
        label: category.name,
        value: String(category.id),
      })),
    [categories],
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  const expensesByCategory = useMemo(() => {
    const totals = new Map<
      number,
      {
        categoryName: string;
        amount: number;
        count: number;
      }
    >();

    for (const expense of expenses) {
      const current = totals.get(expense.category_id) ?? {
        categoryName: expense.category_name ?? "Без категории",
        amount: 0,
        count: 0,
      };

      current.amount += expense.amount;
      current.count += 1;

      totals.set(expense.category_id, current);
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  async function loadExpenses(nextPeriod: ExpensePeriod = period) {
    if (!canReadExpenses) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const categoryId = selectedCategoryId ? Number(selectedCategoryId) : null;

      const [categoriesResult, expensesResult, auditLogsResult] =
        await Promise.all([
          getExpenseCategories(false),
          getBusinessExpenses(nextPeriod, categoryId),
          getBusinessExpenseAuditLogs(),
        ]);

      setCategories(categoriesResult);
      setExpenses(expensesResult);
      setAuditLogs(auditLogsResult);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialExpenses() {
      if (!canReadExpenses) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const categoryId = selectedCategoryId ? Number(selectedCategoryId) : null;

        const [categoriesResult, expensesResult, auditLogsResult] =
          await Promise.all([
            getExpenseCategories(false),
            getBusinessExpenses(period, categoryId),
            getBusinessExpenseAuditLogs(),
          ]);

        if (!isMounted) {
          return;
        }

        setCategories(categoriesResult);
        setExpenses(expensesResult);
        setAuditLogs(auditLogsResult);
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialExpenses();

    return () => {
      isMounted = false;
    };
  }, [canReadExpenses, period, selectedCategoryId]);

  function updateForm(patch: Partial<ExpenseFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function resetForm() {
    setForm(defaultForm);
    setEditingExpenseId(null);
    setIsFormOpen(false);
    setError(null);
  }

  function startCreate() {
    setForm(defaultForm);
    setEditingExpenseId(null);
    setIsFormOpen(true);
    setError(null);
  }

  function startEdit(expense: BusinessExpense) {
    setForm({
      category_id: String(expense.category_id),
      amount: String(expense.amount),
      expense_date: expense.expense_date
        ? expense.expense_date.slice(0, 16)
        : "",
      title: expense.title,
      description: expense.description ?? "",
      payment_method: expense.payment_method ?? "kaspi",
    });
    setEditingExpenseId(expense.id);
    setIsFormOpen(true);
    setError(null);
  }

  async function handleSubmit() {
    const categoryId = Number(form.category_id);
    const amount = parseAmount(form.amount);
    const title = form.title.trim();

    if (!categoryId) {
      setError("Выберите категорию расхода.");
      return;
    }

    if (amount === null) {
      setError("Укажите корректную сумму расхода.");
      return;
    }

    if (!title) {
      setError("Укажите название расхода.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingExpenseId) {
        await updateBusinessExpense(editingExpenseId, {
          category_id: categoryId,
          amount,
          expense_date: toApiDateTime(form.expense_date) ?? undefined,
          title,
          description: form.description.trim() || null,
          payment_method: form.payment_method || null,
        });
      } else {
        await createBusinessExpense({
          category_id: categoryId,
          amount,
          expense_date: toApiDateTime(form.expense_date),
          title,
          description: form.description.trim() || null,
          payment_method: form.payment_method || null,
        });
      }

      resetForm();
      await loadExpenses();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(expenseId: number) {
    setDeletingExpenseId(expenseId);
    setError(null);

    try {
      await deleteBusinessExpense(expenseId);
      await loadExpenses();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingExpenseId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Расходы"
        title="Расходы бизнеса"
        description="Учет аренды, рекламы, коммунальных платежей, закупок и других расходов."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageExpenses ? (
              <Button type="button" onClick={startCreate}>
                Добавить расход
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void loadExpenses()}
            >
              Обновить
            </Button>
          </div>
        }
      />

      {!canReadExpenses ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к расходам
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для просмотра расходов нужно право{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              finance.read
            </span>
            .
          </div>
        </div>
      ) : null}

      {canReadExpenses ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Фильтры</CardTitle>
              <CardDescription>
                Выберите период и категорию расходов.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:items-end">
                <div>
                  <div className="mb-2 text-xs font-medium text-[hsl(var(--muted))]">
                    Период
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {periodOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          period === option.value ? "primary" : "secondary"
                        }
                        onClick={() => setPeriod(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Combobox
                  label="Категория"
                  placeholder="Все категории"
                  value={selectedCategoryId}
                  options={categoryFilterOptions}
                  onChange={(value) => setSelectedCategoryId(String(value))}
                />
              </div>
            </CardContent>
          </Card>

          {error ? (
            <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-5 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          {isFormOpen ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingExpenseId ? "Редактировать расход" : "Новый расход"}
                </CardTitle>
                <CardDescription>
                  Заполните сумму, категорию, дату и способ оплаты.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {categories.length === 0 ? (
                  <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
                    Сначала создайте хотя бы одну категорию расходов через
                    backend или админский интерфейс.
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Combobox
                    label="Категория"
                    placeholder="Выберите категорию"
                    value={form.category_id}
                    options={categoryOptions}
                    onChange={(value) =>
                      updateForm({
                        category_id: String(value),
                      })
                    }
                  />

                  <Input
                    label="Сумма"
                    type="number"
                    min={1}
                    value={form.amount}
                    onChange={(event) =>
                      updateForm({
                        amount: event.target.value,
                      })
                    }
                  />

                  <Input
                    label="Название"
                    placeholder="Например: аренда, реклама, коммунальные"
                    value={form.title}
                    onChange={(event) =>
                      updateForm({
                        title: event.target.value,
                      })
                    }
                  />

                  <Combobox
                    label="Способ оплаты"
                    placeholder="Выберите способ оплаты"
                    value={form.payment_method}
                    options={paymentMethodOptions}
                    onChange={(value) =>
                      updateForm({
                        payment_method: String(value) as ExpensePaymentMethod,
                      })
                    }
                  />
                </div>

                <div className="mt-4">
                  <DateTimeInput
                    label="Дата расхода"
                    value={form.expense_date}
                    onChange={(value: string) =>
                      updateForm({
                        expense_date: value,
                      })
                    }
                  />
                </div>

                <div className="mt-4">
                  <Textarea
                    label="Описание"
                    placeholder="Комментарий или детали расхода"
                    value={form.description}
                    onChange={(event) =>
                      updateForm({
                        description: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={resetForm}
                  >
                    Отмена
                  </Button>

                  <Button
                    type="button"
                    disabled={submitting || categories.length === 0}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? "Сохраняем..." : "Сохранить"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Расходы по категориям</CardTitle>
                  <CardDescription>
                    Распределение расходов с учетом выбранного периода и
                    категории.
                  </CardDescription>
                </div>

                <Badge tone={totalExpenses > 0 ? "warning" : "muted"}>
                  Всего: {formatCurrency(totalExpenses)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {expensesByCategory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Пока нет данных для распределения по категориям.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {expensesByCategory.map((item) => (
                    <div
                      key={item.categoryName}
                      className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20"
                    >
                      <div className="text-xs text-[hsl(var(--muted))]">
                        {item.categoryName}
                      </div>

                      <div className="mt-3 text-2xl font-semibold text-white">
                        {formatCurrency(item.amount)}
                      </div>

                      <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                        Количество расходов: {item.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Список расходов</CardTitle>
                  <CardDescription>
                    Расходы бизнеса с учетом выбранного периода и категории.
                  </CardDescription>
                </div>

                <Badge tone={totalExpenses > 0 ? "warning" : "muted"}>
                  Итого: {formatCurrency(totalExpenses)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем расходы...
                </div>
              ) : null}

              {!isLoading && expenses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  За выбранный период расходов пока нет.
                </div>
              ) : null}

              {!isLoading && expenses.length > 0 ? (
                <div className="space-y-3">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-white">
                              {expense.title}
                            </div>

                            <Badge tone="primary">
                              {expense.category_name ?? "Без категории"}
                            </Badge>

                            <Badge tone="muted">
                              {getPaymentMethodLabel(expense.payment_method)}
                            </Badge>
                          </div>

                          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                            {expense.description || "Без описания"}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[hsl(var(--muted))]">
                            <span>
                              Дата расхода:{" "}
                              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                                {formatDateTime(expense.expense_date)}
                              </span>
                            </span>

                            <span>
                              Создал:{" "}
                              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                                {expense.created_by_user_full_name ??
                                  `Пользователь #${expense.created_by_user_id}`}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 lg:items-end">
                          <div className="text-2xl font-semibold tracking-tight text-white">
                            {formatCurrency(expense.amount)}
                          </div>

                          {canManageExpenses ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => startEdit(expense)}
                              >
                                Изменить
                              </Button>

                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                disabled={deletingExpenseId === expense.id}
                                onClick={() => void handleDelete(expense.id)}
                              >
                                {deletingExpenseId === expense.id
                                  ? "Удаляем..."
                                  : "Удалить"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>История изменений</CardTitle>
                  <CardDescription>
                    Последние действия по расходам бизнеса.
                  </CardDescription>
                </div>

                <Badge tone={auditLogs.length > 0 ? "primary" : "muted"}>
                  Записей: {auditLogs.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  История изменений пока пустая.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.slice(0, 20).map((log) => (
                    <ExpenseAuditLogCard
                      key={log.id}
                      log={log}
                      categories={categories}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}