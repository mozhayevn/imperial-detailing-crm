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
import { getLeadContacts } from "@/src/features/leads/api";
import type { LeadContact } from "@/src/features/leads/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";

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

export function LeadContactsPageClient() {
  const { session } = useAuth();

  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadLeads = canAccessByPermission(session, "leads.read");

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        (contact.full_name?.toLowerCase() ?? "").includes(normalizedSearch) ||
        contact.phone.toLowerCase().includes(normalizedSearch) ||
        contact.source.toLowerCase().includes(normalizedSearch) ||
        (contact.external_username?.toLowerCase() ?? "").includes(
          normalizedSearch,
        ) ||
        (contact.external_user_id?.toLowerCase() ?? "").includes(
          normalizedSearch,
        )
      );
    });
  }, [contacts, search]);

  const linkedClientsCount = contacts.filter(
    (contact) => contact.created_client_id,
  ).length;

  const botContactsCount = contacts.filter((contact) =>
    ["telegram", "whatsapp", "instagram", "website", "bot"].includes(
      contact.source,
    ),
  ).length;

  async function loadContacts() {
    if (!canReadLeads) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getLeadContacts();
      setContacts(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialContacts() {
      if (!canReadLeads) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getLeadContacts();

        if (!isMounted) {
          return;
        }

        setContacts(result);
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

    void loadInitialContacts();

    return () => {
      isMounted = false;
    };
  }, [canReadLeads]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Заявки"
        title="Контакты заявок"
        description="Люди, которые оставляли заявки вручную или через будущие чат-боты."
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
              onClick={() => void loadContacts()}
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

      {canReadLeads ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Всего контактов
              </div>

              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {contacts.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                Из интеграций
              </div>

              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {botContactsCount}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(74_222_128_/_0.22)] bg-[rgb(74_222_128_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(134_239_172)]">
                Связаны с клиентом CRM
              </div>

              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {linkedClientsCount}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Список контактов</CardTitle>
                  <CardDescription>
                    Поиск по имени, телефону, источнику, username или внешнему id.
                  </CardDescription>
                </div>

                <Badge tone={filteredContacts.length > 0 ? "primary" : "muted"}>
                  Найдено: {filteredContacts.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <Input
                label="Поиск"
                placeholder="Имя, телефон, Telegram username или источник"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {isLoading ? (
                <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем контакты заявок...
                </div>
              ) : null}

              {!isLoading && filteredContacts.length === 0 && !error ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Контакты заявок не найдены.
                </div>
              ) : null}

              {!isLoading && filteredContacts.length > 0 ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {filteredContacts.map((contact) => (
                    <Link
                      key={contact.id}
                      href={routes.leadContactDetails(contact.id)}
                      className="block rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.28)] hover:shadow-lg hover:shadow-black/20"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={getLeadSourceTone(contact.source)}>
                              {getLeadSourceLabel(contact.source)}
                            </Badge>

                            {contact.created_client_id ? (
                              <Badge tone="success">Клиент CRM</Badge>
                            ) : (
                              <Badge tone="muted">Еще не клиент</Badge>
                            )}
                          </div>

                          <div className="mt-3 break-words text-base font-semibold text-white">
                            {contact.full_name || "Контакт без имени"}
                          </div>

                          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                            {contact.phone}
                          </div>

                          {contact.external_username || contact.external_user_id ? (
                            <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 text-xs leading-5 text-[hsl(var(--muted))]">
                              {contact.external_username ? (
                                <div>
                                  Никнейм в мессенджере:{" "}
                                  <span className="text-[hsl(var(--muted-foreground))]">
                                    {contact.external_username}
                                  </span>
                                </div>
                              ) : null}

                              {contact.external_user_id ? (
                                <div>
                                  ID в мессенджере:{" "}
                                  <span className="text-[hsl(var(--muted-foreground))]">
                                    {contact.external_user_id}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-xs leading-5 text-[hsl(var(--muted))] sm:text-right">
                          <div>Контакт #{contact.id}</div>
                          <div>{formatDateTime(contact.created_at)}</div>

                          {contact.created_client_id ? (
                            <div className="mt-2 text-[rgb(134_239_172)]">
                              Клиент #{contact.created_client_id}
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