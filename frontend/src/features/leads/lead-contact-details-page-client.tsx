"use client";

import Link from "next/link";
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
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { routes } from "@/src/config/routes";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import {
  getLeadContact,
  getLeadContactLeads,
} from "@/src/features/leads/api";
import type { Lead, LeadContact } from "@/src/features/leads/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";

function getLeadStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Новая",
    in_review: "В обработке",
    confirmed: "Подтверждена",
    rejected: "Отклонена",
    duplicate: "Дубль",
  };

  return labels[status] ?? status;
}

function getLeadStatusTone(status: string) {
  if (status === "new") {
    return "primary";
  }

  if (status === "in_review") {
    return "warning";
  }

  if (status === "confirmed") {
    return "success";
  }

  return "muted";
}

function getLeadSourceLabel(source: string) {
  const labels: Record<string, string> = {
    manual: "Ручная",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    website: "Сайт",
    bot: "Бот",
  };

  return labels[source] ?? source;
}

function getLeadSourceTone(source: string) {
  if (source === "telegram" || source === "bot") {
    return "primary";
  }

  if (source === "whatsapp") {
    return "success";
  }

  if (source === "instagram") {
    return "warning";
  }

  return "muted";
}

function getLeadCarLabel(lead: Lead) {
  const parts = [lead.car_brand, lead.car_model].filter(Boolean);

  if (lead.car_year) {
    parts.push(String(lead.car_year));
  }

  return parts.length > 0 ? parts.join(" ") : "Автомобиль не указан";
}

function getLeadServicesLabel(lead: Lead) {
  if (lead.items.length === 0) {
    return "Услуги не указаны";
  }

  return lead.items
    .map((item) => item.service_name ?? item.service_name_text ?? "Услуга")
    .join(", ");
}

function InfoBlock({
  title,
  value,
}: {
  title: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
      <div className="text-xs text-[hsl(var(--muted))]">{title}</div>
      <div className="mt-2 break-words text-sm font-semibold text-white">
        {value || "—"}
      </div>
    </div>
  );
}

export function LeadContactDetailsPageClient({
  leadContactId,
}: {
  leadContactId: string;
}) {
  const { session } = useAuth();

  const [contact, setContact] = useState<LeadContact | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadLeads = canAccessByPermission(session, "leads.read");

  const confirmedLeadsCount = useMemo(() => {
    return leads.filter((lead) => lead.status === "confirmed").length;
  }, [leads]);

  const activeLeadsCount = useMemo(() => {
    return leads.filter(
      (lead) => lead.status === "new" || lead.status === "in_review",
    ).length;
  }, [leads]);

  async function loadContact() {
    if (!canReadLeads) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [contactResult, leadsResult] = await Promise.all([
        getLeadContact(leadContactId),
        getLeadContactLeads(leadContactId),
      ]);

      setContact(contactResult);
      setLeads(leadsResult);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialContact() {
      if (!canReadLeads) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [contactResult, leadsResult] = await Promise.all([
          getLeadContact(leadContactId),
          getLeadContactLeads(leadContactId),
        ]);

        if (!isMounted) {
          return;
        }

        setContact(contactResult);
        setLeads(leadsResult);
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

    void loadInitialContact();

    return () => {
      isMounted = false;
    };
  }, [canReadLeads, leadContactId]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Заявки"
        title={contact?.full_name || contact?.phone || "Контакт заявки"}
        description="Карточка контакта из входящих заявок и будущих чат-ботов."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={routes.leads}>
              <Button type="button" variant="secondary">
                Назад к заявкам
              </Button>
            </Link>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void loadContact()}
            >
              Обновить
            </Button>
          </div>
        }
      />

      {!canReadLeads ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к контактам заявок
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для просмотра нужен доступ{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              leads.read
            </span>
            .
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-5 text-sm leading-6 text-[rgb(252_165_165)]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
          Загружаем контакт заявки...
        </div>
      ) : null}

      {!isLoading && contact ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Всего заявок
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {leads.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                Активные
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {activeLeadsCount}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(74_222_128_/_0.22)] bg-[rgb(74_222_128_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(134_239_172)]">
                Подтвержденные
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {confirmedLeadsCount}
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Клиент CRM
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {contact.created_client_id ? `#${contact.created_client_id}` : "—"}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Контакт</CardTitle>
                <CardDescription>
                  Данные человека, который оставлял заявки.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <InfoBlock title="Имя" value={contact.full_name} />
                  <InfoBlock title="Телефон" value={contact.phone} />
                  <InfoBlock
                    title="Источник"
                    value={getLeadSourceLabel(contact.source)}
                  />
                  <InfoBlock
                    title="Внешний username"
                    value={contact.external_username}
                  />
                  <InfoBlock
                    title="Внешний user id"
                    value={contact.external_user_id}
                  />
                  <InfoBlock
                    title="Создан"
                    value={formatDateTime(contact.created_at)}
                  />

                  {contact.created_client_id ? (
                    <div className="rounded-2xl border border-[rgb(74_222_128_/_0.22)] bg-[rgb(74_222_128_/_0.08)] p-3">
                      <div className="text-xs text-[rgb(134_239_172)]">
                        Связан с клиентом CRM
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        Клиент #{contact.created_client_id}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Связь с CRM
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        Клиент CRM еще не создан
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Заявки контакта</CardTitle>
                    <CardDescription>
                      Все входящие заявки этого человека.
                    </CardDescription>
                  </div>

                  <Badge tone={leads.length > 0 ? "primary" : "muted"}>
                    {leads.length}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                {leads.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                    У этого контакта пока нет заявок.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={getLeadStatusTone(lead.status)}>
                                {getLeadStatusLabel(lead.status)}
                              </Badge>

                              <Badge tone={getLeadSourceTone(lead.source)}>
                                {getLeadSourceLabel(lead.source)}
                              </Badge>

                              <div className="text-sm font-semibold text-white">
                                Заявка #{lead.id}
                              </div>
                            </div>

                            <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                              {getLeadCarLabel(lead)}
                            </div>

                            <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                              Услуги:{" "}
                              <span className="text-[hsl(var(--muted-foreground))]">
                                {getLeadServicesLabel(lead)}
                              </span>
                            </div>

                            <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                              Создано: {formatDateTime(lead.created_at)}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Link href={routes.leadDetails(lead.id)}>
                              <Button type="button" variant="secondary">
                                Открыть заявку
                              </Button>
                            </Link>

                            {lead.created_order_id ? (
                              <Link href={routes.orderDetails(lead.created_order_id)}>
                                <Button type="button">
                                  Открыть заказ
                                </Button>
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}