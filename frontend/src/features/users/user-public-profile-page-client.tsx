"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
import { apiConfig } from "@/src/config/api";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getUserPublicProfile } from "@/src/features/users/api";
import type { UserPublicProfile } from "@/src/features/users/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";

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

function getVisibilityLabel(isVisible: boolean) {
  return isVisible ? "Доступно" : "Скрыто";
}

function getVisibilityTone(isVisible: boolean) {
  return isVisible ? "success" : "muted";
}

function ProfileField({
  title,
  value,
  isVisible,
}: {
  title: string;
  value: string | null;
  isVisible: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-[hsl(var(--muted))]">
            {title}
          </div>

          <div className="mt-3 break-words text-base font-semibold text-white">
            {value ?? "Скрыто настройками конфиденциальности"}
          </div>
        </div>

        <Badge tone={getVisibilityTone(isVisible)}>
          {getVisibilityLabel(isVisible)}
        </Badge>
      </div>
    </div>
  );
}

function PrivacyItem({
  title,
  description,
  isVisible,
}: {
  title: string;
  description: string;
  isVisible: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            {description}
          </div>
        </div>

        <Badge tone={getVisibilityTone(isVisible)}>
          {getVisibilityLabel(isVisible)}
        </Badge>
      </div>
    </div>
  );
}

function getAvatarUrl(avatarUrl: string | null) {
  if (!avatarUrl) {
    return null;
  }

  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }

  return `${apiConfig.baseUrl}${avatarUrl}`;
}

export function UserPublicProfilePageClient({
  userId,
}: {
  userId: string;
}) {
  const { session } = useAuth();

  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadUsers = canAccessByPermission(session, "users.read");
  const avatarUrl = profile ? getAvatarUrl(profile.avatar_url) : null;

  async function loadProfile() {
    if (!canReadUsers) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getUserPublicProfile(userId);
      setProfile(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialProfile() {
      if (!canReadUsers) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getUserPublicProfile(userId);

        if (!isMounted) {
          return;
        }

        setProfile(result);
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

    void loadInitialProfile();

    return () => {
      isMounted = false;
    };
  }, [canReadUsers, userId]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Сотрудники"
        title={profile?.full_name ?? "Профиль сотрудника"}
        description="Публичная карточка сотрудника с учетом настроек конфиденциальности."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={routes.admin}>
              <Button type="button" variant="secondary">
                Назад в администрирование
              </Button>
            </Link>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void loadProfile()}
            >
              Обновить
            </Button>
          </div>
        }
      />

      {!canReadUsers ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к профилям сотрудников
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

      {error ? (
        <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-5 text-sm leading-6 text-[rgb(252_165_165)]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
          Загружаем профиль сотрудника...
        </div>
      ) : null}

      {!isLoading && profile ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-6 pt-1 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="flex h-22 w-22 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-[rgb(45_212_191_/_0.24)] bg-[rgb(45_212_191_/_0.08)] text-2xl font-semibold text-[rgb(94_234_212)]">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={profile.full_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        profile.full_name.slice(0, 1).toUpperCase()
                      )}
                    </div>

                    <div className="mt-5 min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgb(45_212_191)]">
                        Профиль сотрудника
                      </div>

                      <div className="mt-2 break-words text-xl font-semibold tracking-tight text-white">
                        {profile.full_name}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {profile.roles.length > 0 ? (
                          profile.roles.map((role) => (
                            <Badge key={role} tone={getRoleTone(role)}>
                              {getRoleLabel(role)}
                            </Badge>
                          ))
                        ) : (
                          <Badge tone="muted">Без роли</Badge>
                        )}
                      </div>

                      <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted))]">
                        В CRM с {formatDateTime(profile.created_at)}
                      </div>
                    </div>
                  </div>

                 <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:min-w-[380px]">
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2.5">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Уровень
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        {profile.is_super_admin ? "Супер админ" : "Сотрудник"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2.5">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Статус
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        {profile.is_active ? "Активен" : "Неактивен"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2.5">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Просмотр
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        {profile.can_view_full_profile
                          ? "Полный"
                          : "Ограниченный"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Контакты</CardTitle>
              <CardDescription>
                Телефон и email отображаются по правилам конфиденциальности.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <ProfileField
                  title="Телефон"
                  value={profile.phone}
                  isVisible={Boolean(profile.phone)}
                />

                <ProfileField
                  title="Email"
                  value={profile.email}
                  isVisible={Boolean(profile.email)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Конфиденциальность</CardTitle>
              <CardDescription>
                Какие данные сотрудника доступны текущему пользователю.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <PrivacyItem
                  title="Телефон"
                  description="Разрешено ли видеть номер телефона сотрудника."
                  isVisible={profile.privacy_show_phone}
                />

                <PrivacyItem
                  title="Email"
                  description="Разрешено ли видеть email сотрудника."
                  isVisible={profile.privacy_show_email}
                />

                <PrivacyItem
                  title="Активность"
                  description="Разрешено ли видеть рабочую активность сотрудника."
                  isVisible={profile.privacy_show_activity}
                />

                <PrivacyItem
                  title="Online-статус"
                  description="Разрешено ли видеть, что сотрудник сейчас в системе."
                  isVisible={profile.privacy_show_online_status}
                />

                <PrivacyItem
                  title="Загрузка заказами"
                  description="Разрешено ли видеть текущую загрузку сотрудника по заказам."
                  isVisible={profile.privacy_show_order_load}
                />

                <PrivacyItem
                  title="История действий"
                  description="Разрешено ли видеть действия сотрудника в истории аудита."
                  isVisible={profile.privacy_show_audit_history}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}