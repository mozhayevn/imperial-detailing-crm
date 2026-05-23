import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { formatCurrency, formatDateTime } from "@/src/lib/formatters";
import type { PaymentAuditLog } from "@/src/features/payments/types";

type PaymentAuditTimelineProps = {
  logs: PaymentAuditLog[];
};

type PaymentAuditDetails = {
  payment?: {
    id?: number;
    amount?: number;
    method?: string;
    status?: string;
    comment?: string | null;
    paid_at?: string;
    cancel_reason?: string;
    canceled_at?: string;
  };
  summary_after?: {
    order_id?: number;
    total_price?: number;
    paid_amount?: number;
    remaining_amount?: number;
    payment_status?: string;
  };
};

function safeParsePaymentDetails(
  details: string | null | undefined,
): PaymentAuditDetails | null {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details);

    if (parsed && typeof parsed === "object") {
      return parsed as PaymentAuditDetails;
    }

    return null;
  } catch {
    return null;
  }
}

function getPaymentActionLabel(action: string) {
  const labels: Record<string, string> = {
    payment_created: "Оплата создана",
    payment_canceled: "Оплата отменена",
  };

  return labels[action] ?? action;
}

function getPaymentActionTone(action: string) {
  if (action === "payment_created") {
    return "success";
  }

  if (action === "payment_canceled") {
    return "danger";
  }

  return "muted";
}

function getPaymentMethodLabel(method: string | undefined) {
  const labels: Record<string, string> = {
    cash: "Наличные",
    kaspi: "Kaspi",
    card: "Карта",
    bank_transfer: "Банковский перевод",
    other: "Другое",
  };

  if (!method) {
    return "—";
  }

  return labels[method] ?? method;
}

function getPaymentStatusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    completed: "Проведен",
    canceled: "Отменен",
    refunded: "Возврат",
  };

  if (!status) {
    return "—";
  }

  return labels[status] ?? status;
}

function getSummaryStatusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    unpriced: "Pricing не рассчитан",
    unpaid: "Не оплачено",
    partial: "Частично оплачено",
    paid: "Оплачено",
    overpaid: "Переплата",
  };

  if (!status) {
    return "—";
  }

  return labels[status] ?? status;
}

function getSummaryStatusTone(status: string | undefined) {
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

function MoneyMetric({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
      <div className="text-xs text-[hsl(var(--muted))]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-white">
        {formatCurrency(value ?? 0)}
      </div>
    </div>
  );
}

export function PaymentAuditTimeline({ logs }: PaymentAuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История оплат</CardTitle>
          <CardDescription>
            Финансовая история создания и отмены платежей.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm text-[hsl(var(--muted))]">
            История оплат пока пустая.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История оплат</CardTitle>
        <CardDescription>
          Кто создавал, отменял платежи и как менялся остаток по заказу.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => {
            const parsedDetails = safeParsePaymentDetails(log.details);
            const payment = parsedDetails?.payment;
            const summary = parsedDetails?.summary_after;

            return (
              <div
                key={log.id}
                className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge tone={getPaymentActionTone(log.action)}>
                      {getPaymentActionLabel(log.action)}
                    </Badge>

                    <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted))]">
                      <div>{formatDateTime(log.created_at)}</div>
                      <div>
                        Инициатор:{" "}
                        {log.actor_user_full_name ??
                          `Сотрудник #${log.actor_user_id}`}
                      </div>
                    </div>
                  </div>

                  <Badge tone="muted">Payment audit №{log.id}</Badge>
                </div>

                {parsedDetails ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge tone="muted">
                          Платеж #{payment?.id ?? log.payment_id ?? "—"}
                        </Badge>

                        <Badge tone="primary">
                          {getPaymentMethodLabel(payment?.method)}
                        </Badge>

                        <Badge tone={getPaymentActionTone(log.action)}>
                          {getPaymentStatusLabel(payment?.status)}
                        </Badge>
                      </div>

                      <div className="text-2xl font-semibold tracking-tight text-white">
                        {formatCurrency(payment?.amount ?? 0)}
                      </div>

                      {payment?.paid_at ? (
                        <div className="mt-2 text-xs text-[hsl(var(--muted))]">
                          Дата оплаты: {formatDateTime(payment.paid_at)}
                        </div>
                      ) : null}

                      {payment?.comment ? (
                        <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                          {payment.comment}
                        </div>
                      ) : null}

                      {log.action === "payment_canceled" ? (
                        <div className="mt-3 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-3 text-sm leading-6 text-[rgb(252_165_165)]">
                          <div className="mb-1 font-semibold">
                            Причина отмены
                          </div>

                          <div>
                            {payment?.cancel_reason ?? "Причина не указана"}
                          </div>

                          {payment?.canceled_at ? (
                            <div className="mt-2 text-xs text-[rgb(252_165_165_/_0.78)]">
                              Дата отмены: {formatDateTime(payment.canceled_at)}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {summary ? (
                      <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                            Состояние оплаты после действия
                          </div>

                          <Badge
                            tone={getSummaryStatusTone(summary.payment_status)}
                          >
                            {getSummaryStatusLabel(summary.payment_status)}
                          </Badge>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <MoneyMetric
                            label="Итого"
                            value={summary.total_price}
                          />
                          <MoneyMetric
                            label="Оплачено"
                            value={summary.paid_amount}
                          />
                          <MoneyMetric
                            label="Остаток"
                            value={summary.remaining_amount}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
                    {log.details ?? "Детали действия отсутствуют"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}