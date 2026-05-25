"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";
import { getRecentAuditEvents } from "@/src/features/audits/api";
import type { RecentAuditEvent } from "@/src/features/audits/types";

type AuditSection = {
  title: string;
  description: string;
  badge: string;
  href: string;
  permission: string;
  items: string[];
};

const auditSections: AuditSection[] = [
  {
    title: "История заказов",
    description:
      "Все действия по заказам: создание, редактирование, смена статуса, перенос записи, отмена и изменение состава услуг.",
    badge: "Заказы",
    href: "/orders",
    permission: "orders.read",
    items: [
      "Создание и редактирование заказов",
      "Смена статусов заказа",
      "Перенос записи на другое время",
      "Отмена заказа и причина отмены",
    ],
  },
  {
    title: "Аудит ценообразования",
    description:
      "История расчета и фиксации цены: какие правила применились, откуда взялась цена и были ли предупреждения.",
    badge: "Цены",
    href: "/pricing/rules",
    permission: "pricing.read",
    items: [
      "Фиксация рассчитанной цены",
      "Разблокировка цены для пересчета",
      "Цена из правила ценообразования",
      "Расчет по резервной формуле",
    ],
  },
  {
    title: "История оплат",
    description:
      "Все финансовые действия по заказу: добавление оплаты, отмена оплаты, причина отмены и остаток к оплате.",
    badge: "Оплаты",
    href: "/orders",
    permission: "payments.read",
    items: [
      "Добавление оплаты",
      "Отмена оплаты",
      "Причина отмены оплаты",
      "Остаток после операции",
    ],
  },
  {
    title: "Производственный чеклист",
    description:
      "История выполнения работ по чеклисту: какие пункты выполнены, кто отметил выполнение и какие комментарии оставлены.",
    badge: "Чеклист",
    href: "/orders",
    permission: "orders.read",
    items: [
      "Создание чеклиста заказа",
      "Выполнение пунктов чеклиста",
      "Повторное открытие пункта",
      "Комментарии и контрольные отметки",
    ],
  },
  {
    title: "Роли и права доступа",
    description:
      "История административных действий: назначение ролей, изменение прав и управление доступом сотрудников.",
    badge: "Доступы",
    href: "/admin",
    permission: "users.read",
    items: [
      "Создание пользователей",
      "Назначение ролей",
      "Удаление ролей у сотрудника",
      "Изменение прав доступа",
    ],
  },
  {
    title: "Журнал безопасности",
    description:
      "События входа, двухфакторной защиты, смены пароля, отключения сессий и другие действия, связанные с безопасностью аккаунтов.",
    badge: "Безопасность",
    href: "/audits/security",
    permission: "security.audit.read",
    items: [
      "Успешные входы в систему",
      "Ошибки двухфакторной проверки",
      "Смена пароля",
      "Отключение активных сессий",
    ],
  },
];

function getAuditSourceTone(source: string) {
  if (source === "orders") {
    return "primary";
  }

  if (source === "pricing") {
    return "success";
  }

  if (source === "payments") {
    return "warning";
  }

  if (source === "checklist") {
    return "muted";
  }

  if (source === "access") {
    return "danger";
  }

  return "muted";
}

function getAuditEventHref(event: RecentAuditEvent) {
  if (event.order_id) {
    return `/orders/${event.order_id}`;
  }

  if (event.target_user_id) {
    return `/admin`;
  }

  return "/audits";
}

function tryParseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getReadableAuditDetails(event: RecentAuditEvent) {
  const details = event.details;

  if (!details) {
    return null;
  }

  const parsed = tryParseJson(details);

  if (!parsed) {
    return details;
  }

  if (event.source === "orders") {
    const addedItems = Number(parsed.items_added ?? 0);
    const updatedItems = Number(parsed.items_updated ?? 0);
    const removedItems = Number(parsed.items_removed ?? 0);

    const parts: string[] = [];

    if (addedItems > 0) {
      parts.push(`добавлено позиций: ${addedItems}`);
    }

    if (updatedItems > 0) {
      parts.push(`изменено позиций: ${updatedItems}`);
    }

    if (removedItems > 0) {
      parts.push(`удалено позиций: ${removedItems}`);
    }

    if (parts.length > 0) {
      return `Изменения в заказе: ${parts.join(", ")}.`;
    }

    return "Данные заказа были обновлены.";
  }

  if (event.source === "pricing") {
    const reason = parsed.reason;

    if (typeof reason === "string" && reason.trim()) {
      return `Причина: ${reason}`;
    }

    const totals = parsed.totals as
      | {
          final_price?: number;
          profit?: number;
          items_count?: number;
        }
      | undefined;

    if (totals) {
      return [
        totals.items_count !== undefined
          ? `позиций: ${totals.items_count}`
          : null,
        totals.final_price !== undefined
          ? `итоговая цена: ${totals.final_price.toLocaleString("ru-RU")} ₸`
          : null,
        totals.profit !== undefined
          ? `прибыль: ${totals.profit.toLocaleString("ru-RU")} ₸`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }

    return "Действие по ценообразованию выполнено.";
  }

  if (event.source === "payments") {
    const payment = parsed.payment as
      | {
          amount?: number;
          method?: string;
          status?: string;
          cancel_reason?: string | null;
        }
      | undefined;

    const summary = parsed.summary_after as
      | {
          paid_amount?: number;
          remaining_amount?: number;
          payment_status?: string;
        }
      | undefined;

    const parts: string[] = [];

    if (payment?.amount !== undefined) {
      parts.push(`сумма: ${payment.amount.toLocaleString("ru-RU")} ₸`);
    }

    if (payment?.method) {
      parts.push(`способ: ${payment.method}`);
    }

    if (payment?.cancel_reason) {
      parts.push(`причина отмены: ${payment.cancel_reason}`);
    }

    if (summary?.remaining_amount !== undefined) {
      parts.push(
        `остаток: ${summary.remaining_amount.toLocaleString("ru-RU")} ₸`,
      );
    }

    if (summary?.payment_status) {
      parts.push(`статус: ${summary.payment_status}`);
    }

    return parts.length > 0
      ? parts.join(" · ")
      : "Действие по оплате выполнено.";
  }

  if (event.source === "checklist") {
    const title = parsed.title;

    if (typeof title === "string" && title.trim()) {
      return `Пункт чеклиста: ${title}`;
    }

    const comment = parsed.comment;

    if (typeof comment === "string" && comment.trim()) {
      return `Комментарий: ${comment}`;
    }

    return "Действие по производственному чеклисту выполнено.";
  }

  if (event.source === "access") {
    return details
      .replace("User", "Пользователь")
      .replace("was created", "создан")
      .replace("Role", "Роль")
      .replace("assigned to user", "назначена пользователю")
      .replace("removed from user", "удалена у пользователя");
  }

  return details;
}

export function AuditsPageClient() {
  const { session } = useAuth();
  const [recentEvents, setRecentEvents] = useState<RecentAuditEvent[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const visibleSections = auditSections.filter((section) =>
    canAccessByPermission(session, section.permission),
  );

  const canReadRecentAudit = canAccessByPermission(session, "orders.read");

  useEffect(() => {
    let isMounted = true;

    async function loadRecentEvents() {
      if (!canReadRecentAudit) {
        if (isMounted) {
          setIsRecentLoading(false);
        }

        return;
      }

      setIsRecentLoading(true);
      setRecentError(null);

      try {
        const result = await getRecentAuditEvents(50);

        if (!isMounted) {
          return;
        }

        setRecentEvents(result);
      } catch (loadError) {
        if (isMounted) {
          setRecentError(getApiErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsRecentLoading(false);
        }
      }
    }

    void loadRecentEvents();

    return () => {
      isMounted = false;
    };
  }, [canReadRecentAudit]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Аудит"
        title="Центр аудита"
        description="Единая точка для истории заказов, pricing, оплат, производственного чеклиста и прав доступа."
      />

      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
            <div className="text-xs font-medium text-[hsl(var(--muted))]">
              Доступные разделы
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {visibleSections.length}
            </div>
          </div>

          <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
            <div className="text-xs font-medium text-[hsl(var(--muted))]">
              Всего разделов аудита
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {auditSections.length}
            </div>
          </div>

          <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
            <div className="text-xs font-medium text-[rgb(94_234_212)]">
              Последних событий
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {recentEvents.length}
            </div>
          </div>
        </div>

        {visibleSections.length === 0 ? (
          <Card>
            <CardContent>
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                У вас нет доступа к audit-разделам. Нужны permissions для
                заказов, pricing, оплат или администрирования.
              </div>
            </CardContent>
          </Card>
        ) : null}

        {visibleSections.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {visibleSections.map((section) => (
              <Card key={section.title}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{section.title}</CardTitle>
                        <Badge tone="primary">{section.badge}</Badge>
                      </div>

                      <CardDescription className="mt-2">
                        {section.description}
                      </CardDescription>
                    </div>

                    <Link href={section.href}>
                      <Button type="button" variant="secondary" size="sm">
                        Открыть
                      </Button>
                    </Link>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                      >
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Что отслеживается
                        </div>
                        <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                          {item}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Последние события</CardTitle>
                <CardDescription>
                  Общая лента последних действий по заказам, ценам, оплатам,
                  чеклистам и доступам.
                </CardDescription>
              </div>

              <Badge tone={recentEvents.length > 0 ? "primary" : "muted"}>
                {recentEvents.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {!canReadRecentAudit ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                Для просмотра общей ленты аудита нужен доступ к заказам.
              </div>
            ) : null}

            {recentError ? (
              <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
                {recentError}
              </div>
            ) : null}

            {isRecentLoading ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                Загружаем последние события...
              </div>
            ) : null}

            {!isRecentLoading && recentEvents.length === 0 && !recentError ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                Событий аудита пока нет.
              </div>
            ) : null}

            {!isRecentLoading && recentEvents.length > 0 ? (
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={getAuditSourceTone(event.source)}>
                            {event.source_label}
                          </Badge>

                          <div className="text-sm font-semibold text-white">
                            {event.action_label}
                          </div>
                        </div>

                        <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                          {formatDateTime(event.created_at)} · Автор:{" "}
                          {event.actor_user_full_name ??
                            `Сотрудник #${event.actor_user_id}`}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.order_id ? (
                            <Badge tone="muted">Заказ #{event.order_id}</Badge>
                          ) : null}

                          {event.payment_id ? (
                            <Badge tone="muted">
                              Оплата #{event.payment_id}
                            </Badge>
                          ) : null}

                          {event.checklist_item_id ? (
                            <Badge tone="muted">
                              Пункт чеклиста #{event.checklist_item_id}
                            </Badge>
                          ) : null}

                          {event.target_user_full_name ? (
                            <Badge tone="muted">
                              Сотрудник: {event.target_user_full_name}
                            </Badge>
                          ) : null}

                          {event.role_name ? (
                            <Badge tone="muted">Роль: {event.role_name}</Badge>
                          ) : null}
                        </div>

                        {getReadableAuditDetails(event) ? (
                          <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 text-xs leading-5 text-[hsl(var(--muted))]">
                            {getReadableAuditDetails(event)}
                          </div>
                        ) : null}
                      </div>

                      <Link href={getAuditEventHref(event)}>
                        <Button type="button" variant="secondary" size="sm">
                          Открыть
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}