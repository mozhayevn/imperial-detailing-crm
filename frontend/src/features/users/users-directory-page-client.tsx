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

import { apiConfig } from "@/src/config/api";
import { routes } from "@/src/config/routes";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getPublicUsers } from "@/src/features/users/api";
import type { UserPublicListItem } from "@/src/features/users/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";

function getAvatarUrl(avatarUrl: string | null) {
  if (!avatarUrl) {
    return null;
  }

  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }

  return `${apiConfig.baseUrl}${avatarUrl}`;
}

function getRoleLabel(roleName: string) {
  const labels: Record<string, string> = {
    admin: "Администратор",
    manager: "Менеджер",
    master: "Мастер",
    viewer: "Наблюдатель",
  };

  return labels[roleName] ?? roleName;
}

function getRoleTone(roleName: string) {
  if (roleName === "admin") {
    return "danger";
  }

  if (roleName === "manager") {
    return "primary";
  }

  if (roleName === "master") {
    return "success";
  }

  return "muted";
}

export function UsersDirectoryPageClient() {
  const { session } = useAuth();

  const [users, setUsers] = useState<UserPublicListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadUsers = canAccessByPermission(session, "users.read");

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        user.full_name.toLowerCase().includes(normalizedSearch) ||
        (user.email?.toLowerCase() ?? "").includes(normalizedSearch) ||
        (user.phone?.toLowerCase() ?? "").includes(normalizedSearch) ||
        user.roles.some((role) =>
          getRoleLabel(role).toLowerCase().includes(normalizedSearch),
        )
      );
    });
  }, [users, search]);

  async function loadUsers() {
    if (!canReadUsers) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPublicUsers();
      setUsers(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialUsers() {
      if (!canReadUsers) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getPublicUsers();

        if (!isMounted) {
          return;
        }

        setUsers(result);
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

    void loadInitialUsers();

    return () => {
      isMounted = false;
    };
  }, [canReadUsers]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Сотрудники"
        title="Сотрудники"
        description="Список сотрудников CRM и публичные профили с учетом настроек конфиденциальности."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => void loadUsers()}
          >
            Обновить
          </Button>
        }
      />

      {!canReadUsers ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к списку сотрудников
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для просмотра нужен доступ{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              users.read
            </span>
            .
          </div>
        </div>
      ) : null}

      {canReadUsers ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Всего сотрудников
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {users.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                Активные
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {users.filter((user) => user.is_active).length}
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Полный доступ к профилям
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {users.filter((user) => user.can_view_full_profile).length}
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
              <CardTitle>Каталог сотрудников</CardTitle>
              <CardDescription>
                Поиск по имени, роли, телефону или email, если они доступны.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Input
                label="Поиск"
                placeholder="Например: менеджер, мастер, имя или телефон"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {isLoading ? (
                <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем сотрудников...
                </div>
              ) : null}

              {!isLoading && filteredUsers.length === 0 && !error ? (
                <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Сотрудники не найдены.
                </div>
              ) : null}

              {!isLoading && filteredUsers.length > 0 ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {filteredUsers.map((user) => {
                    const avatarUrl = getAvatarUrl(user.avatar_url);

                    return (
                      <Link
                        key={user.id}
                        href={routes.userProfile(user.id)}
                        className="group rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.28)] hover:shadow-lg hover:shadow-black/20"
                      >
                        <div className="flex gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] text-lg font-semibold text-[rgb(94_234_212)]">
                            {avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={avatarUrl}
                                alt={user.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              user.full_name.slice(0, 1).toUpperCase()
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="break-words text-base font-semibold text-white">
                                {user.full_name}
                              </div>

                              <Badge tone={user.is_active ? "success" : "muted"}>
                                {user.is_active ? "Активен" : "Неактивен"}
                              </Badge>

                              {user.can_view_full_profile ? (
                                <Badge tone="primary">Полный доступ</Badge>
                              ) : (
                                <Badge tone="muted">Ограниченно</Badge>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {user.roles.length > 0 ? (
                                user.roles.map((role) => (
                                  <Badge key={role} tone={getRoleTone(role)}>
                                    {getRoleLabel(role)}
                                  </Badge>
                                ))
                              ) : (
                                <Badge tone="muted">Без роли</Badge>
                              )}
                            </div>

                            <div className="mt-3 space-y-1 text-xs leading-5 text-[hsl(var(--muted))]">
                              <div>
                                Email: {user.email ?? "скрыт настройками"}
                              </div>
                              <div>
                                Телефон: {user.phone ?? "скрыт настройками"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
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