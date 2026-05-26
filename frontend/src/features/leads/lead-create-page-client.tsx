"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
import { createLead } from "@/src/features/leads/api";
import type { LeadCreatePayload } from "@/src/features/leads/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";

type LeadItemFormState = {
  service_name_text: string;
  quantity: string;
  comment: string;
};

type LeadFormState = {
  source: string;
  client_name: string;
  phone: string;
  message: string;

  car_brand: string;
  car_model: string;
  car_year: string;
  car_color: string;
  plate_number: string;

  preferred_time: string;
  comment: string;

  items: LeadItemFormState[];
};

const defaultForm: LeadFormState = {
  source: "manual",
  client_name: "",
  phone: "",
  message: "",

  car_brand: "",
  car_model: "",
  car_year: "",
  car_color: "",
  plate_number: "",

  preferred_time: "",
  comment: "",

  items: [
    {
      service_name_text: "",
      quantity: "1",
      comment: "",
    },
  ],
};

const sourceOptions = [
  { value: "manual", label: "Ручная" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "website", label: "Сайт" },
  { value: "bot", label: "Бот" },
];

function normalizeNullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export function LeadCreatePageClient() {
  const router = useRouter();
  const { session } = useAuth();

  const [form, setForm] = useState<LeadFormState>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageLeads = canAccessByPermission(session, "leads.manage");

  function updateForm(patch: Partial<LeadFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function updateItem(index: number, patch: Partial<LeadItemFormState>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
    setError(null);
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          service_name_text: "",
          quantity: "1",
          comment: "",
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length <= 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function validateForm() {
    if (!form.phone.trim()) {
      return "Укажите телефон клиента.";
    }

    const hasService = form.items.some((item) =>
      item.service_name_text.trim(),
    );

    if (!hasService) {
      return "Добавьте хотя бы одну интересующую услугу.";
    }

    for (const item of form.items) {
      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return "Количество услуги должно быть больше 0.";
      }
    }

    if (form.car_year.trim()) {
      const year = Number(form.car_year);

      if (!Number.isInteger(year) || year < 1950 || year > 2100) {
        return "Укажите корректный год автомобиля.";
      }
    }

    return null;
  }

  function buildPayload(): LeadCreatePayload {
    return {
      source: form.source,

      client_name: normalizeNullableText(form.client_name),
      phone: form.phone.trim(),

      message: normalizeNullableText(form.message),

      car_brand: normalizeNullableText(form.car_brand),
      car_model: normalizeNullableText(form.car_model),
      car_year: form.car_year.trim() ? Number(form.car_year) : null,
      car_color: normalizeNullableText(form.car_color),
      plate_number: normalizeNullableText(form.plate_number),

      preferred_time: normalizeNullableText(form.preferred_time),
      comment: normalizeNullableText(form.comment),

      items: form.items
        .filter((item) => item.service_name_text.trim())
        .map((item) => ({
          service_id: null,
          service_name_text: item.service_name_text.trim(),
          material_brand_id: null,
          service_package_id: null,
          quantity: Number(item.quantity) || 1,
          comment: normalizeNullableText(item.comment),
        })),
    };
  }

  async function handleSubmit() {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const createdLead = await createLead(buildPayload());
      router.push(routes.leadDetails(createdLead.id));
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Заявки"
        title="Создать заявку"
        description="Ручное создание входящей заявки. Заказ будет создан только после подтверждения."
        actions={
          <Link href={routes.leads}>
            <Button type="button" variant="secondary">
              Назад к заявкам
            </Button>
          </Link>
        }
      />

      {!canManageLeads ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к созданию заявок
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для создания нужен доступ{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              leads.manage
            </span>
            .
          </div>
        </div>
      ) : null}

      {canManageLeads ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-5 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Клиент и источник</CardTitle>
              <CardDescription>
                Эти данные позже будут использоваться для создания клиента в CRM.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Имя клиента"
                  placeholder="Например: Ержан"
                  value={form.client_name}
                  onChange={(event) =>
                    updateForm({ client_name: event.target.value })
                  }
                />

                <Input
                  label="Телефон"
                  placeholder="+77001234567"
                  value={form.phone}
                  onChange={(event) =>
                    updateForm({ phone: event.target.value })
                  }
                />
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-[hsl(var(--muted))]">
                  Источник
                </div>

                <div className="flex flex-wrap gap-2">
                  {sourceOptions.map((source) => (
                    <Button
                      key={source.value}
                      type="button"
                      variant={
                        form.source === source.value ? "primary" : "secondary"
                      }
                      onClick={() => updateForm({ source: source.value })}
                    >
                      {source.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <Input
                  label="Сообщение клиента"
                  placeholder="Например: Хочу узнать цену на полировку и химчистку"
                  value={form.message}
                  onChange={(event) =>
                    updateForm({ message: event.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Автомобиль</CardTitle>
              <CardDescription>
                Данные можно заполнить частично. Менеджер уточнит их перед подтверждением.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Марка"
                  placeholder="Toyota"
                  value={form.car_brand}
                  onChange={(event) =>
                    updateForm({ car_brand: event.target.value })
                  }
                />

                <Input
                  label="Модель"
                  placeholder="Camry"
                  value={form.car_model}
                  onChange={(event) =>
                    updateForm({ car_model: event.target.value })
                  }
                />

                <Input
                  label="Год"
                  placeholder="2020"
                  value={form.car_year}
                  onChange={(event) =>
                    updateForm({ car_year: event.target.value })
                  }
                />

                <Input
                  label="Цвет"
                  placeholder="Черный"
                  value={form.car_color}
                  onChange={(event) =>
                    updateForm({ car_color: event.target.value })
                  }
                />

                <Input
                  label="Госномер"
                  placeholder="777ABC02"
                  value={form.plate_number}
                  onChange={(event) =>
                    updateForm({ plate_number: event.target.value })
                  }
                />

                <Input
                  label="Желаемое время"
                  placeholder="Например: после 15:00"
                  value={form.preferred_time}
                  onChange={(event) =>
                    updateForm({ preferred_time: event.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Интересующие услуги</CardTitle>
                  <CardDescription>
                    Пока можно указать услуги текстом. Позже менеджер сопоставит их с услугами CRM.
                  </CardDescription>
                </div>

                <Button type="button" variant="secondary" onClick={addItem}>
                  Добавить услугу
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <Badge tone="primary">Услуга #{index + 1}</Badge>

                      {form.items.length > 1 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => removeItem(index)}
                        >
                          Удалить
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px]">
                      <Input
                        label="Название услуги"
                        placeholder="Например: Полировка кузова"
                        value={item.service_name_text}
                        onChange={(event) =>
                          updateItem(index, {
                            service_name_text: event.target.value,
                          })
                        }
                      />

                      <Input
                        label="Количество"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, {
                            quantity: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="mt-4">
                      <Input
                        label="Комментарий к услуге"
                        placeholder="Например: есть царапины на двери"
                        value={item.comment}
                        onChange={(event) =>
                          updateItem(index, {
                            comment: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Внутренний комментарий</CardTitle>
              <CardDescription>
                Комментарий для менеджера. Клиент его не увидит.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Input
                label="Комментарий"
                placeholder="Например: уточнить бюджет и дату записи"
                value={form.comment}
                onChange={(event) =>
                  updateForm({ comment: event.target.value })
                }
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Link href={routes.leads}>
              <Button type="button" variant="secondary">
                Отмена
              </Button>
            </Link>

            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Создаем..." : "Создать заявку"}
            </Button>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}