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
import { Combobox } from "@/src/components/ui/combobox";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import {
  createServicePackage,
  deleteServicePackage,
  getServicePackages,
  updateServicePackage,
} from "@/src/features/service-packages/api";
import type { ServicePackage } from "@/src/features/service-packages/types";
import { getServices } from "@/src/features/services/api";
import type { Service } from "@/src/features/services/types";

type PackageFormState = {
  service_id: number | null;
  name: string;
  description: string;
};

type PackageStatusFilter = "all" | "active" | "archived";

const defaultForm: PackageFormState = {
  service_id: null,
  name: "",
  description: "",
};

function getServiceName(services: Service[], serviceId: number) {
  return services.find((service) => service.id === serviceId)?.name ?? `Услуга #${serviceId}`;
}

export function ServicePackagesPageClient() {
  const { session } = useAuth();

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [form, setForm] = useState<PackageFormState>(defaultForm);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<PackageFormState>(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PackageStatusFilter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [submittingEditPackageId, setSubmittingEditPackageId] = useState<
    number | null
  >(null);
  const [deleteConfirmPackageId, setDeleteConfirmPackageId] = useState<
    number | null
  >(null);
  const [deletingPackageId, setDeletingPackageId] = useState<number | null>(
    null,
  );
  const [togglingPackageId, setTogglingPackageId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const canReadPackages = canAccessByPermission(
    session,
    "service_packages.read",
  );
  const canManagePackages = canAccessByPermission(
    session,
    "service_packages.manage",
  );
  const canReadServices = canAccessByPermission(session, "services.read");

  const activeServices = useMemo(
    () => services.filter((service) => service.is_active !== false),
    [services],
  );

  const serviceOptions = useMemo(
    () =>
      activeServices.map((service) => ({
        value: String(service.id),
        label: service.name,
      })),
    [activeServices],
  );

  const filteredPackages = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return packages.filter((item) => {
      const serviceName = getServiceName(
        services,
        item.service_id,
      ).toLowerCase();
      const packageName = item.name.toLowerCase();
      const description = item.description?.toLowerCase() ?? "";

      const matchesSearch =
        !normalizedSearch ||
        serviceName.includes(normalizedSearch) ||
        packageName.includes(normalizedSearch) ||
        description.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active !== false) ||
        (statusFilter === "archived" && item.is_active === false);

      return matchesSearch && matchesStatus;
    });
  }, [packages, services, search, statusFilter]);

  const activePackagesCount = useMemo(
    () => packages.filter((item) => item.is_active !== false).length,
    [packages],
  );

  const archivedPackagesCount = useMemo(
    () => packages.filter((item) => item.is_active === false).length,
    [packages],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!canReadPackages) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [packagesResult, servicesResult] = await Promise.allSettled([
          getServicePackages(),
          canReadServices ? getServices() : Promise.resolve([]),
        ]);

        if (!isMounted) {
          return;
        }

        if (packagesResult.status === "fulfilled") {
          setPackages(packagesResult.value);
        } else {
          setPackages([]);
          setError(getApiErrorMessage(packagesResult.reason));
        }

        if (servicesResult.status === "fulfilled") {
          setServices(servicesResult.value);
        } else {
          setServices([]);
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

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [canReadPackages, canReadServices]);

  function updateForm(patch: Partial<PackageFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function updateEditingForm(patch: Partial<PackageFormState>) {
    setEditingForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function validatePackageForm(currentForm: PackageFormState) {
    const name = currentForm.name.trim();

    if (!currentForm.service_id) {
      return {
        error: "Выберите услугу.",
        payload: null,
      };
    }

    if (!name) {
      return {
        error: "Укажите название пакета.",
        payload: null,
      };
    }

    return {
      error: null,
      payload: {
        service_id: currentForm.service_id,
        name,
        description: currentForm.description.trim() || null,
      },
    };
  }

  async function handleCreatePackage() {
    const validation = validatePackageForm(form);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные пакета.");
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdPackage = await createServicePackage({
        ...validation.payload,
        is_active: true,
      });

      setPackages((current) => [createdPackage, ...current]);
      setForm(defaultForm);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  function startEditPackage(item: ServicePackage) {
    setEditingPackageId(item.id);
    setEditingForm({
      service_id: item.service_id,
      name: item.name,
      description: item.description ?? "",
    });
    setDeleteConfirmPackageId(null);
    setError(null);
  }

  function cancelEditPackage() {
    setEditingPackageId(null);
    setEditingForm(defaultForm);
    setError(null);
  }

  async function handleUpdatePackage(packageId: number) {
    const validation = validatePackageForm(editingForm);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные пакета.");
      return;
    }

    setSubmittingEditPackageId(packageId);
    setError(null);

    try {
      const updatedPackage = await updateServicePackage(
        packageId,
        validation.payload,
      );

      setPackages((current) =>
        current.map((item) =>
          item.id === updatedPackage.id ? updatedPackage : item,
        ),
      );

      setEditingPackageId(null);
      setEditingForm(defaultForm);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setSubmittingEditPackageId(null);
    }
  }

  async function handleDeletePackage(packageId: number) {
    setDeletingPackageId(packageId);
    setError(null);

    try {
      await deleteServicePackage(packageId);

      setPackages((current) => current.filter((item) => item.id !== packageId));
      setDeleteConfirmPackageId(null);

      if (editingPackageId === packageId) {
        setEditingPackageId(null);
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
          "Пакет услуги нельзя удалить, потому что он уже используется в заказах или правилах pricing. Позже для таких пакетов используем архив/деактивацию, чтобы сохранить историю.",
        );
      } else {
        setError(message);
      }
    } finally {
      setDeletingPackageId(null);
    }
  }

  async function handleTogglePackageActive(item: ServicePackage) {
    setTogglingPackageId(item.id);
    setError(null);

    try {
      const updatedPackage = await updateServicePackage(item.id, {
        is_active: !item.is_active,
      });

      setPackages((current) =>
        current.map((currentPackage) =>
          currentPackage.id === updatedPackage.id
            ? updatedPackage
            : currentPackage,
        ),
      );
    } catch (toggleError) {
      setError(getApiErrorMessage(toggleError));
    } finally {
      setTogglingPackageId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Услуги"
        title="Пакеты услуг"
        description="Управление пакетами услуг: Basic, Premium, Full, комплексные варианты и будущие bundle-предложения."
      />

      {!canReadPackages ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к пакетам услуг. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                service_packages.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadPackages ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Список пакетов</CardTitle>
                      <CardDescription>
                        Всего пакетов: {packages.length}. Найдено:{" "}
                        {filteredPackages.length}.
                      </CardDescription>
                    </div>

                    <Badge tone={packages.length > 0 ? "primary" : "muted"}>
                      {packages.length}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Input
                    label="Поиск"
                    placeholder="Например: Basic, Premium, полировка..."
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
                      Все · {packages.length}
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
                      Активные · {activePackagesCount}
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
                      Архив · {archivedPackagesCount}
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                      Загружаем пакеты услуг...
                    </div>
                  ) : null}

                  {!isLoading && filteredPackages.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Пакеты услуг не найдены.
                    </div>
                  ) : null}

                  {!isLoading && filteredPackages.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {filteredPackages.map((item) => {
                        const isEditing = editingPackageId === item.id;

                        return (
                          <div
                            key={item.id}
                            className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                          >
                            {!isEditing ? (
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate text-base font-semibold text-white">
                                      {item.name}
                                    </div>

                                    <Badge tone="muted">
                                      Package ID #{item.id}
                                    </Badge>

                                    <Badge
                                      tone={
                                        item.is_active ? "success" : "muted"
                                      }
                                    >
                                      {item.is_active ? "Активен" : "Архив"}
                                    </Badge>
                                  </div>

                                  <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                    {item.description ||
                                      "Описание пакета не заполнено."}
                                  </div>

                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Услуга
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {getServiceName(
                                          services,
                                          item.service_id,
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Service ID
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        #{item.service_id}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                                    Удаление подходит только для ошибочно
                                    созданных пакетов, которые нигде не
                                    использовались. Если пакет уже был в заказе
                                    или pricing, удаление будет запрещено.
                                  </div>
                                </div>

                                {canManagePackages ? (
                                  <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => {
                                        setDeleteConfirmPackageId(null);
                                        startEditPackage(item);
                                      }}
                                    >
                                      Редактировать
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      disabled={togglingPackageId === item.id}
                                      onClick={() =>
                                        void handleTogglePackageActive(item)
                                      }
                                    >
                                      {togglingPackageId === item.id
                                        ? "Сохраняем..."
                                        : item.is_active
                                          ? "В архив"
                                          : "Активировать"}
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-[rgb(252_165_165)] hover:text-[rgb(254_202_202)]"
                                      disabled={deletingPackageId === item.id}
                                      onClick={() =>
                                        setDeleteConfirmPackageId((current) =>
                                          current === item.id ? null : item.id,
                                        )
                                      }
                                    >
                                      Удалить
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <Combobox
                                  label="Услуга"
                                  placeholder="Выберите услугу"
                                  value={
                                    editingForm.service_id
                                      ? String(editingForm.service_id)
                                      : ""
                                  }
                                  options={serviceOptions}
                                  onChange={(value) =>
                                    updateEditingForm({
                                      service_id: value ? Number(value) : null,
                                    })
                                  }
                                />

                                <Input
                                  label="Название пакета"
                                  placeholder="Например: Premium"
                                  value={editingForm.name}
                                  onChange={(event) =>
                                    updateEditingForm({
                                      name: event.target.value,
                                    })
                                  }
                                />

                                <Textarea
                                  label="Описание"
                                  placeholder="Краткое описание пакета..."
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
                                    disabled={
                                      submittingEditPackageId === item.id
                                    }
                                    onClick={cancelEditPackage}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={
                                      submittingEditPackageId === item.id
                                    }
                                    onClick={() =>
                                      void handleUpdatePackage(item.id)
                                    }
                                  >
                                    {submittingEditPackageId === item.id
                                      ? "Сохраняем..."
                                      : "Сохранить"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {deleteConfirmPackageId === item.id ? (
                              <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                                <div className="text-sm font-semibold text-[rgb(252_165_165)]">
                                  Подтвердить удаление пакета?
                                </div>

                                <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                                  Удалить можно только ошибочно созданный пакет,
                                  который еще нигде не использовался. Если пакет
                                  уже есть в заказах или pricing rules, backend
                                  отклонит удаление.
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={deletingPackageId === item.id}
                                    onClick={() =>
                                      setDeleteConfirmPackageId(null)
                                    }
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={deletingPackageId === item.id}
                                    onClick={() =>
                                      void handleDeletePackage(item.id)
                                    }
                                  >
                                    {deletingPackageId === item.id
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
                  <CardTitle>Создать пакет</CardTitle>
                  <CardDescription>
                    Добавьте пакет для выбранной услуги.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {!canManagePackages ? (
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                      Для создания и редактирования нужен permission{" "}
                      <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                        service_packages.manage
                      </span>
                      .
                    </div>
                  ) : null}

                  {canManagePackages ? (
                    <div className="space-y-4">
                      <Combobox
                        label="Услуга"
                        placeholder="Выберите услугу"
                        value={form.service_id ? String(form.service_id) : ""}
                        options={serviceOptions}
                        onChange={(value) =>
                          updateForm({
                            service_id: value ? Number(value) : null,
                          })
                        }
                      />

                      <Input
                        label="Название пакета"
                        placeholder="Например: Basic, Premium, Full"
                        value={form.name}
                        onChange={(event) =>
                          updateForm({
                            name: event.target.value,
                          })
                        }
                      />

                      <Textarea
                        label="Описание"
                        placeholder="Краткое описание пакета..."
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
                        onClick={() => void handleCreatePackage()}
                      >
                        {isSubmittingCreate ? "Создаем..." : "Создать пакет"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Как использовать</CardTitle>
                  <CardDescription>
                    Пакеты уточняют выбранную услугу.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3 text-sm leading-6 text-[hsl(var(--muted))]">
                    <p>
                      Например, для услуги “Полировка” можно создать пакеты
                      Basic, Medium и Premium.
                    </p>

                    <p>
                      Если у услуги включено “Требует пакет”, при создании
                      заказа пользователь должен будет выбрать один из пакетов.
                    </p>

                    <p>
                      Позже пакеты будут участвовать в pricing rules и
                      автоматическом расчете стоимости.
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