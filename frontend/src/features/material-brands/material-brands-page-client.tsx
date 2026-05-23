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
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import {
  createMaterialBrand,
  getMaterialBrands,
  updateMaterialBrand,
  deleteMaterialBrand,
} from "@/src/features/material-brands/api";
import type { MaterialBrand } from "@/src/features/material-brands/types";

type BrandFormState = {
  name: string;
  category: string;
};

type BrandStatusFilter = "all" | "active" | "archived";

const defaultForm: BrandFormState = {
  name: "",
  category: "",
};

export function MaterialBrandsPageClient() {
  const { session } = useAuth();

  const [brands, setBrands] = useState<MaterialBrand[]>([]);
  const [form, setForm] = useState<BrandFormState>(defaultForm);
  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BrandStatusFilter>("all");
  const [deleteConfirmBrandId, setDeleteConfirmBrandId] = useState<
    number | null
  >(null);
  const [deletingBrandId, setDeletingBrandId] = useState<number | null>(null);
  const [togglingBrandId, setTogglingBrandId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [submittingEditBrandId, setSubmittingEditBrandId] = useState<
    number | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const canReadBrands = canAccessByPermission(session, "material_brands.read");
  const canManageBrands = canAccessByPermission(
    session,
    "material_brands.manage",
  );

  const filteredBrands = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return brands.filter((brand) => {
      const matchesSearch =
        !normalizedSearch ||
        brand.name.toLowerCase().includes(normalizedSearch) ||
        (brand.category?.toLowerCase() ?? "").includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && brand.is_active) ||
        (statusFilter === "archived" && !brand.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [brands, search, statusFilter]);

  const activeBrandsCount = useMemo(
    () => brands.filter((brand) => brand.is_active).length,
    [brands],
  );

  const archivedBrandsCount = useMemo(
    () => brands.filter((brand) => !brand.is_active).length,
    [brands],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadBrands() {
      if (!canReadBrands) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getMaterialBrands();

        if (isMounted) {
          setBrands(result);
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

    void loadBrands();

    return () => {
      isMounted = false;
    };
  }, [canReadBrands]);

  function updateForm(patch: Partial<BrandFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  async function handleCreateBrand() {
    const name = form.name.trim();

    if (!name) {
      setError("Укажите название бренда.");
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdBrand = await createMaterialBrand({
        name,
        category: form.category.trim() || null,
        is_active: true,
      });

      setBrands((current) => [createdBrand, ...current]);
      setForm(defaultForm);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  function startEditBrand(brand: MaterialBrand) {
    setEditingBrandId(brand.id);
    setEditingName(brand.name);
    setEditingCategory(brand.category ?? "");
    setError(null);
  }

  function cancelEditBrand() {
    setEditingBrandId(null);
    setEditingName("");
    setEditingCategory("");
    setError(null);
  }

  async function handleUpdateBrand(brandId: number) {
    const name = editingName.trim();

    if (!name) {
      setError("Укажите название бренда.");
      return;
    }

    setSubmittingEditBrandId(brandId);
    setError(null);

    try {
      const updatedBrand = await updateMaterialBrand(brandId, {
        name,
        category: editingCategory.trim() || null,
      });

      setBrands((current) =>
        current.map((brand) =>
          brand.id === updatedBrand.id ? updatedBrand : brand,
        ),
      );

      setEditingBrandId(null);
      setEditingName("");
      setEditingCategory("");
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setSubmittingEditBrandId(null);
    }
  }

  async function handleDeleteBrand(brandId: number) {
    setDeletingBrandId(brandId);
    setError(null);

    try {
      await deleteMaterialBrand(brandId);

      setBrands((current) => current.filter((brand) => brand.id !== brandId));
      setDeleteConfirmBrandId(null);

      if (editingBrandId === brandId) {
        setEditingBrandId(null);
        setEditingName("");
        setEditingCategory("");
      }
    } catch (deleteError) {
      const message = getApiErrorMessage(deleteError);

      if (
        message.toLowerCase().includes("cannot be deleted") ||
        message.toLowerCase().includes("already used") ||
        message.toLowerCase().includes("used by materials")
      ) {
        setError(
          "Бренд нельзя удалить, потому что он уже используется в материалах, заказах или правилах pricing. Отправьте бренд в архив, чтобы скрыть его из новых операций, но сохранить историю.",
        );
      } else {
        setError(message);
      }
    } finally {
      setDeletingBrandId(null);
    }
  }

async function handleToggleBrandActive(brand: MaterialBrand) {
  setTogglingBrandId(brand.id);
  setError(null);

  try {
    const updatedBrand = await updateMaterialBrand(brand.id, {
      is_active: !brand.is_active,
    });

    setBrands((current) =>
      current.map((currentBrand) =>
        currentBrand.id === updatedBrand.id ? updatedBrand : currentBrand,
      ),
    );
  } catch (toggleError) {
    setError(getApiErrorMessage(toggleError));
  } finally {
    setTogglingBrandId(null);
  }
}

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Материалы"
        title="Бренды материалов"
        description="Справочник брендов материалов, которые используются в услугах, заказах и pricing."
      />

      {!canReadBrands ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к брендам материалов. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                material_brands.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadBrands ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Список брендов</CardTitle>
                      <CardDescription>
                        Всего брендов: {brands.length}. Найдено:{" "}
                        {filteredBrands.length}.
                      </CardDescription>
                    </div>

                    <Badge tone={brands.length > 0 ? "primary" : "muted"}>
                      {brands.length}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Input
                    label="Поиск"
                    placeholder="Например: Koch, CarPro, Gyeon..."
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
                      Все · {brands.length}
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
                      Активные · {activeBrandsCount}
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
                      Архив · {archivedBrandsCount}
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                      Загружаем бренды материалов...
                    </div>
                  ) : null}

                  {!isLoading && filteredBrands.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Бренды не найдены.
                    </div>
                  ) : null}

                  {!isLoading && filteredBrands.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {filteredBrands.map((brand) => {
                        const isEditing = editingBrandId === brand.id;

                        return (
                          <div
                            key={brand.id}
                            className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                          >
                            {!isEditing ? (
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate text-base font-semibold text-white">
                                      {brand.name}
                                    </div>

                                    <Badge tone="muted">
                                      Brand ID #{brand.id}
                                    </Badge>

                                    <Badge
                                      tone={
                                        brand.is_active ? "success" : "muted"
                                      }
                                    >
                                      {brand.is_active ? "Активен" : "Архив"}
                                    </Badge>
                                  </div>

                                  <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                    Используется как бренд материала в позициях
                                    заказа и расчетах pricing. Удаление подходит
                                    только для ошибочно созданных брендов,
                                    которые нигде не использовались. Для
                                    использованных брендов используйте архив.
                                  </div>

                                  {brand.category ? (
                                    <div className="mt-3">
                                      <Badge tone="primary">
                                        {brand.category}
                                      </Badge>
                                    </div>
                                  ) : null}
                                </div>

                                {canManageBrands ? (
                                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => {
                                        setDeleteConfirmBrandId(null);
                                        startEditBrand(brand);
                                      }}
                                    >
                                      Редактировать
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      disabled={togglingBrandId === brand.id}
                                      onClick={() =>
                                        void handleToggleBrandActive(brand)
                                      }
                                    >
                                      {togglingBrandId === brand.id
                                        ? "Сохраняем..."
                                        : brand.is_active
                                          ? "В архив"
                                          : "Активировать"}
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-[rgb(252_165_165)] hover:text-[rgb(254_202_202)]"
                                      disabled={deletingBrandId === brand.id}
                                      onClick={() =>
                                        setDeleteConfirmBrandId((current) =>
                                          current === brand.id
                                            ? null
                                            : brand.id,
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
                                <Input
                                  label="Название бренда"
                                  value={editingName}
                                  onChange={(event) => {
                                    setEditingName(event.target.value);
                                    setError(null);
                                  }}
                                />

                                <Input
                                  label="Категория"
                                  placeholder="Например: пленка, химия, керамика"
                                  value={editingCategory}
                                  onChange={(event) => {
                                    setEditingCategory(event.target.value);
                                    setError(null);
                                  }}
                                />

                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={
                                      submittingEditBrandId === brand.id
                                    }
                                    onClick={cancelEditBrand}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={
                                      submittingEditBrandId === brand.id
                                    }
                                    onClick={() =>
                                      void handleUpdateBrand(brand.id)
                                    }
                                  >
                                    {submittingEditBrandId === brand.id
                                      ? "Сохраняем..."
                                      : "Сохранить"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {deleteConfirmBrandId === brand.id ? (
                              <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                                <div className="text-sm font-semibold text-[rgb(252_165_165)]">
                                  Подтвердить удаление бренда?
                                </div>

                                <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                                  Удалить можно только бренд, который нигде не
                                  использовался. Если бренд уже есть в
                                  материалах, заказах или pricing rules, backend
                                  отклонит удаление.
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={deletingBrandId === brand.id}
                                    onClick={() =>
                                      setDeleteConfirmBrandId(null)
                                    }
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={deletingBrandId === brand.id}
                                    onClick={() =>
                                      void handleDeleteBrand(brand.id)
                                    }
                                  >
                                    {deletingBrandId === brand.id
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
                  <CardTitle>Создать бренд</CardTitle>
                  <CardDescription>
                    Добавьте новый бренд материалов в справочник.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {!canManageBrands ? (
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                      Для создания и редактирования нужен permission{" "}
                      <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                        material_brands.manage
                      </span>
                      .
                    </div>
                  ) : null}

                  {canManageBrands ? (
                    <div className="space-y-4">
                      <Input
                        label="Название бренда"
                        placeholder="Например: Koch Chemie"
                        value={form.name}
                        onChange={(event) =>
                          updateForm({
                            name: event.target.value,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleCreateBrand();
                          }
                        }}
                      />

                      <Input
                        label="Категория"
                        placeholder="Например: пленка, химия, керамика"
                        value={form.category}
                        onChange={(event) =>
                          updateForm({
                            category: event.target.value,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleCreateBrand();
                          }
                        }}
                      />

                      <Button
                        type="button"
                        className="w-full"
                        disabled={isSubmittingCreate}
                        onClick={() => void handleCreateBrand()}
                      >
                        {isSubmittingCreate ? "Создаем..." : "Создать бренд"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Как использовать</CardTitle>
                  <CardDescription>
                    Бренды нужны для услуг, где цена зависит от материала.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3 text-sm leading-6 text-[hsl(var(--muted))]">
                    <p>
                      Например, услуга “Оклейка” может требовать выбора бренда
                      пленки: Llumar, SunTek, Hexis.
                    </p>

                    <p>
                      В заказе бренд сохраняется в позиции услуги и потом
                      участвует в audit, pricing и истории заказа.
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