"use client";

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

import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getSecurityAuditLogs } from "@/src/features/security-audit/api";
import type { SecurityAuditLog } from "@/src/features/security-audit/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";

function getSecurityActionLabel(action: string) {
  const labels: Record<string, string> = {
    login_success: "Успешный вход",
    two_factor_login_started: "Вход с двухфакторной защитой",
    two_factor_verified: "Двухфакторная проверка пройдена",
    two_factor_failed: "Ошибка двухфакторной проверки",
    two_factor_resend: "Повторная отправка кода",
    two_factor_setup_code_sent: "Код настройки двухфакторной защиты отправлен",
    two_factor_enabled: "Двухфакторная защита включена",
    two_factor_disabled: "Двухфакторная защита отключена",
    password_changed: "Пароль изменен",
    session_revoked: "Сессия отключена",
  };

  return labels[action] ?? action;
}

function getSecurityActionTone(action: string) {
  if (
    action === "login_success" ||
    action === "two_factor_verified" ||
    action === "two_factor_enabled"
  ) {
    return "success";
  }

  if (
    action === "two_factor_failed" ||
    action === "two_factor_disabled" ||
    action === "session_revoked"
  ) {
    return "danger";
  }

  if (
    action === "two_factor_login_started" ||
    action === "two_factor_resend" ||
    action === "two_factor_setup_code_sent" ||
    action === "password_changed"
  ) {
    return "warning";
  }

  return "muted";
}

function parseSecurityDetails(details: string | null) {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getReadableSecurityDetails(log: SecurityAuditLog) {
  const parsed = parseSecurityDetails(log.details);

  if (!parsed) {
    return log.details;
  }

  const message = parsed.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return "Событие безопасности зафиксировано.";
}

function getDetailBadges(log: SecurityAuditLog) {
  const parsed = parseSecurityDetails(log.details);

  if (!parsed) {
    return [];
  }

  const badges: string[] = [];

  const method = parsed.method;
  if (typeof method === "string" && method.trim()) {
    badges.push(`Метод: ${method}`);
  }

  const destinationMasked = parsed.destination_masked;
  if (typeof destinationMasked === "string" && destinationMasked.trim()) {
    badges.push(`Получатель: ${destinationMasked}`);
  }

  const challengeId = parsed.challenge_id;
  if (typeof challengeId === "number" || typeof challengeId === "string") {
    badges.push(`Проверка #${challengeId}`);
  }

  const reason = parsed.reason;
  if (typeof reason === "string" && reason.trim()) {
    badges.push(`Причина: ${reason}`);
  }

  const twoFactorUsed = parsed.two_factor_used;
  if (typeof twoFactorUsed === "boolean") {
    badges.push(twoFactorUsed ? "С 2FA" : "Без 2FA");
  }

  const sessionId = parsed.session_id;
  if (typeof sessionId === "number" || typeof sessionId === "string") {
    badges.push(`Сессия #${sessionId}`);
  }

  return badges;
}

export function SecurityAuditPageClient() {
  const { session } = useAuth();

  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadSecurityAudit = canAccessByPermission(
    session,
    "security.audit.read",
  );

  async function loadLogs() {
    if (!canReadSecurityAudit) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSecurityAuditLogs(10);
      setLogs(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialLogs() {
      if (!canReadSecurityAudit) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getSecurityAuditLogs(10);

        if (!isMounted) {
          return;
        }

        setLogs(result);
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

    void loadInitialLogs();

    return () => {
      isMounted = false;
    };
  }, [canReadSecurityAudit]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Безопасность"
        title="Журнал безопасности"
        description="Последние события входа, двухфакторной защиты, смены пароля и отключения сессий."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => void loadLogs()}
          >
            Обновить
          </Button>
        }
      />

      {!canReadSecurityAudit ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к журналу безопасности
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для просмотра нужен доступ{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              security.audit.read
            </span>
            .
          </div>
        </div>
      ) : null}

      {canReadSecurityAudit ? (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                Последних событий
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {logs.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Событий с риском
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {
                  logs.filter(
                    (log) => getSecurityActionTone(log.action) === "danger",
                  ).length
                }
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Период отображения
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                10
              </div>
              <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                последних записей
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
                  <CardTitle>Последние события безопасности</CardTitle>
                  <CardDescription>
                    Показываются последние 10 событий. Коды подтверждения,
                    пароли и токены здесь не отображаются.
                  </CardDescription>
                </div>

                <Badge tone={logs.length > 0 ? "primary" : "muted"}>
                  Записей: {logs.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем журнал безопасности...
                </div>
              ) : null}

              {!isLoading && logs.length === 0 && !error ? (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Событий безопасности пока нет.
                </div>
              ) : null}

              {!isLoading && logs.length > 0 ? (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={getSecurityActionTone(log.action)}>
                              {getSecurityActionLabel(log.action)}
                            </Badge>

                            <div className="text-sm font-semibold text-white">
                              {log.actor_user_full_name ??
                                log.target_user_full_name ??
                                "Сотрудник не определен"}
                            </div>
                          </div>

                          <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                            {formatDateTime(log.created_at)}
                            {log.ip_address ? ` · IP: ${log.ip_address}` : ""}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {getDetailBadges(log).map((badge) => (
                              <Badge key={badge} tone="muted">
                                {badge}
                              </Badge>
                            ))}
                          </div>

                          {getReadableSecurityDetails(log) ? (
                            <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 text-xs leading-5 text-[hsl(var(--muted))]">
                              {getReadableSecurityDetails(log)}
                            </div>
                          ) : null}

                          {log.user_agent ? (
                            <div className="mt-3 break-words text-xs leading-5 text-[hsl(var(--muted))]">
                              Устройство: {log.user_agent}
                            </div>
                          ) : null}
                        </div>

                        <Badge tone="muted">#{log.id}</Badge>
                      </div>
                    </div>
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