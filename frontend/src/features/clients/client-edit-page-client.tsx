"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getClientById, updateClient } from "@/src/features/clients/api";
import type { Client } from "@/src/features/clients/types";

type ClientEditPageClientProps = {
  clientId: number;
};

type ClientEditForm = {
  full_name: string;
  phone: string;
  birth_date_day: string;
  birth_date_month: string;
  birth_date_year: string;
  preferences: string;
};

const defaultForm: ClientEditForm = {
  full_name: "",
  phone: "",
  birth_date_day: "",
  birth_date_month: "",
  birth_date_year: "",
  preferences: "",
};

function splitBirthDate(value: string | null) {
  if (!value) {
    return {
      birth_date_day: "",
      birth_date_month: "",
      birth_date_year: "",
    };
  }

  const dateOnly = value.split("T")[0];
  const [year, month, day] = dateOnly.split("-");

  return {
    birth_date_day: day ?? "",
    birth_date_month: month ?? "",
    birth_date_year: year ?? "",
  };
}

function buildBirthDate(form: ClientEditForm) {
  const day = form.birth_date_day.trim();
  const month = form.birth_date_month.trim();
  const year = form.birth_date_year.trim();

  if (!day && !month && !year) {
    return null;
  }

  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    throw new Error("Укажите дату рождения в формате ДД / ММ / ГГГГ.");
  }

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  if (
    !Number.isInteger(dayNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(yearNumber) ||
    dayNumber < 1 ||
    dayNumber > 31 ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    yearNumber < 1900 ||
    yearNumber > new Date().getFullYear()
  ) {
    throw new Error("Укажите корректную дату рождения.");
  }

  return `${year}-${month}-${day}`;
}

function mapClientToForm(client: Client): ClientEditForm {
  const birthDateParts = splitBirthDate(client.birth_date);

  return {
    full_name: client.full_name,
    phone: client.phone,
    birth_date_day: birthDateParts.birth_date_day,
    birth_date_month: birthDateParts.birth_date_month,
    birth_date_year: birthDateParts.birth_date_year,
    preferences: client.preferences ?? "",
  };
}

export function ClientEditPageClient({ clientId }: ClientEditPageClientProps) {
  const router = useRouter();
  const { session } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientEditForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadClients = canAccessByPermission(session, "clients.read");
  const canUpdateClients = canAccessByPermission(session, "clients.update");

  useEffect(() => {
    let isMounted = true;

    async function loadClient() {
      if (!canReadClients) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getClientById(clientId);

        if (isMounted) {
          setClient(result);
          setForm(mapClientToForm(result));
        }
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

    void loadClient();

    return () => {
      isMounted = false;
    };
  }, [clientId, canReadClients]);

  function updateForm(patch: Partial<ClientEditForm>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  async function handleSubmit() {
    if (!form.full_name.trim()) {
      setError("Укажите ФИО клиента.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Укажите телефон клиента.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let birthDate: string | null = null;

      try {
        birthDate = buildBirthDate(form);
      } catch (validationError) {
        setError(
          validationError instanceof Error
            ? validationError.message
            : "Проверьте дату рождения.",
        );
        setIsSubmitting(false);
        return;
      }

      const updatedClient = await updateClient(clientId, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        birth_date: birthDate,
        preferences: form.preferences.trim() || null,
      });

      router.push(`/clients/${updatedClient.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
              Загружаем данные клиента...
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!canReadClients || !canUpdateClients) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к редактированию клиента. Нужны permissions{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                clients.read
              </span>{" "}
              и{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                clients.update
              </span>
              .
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (error && !client) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Клиенты"
          title="Клиент не найден"
          description="Не удалось загрузить данные клиента для редактирования."
          actions={
            <Link href="/clients">
              <Button type="button" variant="secondary">
                К списку клиентов
              </Button>
            </Link>
          }
        />

        <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
          {error}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Клиенты"
        title="Редактировать клиента"
        description={
          client
            ? `Изменение данных клиента ${client.full_name}.`
            : "Изменение данных клиента."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={client ? `/clients/${client.id}` : "/clients"}>
              <Button type="button" variant="secondary">
                Назад
              </Button>
            </Link>

            <Link href="/clients">
              <Button type="button" variant="secondary">
                К списку клиентов
              </Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Данные клиента</CardTitle>
          <CardDescription>
            Обновите ФИО, телефон, дату рождения и предпочтения клиента.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              label="ФИО клиента"
              placeholder="Например: Иван Петров"
              value={form.full_name}
              onChange={(event) =>
                updateForm({
                  full_name: event.target.value,
                })
              }
            />

            <Input
              label="Телефон"
              placeholder="+7..."
              value={form.phone}
              onChange={(event) =>
                updateForm({
                  phone: event.target.value,
                })
              }
            />
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-medium text-white">
              Дата рождения
            </div>

            <div className="grid gap-3 sm:grid-cols-[120px_1fr_140px]">
              <Input
                label="День"
                placeholder="03"
                inputMode="numeric"
                maxLength={2}
                value={form.birth_date_day}
                onChange={(event) =>
                  updateForm({
                    birth_date_day: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2),
                  })
                }
              />

              <Input
                label="Месяц"
                placeholder="05"
                inputMode="numeric"
                maxLength={2}
                value={form.birth_date_month}
                onChange={(event) =>
                  updateForm({
                    birth_date_month: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2),
                  })
                }
              />

              <Input
                label="Год"
                placeholder="1998"
                inputMode="numeric"
                maxLength={4}
                value={form.birth_date_year}
                onChange={(event) =>
                  updateForm({
                    birth_date_year: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4),
                  })
                }
              />
            </div>

            <div className="mt-2 text-xs text-[hsl(var(--muted))]">
              Формат: день, месяц, год. Например: 03 / 05 / 1998.
            </div>
          </div>

          <div className="mt-4">
            <Textarea
              label="Предпочтения клиента"
              placeholder="Например: предпочитает звонок после 18:00, любит защитные пленки, не любит запах химии..."
              value={form.preferences}
              onChange={(event) =>
                updateForm({
                  preferences: event.target.value,
                })
              }
            />
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link href={client ? `/clients/${client.id}` : "/clients"}>
              <Button type="button" variant="secondary">
                Отмена
              </Button>
            </Link>

            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Сохраняем..." : "Сохранить изменения"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}