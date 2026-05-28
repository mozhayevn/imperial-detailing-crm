"use client";

import Link from "next/link";
import { routes } from "@/src/config/routes";

import { useEffect, useMemo, useState } from "react";
import { DateTimeInput } from "@/src/components/ui/date-time-input";
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
import { Textarea } from "@/src/components/ui/textarea";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";

import {
  createWorkBay,
  deleteWorkBay,
  getAvailableWorkBays,
  getWorkBays,
  updateWorkBay,
} from "@/src/features/work-bays/api";
import type {
  WorkBay,
  WorkBayAvailability,
} from "@/src/features/work-bays/types";

type WorkBayFormState = {
  name: string;
  description: string;
};

type AvailabilityFormState = {
  planned_start_at: string;
  planned_end_at: string;
};

const defaultForm: WorkBayFormState = {
  name: "",
  description: "",
};

const defaultAvailabilityForm: AvailabilityFormState = {
  planned_start_at: "",
  planned_end_at: "",
};

function toApiDateTime(value: string) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString();
}

function getAvailabilityTone(item: WorkBayAvailability | undefined) {
  if (!item) {
    return "muted";
  }

  return item.is_available ? "success" : "danger";
}

function getAvailabilityLabel(item: WorkBayAvailability | undefined) {
  if (!item) {
    return "Не проверено";
  }

  return item.is_available ? "Свободен" : "Занят";
}

export function WorkBaysPageClient() {
  const { session } = useAuth();

  const [workBays, setWorkBays] = useState<WorkBay[]>([]);
  const [availability, setAvailability] = useState<WorkBayAvailability[]>([]);

  const [form, setForm] = useState<WorkBayFormState>(defaultForm);
  const [editingBayId, setEditingBayId] = useState<number | null>(null);
  const [editingForm, setEditingForm] =
    useState<WorkBayFormState>(defaultForm);

  const [availabilityForm, setAvailabilityForm] =
    useState<AvailabilityFormState>(defaultAvailabilityForm);

  const [search, setSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [submittingEditBayId, setSubmittingEditBayId] = useState<number | null>(
    null,
  );
  const [deleteConfirmBayId, setDeleteConfirmBayId] = useState<number | null>(
    null,
  );
  const [deletingBayId, setDeletingBayId] = useState<number | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const canReadWorkBays = canAccessByPermission(session, "work_bays.read");
  const canManageWorkBays = canAccessByPermission(session, "work_bays.manage");

  const availabilityByBayId = useMemo(() => {
    return availability.reduce<Record<number, WorkBayAvailability>>(
      (acc, item) => {
        acc[item.id] = item;
        return acc;
      },
      {},
    );
  }, [availability]);

  const filteredWorkBays = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return workBays.filter((bay) => {
      return (
        !normalizedSearch ||
        bay.name.toLowerCase().includes(normalizedSearch) ||
        (bay.description?.toLowerCase() ?? "").includes(normalizedSearch)
      );
    });
  }, [workBays, search]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!canReadWorkBays) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getWorkBays();

        if (!isMounted) {
          return;
        }

        setWorkBays(result);
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

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [canReadWorkBays]);

  function updateForm(patch: Partial<WorkBayFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function updateEditingForm(patch: Partial<WorkBayFormState>) {
    setEditingForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function updateAvailabilityForm(patch: Partial<AvailabilityFormState>) {
    setAvailabilityForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function validateForm(currentForm: WorkBayFormState) {
    const name = currentForm.name.trim();

    if (!name) {
      return {
        error: "Укажите название бокса.",
        payload: null,
      };
    }

    return {
      error: null,
      payload: {
        name,
        description: currentForm.description.trim() || null,
      },
    };
  }

  async function reloadWorkBays() {
    const result = await getWorkBays();
    setWorkBays(result);
  }

  async function handleCreateWorkBay() {
    const validation = validateForm(form);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные бокса.");
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdBay = await createWorkBay(validation.payload);

      setWorkBays((current) => [createdBay, ...current]);
      setForm(defaultForm);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  function startEditWorkBay(bay: WorkBay) {
    setEditingBayId(bay.id);
    setEditingForm({
      name: bay.name,
      description: bay.description ?? "",
    });
    setDeleteConfirmBayId(null);
    setError(null);
  }

  function cancelEditWorkBay() {
    setEditingBayId(null);
    setEditingForm(defaultForm);
    setError(null);
  }

  async function handleUpdateWorkBay(bayId: number) {
    const validation = validateForm(editingForm);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные бокса.");
      return;
    }

    setSubmittingEditBayId(bayId);
    setError(null);

    try {
      const updatedBay = await updateWorkBay(bayId, validation.payload);

      setWorkBays((current) =>
        current.map((bay) => (bay.id === updatedBay.id ? updatedBay : bay)),
      );

      setEditingBayId(null);
      setEditingForm(defaultForm);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setSubmittingEditBayId(null);
    }
  }

  async function handleDeleteWorkBay(bayId: number) {
    setDeletingBayId(bayId);
    setError(null);

    try {
      await deleteWorkBay(bayId);

      setWorkBays((current) => current.filter((bay) => bay.id !== bayId));
      setDeleteConfirmBayId(null);

      if (editingBayId === bayId) {
        setEditingBayId(null);
        setEditingForm(defaultForm);
      }
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingBayId(null);
    }
  }

  async function handleCheckAvailability() {
    if (!availabilityForm.planned_start_at || !availabilityForm.planned_end_at) {
      setError("Укажите начало и конец интервала.");
      return;
    }

    const startDate = new Date(availabilityForm.planned_start_at);
    const endDate = new Date(availabilityForm.planned_end_at);

    if (startDate >= endDate) {
      setError("Конец интервала должен быть позже начала.");
      return;
    }

    setIsCheckingAvailability(true);
    setError(null);

    try {
      const result = await getAvailableWorkBays({
        planned_start_at: toApiDateTime(availabilityForm.planned_start_at),
        planned_end_at: toApiDateTime(availabilityForm.planned_end_at),
      });

      setAvailability(result);
    } catch (availabilityError) {
      setError(getApiErrorMessage(availabilityError));
    } finally {
      setIsCheckingAvailability(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Рабочие боксы"
        title="Рабочие боксы"
        description="Управление рабочими боксами и проверка доступности по расписанию заказов."
        actions={
          <Link href={routes.workBaySchedule}>
            <Button type="button" variant="secondary">
              Расписание
            </Button>
          </Link>
        }
      />

      {!canReadWorkBays ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к рабочим боксам. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                work_bays.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadWorkBays ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Всего боксов
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {workBays.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                Свободно
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {availability.length > 0
                  ? availability.filter((item) => item.is_available).length
                  : "—"}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
              <div className="text-xs font-medium text-[rgb(252_165_165)]">
                Занято
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {availability.length > 0
                  ? availability.filter((item) => !item.is_available).length
                  : "—"}
              </div>
            </div>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>Список боксов</CardTitle>
                      <CardDescription>
                        Всего: {workBays.length}. Найдено:{" "}
                        {filteredWorkBays.length}.
                      </CardDescription>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isLoading}
                      onClick={() => void reloadWorkBays()}
                    >
                      Обновить
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  <Input
                    label="Поиск"
                    placeholder="Например: Бокс 1, детейлинг, покраска..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                      Загружаем боксы...
                    </div>
                  ) : null}

                  {!isLoading && filteredWorkBays.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Рабочие боксы не найдены.
                    </div>
                  ) : null}

                  {!isLoading && filteredWorkBays.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {filteredWorkBays.map((bay) => {
                        const isEditing = editingBayId === bay.id;
                        const bayAvailability = availabilityByBayId[bay.id];

                        return (
                          <div
                            key={bay.id}
                            className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                          >
                            {!isEditing ? (
                              <div className="space-y-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="truncate text-base font-semibold text-white">
                                        {bay.name}
                                      </div>

                                      <Badge tone="muted">
                                        Bay ID #{bay.id}
                                      </Badge>

                                      <Badge
                                        tone={getAvailabilityTone(
                                          bayAvailability,
                                        )}
                                      >
                                        {getAvailabilityLabel(bayAvailability)}
                                      </Badge>
                                    </div>

                                    <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                      {bay.description || "Без описания"}
                                    </div>
                                  </div>

                                  {canManageWorkBays ? (
                                    <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => startEditWorkBay(bay)}
                                      >
                                        Редактировать
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-[rgb(252_165_165)] hover:text-[rgb(254_202_202)]"
                                        disabled={deletingBayId === bay.id}
                                        onClick={() =>
                                          setDeleteConfirmBayId((current) =>
                                            current === bay.id ? null : bay.id,
                                          )
                                        }
                                      >
                                        Удалить
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Статус доступности
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-white">
                                      {getAvailabilityLabel(bayAvailability)}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Конфликтующий заказ
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-white">
                                      {bayAvailability?.conflicting_order_id
                                        ? `Заказ #${bayAvailability.conflicting_order_id}`
                                        : "—"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <Input
                                  label="Название бокса"
                                  value={editingForm.name}
                                  onChange={(event) =>
                                    updateEditingForm({
                                      name: event.target.value,
                                    })
                                  }
                                />

                                <Textarea
                                  label="Описание"
                                  placeholder="Например: большой бокс для PPF..."
                                  value={editingForm.description}
                                  onChange={(event) =>
                                    updateEditingForm({
                                      description: event.target.value,
                                    })
                                  }
                                />

                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={submittingEditBayId === bay.id}
                                    onClick={cancelEditWorkBay}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={submittingEditBayId === bay.id}
                                    onClick={() =>
                                      void handleUpdateWorkBay(bay.id)
                                    }
                                  >
                                    {submittingEditBayId === bay.id
                                      ? "Сохраняем..."
                                      : "Сохранить"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {deleteConfirmBayId === bay.id ? (
                              <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                                <div className="text-sm font-semibold text-[rgb(252_165_165)]">
                                  Подтвердить удаление бокса?
                                </div>

                                <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                                  Если бокс уже используется в заказах, позже
                                  лучше перейти на архивирование вместо
                                  удаления.
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={deletingBayId === bay.id}
                                    onClick={() => setDeleteConfirmBayId(null)}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={deletingBayId === bay.id}
                                    onClick={() =>
                                      void handleDeleteWorkBay(bay.id)
                                    }
                                  >
                                    {deletingBayId === bay.id
                                      ? "Удаляем..."
                                      : "Да, удалить"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-24">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Проверить доступность</CardTitle>
                  <CardDescription>
                    Выберите интервал, чтобы увидеть свободные и занятые боксы.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <DateTimeInput
                      label="Начало"
                      value={availabilityForm.planned_start_at}
                      onChange={(value: string) => {
                        updateAvailabilityForm({
                          planned_start_at: value,
                        });
                      }}
                    />

                    <DateTimeInput
                      label="Конец"
                      value={availabilityForm.planned_end_at}
                      onChange={(value: string) => {
                        updateAvailabilityForm({
                          planned_end_at: value,
                        });
                      }}
                    />

                    <Button
                      type="button"
                      className="w-full"
                      disabled={isCheckingAvailability}
                      onClick={() => void handleCheckAvailability()}
                    >
                      {isCheckingAvailability
                        ? "Проверяем..."
                        : "Проверить доступность"}
                    </Button>

                    {availability.length > 0 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          setAvailability([]);
                          setAvailabilityForm(defaultAvailabilityForm);
                        }}
                      >
                        Сбросить проверку
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Создать бокс</CardTitle>
                  <CardDescription>
                    Добавьте новый рабочий бокс для планирования заказов.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {!canManageWorkBays ? (
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                      Для управления боксами нужен permission{" "}
                      <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                        work_bays.manage
                      </span>
                      .
                    </div>
                  ) : null}

                  {canManageWorkBays ? (
                    <div className="space-y-4">
                      <Input
                        label="Название бокса"
                        placeholder="Например: Бокс 1"
                        value={form.name}
                        onChange={(event) =>
                          updateForm({
                            name: event.target.value,
                          })
                        }
                      />

                      <Textarea
                        label="Описание"
                        placeholder="Например: большой бокс для PPF..."
                        value={form.description}
                        onChange={(event) =>
                          updateForm({
                            description: event.target.value,
                          })
                        }
                      />

                      <Button
                        type="button"
                        className="w-full"
                        disabled={isSubmittingCreate}
                        onClick={() => void handleCreateWorkBay()}
                      >
                        {isSubmittingCreate ? "Создаем..." : "Создать бокс"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}