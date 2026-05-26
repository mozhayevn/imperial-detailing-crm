"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Combobox } from "@/src/components/ui/combobox";
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
  confirmLead,
  getLead,
  getLeadAuditLogs,
  updateLeadStatus,
} from "@/src/features/leads/api";
import type {
  Lead,
  LeadAuditLog,
  LeadStatus,
} from "@/src/features/leads/types";
import { getServices } from "@/src/features/services/api";
import type { Service } from "@/src/features/services/types";
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

function getLeadAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    lead_created: "Заявка создана",
    lead_updated: "Заявка обновлена",
    lead_status_changed: "Статус изменен",
  };

  return labels[action] ?? action;
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

function parseAuditDetails(details: string | null) {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getAuditDetailsText(log: LeadAuditLog) {
  const parsed = parseAuditDetails(log.details);

  if (!parsed) {
    return log.details;
  }

  const message = parsed.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const oldStatus = parsed.old_status;
  const newStatus = parsed.new_status;

  if (typeof oldStatus === "string" && typeof newStatus === "string") {
    return `Статус изменен: ${getLeadStatusLabel(oldStatus)} → ${getLeadStatusLabel(
      newStatus,
    )}`;
  }

  return "Событие заявки зафиксировано.";
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

export function LeadDetailsPageClient({ leadId }: { leadId: string }) {
  const { session } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [auditLogs, setAuditLogs] = useState<LeadAuditLog[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIdByLeadItemId, setSelectedServiceIdByLeadItemId] =
    useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadLeads = canAccessByPermission(session, "leads.read");
  const canManageLeads = canAccessByPermission(session, "leads.manage");
  const canConfirmLeads = canAccessByPermission(session, "leads.confirm");
  const canRejectLeads = canAccessByPermission(session, "leads.reject");

  const serviceOptions = services.map((service) => {
    const requirements = [
      service.requires_brand ? "нужен бренд материала" : null,
      service.requires_package ? "нужен пакет услуги" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      value: String(service.id),
      label: service.name,
      description: requirements || service.description || "Активная услуга CRM",
    };
  });

  async function loadLead() {
    if (!canReadLeads) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [leadResult, auditResult, servicesResult] = await Promise.all([
        getLead(leadId),
        getLeadAuditLogs(leadId),
        getServices(),
      ]);

      setLead(leadResult);
      setAuditLogs(auditResult);
      setServices(servicesResult.filter((service) => service.is_active));

      setSelectedServiceIdByLeadItemId((current) => {
        const next = { ...current };

        leadResult.items.forEach((item) => {
          if (item.service_id && !next[item.id]) {
            next[item.id] = String(item.service_id);
          }
        });

        return next;
      });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(nextStatus: LeadStatus) {
    if (!lead) {
      return;
    }

    setIsChangingStatus(true);
    setError(null);

    try {
      const updatedLead = await updateLeadStatus(lead.id, {
        status: nextStatus,
      });

      const updatedAuditLogs = await getLeadAuditLogs(lead.id);

      setLead(updatedLead);
      setAuditLogs(updatedAuditLogs);
    } catch (statusError) {
      setError(getApiErrorMessage(statusError));
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleConfirmLead() {
    if (!lead) {
      return;
    }

    if (lead.items.length === 0) {
      setError(
        "В заявке нет услуг. Добавьте хотя бы одну услугу перед подтверждением.",
      );
      return;
    }

    const items = lead.items.map((item) => {
      const selectedServiceId = selectedServiceIdByLeadItemId[item.id];

      return {
        lead_item_id: item.id,
        service_id: selectedServiceId ? Number(selectedServiceId) : 0,
        material_brand_id: item.material_brand_id,
        service_package_id: item.service_package_id,
        quantity: item.quantity || 1,
        discount_percent: 0,
        discount_reason: null,
      };
    });

    const hasMissingService = items.some((item) => !item.service_id);

    if (hasMissingService) {
      setError("Для каждой услуги из заявки выберите реальную услугу CRM.");
      return;
    }

    const hasClientName = Boolean(lead.client_name?.trim());
    const hasPhone = Boolean(lead.phone.trim());
    const hasCarBrand = Boolean(lead.car_brand?.trim());
    const hasCarModel = Boolean(lead.car_model?.trim());

    if (!hasClientName) {
      setError("Перед подтверждением укажите имя клиента в заявке.");
      return;
    }

    if (!hasPhone) {
      setError("Перед подтверждением укажите телефон клиента.");
      return;
    }

    if (!hasCarBrand || !hasCarModel) {
      setError("Перед подтверждением укажите марку и модель автомобиля.");
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const result = await confirmLead(lead.id, {
        client_name: lead.client_name,
        phone: lead.phone,
        car_brand: lead.car_brand,
        car_model: lead.car_model,
        car_year: lead.car_year,
        car_color: lead.car_color,
        plate_number: lead.plate_number,
        comment: "Подтверждено из карточки заявки",
        items,
      });

      const updatedAuditLogs = await getLeadAuditLogs(lead.id);

      setLead(result.lead);
      setAuditLogs(updatedAuditLogs);
    } catch (confirmError) {
      setError(getApiErrorMessage(confirmError));
    } finally {
      setIsConfirming(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialLead() {
      if (!canReadLeads) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [leadResult, auditResult, servicesResult] = await Promise.all([
          getLead(leadId),
          getLeadAuditLogs(leadId),
          getServices(),
        ]);

        if (!isMounted) {
          return;
        }

        setLead(leadResult);
        setAuditLogs(auditResult);
        setServices(servicesResult.filter((service) => service.is_active));

        setSelectedServiceIdByLeadItemId((current) => {
          const next = { ...current };

          leadResult.items.forEach((item) => {
            if (item.service_id && !next[item.id]) {
              next[item.id] = String(item.service_id);
            }
          });

          return next;
        });
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

    void loadInitialLead();

    return () => {
      isMounted = false;
    };
  }, [canReadLeads, leadId]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Заявки"
        title={lead ? `Заявка #${lead.id}` : "Карточка заявки"}
        description="Проверка входящей заявки перед созданием клиента, автомобиля и заказа."
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
              onClick={() => void loadLead()}
            >
              Обновить
            </Button>
          </div>
        }
      />

      {!canReadLeads ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к заявке
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
          Загружаем заявку...
        </div>
      ) : null}

      {!isLoading && lead ? (
        <div className="space-y-5">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="mt-4 text-2xl font-semibold tracking-tight text-white">
                    {lead.client_name || "Клиент без имени"}
                  </div>

                  <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                    {lead.phone} · {getLeadCarLabel(lead)}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                    Создано: {formatDateTime(lead.created_at)}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Badge tone={getLeadStatusTone(lead.status)}>
                      {getLeadStatusLabel(lead.status)}
                    </Badge>

                    <Badge tone={getLeadSourceTone(lead.source)}>
                      {getLeadSourceLabel(lead.source)}
                    </Badge>

                    {lead.created_order_id ? (
                      <Badge tone="success">Заказ создан</Badge>
                    ) : (
                      <Badge tone="muted">Заказ еще не создан</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 xl:justify-end">
                  {canManageLeads && lead.status === "new" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isChangingStatus}
                      onClick={() => void handleStatusChange("in_review")}
                    >
                      Взять в обработку
                    </Button>
                  ) : null}

                  {canRejectLeads &&
                  lead.status !== "confirmed" &&
                  lead.status !== "rejected" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isChangingStatus}
                      onClick={() => void handleStatusChange("rejected")}
                    >
                      Отклонить
                    </Button>
                  ) : null}

                  {canManageLeads &&
                  lead.status !== "confirmed" &&
                  lead.status !== "duplicate" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isChangingStatus}
                      onClick={() => void handleStatusChange("duplicate")}
                    >
                      Отметить дублем
                    </Button>
                  ) : null}

                  {canConfirmLeads && lead.status !== "confirmed" ? (
                    <Button
                      type="button"
                      disabled={isConfirming || lead.items.length === 0}
                      onClick={() => void handleConfirmLead()}
                    >
                      {isConfirming ? "Подтверждаем..." : "Подтвердить заказ"}
                    </Button>
                  ) : null}

                  {lead.created_order_id ? (
                    <Link href={routes.orderDetails(lead.created_order_id)}>
                      <Button type="button">Открыть заказ</Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Данные клиента</CardTitle>
                  <CardDescription>
                    Информация, полученная из заявки или будущего чат-бота.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBlock title="Имя клиента" value={lead.client_name} />
                    <InfoBlock title="Телефон" value={lead.phone} />
                    <InfoBlock
                      title="Источник"
                      value={getLeadSourceLabel(lead.source)}
                    />
                    <InfoBlock
                      title="Ответственный"
                      value={lead.assigned_user_full_name}
                    />
                  </div>

                  {lead.message ? (
                    <div className="mt-4 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Сообщение клиента
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white">
                        {lead.message}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Автомобиль</CardTitle>
                  <CardDescription>
                    Данные автомобиля для будущего создания заказа.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBlock title="Марка" value={lead.car_brand} />
                    <InfoBlock title="Модель" value={lead.car_model} />
                    <InfoBlock title="Год" value={lead.car_year} />
                    <InfoBlock title="Цвет" value={lead.car_color} />
                    <InfoBlock title="Госномер" value={lead.plate_number} />
                    <InfoBlock
                      title="Желаемое время"
                      value={lead.preferred_time}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Интересующие услуги</CardTitle>
                  <CardDescription>
                    Услуги могут быть выбраны из CRM или записаны текстом из
                    сообщения клиента.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {lead.items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-6 text-center text-sm text-[hsl(var(--muted))]">
                      Услуги не указаны.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lead.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {item.service_name ??
                                  item.service_name_text ??
                                  "Услуга"}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.material_brand_name ? (
                                  <Badge tone="muted">
                                    {item.material_brand_name}
                                  </Badge>
                                ) : null}

                                {item.service_package_name ? (
                                  <Badge tone="muted">
                                    {item.service_package_name}
                                  </Badge>
                                ) : null}

                                <Badge tone="primary">
                                  Кол-во: {item.quantity}
                                </Badge>
                              </div>

                              {lead.status !== "confirmed" &&
                              canConfirmLeads ? (
                                <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                                  <Combobox
                                    label="Реальная услуга CRM для создания заказа"
                                    placeholder="Выберите услугу"
                                    value={
                                      selectedServiceIdByLeadItemId[item.id] ??
                                      null
                                    }
                                    options={serviceOptions}
                                    onChange={(value) =>
                                      setSelectedServiceIdByLeadItemId(
                                        (current) => ({
                                          ...current,
                                          [item.id]: value ? String(value) : "",
                                        }),
                                      )
                                    }
                                    hint="Например, если клиент написал “полировка”, выберите услугу “Полировка”."
                                  />
                                </div>
                              ) : null}

                              {item.comment ? (
                                <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted))]">
                                  {item.comment}
                                </div>
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

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Связи CRM</CardTitle>
                  <CardDescription>
                    Появятся после подтверждения заявки.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Контакт заявки
                      </div>

                      <div className="mt-3">
                        <Link
                          href={routes.leadContactDetails(lead.lead_contact_id)}
                        >
                          <Button type="button" variant="secondary">
                            Открыть контакт
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <InfoBlock
                      title="Созданный клиент"
                      value={
                        lead.created_client_id
                          ? `Клиент #${lead.created_client_id}`
                          : null
                      }
                    />

                    <InfoBlock
                      title="Созданный автомобиль"
                      value={
                        lead.created_car_id
                          ? `Автомобиль #${lead.created_car_id}`
                          : null
                      }
                    />

                    <InfoBlock
                      title="Созданный заказ"
                      value={
                        lead.created_order_id
                          ? `Заказ #${lead.created_order_id}`
                          : null
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>История заявки</CardTitle>
                  <CardDescription>
                    Действия сотрудников и будущих интеграций.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {auditLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-6 text-center text-sm text-[hsl(var(--muted))]">
                      История заявки пока пустая.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="muted">
                              {getLeadAuditActionLabel(log.action)}
                            </Badge>
                          </div>

                          <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                            {formatDateTime(log.created_at)}
                            {log.actor_user_full_name
                              ? ` · ${log.actor_user_full_name}`
                              : " · Система"}
                          </div>

                          {getAuditDetailsText(log) ? (
                            <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                              {getAuditDetailsText(log)}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}