"use client";

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
import { Textarea } from "@/src/components/ui/textarea";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency } from "@/src/lib/formatters";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import {
  createService,
  deleteService,
  getServices,
  updateService,
} from "@/src/features/services/api";
import type { Service } from "@/src/features/services/types";

type ServiceFormState = {
  name: string;
  description: string;
  requires_brand: boolean;
  requires_package: boolean;
  base_labor_cost: string;
};

type ServiceStatusFilter = "all" | "active" | "archived";

const defaultForm: ServiceFormState = {
  name: "",
  description: "",
  requires_brand: false,
  requires_package: false,
  base_labor_cost: "",
};

function parseMoneyValue(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function serviceToForm(service: Service): ServiceFormState {
  return {
    name: service.name,
    description: service.description ?? "",
    requires_brand: service.requires_brand,
    requires_package: service.requires_package,
    base_labor_cost: String(service.base_labor_cost ?? 0),
  };
}

export function ServicesCatalogPageClient() {
  const { session } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<ServiceFormState>(defaultForm);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<ServiceFormState>(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [submittingEditServiceId, setSubmittingEditServiceId] = useState<
    number | null
  >(null);
  const [deleteConfirmServiceId, setDeleteConfirmServiceId] = useState<
    number | null
  >(null);
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(
    null,
  );
  const [togglingServiceId, setTogglingServiceId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const canReadServices = canAccessByPermission(session, "services.read");
  const canCreateServices = canAccessByPermission(session, "services.create");
  const canUpdateServices = canAccessByPermission(session, "services.update");
  const canDeleteServices = canAccessByPermission(session, "services.delete");

  const canManageAnyService =
    canCreateServices || canUpdateServices || canDeleteServices;

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return services.filter((service) => {
      const name = service.name.toLowerCase();
      const description = service.description?.toLowerCase() ?? "";

      const matchesSearch =
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        description.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && service.is_active !== false) ||
        (statusFilter === "archived" && service.is_active === false);

      return matchesSearch && matchesStatus;
    });
  }, [services, search, statusFilter]);

  const activeServicesCount = useMemo(
    () => services.filter((service) => service.is_active !== false).length,
    [services],
  );

  const archivedServicesCount = useMemo(
    () => services.filter((service) => service.is_active === false).length,
    [services],
  );

  const servicesWithBrandCount = useMemo(
    () => services.filter((service) => service.requires_brand).length,
    [services],
  );

  const servicesWithPackageCount = useMemo(
    () => services.filter((service) => service.requires_package).length,
    [services],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadServices() {
      if (!canReadServices) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getServices();

        if (isMounted) {
          setServices(result);
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

    void loadServices();

    return () => {
      isMounted = false;
    };
  }, [canReadServices]);

  function updateForm(patch: Partial<ServiceFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function updateEditingForm(patch: Partial<ServiceFormState>) {
    setEditingForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function validateServiceForm(currentForm: ServiceFormState) {
    const name = currentForm.name.trim();

    if (!name) {
      return {
        error: "Укажите название услуги.",
        payload: null,
      };
    }

    const baseLaborCost = parseMoneyValue(currentForm.base_labor_cost);

    if (baseLaborCost === null) {
      return {
        error: "Укажите корректную базовую себестоимость работы.",
        payload: null,
      };
    }

    return {
      error: null,
      payload: {
        name,
        description: currentForm.description.trim() || null,
        requires_brand: currentForm.requires_brand,
        requires_package: currentForm.requires_package,
        base_labor_cost: baseLaborCost,
      },
    };
  }

  async function handleCreateService() {
    const validation = validateServiceForm(form);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные услуги.");
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdService = await createService({
        ...validation.payload,
        is_active: true,
      });

      setServices((current) => [createdService, ...current]);
      setForm(defaultForm);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  function startEditService(service: Service) {
    setEditingServiceId(service.id);
    setEditingForm(serviceToForm(service));
    setDeleteConfirmServiceId(null);
    setError(null);
  }

  function cancelEditService() {
    setEditingServiceId(null);
    setEditingForm(defaultForm);
    setError(null);
  }

  async function handleUpdateService(serviceId: number) {
    const validation = validateServiceForm(editingForm);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные услуги.");
      return;
    }

    setSubmittingEditServiceId(serviceId);
    setError(null);

    try {
      const updatedService = await updateService(serviceId, validation.payload);

      setServices((current) =>
        current.map((service) =>
          service.id === updatedService.id ? updatedService : service,
        ),
      );

      setEditingServiceId(null);
      setEditingForm(defaultForm);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setSubmittingEditServiceId(null);
    }
  }

  async function handleDeleteService(serviceId: number) {
    setDeletingServiceId(serviceId);
    setError(null);

    try {
      await deleteService(serviceId);

      setServices((current) =>
        current.filter((service) => service.id !== serviceId),
      );

      setDeleteConfirmServiceId(null);

      if (editingServiceId === serviceId) {
        setEditingServiceId(null);
        setEditingForm(defaultForm);
      }
    } catch (deleteError) {
      const message = getApiErrorMessage(deleteError);

      if (
        message.toLowerCase().includes("cannot be deleted") ||
        message.toLowerCase().includes("already used") ||
        message.toLowerCase().includes("orders") ||
        message.toLowerCase().includes("pricing")
      ) {
        setError(
          "Услугу нельзя удалить, потому что она уже используется в заказах, пакетах услуг или правилах pricing. Позже для таких услуг используем архив/деактивацию, чтобы сохранить историю.",
        );
      } else {
        setError(message);
      }
    } finally {
      setDeletingServiceId(null);
    }
  }

  async function handleToggleServiceActive(service: Service) {
    setTogglingServiceId(service.id);
    setError(null);

    try {
      const updatedService = await updateService(service.id, {
        is_active: !service.is_active,
      });

      setServices((current) =>
        current.map((currentService) =>
          currentService.id === updatedService.id
            ? updatedService
            : currentService,
        ),
      );
    } catch (toggleError) {
      setError(getApiErrorMessage(toggleError));
    } finally {
      setTogglingServiceId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Услуги"
        title="Каталог услуг"
        description="Управление базовыми услугами детейлинга: PDR, полировка, химчистка, шумоизоляция, оклейка и другие работы."
      />

      {!canReadServices ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к услугам. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                services.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadServices ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Сводка услуг</CardTitle>
              <CardDescription>
                Быстрый обзор каталога услуг и требований к ним.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Всего услуг
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {services.length}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Требуют бренд
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {servicesWithBrandCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Требуют пакет
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {servicesWithPackageCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Архив
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {archivedServicesCount}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Список услуг</CardTitle>
                      <CardDescription>
                        Всего услуг: {services.length}. Найдено:{" "}
                        {filteredServices.length}.
                      </CardDescription>
                    </div>

                    <Badge tone={services.length > 0 ? "primary" : "muted"}>
                      {services.length}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Input
                    label="Поиск"
                    placeholder="Например: PDR, полировка, химчистка..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={[
                        "rounded-full border px-3 py-2 text-xs font-semibold transition",
                        statusFilter === "all"
                          ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                      ].join(" ")}
                      onClick={() => setStatusFilter("all")}
                    >
                      Все · {services.length}
                    </button>

                    <button
                      type="button"
                      className={[
                        "rounded-full border px-3 py-2 text-xs font-semibold transition",
                        statusFilter === "active"
                          ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                      ].join(" ")}
                      onClick={() => setStatusFilter("active")}
                    >
                      Активные · {activeServicesCount}
                    </button>

                    <button
                      type="button"
                      className={[
                        "rounded-full border px-3 py-2 text-xs font-semibold transition",
                        statusFilter === "archived"
                          ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                      ].join(" ")}
                      onClick={() => setStatusFilter("archived")}
                    >
                      Архив · {archivedServicesCount}
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                      Загружаем услуги...
                    </div>
                  ) : null}

                  {!isLoading && filteredServices.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Услуги не найдены.
                    </div>
                  ) : null}

                  {!isLoading && filteredServices.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {filteredServices.map((service) => {
                        const isEditing = editingServiceId === service.id;

                        return (
                          <div
                            key={service.id}
                            className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                          >
                            {!isEditing ? (
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate text-base font-semibold text-white">
                                      {service.name}
                                    </div>

                                    <Badge tone="muted">
                                      Service ID #{service.id}
                                    </Badge>

                                    <Badge
                                      tone={
                                        service.is_active ? "success" : "muted"
                                      }
                                    >
                                      {service.is_active ? "Активна" : "Архив"}
                                    </Badge>

                                    {service.requires_brand ? (
                                      <Badge tone="primary">Нужен бренд</Badge>
                                    ) : null}

                                    {service.requires_package ? (
                                      <Badge tone="warning">Нужен пакет</Badge>
                                    ) : null}
                                  </div>

                                  <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                    {service.description ||
                                      "Описание услуги не заполнено."}
                                  </div>

                                  <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                                    Удаление подходит только для ошибочно
                                    созданных услуг, которые нигде не
                                    использовались. Если услуга уже была в
                                    заказе, пакете или pricing, удаление будет
                                    запрещено.
                                  </div>

                                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Базовая себестоимость
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {formatCurrency(
                                          service.base_labor_cost,
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Бренд
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {service.requires_brand
                                          ? "Обязателен"
                                          : "Не нужен"}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Пакет
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {service.requires_package
                                          ? "Обязателен"
                                          : "Не нужен"}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {canUpdateServices || canDeleteServices ? (
                                  <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                                    {canUpdateServices ? (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                          startEditService(service)
                                        }
                                      >
                                        Редактировать
                                      </Button>
                                    ) : null}

                                    {canUpdateServices ? (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={
                                          togglingServiceId === service.id
                                        }
                                        onClick={() =>
                                          void handleToggleServiceActive(
                                            service,
                                          )
                                        }
                                      >
                                        {togglingServiceId === service.id
                                          ? "Сохраняем..."
                                          : service.is_active
                                            ? "В архив"
                                            : "Активировать"}
                                      </Button>
                                    ) : null}

                                    {canDeleteServices ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-[rgb(252_165_165)] hover:text-[rgb(254_202_202)]"
                                        disabled={
                                          deletingServiceId === service.id
                                        }
                                        onClick={() =>
                                          setDeleteConfirmServiceId(
                                            (current) =>
                                              current === service.id
                                                ? null
                                                : service.id,
                                          )
                                        }
                                      >
                                        Удалить
                                      </Button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <Input
                                  label="Название услуги"
                                  value={editingForm.name}
                                  onChange={(event) =>
                                    updateEditingForm({
                                      name: event.target.value,
                                    })
                                  }
                                />

                                <Textarea
                                  label="Описание"
                                  placeholder="Краткое описание услуги..."
                                  value={editingForm.description}
                                  onChange={(event) =>
                                    updateEditingForm({
                                      description: event.target.value,
                                    })
                                  }
                                />

                                <div className="grid gap-4 lg:grid-cols-2">
                                  <Input
                                    label="Базовая себестоимость работы"
                                    placeholder="Например: 10000"
                                    inputMode="numeric"
                                    value={editingForm.base_labor_cost}
                                    onChange={(event) =>
                                      updateEditingForm({
                                        base_labor_cost: event.target.value
                                          .replace(/[^\d.,\s]/g, "")
                                          .slice(0, 12),
                                      })
                                    }
                                  />

                                  <div className="grid gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
                                    <label className="flex items-center justify-between gap-3 text-sm text-white">
                                      <span>Требует бренд материала</span>
                                      <input
                                        type="checkbox"
                                        checked={editingForm.requires_brand}
                                        onChange={(event) =>
                                          updateEditingForm({
                                            requires_brand:
                                              event.target.checked,
                                          })
                                        }
                                      />
                                    </label>

                                    <label className="flex items-center justify-between gap-3 text-sm text-white">
                                      <span>Требует пакет услуги</span>
                                      <input
                                        type="checkbox"
                                        checked={editingForm.requires_package}
                                        onChange={(event) =>
                                          updateEditingForm({
                                            requires_package:
                                              event.target.checked,
                                          })
                                        }
                                      />
                                    </label>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={
                                      submittingEditServiceId === service.id
                                    }
                                    onClick={cancelEditService}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={
                                      submittingEditServiceId === service.id
                                    }
                                    onClick={() =>
                                      void handleUpdateService(service.id)
                                    }
                                  >
                                    {submittingEditServiceId === service.id
                                      ? "Сохраняем..."
                                      : "Сохранить"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {deleteConfirmServiceId === service.id ? (
                              <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                                <div className="text-sm font-semibold text-[rgb(252_165_165)]">
                                  Подтвердить удаление услуги?
                                </div>

                                <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                                  Удалить можно только ошибочно созданную
                                  услугу, которая еще нигде не использовалась.
                                  Если услуга уже есть в заказах, пакетах услуг
                                  или pricing rules, backend отклонит удаление.
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={deletingServiceId === service.id}
                                    onClick={() =>
                                      setDeleteConfirmServiceId(null)
                                    }
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={deletingServiceId === service.id}
                                    onClick={() =>
                                      void handleDeleteService(service.id)
                                    }
                                  >
                                    {deletingServiceId === service.id
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
                  <CardTitle>Создать услугу</CardTitle>
                  <CardDescription>
                    Добавьте новую услугу в каталог.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {!canCreateServices ? (
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                      Для создания услуги нужен permission{" "}
                      <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                        services.create
                      </span>
                      .
                    </div>
                  ) : null}

                  {canCreateServices ? (
                    <div className="space-y-4">
                      <Input
                        label="Название услуги"
                        placeholder="Например: Полировка кузова"
                        value={form.name}
                        onChange={(event) =>
                          updateForm({
                            name: event.target.value,
                          })
                        }
                      />

                      <Textarea
                        label="Описание"
                        placeholder="Краткое описание услуги..."
                        value={form.description}
                        onChange={(event) =>
                          updateForm({
                            description: event.target.value,
                          })
                        }
                      />

                      <Input
                        label="Базовая себестоимость работы"
                        placeholder="Например: 10000"
                        inputMode="numeric"
                        value={form.base_labor_cost}
                        onChange={(event) =>
                          updateForm({
                            base_labor_cost: event.target.value
                              .replace(/[^\d.,\s]/g, "")
                              .slice(0, 12),
                          })
                        }
                      />

                      <div className="grid gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
                        <label className="flex items-center justify-between gap-3 text-sm text-white">
                          <span>Требует бренд материала</span>
                          <input
                            type="checkbox"
                            checked={form.requires_brand}
                            onChange={(event) =>
                              updateForm({
                                requires_brand: event.target.checked,
                              })
                            }
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 text-sm text-white">
                          <span>Требует пакет услуги</span>
                          <input
                            type="checkbox"
                            checked={form.requires_package}
                            onChange={(event) =>
                              updateForm({
                                requires_package: event.target.checked,
                              })
                            }
                          />
                        </label>
                      </div>

                      <Button
                        type="button"
                        className="w-full"
                        disabled={isSubmittingCreate}
                        onClick={() => void handleCreateService()}
                      >
                        {isSubmittingCreate ? "Создаем..." : "Создать услугу"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Как использовать</CardTitle>
                  <CardDescription>
                    Услуги определяют состав заказа и будущий pricing.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3 text-sm leading-6 text-[hsl(var(--muted))]">
                    <p>
                      Если услуга требует бренд, при добавлении позиции заказа
                      нужно будет выбрать бренд материала.
                    </p>

                    <p>
                      Если услуга требует пакет, для нее можно будет настроить
                      варианты вроде Basic, Premium или Full.
                    </p>

                    <p>
                      Базовая себестоимость работы участвует в расчете
                      прибыльности и может использоваться в pricing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}