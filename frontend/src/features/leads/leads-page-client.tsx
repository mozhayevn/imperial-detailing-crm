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
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { routes } from "@/src/config/routes";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getLeads } from "@/src/features/leads/api";
import type { Lead, LeadStatus } from "@/src/features/leads/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";

type LeadStatusFilter = LeadStatus | "all";

const leadStatusOptions: {
  value: LeadStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_review", label: "В обработке" },
  { value: "confirmed", label: "Подтвержденные" },
  { value: "rejected", label: "Отклоненные" },
  { value: "duplicate", label: "Дубли" },
];

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

  if (status === "rejected" || status === "duplicate") {
    return "muted";
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

  if (parts.length === 0) {
    return "Автомобиль не указан";
  }

  return parts.join(" ");
}

function getLeadServicesLabel(lead: Lead) {
  if (lead.items.length === 0) {
    return "Услуги не указаны";
  }

  return lead.items
    .slice(0, 3)
    .map((item) => item.service_name ?? item.service_name_text ?? "Услуга")
    .join(", ");
}

export function LeadsPageClient() {
  const { session } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState<LeadStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadLeads = canAccessByPermission(session, "leads.read");

  const filteredLeads = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return leads.filter((lead) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        (lead.client_name?.toLowerCase() ?? "").includes(normalizedSearch) ||
        lead.phone.toLowerCase().includes(normalizedSearch) ||
        (lead.car_brand?.toLowerCase() ?? "").includes(normalizedSearch) ||
        (lead.car_model?.toLowerCase() ?? "").includes(normalizedSearch) ||
        (lead.plate_number?.toLowerCase() ?? "").includes(normalizedSearch) ||
        getLeadServicesLabel(lead).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [leads, search]);

  const newCount = leads.filter((lead) => lead.status === "new").length;
  const inReviewCount = leads.filter((lead) => lead.status === "in_review").length;
  const confirmedCount = leads.filter((lead) => lead.status === "confirmed").length;

  async function loadLeads(nextStatus: LeadStatusFilter = status) {
    if (!canReadLeads) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getLeads({
        status: nextStatus,
      });

      setLeads(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialLeads() {
      if (!canReadLeads) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getLeads({
          status,
        });

        if (!isMounted) {
          return;
        }

        setLeads(result);
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

    void loadInitialLeads();

    return () => {
      isMounted = false;
    };
  }, [canReadLeads, status]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Заявки"
        title="Входящие заявки"
        description="Заявки из ручного ввода и будущих чат-ботов. Заказы создаются только после подтверждения."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={routes.newLead}>
              <Button type="button">Создать заявку</Button>
            </Link>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void loadLeads()}
            >
              Обновить
            </Button>
          </div>
        }
      />

      {!canReadLeads ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к заявкам
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

      {canReadLeads ? (
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
                Новые
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {newCount}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(251_191_36_/_0.22)] bg-[rgb(251_191_36_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(253_224_71)]">
                В обработке
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {inReviewCount}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(74_222_128_/_0.22)] bg-[rgb(74_222_128_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(134_239_172)]">
                Подтвержденные
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {confirmedCount}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-5 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Очередь заявок</CardTitle>
                  <CardDescription>
                    Сначала менеджер проверяет заявку, потом подтверждает
                    создание заказа.
                  </CardDescription>
                </div>

                <Badge tone={filteredLeads.length > 0 ? "primary" : "muted"}>
                  Найдено: {filteredLeads.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <Input
                  label="Поиск"
                  placeholder="Имя, телефон, автомобиль, номер или услуга"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <div>
                  <div className="mb-2 text-xs font-medium text-[hsl(var(--muted))]">
                    Статус
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {leadStatusOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          status === option.value ? "primary" : "secondary"
                        }
                        onClick={() => setStatus(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем заявки...
                </div>
              ) : null}

              {!isLoading && filteredLeads.length === 0 && !error ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Заявки не найдены.
                </div>
              ) : null}

              {!isLoading && filteredLeads.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {filteredLeads.map((lead) => (
                    <Link
                      key={lead.id}
                      href={routes.leadDetails(lead.id)}
                      className="block rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.28)] hover:shadow-lg hover:shadow-black/20"
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

                            <div className="text-base font-semibold text-white">
                              {lead.client_name || "Клиент без имени"}
                            </div>
                          </div>

                          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                            {lead.phone} · {getLeadCarLabel(lead)}
                          </div>

                          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                            Услуги:{" "}
                            <span className="text-[hsl(var(--muted-foreground))]">
                              {getLeadServicesLabel(lead)}
                            </span>
                          </div>

                          {lead.message ? (
                            <div className="mt-3 line-clamp-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 text-xs leading-5 text-[hsl(var(--muted))]">
                              {lead.message}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-xs leading-5 text-[hsl(var(--muted))] lg:min-w-[180px] lg:text-right">
                          <div>Заявка #{lead.id}</div>
                          <div>{formatDateTime(lead.created_at)}</div>

                          {lead.assigned_user_full_name ? (
                            <div className="mt-2">
                              Ответственный: {lead.assigned_user_full_name}
                            </div>
                          ) : (
                            <div className="mt-2">
                              Ответственный не назначен
                            </div>
                          )}

                          {lead.created_order_id ? (
                            <div className="mt-2 text-[rgb(134_239_172)]">
                              Заказ #{lead.created_order_id}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}