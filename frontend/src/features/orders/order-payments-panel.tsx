"use client";

import { Combobox } from "@/src/components/ui/combobox";
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
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency, formatDateTime } from "@/src/lib/formatters";
import {
  cancelPayment,
  createOrderPayment,
  getOrderPaymentSummary,
  getOrderPayments,
} from "@/src/features/payments/api";
import type {
  Payment,
  PaymentMethod,
  PaymentSummary,
} from "@/src/features/payments/types";
import type { Order } from "@/src/features/orders/types";
import { DateTimeInput } from "@/src/components/ui/date-time-input";

type OrderPaymentsPanelProps = {
  order: Order;
  canReadPayments: boolean;
  canCreatePayments: boolean;
  canCancelPayments: boolean;
  onChanged: () => void;
};

type PaymentFormState = {
  amount: string;
  method: PaymentMethod;
  paid_at: string;
  comment: string;
};

const defaultPaymentForm: PaymentFormState = {
  amount: "",
  method: "kaspi",
  paid_at: "",
  comment: "",
};

const paymentMethods: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "kaspi", label: "Kaspi" },
  { value: "cash", label: "Наличные" },
  { value: "card", label: "Карта" },
  { value: "bank_transfer", label: "Банковский перевод" },
  { value: "other", label: "Другое" },
];

const paymentMethodOptions = paymentMethods.map((method) => ({
  label: method.label,
  value: method.value,
}));

function getPaymentMethodLabel(method: string) {
  const found = paymentMethods.find((item) => item.value === method);

  return found?.label ?? method;
}

function getPaymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "Проведен",
    canceled: "Отменен",
    refunded: "Возврат",
  };

  return labels[status] ?? status;
}

function getPaymentStatusTone(status: string) {
  if (status === "completed") {
    return "success";
  }

  if (status === "canceled") {
    return "danger";
  }

  if (status === "refunded") {
    return "warning";
  }

  return "muted";
}

function getSummaryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    unpriced: "Pricing не рассчитан",
    unpaid: "Не оплачено",
    partial: "Частично оплачено",
    paid: "Оплачено",
    overpaid: "Переплата",
  };

  return labels[status] ?? status;
}

function getSummaryStatusTone(status: string) {
  if (status === "paid") {
    return "success";
  }

  if (status === "partial") {
    return "warning";
  }

  if (status === "overpaid") {
    return "danger";
  }

  return "muted";
}

function toApiDateTime(value: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function parsePaymentAmount(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

export function OrderPaymentsPanel({
  order,
  canReadPayments,
  canCreatePayments,
  canCancelPayments,
  onChanged,
}: OrderPaymentsPanelProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(defaultPaymentForm);

  const [cancelingPaymentId, setCancelingPaymentId] = useState<number | null>(
    null,
  );
  const [cancelReasonByPaymentId, setCancelReasonByPaymentId] = useState<
    Record<number, string>
  >({});

  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingCancelId, setSubmittingCancelId] = useState<number | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  const isCanceled = order.status === "canceled";
  const canCreatePaymentForOrder =
    canCreatePayments && order.pricing_locked && !isCanceled;

  const completedPayments = useMemo(
    () => payments.filter((payment) => payment.status === "completed"),
    [payments],
  );

  const canceledPayments = useMemo(
    () => payments.filter((payment) => payment.status === "canceled"),
    [payments],
  );

  const visibleCompletedPayments = completedPayments.slice(0, 2);
  const hiddenCompletedPaymentsCount =
    completedPayments.length - visibleCompletedPayments.length;

  const visibleCanceledPayments = canceledPayments.slice(0, 2);
  const hiddenCanceledPaymentsCount =
    canceledPayments.length - visibleCanceledPayments.length;

  async function loadPayments() {
    if (!canReadPayments) {
      setPayments([]);
      setSummary(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [paymentsResult, summaryResult] = await Promise.all([
        getOrderPayments(order.id),
        getOrderPaymentSummary(order.id),
      ]);

      setPayments(paymentsResult);
      setSummary(summaryResult);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
  let isMounted = true;

  async function loadInitialPayments() {
    try {
      if (!canReadPayments) {
        if (isMounted) {
          setPayments([]);
          setSummary(null);
        }

        return;
      }

      const [paymentsResult, summaryResult] = await Promise.all([
        getOrderPayments(order.id),
        getOrderPaymentSummary(order.id),
      ]);

      if (isMounted) {
        setPayments(paymentsResult);
        setSummary(summaryResult);
      }
    } catch (loadError) {
      if (isMounted) {
        setError(getApiErrorMessage(loadError));
      }
    }
  }

  void loadInitialPayments();

  return () => {
    isMounted = false;
  };
}, [order.id, canReadPayments, order.total_price, order.pricing_locked]);

  function updateForm(patch: Partial<PaymentFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  async function handleCreatePayment() {
    const amount = parsePaymentAmount(form.amount);

    if (amount === null) {
      setError("Укажите корректную сумму оплаты");
      return;
    }

    if (!summary) {
      setError("Сначала загрузите payment summary.");
      return;
    }

    if (summary.payment_status === "paid") {
      setError("Заказ уже полностью оплачен.");
      return;
    }

    if (summary.payment_status === "overpaid") {
      setError("По заказу уже есть переплата. Новые оплаты недоступны.");
      return;
    }

    if (amount > summary.remaining_amount) {
      setError(
        `Сумма оплаты превышает остаток. Осталось оплатить: ${formatCurrency(
          summary.remaining_amount,
        )}.`,
      );
      return;
    }

    if (!form.method) {
      setError("Выберите способ оплаты");
      return;
    }

    setSubmittingPayment(true);
    setError(null);

    try {
      await createOrderPayment(order.id, {
        amount,
        method: form.method,
        paid_at: toApiDateTime(form.paid_at),
        comment: form.comment.trim() || null,
      });

      setForm(defaultPaymentForm);
      setIsFormOpen(false);

      await loadPayments();
      onChanged();
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleCancelPayment(paymentId: number) {
    const reason = cancelReasonByPaymentId[paymentId]?.trim();

    if (!reason) {
      setError("Укажите причину отмены платежа");
      return;
    }

    setSubmittingCancelId(paymentId);
    setError(null);

    try {
      await cancelPayment(paymentId, {
        reason,
      });

      setCancelingPaymentId(null);
      setCancelReasonByPaymentId((current) => ({
        ...current,
        [paymentId]: "",
      }));

      await loadPayments();
      onChanged();
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError));
    } finally {
      setSubmittingCancelId(null);
    }
  }

  const totalPrice = summary?.total_price ?? order.total_price;
  const paidAmount = summary?.paid_amount ?? 0;
  const remainingAmount = summary?.remaining_amount ?? totalPrice;
  const paymentStatus = summary?.payment_status ?? "unpaid";

  const isFullyPaid = paymentStatus === "paid";
  const isOverpaid = paymentStatus === "overpaid";
  const canSubmitPayment =
    canCreatePaymentForOrder &&
    !isFullyPaid &&
    !isOverpaid &&
    remainingAmount > 0;

  return (
    <Card className="self-start">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Оплата заказа</CardTitle>
            <CardDescription>
              Оплаты, остаток и финансовый статус заказа.
            </CardDescription>
          </div>

          <Badge tone={getSummaryStatusTone(paymentStatus)}>
            {getSummaryStatusLabel(paymentStatus)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {!canReadPayments ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            У вас нет доступа к оплатам. Нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              payments.read
            </span>
            .
          </div>
        ) : null}

        {isCanceled ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            Заказ отменен. Добавление оплат недоступно.
          </div>
        ) : null}

        {!order.pricing_locked ? (
          <div className="mb-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
            Сначала нужно применить и зафиксировать pricing. После этого можно
            принимать оплату.
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
            <div className="text-xs text-[hsl(var(--muted))]">Итого</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {formatCurrency(totalPrice)}
            </div>
          </div>

          <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-3">
            <div className="text-xs text-[rgb(94_234_212)]">Оплачено</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {formatCurrency(paidAmount)}
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
            <div className="text-xs text-[hsl(var(--muted))]">Остаток</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {formatCurrency(remainingAmount)}
            </div>
          </div>
        </div>

        {paymentStatus === "overpaid" ? (
          <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            По заказу есть переплата. Проверьте историю оплат.
          </div>
        ) : null}

        {isFullyPaid ? (
          <div className="mt-4 rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4 text-sm leading-6 text-[rgb(94_234_212)]">
            Заказ полностью оплачен. Новые оплаты недоступны.
          </div>
        ) : null}

        {canReadPayments ? (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-4">
              <div>
                <div className="text-sm font-semibold text-white">Оплата</div>
                <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                  Добавление оплаты доступно после фиксации pricing.
                </div>
              </div>

              {canSubmitPayment ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsFormOpen((current) => !current)}
                >
                  {isFormOpen ? "Скрыть форму" : "Добавить оплату"}
                </Button>
              ) : null}
            </div>

            {isFormOpen && canSubmitPayment ? (
              <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Сумма"
                    type="number"
                    min={1}
                    max={remainingAmount}
                    placeholder={`Максимум: ${formatCurrency(remainingAmount)}`}
                    value={form.amount}
                    onChange={(event) =>
                      updateForm({
                        amount: event.target.value,
                      })
                    }
                  />

                  <Combobox
                    label="Способ оплаты"
                    placeholder="Выберите способ"
                    value={form.method}
                    options={paymentMethodOptions}
                    onChange={(value) =>
                      updateForm({
                        method: String(value) as PaymentMethod,
                      })
                    }
                  />
                </div>

                {summary ? (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
                    <div className="flex items-center justify-between gap-4">
                      <span>Стоимость заказа</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(summary.total_price)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <span>Оплачено</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(summary.paid_amount)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <span>Осталось оплатить</span>
                      <span className="font-semibold text-[rgb(94_234_212)]">
                        {formatCurrency(summary.remaining_amount)}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <DateTimeInput
                    label="Дата оплаты"
                    value={form.paid_at}
                    onChange={(value: string) =>
                      updateForm({
                        paid_at: value,
                      })
                    }
                  />
                </div>

                <div className="mt-4">
                  <Textarea
                    label="Комментарий"
                    placeholder="Например: предоплата, доплата при выдаче..."
                    value={form.comment}
                    onChange={(event) =>
                      updateForm({
                        comment: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submittingPayment}
                    onClick={() => {
                      setIsFormOpen(false);
                      setForm(defaultPaymentForm);
                      setError(null);
                    }}
                  >
                    Отмена
                  </Button>

                  <Button
                    type="button"
                    disabled={submittingPayment}
                    onClick={() => void handleCreatePayment()}
                  >
                    {submittingPayment ? "Сохраняем..." : "Сохранить оплату"}
                  </Button>
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm text-[hsl(var(--muted))]">
                Загружаем оплаты...
              </div>
            ) : null}

            {payments.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3 text-sm leading-6 text-[hsl(var(--muted))]">
                Всего платежей в истории: {payments.length}. Подробная
                финансовая история доступна ниже в блоке “История оплат”.
              </div>
            ) : !isLoading ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                По этому заказу пока нет оплат.
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}