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
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import {
  createMaterial,
  deleteMaterial,
  getMaterials,
  updateMaterial,
} from "@/src/features/materials/api";
import type { Material } from "@/src/features/materials/types";
import { getMaterialBrands } from "@/src/features/material-brands/api";
import type { MaterialBrand } from "@/src/features/material-brands/types";
import { getUnits } from "@/src/features/units/api";
import type { Unit } from "@/src/features/units/types";
import Link from "next/link";
import {
  createMaterialStockMovement,
  getMaterialStock,
  getMaterialStockMovements,
} from "@/src/features/material-stock/api";
import type {
  MaterialStockMovement,
  MaterialStockSummary,
} from "@/src/features/material-stock/types";
import { formatCurrency, formatDateTime } from "@/src/lib/formatters";

type MaterialFormState = {
  name: string;
  brand_id: number | null;
  category: string;
  unit_id: number | null;
  cost_per_unit: string;
  min_stock_quantity: string;
};

type MaterialStatusFilter = "all" | "active" | "archived";

type StockFormState = {
  movement_type: "receipt" | "write_off" | "adjustment";
  quantity: string;
  unit_cost: string;
  comment: string;
};

type StockMovementFilter =
  | "all"
  | "receipt"
  | "write_off"
  | "adjustment"
  | "order_usage";

const defaultStockForm: StockFormState = {
  movement_type: "receipt",
  quantity: "",
  unit_cost: "",
  comment: "",
};

const defaultForm: MaterialFormState = {
  name: "",
  brand_id: null,
  category: "",
  unit_id: null,
  cost_per_unit: "",
  min_stock_quantity: "",
};

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₸`;
}

function getBrandName(brands: MaterialBrand[], brandId: number | null) {
  if (!brandId) {
    return "Без бренда";
  }

  return (
    brands.find((brand) => brand.id === brandId)?.name ?? `Brand #${brandId}`
  );
}

function getUnitLabel(units: Unit[], unitId: number) {
  const unit = units.find((item) => item.id === unitId);

  if (!unit) {
    return `Unit #${unitId}`;
  }

  return `${unit.name} (${unit.code})`;
}

function getStockMovementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    receipt: "Приход",
    write_off: "Списание",
    adjustment: "Корректировка",
    order_usage: "Расход по заказу",
    order_usage_reversal: "Возврат расхода",
  };

  return labels[type] ?? type;
}

function getStockMovementTone(type: string) {
  if (type === "receipt" || type === "order_usage_reversal") {
    return "success";
  }

  if (type === "write_off" || type === "order_usage") {
    return "warning";
  }

  if (type === "adjustment") {
    return "primary";
  }

  return "muted";
}

function getStockStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    in_stock: "В наличии",
    low_stock: "Мало",
    out_of_stock: "Нет остатка",
  };

  if (!status) {
    return "Нет данных";
  }

  return labels[status] ?? status;
}

function getStockStatusTone(status: string | null | undefined) {
  if (!status) {
    return "muted";
  }

  if (status === "in_stock") {
    return "success";
  }

  if (status === "low_stock") {
    return "warning";
  }

  if (status === "out_of_stock") {
    return "danger";
  }

  return "muted";
}

function parseStockNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function parseCostPerUnit(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function parseMinStockQuantity(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

export function MaterialsPageClient() {
  const { session } = useAuth();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [brands, setBrands] = useState<MaterialBrand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [form, setForm] = useState<MaterialFormState>(defaultForm);
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(
    null,
  );
  const [editingForm, setEditingForm] =
    useState<MaterialFormState>(defaultForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MaterialStatusFilter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [submittingEditMaterialId, setSubmittingEditMaterialId] = useState<
    number | null
  >(null);
  const [togglingMaterialId, setTogglingMaterialId] = useState<number | null>(
    null,
  );
  const [deleteConfirmMaterialId, setDeleteConfirmMaterialId] = useState<
    number | null
  >(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<number | null>(
    null,
  );
  const [stockMaterialId, setStockMaterialId] = useState<number | null>(null);
  const [stockSummaryByMaterialId, setStockSummaryByMaterialId] = useState<
    Record<number, MaterialStockSummary>
  >({});
  const [stockMovements, setStockMovements] = useState<MaterialStockMovement[]>(
    [],
  );
  const [stockMovementFilter, setStockMovementFilter] =
    useState<StockMovementFilter>("all");
  const [stockForm, setStockForm] = useState<StockFormState>(defaultStockForm);
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [isStockSubmitting, setIsStockSubmitting] = useState(false);
  const [isStockSummaryLoading, setIsStockSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadMaterials = canAccessByPermission(session, "materials.read");
  const canManageMaterials = canAccessByPermission(session, "materials.manage");
  const canReadBrands = canAccessByPermission(session, "material_brands.read");

  const activeBrands = useMemo(
    () => brands.filter((brand) => brand.is_active !== false),
    [brands],
  );

  const brandOptions = useMemo(
    () => [
      {
        value: "",
        label: "Без бренда",
      },
      ...activeBrands.map((brand) => ({
        value: String(brand.id),
        label: brand.category
          ? `${brand.name} · ${brand.category}`
          : brand.name,
      })),
    ],
    [activeBrands],
  );

  const unitOptions = useMemo(
    () =>
      units.map((unit) => ({
        value: String(unit.id),
        label: `${unit.name} · ${unit.code}`,
      })),
    [units],
  );

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return materials.filter((material) => {
      const brandName = getBrandName(brands, material.brand_id).toLowerCase();
      const unitLabel = getUnitLabel(units, material.unit_id).toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        material.name.toLowerCase().includes(normalizedSearch) ||
        (material.category?.toLowerCase() ?? "").includes(normalizedSearch) ||
        brandName.includes(normalizedSearch) ||
        unitLabel.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && material.is_active) ||
        (statusFilter === "archived" && !material.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [materials, brands, units, search, statusFilter]);

  const activeMaterialsCount = useMemo(
    () => materials.filter((material) => material.is_active).length,
    [materials],
  );

  const archivedMaterialsCount = useMemo(
    () => materials.filter((material) => !material.is_active).length,
    [materials],
  );

  async function loadMaterialsStockSummaries(materialsList: Material[]) {
    if (materialsList.length === 0) {
      return;
    }

    setIsStockSummaryLoading(true);

    try {
      const summaries = await Promise.allSettled(
        materialsList.map((material) => getMaterialStock(material.id)),
      );

      const nextSummaries: Record<number, MaterialStockSummary> = {};

      summaries.forEach((result) => {
        if (result.status === "fulfilled") {
          nextSummaries[result.value.material_id] = result.value;
        }
      });

      setStockSummaryByMaterialId((current) => ({
        ...current,
        ...nextSummaries,
      }));
    } finally {
      setIsStockSummaryLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!canReadMaterials) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [materialsResult, brandsResult, unitsResult] =
          await Promise.allSettled([
            getMaterials(),
            canReadBrands ? getMaterialBrands() : Promise.resolve([]),
            getUnits(),
          ]);

        if (!isMounted) {
          return;
        }

        if (materialsResult.status === "fulfilled") {
          setMaterials(materialsResult.value);
          void loadMaterialsStockSummaries(materialsResult.value);
        } else {
          setMaterials([]);
          setError(getApiErrorMessage(materialsResult.reason));
        }

        if (brandsResult.status === "fulfilled") {
          setBrands(brandsResult.value);
        } else {
          setBrands([]);
        }

        if (unitsResult.status === "fulfilled") {
          setUnits(unitsResult.value);
        } else {
          setUnits([]);
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
  }, [canReadMaterials, canReadBrands]);

  function updateForm(patch: Partial<MaterialFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function updateEditingForm(patch: Partial<MaterialFormState>) {
    setEditingForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function validateMaterialForm(currentForm: MaterialFormState) {
    const name = currentForm.name.trim();

    if (!name) {
      return {
        error: "Укажите название материала.",
        payload: null,
      };
    }

    if (!currentForm.unit_id) {
      return {
        error: "Выберите единицу измерения.",
        payload: null,
      };
    }

    const costPerUnit = parseCostPerUnit(currentForm.cost_per_unit);

    if (costPerUnit === null) {
      return {
        error: "Укажите корректную себестоимость за единицу.",
        payload: null,
      };
    }

    const minStockQuantity = parseMinStockQuantity(
      currentForm.min_stock_quantity,
    );

    if (minStockQuantity === null) {
      return {
        error: "Укажите корректный минимальный остаток.",
        payload: null,
      };
    }

    return {
      error: null,
      payload: {
        name,
        brand_id: currentForm.brand_id,
        category: currentForm.category.trim() || null,
        unit_id: currentForm.unit_id,
        cost_per_unit: costPerUnit,
        min_stock_quantity: minStockQuantity,
      },
    };
  }

  async function loadMaterialStock(materialId: number) {
    setIsStockLoading(true);
    setError(null);

    try {
      const [summaryResult, movementsResult] = await Promise.all([
        getMaterialStock(materialId),
        getMaterialStockMovements(materialId),
      ]);

      setStockSummaryByMaterialId((current) => ({
        ...current,
        [materialId]: summaryResult,
      }));
      setStockMovements(movementsResult);
    } catch (stockError) {
      setError(getApiErrorMessage(stockError));
    } finally {
      setIsStockLoading(false);
    }
  }

  async function openMaterialStock(materialId: number) {
    setStockMaterialId(materialId);
    setStockForm(defaultStockForm);
    setStockMovementFilter("all");
    await loadMaterialStock(materialId);
  }

  function closeMaterialStock() {
    setStockMaterialId(null);
    setStockMovements([]);
    setStockForm(defaultStockForm);
    setStockMovementFilter("all");
    setError(null);
  }

  function updateStockForm(patch: Partial<StockFormState>) {
    setStockForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  async function handleCreateMaterial() {
    const validation = validateMaterialForm(form);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные материала.");
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdMaterial = await createMaterial({
        ...validation.payload,
        is_active: true,
      });

      setMaterials((current) => [createdMaterial, ...current]);

      setStockSummaryByMaterialId((current) => ({
        ...current,
        [createdMaterial.id]: {
          material_id: createdMaterial.id,
          material_name: createdMaterial.name,
          unit_id: createdMaterial.unit_id,
          unit_name:
            units.find((unit) => unit.id === createdMaterial.unit_id)?.name ?? null,
          unit_code:
            units.find((unit) => unit.id === createdMaterial.unit_id)?.code ?? null,
          current_quantity: 0,
          min_stock_quantity: createdMaterial.min_stock_quantity,
          stock_status: "out_of_stock",
          stock_value: 0,
          last_unit_cost: null,
        },
      }));
      setForm(defaultForm);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  async function handleCreateStockMovement(materialId: number) {
    const quantity = parseStockNumber(stockForm.quantity);

    if (quantity === null || quantity === 0) {
      setError("Укажите корректное количество.");
      return;
    }

    const unitCost =
      stockForm.unit_cost.trim() === ""
        ? null
        : parseStockNumber(stockForm.unit_cost);

    if (unitCost !== null && unitCost < 0) {
      setError("Себестоимость за единицу не может быть отрицательной.");
      return;
    }

    setIsStockSubmitting(true);
    setError(null);

    try {
      await createMaterialStockMovement(materialId, {
        movement_type: stockForm.movement_type,
        quantity,
        unit_cost: unitCost,
        comment: stockForm.comment.trim() || null,
      });

      setStockForm(defaultStockForm);
      await loadMaterialStock(materialId);
    } catch (stockError) {
      setError(getApiErrorMessage(stockError));
    } finally {
      setIsStockSubmitting(false);
    }
  }

  async function handleDeleteMaterial(materialId: number) {
    setDeletingMaterialId(materialId);
    setError(null);

    try {
      await deleteMaterial(materialId);

      setMaterials((current) =>
        current.filter((material) => material.id !== materialId),
      );

      setDeleteConfirmMaterialId(null);

      if (editingMaterialId === materialId) {
        setEditingMaterialId(null);
        setEditingForm(defaultForm);
      }
    } catch (deleteError) {
      const message = getApiErrorMessage(deleteError);

      if (
        message.toLowerCase().includes("cannot be deleted") ||
        message.toLowerCase().includes("already used") ||
        message.toLowerCase().includes("consumption")
      ) {
        setError(
          "Материал нельзя удалить, потому что он уже используется в фактическом расходе по заказу. Отправьте материал в архив, чтобы скрыть его из новых операций, но сохранить историю.",
        );
      } else {
        setError(message);
      }
    } finally {
      setDeletingMaterialId(null);
    }
  }

  function startEditMaterial(material: Material) {
    setEditingMaterialId(material.id);
    setEditingForm({
      name: material.name,
      brand_id: material.brand_id,
      category: material.category ?? "",
      unit_id: material.unit_id,
      cost_per_unit: String(material.cost_per_unit),
      min_stock_quantity: String(material.min_stock_quantity ?? 0),
    });
    setError(null);
  }

  function cancelEditMaterial() {
    setEditingMaterialId(null);
    setEditingForm(defaultForm);
    setError(null);
  }

  async function handleUpdateMaterial(materialId: number) {
    const validation = validateMaterialForm(editingForm);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте данные материала.");
      return;
    }

    setSubmittingEditMaterialId(materialId);
    setError(null);

    try {
      const updatedMaterial = await updateMaterial(
        materialId,
        validation.payload,
      );

      setMaterials((current) =>
        current.map((material) =>
          material.id === updatedMaterial.id ? updatedMaterial : material,
        ),
      );

      setEditingMaterialId(null);
      setEditingForm(defaultForm);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setSubmittingEditMaterialId(null);
    }
  }

  async function handleToggleMaterialActive(material: Material) {
    setTogglingMaterialId(material.id);
    setError(null);

    try {
      const updatedMaterial = await updateMaterial(material.id, {
        is_active: !material.is_active,
      });

      setMaterials((current) =>
        current.map((currentMaterial) =>
          currentMaterial.id === updatedMaterial.id
            ? updatedMaterial
            : currentMaterial,
        ),
      );
    } catch (toggleError) {
      setError(getApiErrorMessage(toggleError));
    } finally {
      setTogglingMaterialId(null);
    }
  }

  const stockMovementTypeOptions = [
    {
      value: "receipt",
      label: "Приход",
      description: "Увеличивает остаток на складе",
    },
    {
      value: "write_off",
      label: "Списание",
      description: "Уменьшает остаток на складе",
    },
    {
      value: "adjustment",
      label: "Корректировка",
      description: "Может увеличить или уменьшить остаток",
    },
  ];

  const filteredStockMovements = stockMovements.filter((movement) => {
    if (stockMovementFilter === "all") {
      return true;
    }

    if (stockMovementFilter === "order_usage") {
      return (
        movement.movement_type === "order_usage" ||
        movement.movement_type === "order_usage_reversal"
      );
    }

    return movement.movement_type === stockMovementFilter;
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Материалы"
        title="Материалы"
        description="Справочник расходных материалов: бренд, категория, единица измерения, себестоимость и активность."
        actions={
          <Link href="/units">
            <Button type="button" variant="secondary">
              Единицы измерения
            </Button>
          </Link>
        }
      />

      {!canReadMaterials ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к материалам. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                materials.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadMaterials ? (
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
                      <CardTitle>Список материалов</CardTitle>
                      <CardDescription>
                        Всего материалов: {materials.length}. Найдено:{" "}
                        {filteredMaterials.length}.
                      </CardDescription>
                    </div>

                    <Badge tone={materials.length > 0 ? "primary" : "muted"}>
                      {materials.length}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Input
                    label="Поиск"
                    placeholder="Например: пленка, полироль, Koch, мл..."
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
                      Все · {materials.length}
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
                      Активные · {activeMaterialsCount}
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
                      Архив · {archivedMaterialsCount}
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                      Загружаем материалы...
                    </div>
                  ) : null}

                  {!isLoading && filteredMaterials.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Материалы не найдены.
                    </div>
                  ) : null}

                  {!isLoading && filteredMaterials.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {filteredMaterials.map((material) => {
                        const isEditing = editingMaterialId === material.id;

                        return (
                          <div
                            key={material.id}
                            className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                          >
                            {!isEditing ? (
                              <div className="space-y-4">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="truncate text-base font-semibold text-white">
                                        {material.name}
                                      </div>

                                      <Badge tone="muted">
                                        Material ID #{material.id}
                                      </Badge>

                                      <Badge
                                        tone={
                                          material.is_active
                                            ? "success"
                                            : "muted"
                                        }
                                      >
                                        {material.is_active
                                          ? "Активен"
                                          : "Архив"}
                                      </Badge>

                                      <Badge
                                        tone={getStockStatusTone(
                                          stockSummaryByMaterialId[material.id]
                                            ?.stock_status,
                                        )}
                                      >
                                        {getStockStatusLabel(
                                          stockSummaryByMaterialId[material.id]
                                            ?.stock_status,
                                        )}
                                      </Badge>
                                    </div>

                                    <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                      {getBrandName(brands, material.brand_id)}{" "}
                                      · {material.category || "Без категории"} ·{" "}
                                      {getUnitLabel(units, material.unit_id)}
                                    </div>
                                  </div>

                                  {canManageMaterials ? (
                                    <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                          void openMaterialStock(material.id)
                                        }
                                      >
                                        Склад
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                          setDeleteConfirmMaterialId(null);
                                          startEditMaterial(material);
                                        }}
                                      >
                                        Редактировать
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={
                                          togglingMaterialId === material.id
                                        }
                                        onClick={() =>
                                          void handleToggleMaterialActive(
                                            material,
                                          )
                                        }
                                      >
                                        {togglingMaterialId === material.id
                                          ? "Сохраняем..."
                                          : material.is_active
                                            ? "В архив"
                                            : "Активировать"}
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-[rgb(252_165_165)] hover:text-[rgb(254_202_202)]"
                                        disabled={
                                          deletingMaterialId === material.id
                                        }
                                        onClick={() =>
                                          setDeleteConfirmMaterialId(
                                            (current) =>
                                              current === material.id
                                                ? null
                                                : material.id,
                                          )
                                        }
                                      >
                                        Удалить
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 text-xs leading-5 text-[hsl(var(--muted))]">
                                  Удаление подходит только для ошибочно
                                  созданных материалов, которые нигде не
                                  использовались. Если материал уже был списан в
                                  заказе, используйте архив.
                                </div>

                                <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Себестоимость
                                    </div>
                                    <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                                      {formatMoney(material.cost_per_unit)}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Бренд
                                    </div>
                                    <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                                      {getBrandName(brands, material.brand_id)}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Ед. изм.
                                    </div>
                                    <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                                      {getUnitLabel(units, material.unit_id)}
                                    </div>
                                  </div>

                                  <div
                                    className={[
                                      "rounded-2xl border p-3",
                                      !stockSummaryByMaterialId[material.id]
                                        ? "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]"
                                        : stockSummaryByMaterialId[material.id]
                                              .stock_status === "out_of_stock"
                                          ? "border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)]"
                                          : stockSummaryByMaterialId[
                                                material.id
                                              ].stock_status === "low_stock"
                                            ? "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)]"
                                            : "border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)]",
                                    ].join(" ")}
                                  >
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Остаток
                                    </div>
                                    <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                                      {stockSummaryByMaterialId[material.id]
                                        ? `${stockSummaryByMaterialId[material.id].current_quantity} ${
                                            stockSummaryByMaterialId[
                                              material.id
                                            ].unit_code ?? ""
                                          }`
                                        : isStockSummaryLoading
                                          ? "Загрузка..."
                                          : "—"}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Минимум
                                    </div>
                                    <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                                      {material.min_stock_quantity}{" "}
                                      {stockSummaryByMaterialId[material.id]
                                        ?.unit_code ?? ""}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 sm:col-span-2 lg:col-span-1">
                                    <div className="text-xs text-[hsl(var(--muted))]">
                                      Складская стоимость
                                    </div>
                                    <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                                      {stockSummaryByMaterialId[material.id]
                                        ? formatCurrency(
                                            stockSummaryByMaterialId[
                                              material.id
                                            ].stock_value,
                                          )
                                        : isStockSummaryLoading
                                          ? "Загрузка..."
                                          : "—"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <Input
                                  label="Название материала"
                                  value={editingForm.name}
                                  onChange={(event) =>
                                    updateEditingForm({
                                      name: event.target.value,
                                    })
                                  }
                                />

                                <div className="grid gap-4 lg:grid-cols-2">
                                  <Combobox
                                    label="Бренд"
                                    placeholder="Выберите бренд"
                                    value={
                                      editingForm.brand_id
                                        ? String(editingForm.brand_id)
                                        : ""
                                    }
                                    options={brandOptions}
                                    onChange={(value) =>
                                      updateEditingForm({
                                        brand_id: value ? Number(value) : null,
                                      })
                                    }
                                  />

                                  <Input
                                    label="Категория"
                                    placeholder="Например: пленка, химия, полироль"
                                    value={editingForm.category}
                                    onChange={(event) =>
                                      updateEditingForm({
                                        category: event.target.value,
                                      })
                                    }
                                  />
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                  <Combobox
                                    label="Единица измерения"
                                    placeholder="Выберите единицу"
                                    value={
                                      editingForm.unit_id
                                        ? String(editingForm.unit_id)
                                        : ""
                                    }
                                    options={unitOptions}
                                    onChange={(value) =>
                                      updateEditingForm({
                                        unit_id: value ? Number(value) : null,
                                      })
                                    }
                                  />

                                  <Input
                                    label="Себестоимость за единицу"
                                    placeholder="Например: 2500"
                                    inputMode="numeric"
                                    value={editingForm.cost_per_unit}
                                    onChange={(event) =>
                                      updateEditingForm({
                                        cost_per_unit: event.target.value
                                          .replace(/[^\d.,\s]/g, "")
                                          .slice(0, 12),
                                      })
                                    }
                                  />

                                  <Input
                                    label="Минимальный остаток"
                                    placeholder="Например: 3"
                                    inputMode="numeric"
                                    value={editingForm.min_stock_quantity}
                                    onChange={(event) =>
                                      updateEditingForm({
                                        min_stock_quantity: event.target.value
                                          .replace(/[^\d.,\s]/g, "")
                                          .slice(0, 12),
                                      })
                                    }
                                  />
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={
                                      submittingEditMaterialId === material.id
                                    }
                                    onClick={cancelEditMaterial}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={
                                      submittingEditMaterialId === material.id
                                    }
                                    onClick={() =>
                                      void handleUpdateMaterial(material.id)
                                    }
                                  >
                                    {submittingEditMaterialId === material.id
                                      ? "Сохраняем..."
                                      : "Сохранить"}
                                  </Button>
                                </div>
                              </div>
                            )}
                            {deleteConfirmMaterialId === material.id ? (
                              <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                                <div className="text-sm font-semibold text-[rgb(252_165_165)]">
                                  Подтвердить удаление материала?
                                </div>

                                <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                                  Удалить можно только ошибочно созданный
                                  материал, который еще нигде не использовался.
                                  Если материал уже есть в фактическом расходе
                                  заказа, backend отклонит удаление. Для таких
                                  материалов используйте кнопку “В архив”.
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={
                                      deletingMaterialId === material.id
                                    }
                                    onClick={() =>
                                      setDeleteConfirmMaterialId(null)
                                    }
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={
                                      deletingMaterialId === material.id
                                    }
                                    onClick={() =>
                                      void handleDeleteMaterial(material.id)
                                    }
                                  >
                                    {deletingMaterialId === material.id
                                      ? "Удаляем..."
                                      : "Да, удалить"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                            {stockMaterialId === material.id ? (
                              <div className="mt-4 rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.06)] p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-sm font-semibold text-white">
                                      Склад: {material.name}
                                    </div>
                                    <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                                      Приход, списание, корректировка и история
                                      движений материала.
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      disabled={isStockLoading}
                                      onClick={() =>
                                        void loadMaterialStock(material.id)
                                      }
                                    >
                                      Обновить
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={closeMaterialStock}
                                    >
                                      Закрыть
                                    </Button>
                                  </div>
                                </div>

                                {isStockLoading ? (
                                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm text-[hsl(var(--muted))]">
                                    Загружаем склад...
                                  </div>
                                ) : null}

                                {stockSummaryByMaterialId[material.id] ? (
                                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Остаток
                                      </div>
                                      <div className="mt-2 text-lg font-semibold text-white">
                                        {
                                          stockSummaryByMaterialId[material.id]
                                            .current_quantity
                                        }{" "}
                                        {stockSummaryByMaterialId[material.id]
                                          .unit_code ?? ""}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Минимум
                                      </div>
                                      <div className="mt-2 text-lg font-semibold text-white">
                                        {
                                          stockSummaryByMaterialId[material.id]
                                            .min_stock_quantity
                                        }{" "}
                                        {stockSummaryByMaterialId[material.id]
                                          .unit_code ?? ""}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Статус
                                      </div>
                                      <div className="mt-2">
                                        <Badge
                                          tone={getStockStatusTone(
                                            stockSummaryByMaterialId[
                                              material.id
                                            ].stock_status,
                                          )}
                                        >
                                          {getStockStatusLabel(
                                            stockSummaryByMaterialId[
                                              material.id
                                            ].stock_status,
                                          )}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Складская стоимость
                                      </div>
                                      <div className="mt-2 text-lg font-semibold text-white">
                                        {formatCurrency(
                                          stockSummaryByMaterialId[material.id]
                                            .stock_value,
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Последняя себестоимость
                                      </div>
                                      <div className="mt-2 text-lg font-semibold text-white">
                                        {stockSummaryByMaterialId[material.id]
                                          .last_unit_cost !== null
                                          ? formatCurrency(
                                              stockSummaryByMaterialId[
                                                material.id
                                              ].last_unit_cost ?? 0,
                                            )
                                          : "—"}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
                                  <div className="mb-4 text-sm font-semibold text-white">
                                    Новое движение склада
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <Combobox
                                      label="Тип движения"
                                      placeholder="Выберите тип"
                                      value={stockForm.movement_type}
                                      options={stockMovementTypeOptions}
                                      onChange={(value) =>
                                        updateStockForm({
                                          movement_type:
                                            value as StockFormState["movement_type"],
                                        })
                                      }
                                    />

                                    <Input
                                      label="Количество"
                                      placeholder={
                                        stockForm.movement_type === "adjustment"
                                          ? "Например: -2 или 3"
                                          : "Например: 10"
                                      }
                                      inputMode="numeric"
                                      value={stockForm.quantity}
                                      onChange={(event) =>
                                        updateStockForm({
                                          quantity: event.target.value
                                            .replace(/[^\d.,\s-]/g, "")
                                            .slice(0, 12),
                                        })
                                      }
                                    />

                                    <Input
                                      label="Себестоимость за единицу"
                                      placeholder={`По умолчанию: ${formatCurrency(
                                        material.cost_per_unit,
                                      )}`}
                                      inputMode="numeric"
                                      value={stockForm.unit_cost}
                                      onChange={(event) =>
                                        updateStockForm({
                                          unit_cost: event.target.value
                                            .replace(/[^\d.,\s]/g, "")
                                            .slice(0, 12),
                                        })
                                      }
                                    />

                                    {stockForm.movement_type ===
                                    "adjustment" ? (
                                      <div className="text-xs leading-5 text-[hsl(var(--muted))] md:col-span-2">
                                        Корректировка может быть положительной
                                        или отрицательной. Например: -2 уменьшит
                                        остаток, 3 увеличит остаток.
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="mt-4">
                                    <Input
                                      label="Комментарий"
                                      placeholder="Например: приход от поставщика, инвентаризация..."
                                      value={stockForm.comment}
                                      onChange={(event) =>
                                        updateStockForm({
                                          comment: event.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={isStockSubmitting}
                                      onClick={() =>
                                        setStockForm(defaultStockForm)
                                      }
                                    >
                                      Очистить
                                    </Button>

                                    <Button
                                      type="button"
                                      disabled={isStockSubmitting}
                                      onClick={() =>
                                        void handleCreateStockMovement(
                                          material.id,
                                        )
                                      }
                                    >
                                      {isStockSubmitting
                                        ? "Сохраняем..."
                                        : "Сохранить движение"}
                                    </Button>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                                    История движений
                                  </div>

                                  <div className="mb-3 flex flex-wrap gap-2">
                                    {[
                                      { value: "all", label: "Все" },
                                      { value: "receipt", label: "Приходы" },
                                      { value: "write_off", label: "Списания" },
                                      {
                                        value: "adjustment",
                                        label: "Корректировки",
                                      },
                                      {
                                        value: "order_usage",
                                        label: "Расходы заказов",
                                      },
                                    ].map((filter) => (
                                      <button
                                        key={filter.value}
                                        type="button"
                                        className={[
                                          "rounded-full border px-3 py-2 text-xs font-semibold transition",
                                          stockMovementFilter === filter.value
                                            ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                                            : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                                        ].join(" ")}
                                        onClick={() =>
                                          setStockMovementFilter(
                                            filter.value as StockMovementFilter,
                                          )
                                        }
                                      >
                                        {filter.label}
                                      </button>
                                    ))}
                                  </div>

                                  {filteredStockMovements.length === 0 &&
                                  !isStockLoading ? (
                                    <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-5 text-center text-sm text-[hsl(var(--muted))]">
                                      Движений по этому материалу пока нет.
                                    </div>
                                  ) : null}

                                  {filteredStockMovements.length > 0 ? (
                                    <div className="space-y-2">
                                      {filteredStockMovements.map(
                                        (movement) => (
                                          <div
                                            key={movement.id}
                                            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                                          >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                              <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <Badge
                                                    tone={getStockMovementTone(
                                                      movement.movement_type,
                                                    )}
                                                  >
                                                    {getStockMovementTypeLabel(
                                                      movement.movement_type,
                                                    )}
                                                  </Badge>

                                                  <Badge tone="muted">
                                                    Movement #{movement.id}
                                                  </Badge>

                                                  {movement.order_item_material_id ? (
                                                    <Badge tone="primary">
                                                      Расход #
                                                      {
                                                        movement.order_item_material_id
                                                      }
                                                    </Badge>
                                                  ) : null}
                                                </div>

                                                <div className="mt-2 text-sm font-semibold text-white">
                                                  {movement.quantity > 0
                                                    ? "+"
                                                    : ""}
                                                  {movement.quantity}{" "}
                                                  {stockSummaryByMaterialId[
                                                    material.id
                                                  ]?.unit_code ?? ""}
                                                  {" · "}
                                                  {formatCurrency(
                                                    movement.total_cost,
                                                  )}
                                                </div>

                                                <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                                                  Себестоимость:{" "}
                                                  {formatCurrency(
                                                    movement.unit_cost,
                                                  )}{" "}
                                                  ·{" "}
                                                  {formatDateTime(
                                                    movement.created_at,
                                                  )}
                                                </div>

                                                {movement.comment ? (
                                                  <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                                                    {movement.comment}
                                                  </div>
                                                ) : null}
                                              </div>

                                              <div className="text-xs leading-5 text-[hsl(var(--muted))] sm:text-right">
                                                <div>
                                                  Автор:{" "}
                                                  {movement.created_by_user_full_name ??
                                                    `Сотрудник #${movement.created_by_user_id}`}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  ) : null}
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
                  <CardTitle>Создать материал</CardTitle>
                  <CardDescription>
                    Добавьте материал для учета расхода и себестоимости.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {!canManageMaterials ? (
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                      Для создания и редактирования нужен permission{" "}
                      <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                        materials.manage
                      </span>
                      .
                    </div>
                  ) : null}

                  {canManageMaterials ? (
                    <div className="space-y-4">
                      <Input
                        label="Название материала"
                        placeholder="Например: Пленка PPF 200 micron"
                        value={form.name}
                        onChange={(event) =>
                          updateForm({
                            name: event.target.value,
                          })
                        }
                      />

                      <Combobox
                        label="Бренд"
                        placeholder="Выберите бренд"
                        value={form.brand_id ? String(form.brand_id) : ""}
                        options={brandOptions}
                        onChange={(value) =>
                          updateForm({
                            brand_id: value ? Number(value) : null,
                          })
                        }
                      />

                      <Input
                        label="Категория"
                        placeholder="Например: пленка, химия, полироль"
                        value={form.category}
                        onChange={(event) =>
                          updateForm({
                            category: event.target.value,
                          })
                        }
                      />

                      <Combobox
                        label="Единица измерения"
                        placeholder="Выберите единицу"
                        value={form.unit_id ? String(form.unit_id) : ""}
                        options={unitOptions}
                        onChange={(value) =>
                          updateForm({
                            unit_id: value ? Number(value) : null,
                          })
                        }
                      />

                      <Input
                        label="Себестоимость за единицу"
                        placeholder="Например: 2500"
                        inputMode="numeric"
                        value={form.cost_per_unit}
                        onChange={(event) =>
                          updateForm({
                            cost_per_unit: event.target.value
                              .replace(/[^\d.,\s]/g, "")
                              .slice(0, 12),
                          })
                        }
                      />

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Input
                          label="Минимальный остаток"
                          placeholder="Например: 3"
                          inputMode="numeric"
                          value={form.min_stock_quantity}
                          onChange={(event) =>
                            updateForm({
                              min_stock_quantity: event.target.value
                                .replace(/[^\d.,\s]/g, "")
                                .slice(0, 12),
                            })
                          }
                        />
                      </div>

                      <Button
                        type="button"
                        className="w-full"
                        disabled={isSubmittingCreate}
                        onClick={() => void handleCreateMaterial()}
                      >
                        {isSubmittingCreate ? "Создаем..." : "Создать материал"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Как использовать</CardTitle>
                  <CardDescription>
                    Материалы нужны для фактического расхода по заказу.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3 text-sm leading-6 text-[hsl(var(--muted))]">
                    <p>
                      Материал хранит себестоимость за единицу измерения. При
                      добавлении фактического расхода к позиции заказа эта
                      стоимость попадет в расчет себестоимости.
                    </p>

                    <p>
                      Архивный материал остается в истории, но позже будет скрыт
                      из выбора в новых операциях.
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
