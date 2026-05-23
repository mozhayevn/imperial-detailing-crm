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
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import {
  deleteClient,
  getClients,
  searchClients,
} from "@/src/features/clients/api";
import type { Client } from "@/src/features/clients/types";

type ClientSearchForm = {
  full_name: string;
  phone: string;
};

const defaultSearchForm: ClientSearchForm = {
  full_name: "",
  phone: "",
};

function getClientInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "К";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatBirthDate(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ClientsPageClient() {
  const { session } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [searchForm, setSearchForm] =
    useState<ClientSearchForm>(defaultSearchForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<number | null>(null);
  const [confirmDeleteClientId, setConfirmDeleteClientId] = useState<
    number | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const canReadClients = canAccessByPermission(session, "clients.read");
  const canCreateClients = canAccessByPermission(session, "clients.create");
  const canUpdateClients = canAccessByPermission(session, "clients.update");
  const canDeleteClients = canAccessByPermission(session, "clients.delete");

  const hasActiveSearch = useMemo(
    () => Boolean(searchForm.full_name.trim() || searchForm.phone.trim()),
    [searchForm.full_name, searchForm.phone],
  );

  async function loadClients() {
    if (!canReadClients) {
      setClients([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getClients();
      setClients(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialClients() {
      try {
        if (!canReadClients) {
          if (isMounted) {
            setClients([]);
          }

          return;
        }

        const result = await getClients();

        if (isMounted) {
          setClients(result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
        }
      }
    }

    void loadInitialClients();

    return () => {
      isMounted = false;
    };
  }, [canReadClients]);

  function updateSearchForm(patch: Partial<ClientSearchForm>) {
    setSearchForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  async function handleSearch() {
    if (!hasActiveSearch) {
      await loadClients();
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const result = await searchClients({
        full_name: searchForm.full_name,
        phone: searchForm.phone,
      });

      setClients(result);
    } catch (searchError) {
      setError(getApiErrorMessage(searchError));
    } finally {
      setIsSearching(false);
    }
  }

  async function handleResetSearch() {
    setSearchForm(defaultSearchForm);
    setConfirmDeleteClientId(null);
    await loadClients();
  }

  async function handleDeleteClient(clientId: number) {
    setDeletingClientId(clientId);
    setError(null);

    try {
      await deleteClient(clientId);

      setClients((current) =>
        current.filter((client) => client.id !== clientId),
      );
      setConfirmDeleteClientId(null);
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingClientId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="CRM"
        title="Клиенты"
        description="База клиентов: поиск по ФИО и телефону, быстрый переход к карточке клиента."
        actions={
          canCreateClients ? (
            <Link href="/clients/new">
              <Button type="button">Создать клиента</Button>
            </Link>
          ) : null
        }
      />

      {!canReadClients ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к клиентам. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                clients.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadClients ? (
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Поиск клиентов</CardTitle>
              <CardDescription>
                Найдите клиента по имени, фамилии или номеру телефона.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <Input
                  label="ФИО клиента"
                  placeholder="Например: Иван Петров"
                  value={searchForm.full_name}
                  onChange={(event) =>
                    updateSearchForm({
                      full_name: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSearch();
                    }
                  }}
                />

                <Input
                  label="Телефон"
                  placeholder="+7..."
                  value={searchForm.phone}
                  onChange={(event) =>
                    updateSearchForm({
                      phone: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSearch();
                    }
                  }}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={isSearching}
                    onClick={() => void handleSearch()}
                  >
                    {isSearching ? "Ищем..." : "Найти"}
                  </Button>

                  {hasActiveSearch ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isSearching}
                      onClick={() => void handleResetSearch()}
                    >
                      Сбросить
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Список клиентов</CardTitle>
                  <CardDescription>
                    Всего найдено: {clients.length}
                  </CardDescription>
                </div>

                <Badge tone={hasActiveSearch ? "primary" : "muted"}>
                  {hasActiveSearch ? "Результаты поиска" : "Все клиенты"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем клиентов...
                </div>
              ) : null}

              {clients.length === 0 && !isLoading ? (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Клиенты не найдены.
                </div>
              ) : null}

              {clients.length > 0 ? (
                <div className="space-y-3">
                  {clients.map((client) => {
                    const isDeleteConfirmOpen =
                      confirmDeleteClientId === client.id;

                    return (
                      <div
                        key={client.id}
                        className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(45_212_191_/_0.12)] text-sm font-semibold text-[rgb(94_234_212)]">
                              {getClientInitials(client.full_name)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/clients/${client.id}`}
                                  className="text-base font-semibold text-white transition hover:text-[rgb(94_234_212)]"
                                >
                                  {client.full_name}
                                </Link>

                                <Badge tone="muted">
                                  Client ID #{client.id}
                                </Badge>
                              </div>

                              <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                                {client.phone}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge tone="muted">
                                  Дата рождения:{" "}
                                  {formatBirthDate(client.birth_date)}
                                </Badge>

                                {client.preferences ? (
                                  <Badge tone="primary">
                                    Есть предпочтения
                                  </Badge>
                                ) : (
                                  <Badge tone="muted">
                                    Без предпочтений
                                  </Badge>
                                )}
                              </div>

                              {client.preferences ? (
                                <div className="mt-3 line-clamp-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                  {client.preferences}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                            <Link href={`/clients/${client.id}`}>
                              <Button type="button" variant="secondary" size="sm">
                                Открыть
                              </Button>
                            </Link>

                            {canUpdateClients ? (
                              <Link href={`/clients/${client.id}/edit`}>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                >
                                  Редактировать
                                </Button>
                              </Link>
                            ) : null}

                            {canDeleteClients ? (
                              <>
                                {!isDeleteConfirmOpen ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setConfirmDeleteClientId(client.id)
                                    }
                                  >
                                    Удалить
                                  </Button>
                                ) : (
                                  <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-3">
                                    <div className="mb-3 max-w-[260px] text-xs leading-5 text-[rgb(252_165_165)]">
                                      Удалить можно только клиента без машин и
                                      заказов.
                                    </div>

                                    <div className="flex flex-col gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={
                                          deletingClientId === client.id
                                        }
                                        onClick={() =>
                                          void handleDeleteClient(client.id)
                                        }
                                      >
                                        {deletingClientId === client.id
                                          ? "Удаляем..."
                                          : "Подтвердить"}
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={
                                          deletingClientId === client.id
                                        }
                                        onClick={() =>
                                          setConfirmDeleteClientId(null)
                                        }
                                      >
                                        Отмена
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}