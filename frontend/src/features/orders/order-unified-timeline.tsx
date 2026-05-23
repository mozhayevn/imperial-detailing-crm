import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { formatDateTime } from "@/src/lib/formatters";

import type {
  OrderAuditLog,
  OrderStatusHistoryItem,
} from "@/src/features/orders/types";
import type { PricingAuditLog } from "@/src/features/pricing/types";
import type { PaymentAuditLog } from "@/src/features/payments/types";
import type { OrderChecklistAuditLog } from "@/src/features/order-checklist/types";

type OrderUnifiedTimelineProps = {
  statusHistory: OrderStatusHistoryItem[];
  orderAuditLogs: OrderAuditLog[];
  pricingAuditLogs: PricingAuditLog[];
  paymentAuditLogs: PaymentAuditLog[];
  checklistAuditLogs: OrderChecklistAuditLog[];
};

type TimelineSource =
  | "status"
  | "order"
  | "pricing"
  | "payment"
  | "checklist";

type TimelineEvent = {
  id: string;
  source: TimelineSource;
  title: string;
  description: string | null;
  actorLabel: string | null;
  createdAt: string;
};

function getSourceLabel(source: TimelineSource) {
  const labels: Record<TimelineSource, string> = {
    status: "Статус",
    order: "Заказ",
    pricing: "Pricing",
    payment: "Оплата",
    checklist: "Чеклист",
  };

  return labels[source];
}

function getSourceTone(source: TimelineSource) {
  if (source === "status") {
    return "primary";
  }

  if (source === "pricing") {
    return "warning";
  }

  if (source === "payment") {
    return "success";
  }

  if (source === "checklist") {
    return "muted";
  }

  return "primary";
}

function getStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "—";
  }

  const labels: Record<string, string> = {
    new: "Новый",
    scheduled: "Запланирован",
    in_progress: "В работе",
    waiting: "Ожидает",
    completed: "Завершен",
    delivered: "Выдан",
    canceled: "Отменен",
  };

  return labels[status] ?? status;
}

function getOrderActionLabel(action: string) {
  const labels: Record<string, string> = {
    created: "Заказ создан",
    updated: "Заказ обновлен",
    status_changed: "Статус заказа изменен",
    canceled: "Заказ отменен",
    rescheduled: "Заказ перенесен",
  };

  return labels[action] ?? action;
}

function getPricingActionLabel(action: string) {
  const labels: Record<string, string> = {
    pricing_applied: "Цена зафиксирована",
    pricing_unlocked: "Цена разблокирована",
  };

  return labels[action] ?? action;
}

function getPaymentActionLabel(action: string) {
  const labels: Record<string, string> = {
    payment_created: "Оплата добавлена",
    payment_canceled: "Оплата отменена",
  };

  return labels[action] ?? action;
}

function getChecklistActionLabel(action: string) {
  const labels: Record<string, string> = {
    checklist_created: "Чеклист создан",
    item_completed: "Пункт чеклиста выполнен",
    item_reopened: "Пункт чеклиста открыт повторно",
    item_updated: "Пункт чеклиста изменен",
  };

  return labels[action] ?? action;
}

function getActorLabel(log: {
  actor_user_full_name?: string | null;
  actor_user_id?: number | null;
}) {
  if (log.actor_user_full_name) {
    return log.actor_user_full_name;
  }

  if (log.actor_user_id) {
    return `Сотрудник #${log.actor_user_id}`;
  }

  return null;
}

function getDetailsPreview(details: string | null | undefined) {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;

    const reason = parsed.reason;
    if (typeof reason === "string" && reason.trim()) {
      return `Причина: ${reason}`;
    }

    const comment = parsed.comment;
    if (typeof comment === "string" && comment.trim()) {
      return `Комментарий: ${comment}`;
    }

    const title = parsed.title;
    if (typeof title === "string" && title.trim()) {
      return `Пункт: ${title}`;
    }

    const payment = parsed.payment as
      | {
          amount?: number;
          method?: string;
          cancel_reason?: string | null;
        }
      | undefined;

    if (payment?.amount !== undefined) {
      const parts = [`Сумма: ${payment.amount.toLocaleString("ru-RU")} ₸`];

      if (payment.method) {
        parts.push(`Способ: ${payment.method}`);
      }

      if (payment.cancel_reason) {
        parts.push(`Причина отмены: ${payment.cancel_reason}`);
      }

      return parts.join(" · ");
    }

    const itemsAdded = Number(parsed.items_added ?? 0);
    const itemsUpdated = Number(parsed.items_updated ?? 0);
    const itemsRemoved = Number(parsed.items_removed ?? 0);

    const parts: string[] = [];

    if (itemsAdded > 0) {
      parts.push(`добавлено позиций: ${itemsAdded}`);
    }

    if (itemsUpdated > 0) {
      parts.push(`изменено позиций: ${itemsUpdated}`);
    }

    if (itemsRemoved > 0) {
      parts.push(`удалено позиций: ${itemsRemoved}`);
    }

    if (parts.length > 0) {
      return `Изменения заказа: ${parts.join(", ")}.`;
    }

    return "Детали события сохранены в audit log.";
  } catch {
    return details;
  }
}

export function OrderUnifiedTimeline({
  statusHistory,
  orderAuditLogs,
  pricingAuditLogs,
  paymentAuditLogs,
  checklistAuditLogs,
}: OrderUnifiedTimelineProps) {
  const events: TimelineEvent[] = [
    ...statusHistory.map((item) => {
      const record = item as unknown as {
        id: number;
        old_status?: string | null;
        new_status?: string | null;
        from_status?: string | null;
        to_status?: string | null;
        changed_by_user_full_name?: string | null;
        changed_by_user_id?: number | null;
        created_at: string;
      };

      const oldStatus = record.old_status ?? record.from_status ?? null;
      const newStatus = record.new_status ?? record.to_status ?? null;

      return {
        id: `status-${record.id}`,
        source: "status" as const,
        title: "Статус изменен",
        description: `${getStatusLabel(oldStatus)} → ${getStatusLabel(
          newStatus,
        )}`,
        actorLabel:
          record.changed_by_user_full_name ??
          (record.changed_by_user_id
            ? `Сотрудник #${record.changed_by_user_id}`
            : null),
        createdAt: record.created_at,
      };
    }),

    ...orderAuditLogs.map((log) => ({
      id: `order-${log.id}`,
      source: "order" as const,
      title: getOrderActionLabel(log.action),
      description: getDetailsPreview(log.details),
      actorLabel: getActorLabel(log),
      createdAt: log.created_at,
    })),

    ...pricingAuditLogs.map((log) => ({
      id: `pricing-${log.id}`,
      source: "pricing" as const,
      title: getPricingActionLabel(log.action),
      description: getDetailsPreview(log.details),
      actorLabel: getActorLabel(log),
      createdAt: log.created_at,
    })),

    ...paymentAuditLogs.map((log) => ({
      id: `payment-${log.id}`,
      source: "payment" as const,
      title: getPaymentActionLabel(log.action),
      description: getDetailsPreview(log.details),
      actorLabel: getActorLabel(log),
      createdAt: log.created_at,
    })),

    ...checklistAuditLogs.map((log) => ({
      id: `checklist-${log.id}`,
      source: "checklist" as const,
      title: getChecklistActionLabel(log.action),
      description: getDetailsPreview(log.details),
      actorLabel: getActorLabel(log),
      createdAt: log.created_at,
    })),
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Единая история заказа</CardTitle>
            <CardDescription>
              Общий поток событий: статус, pricing, оплаты, чеклист и изменения
              заказа.
            </CardDescription>
          </div>

          <Badge tone={events.length > 0 ? "primary" : "muted"}>
            {events.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
            История заказа пока пустая.
          </div>
        ) : (
          <div className="relative space-y-3">
            <div className="absolute bottom-4 left-[18px] top-4 w-px bg-[hsl(var(--border))]" />

            {events.map((event) => (
              <div key={event.id} className="relative flex gap-3">
                <div className="relative z-10 mt-4 h-9 w-9 shrink-0 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-1">
                  <div className="h-full w-full rounded-xl bg-[rgb(45_212_191_/_0.14)]" />
                </div>

                <div className="min-w-0 flex-1 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={getSourceTone(event.source)}>
                          {getSourceLabel(event.source)}
                        </Badge>

                        <div className="text-sm font-semibold text-white">
                          {event.title}
                        </div>
                      </div>

                      {event.description ? (
                        <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                          {event.description}
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-xs leading-5 text-[hsl(var(--muted))] sm:text-right">
                      <div>{formatDateTime(event.createdAt)}</div>
                      {event.actorLabel ? (
                        <div>Автор: {event.actorLabel}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}