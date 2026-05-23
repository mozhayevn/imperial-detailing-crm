"use client";

import Link from "next/link";
import { useState } from "react";
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
import { createClient } from "@/src/features/clients/api";

type ClientCreateForm = {
  full_name: string;
  phone: string;
  birth_date_day: string;
  birth_date_month: string;
  birth_date_year: string;
  preferences: string;
};

const defaultForm: ClientCreateForm = {
  full_name: "",
  phone: "",
  birth_date_day: "",
  birth_date_month: "",
  birth_date_year: "",
  preferences: "",
};

function buildBirthDate(form: ClientCreateForm) {
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

export function ClientCreatePageClient() {
  const router = useRouter();
  const { session } = useAuth();

  const [form, setForm] = useState<ClientCreateForm>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreateClients = canAccessByPermission(session, "clients.create");

  function updateForm(patch: Partial<ClientCreateForm>) {
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

      const createdClient = await createClient({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        birth_date: birthDate,
        preferences: form.preferences.trim() || null,
      });

      router.push(`/clients/${createdClient.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Клиенты"
        title="Создать клиента"
        description="Добавьте нового клиента в CRM."
        actions={
          <Link href="/clients">
            <Button type="button" variant="secondary">
              К списку клиентов
            </Button>
          </Link>
        }
      />

      {!canCreateClients ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к созданию клиентов. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                clients.create
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canCreateClients ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Данные клиента</CardTitle>
            <CardDescription>
              ФИО и телефон обязательны. Предпочтения можно заполнить позже.
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
                    value={form.birth_date_day ?? ""}
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
                    value={form.birth_date_month ?? ""}
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
                    value={form.birth_date_year ?? ""}
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
              <Link href="/clients">
                <Button type="button" variant="secondary">
                  Отмена
                </Button>
              </Link>

              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? "Создаем..." : "Создать клиента"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}