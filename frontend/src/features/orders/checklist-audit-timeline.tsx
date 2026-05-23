import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { formatDateTime } from "@/src/lib/formatters";
import type { OrderChecklistAuditLog } from "@/src/features/order-checklist/types";

type ChecklistAuditTimelineProps = {
  logs: OrderChecklistAuditLog[];
};

type ChecklistAuditDetails = {
  items_count?: number;
  source?: string;
  item?: {
    id?: number;
    key?: string | null;
    title?: string;
    comment?: string | null;
    sort_order?: number;
    is_required?: boolean;
  };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

function safeParseChecklistDetails(
  details: string | null | undefined,
): ChecklistAuditDetails | null {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details);

    if (parsed && typeof parsed === "object") {
      return parsed as ChecklistAuditDetails;
    }

    return null;
  } catch {
    return null;
  }
}

function getChecklistActionLabel(action: string) {
  const labels: Record<string, string> = {
    checklist_created: "Чеклист создан",
    item_created: "Пункт добавлен",
    item_updated: "Пункт обновлен",
    item_completed: "Пункт выполнен",
    item_reopened: "Пункт переоткрыт",
  };

  return labels[action] ?? action;
}

function getChecklistActionTone(action: string) {
  if (action === "item_completed") {
    return "success";
  }

  if (action === "item_reopened") {
    return "warning";
  }

  if (action === "checklist_created" || action === "item_created") {
    return "primary";
  }

  return "muted";
}

function getChecklistKeyLabel(key: string | null | undefined) {
  const labels: Record<string, string> = {
    vehicle_accepted: "Авто принято",
    before_photos: "Фото до работ",
    materials_added: "Материалы добавлены",
    work_started: "Работы начаты",
    quality_control: "Контроль качества",
    after_photos: "Фото после работ",
    ready_for_delivery: "Готово к выдаче",
  };

  if (!key) {
    return null;
  }

  return labels[key] ?? key;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  return String(value);
}

function getFieldLabel(field: string) {
  const labels: Record<string, string> = {
    title: "Название",
    description: "Описание",
    is_required: "Обязательный пункт",
    sort_order: "Порядок",
    comment: "Комментарий",
  };

  return labels[field] ?? field;
}

function UpdatedFields({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const fields = Object.keys(after).filter(
    (key) => formatValue(before[key]) !== formatValue(after[key]),
  );

  if (fields.length === 0) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
        Изменений в пункте не найдено.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div
          key={field}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
        >
          <div className="mb-3 text-sm font-semibold text-white">
            {getFieldLabel(field)}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Было
              </div>
              <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                {formatValue(before[field])}
              </div>
            </div>

            <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-[rgb(94_234_212)]">
                Стало
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {formatValue(after[field])}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChecklistAuditTimeline({ logs }: ChecklistAuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История производства</CardTitle>
          <CardDescription>
            Действия по производственному чеклисту заказа.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm text-[hsl(var(--muted))]">
            История производства пока пустая.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История производства</CardTitle>
        <CardDescription>
          Кто выполнял, переоткрывал и изменял пункты чеклиста.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => {
            const details = safeParseChecklistDetails(log.details);
            const item = details?.item;
            const itemLabel =
              item?.title ?? getChecklistKeyLabel(item?.key) ?? null;

            return (
              <div
                key={log.id}
                className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge tone={getChecklistActionTone(log.action)}>
                      {getChecklistActionLabel(log.action)}
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

                  <Badge tone="muted">Production audit №{log.id}</Badge>
                </div>

                {log.action === "checklist_created" ? (
                  <div className="mt-4 rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4 text-sm leading-6 text-[rgb(94_234_212)]">
                    Создан стандартный производственный чеклист.
                    {details?.items_count ? (
                      <span> Количество пунктов: {details.items_count}.</span>
                    ) : null}
                  </div>
                ) : null}

                {itemLabel && log.action !== "item_updated" ? (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary">
                        Пункт #{item?.id ?? log.checklist_item_id ?? "—"}
                      </Badge>

                      {item?.key ? (
                        <Badge tone="muted">
                          {getChecklistKeyLabel(item.key) ?? item.key}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 text-sm font-semibold text-white">
                      {itemLabel}
                    </div>

                    {item?.comment ? (
                      <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                        {item.comment}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {log.action === "item_updated" &&
                details?.before &&
                details?.after ? (
                  <div className="mt-4">
                    <UpdatedFields before={details.before} after={details.after} />
                  </div>
                ) : null}

                {!details && log.details ? (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
                    {log.details}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}