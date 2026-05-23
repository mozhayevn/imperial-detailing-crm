"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
import { formatCurrency } from "@/src/lib/formatters";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";

import { getMaterials } from "@/src/features/materials/api";
import type { Material } from "@/src/features/materials/types";
import { getMaterialBrands } from "@/src/features/material-brands/api";
import type { MaterialBrand } from "@/src/features/material-brands/types";
import { getUnits } from "@/src/features/units/api";
import type { Unit } from "@/src/features/units/types";
import { getMaterialStock } from "@/src/features/material-stock/api";
import type { MaterialStockSummary } from "@/src/features/material-stock/types";

type InventoryStatusFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";

function getBrandName(brands: MaterialBrand[], brandId: number | null) {
  if (!brandId) {
    return "Без бренда";
  }

  return brands.find((brand) => brand.id === brandId)?.name ?? `Бренд #${brandId}`;
}

function getUnitLabel(units: Unit[], unitId: number) {
  const unit = units.find((item) => item.id === unitId);

  if (!unit) {
    return `Unit #${unitId}`;
  }

  return `${unit.name} (${unit.code})`;
}

function getStockStatus(quantity: number | null | undefined) {
  if (quantity === null || quantity === undefined) {
    return "unknown";
  }

  if (quantity <= 0) {
    return "out_of_stock";
  }

  if (quantity <= 3) {
    return "low_stock";
  }

  return "in_stock";
}

function getStockStatusLabel(quantity: number | null | undefined) {
  const status = getStockStatus(quantity);

  if (status === "out_of_stock") {
    return "Нет остатка";
  }

  if (status === "low_stock") {
    return "Мало";
  }

  if (status === "in_stock") {
    return "В наличии";
  }

  return "Нет данных";
}

function getStockStatusTone(quantity: number | null | undefined) {
  const status = getStockStatus(quantity);

  if (status === "out_of_stock") {
    return "danger";
  }

  if (status === "low_stock") {
    return "warning";
  }

  if (status === "in_stock") {
    return "success";
  }

  return "muted";
}

export function InventoryPageClient() {
  const { session } = useAuth();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [brands, setBrands] = useState<MaterialBrand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stockByMaterialId, setStockByMaterialId] = useState<
    Record<number, MaterialStockSummary>
  >({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<InventoryStatusFilter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadMaterials = canAccessByPermission(session, "materials.read");
  const canReadBrands = canAccessByPermission(session, "material_brands.read");

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

        const loadedMaterials =
          materialsResult.status === "fulfilled" ? materialsResult.value : [];

        if (materialsResult.status === "fulfilled") {
          setMaterials(loadedMaterials);
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

        const stockResults = await Promise.allSettled(
          loadedMaterials.map((material) => getMaterialStock(material.id)),
        );

        if (!isMounted) {
          return;
        }

        const nextStockByMaterialId: Record<number, MaterialStockSummary> = {};

        stockResults.forEach((result) => {
          if (result.status === "fulfilled") {
            nextStockByMaterialId[result.value.material_id] = result.value;
          }
        });

        setStockByMaterialId(nextStockByMaterialId);
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

  const inventoryRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return materials.filter((material) => {
      const stock = stockByMaterialId[material.id];
      const currentQuantity = stock?.current_quantity ?? null;
      const stockStatus = getStockStatus(currentQuantity);

      const brandName = getBrandName(brands, material.brand_id);
      const unitLabel = getUnitLabel(units, material.unit_id);

      const matchesSearch =
        !normalizedSearch ||
        material.name.toLowerCase().includes(normalizedSearch) ||
        (material.category?.toLowerCase() ?? "").includes(normalizedSearch) ||
        brandName.toLowerCase().includes(normalizedSearch) ||
        unitLabel.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || statusFilter === stockStatus;

      return matchesSearch && matchesStatus;
    });
  }, [materials, brands, units, stockByMaterialId, search, statusFilter]);

  const totals = useMemo(() => {
    return materials.reduce(
      (acc, material) => {
        const stock = stockByMaterialId[material.id];
        const quantity = stock?.current_quantity ?? 0;
        const value = stock?.stock_value ?? 0;

        acc.totalStockValue += value;

        if (quantity <= 0) {
          acc.outOfStock += 1;
        } else if (quantity <= 3) {
          acc.lowStock += 1;
        } else {
          acc.inStock += 1;
        }

        return acc;
      },
      {
        totalStockValue: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
      },
    );
  }, [materials, stockByMaterialId]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Склад"
        title="Inventory overview"
        description="Общий обзор остатков, складской стоимости и статуса материалов."
        actions={
          <Link href="/materials">
            <Button type="button" variant="secondary">
              Материалы
            </Button>
          </Link>
        }
      />

      {!canReadMaterials ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к складу. Нужен permission{" "}
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Складская стоимость
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {formatCurrency(totals.totalStockValue)}
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                В наличии
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {totals.inStock}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(252_211_77)]">
                Мало
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {totals.lowStock}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
              <div className="text-xs font-medium text-[rgb(252_165_165)]">
                Нет остатка
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {totals.outOfStock}
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Остатки материалов</CardTitle>
                  <CardDescription>
                    Всего материалов: {materials.length}. Найдено:{" "}
                    {inventoryRows.length}.
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
                placeholder="Например: пленка, химия, Koch, мл..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Все" },
                  { value: "in_stock", label: "В наличии" },
                  { value: "low_stock", label: "Мало" },
                  { value: "out_of_stock", label: "Нет остатка" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={[
                      "rounded-full border px-3 py-2 text-xs font-semibold transition",
                      statusFilter === filter.value
                        ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                    ].join(" ")}
                    onClick={() =>
                      setStatusFilter(filter.value as InventoryStatusFilter)
                    }
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем склад...
                </div>
              ) : null}

              {!isLoading && inventoryRows.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Материалы не найдены.
                </div>
              ) : null}

              {!isLoading && inventoryRows.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-3xl border border-[hsl(var(--border))]">
                  <div className="grid grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(140px,0.8fr)] gap-0 bg-[hsl(var(--surface-1))] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--muted))]">
                    <div>Материал</div>
                    <div>Бренд</div>
                    <div>Остаток</div>
                    <div>Стоимость</div>
                    <div>Статус</div>
                  </div>

                  <div className="divide-y divide-[hsl(var(--border))]">
                    {inventoryRows.map((material) => {
                      const stock = stockByMaterialId[material.id];
                      const brandName = getBrandName(brands, material.brand_id);
                      const unitLabel = getUnitLabel(units, material.unit_id);

                      return (
                        <div
                          key={material.id}
                          className="grid grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(140px,0.8fr)] gap-0 px-4 py-4 text-sm"
                        >
                          <div>
                            <div className="font-semibold text-white">
                              {material.name}
                            </div>
                            <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                              {material.category || "Без категории"} ·{" "}
                              {unitLabel}
                            </div>
                          </div>

                          <div className="text-[hsl(var(--muted-foreground))]">
                            {brandName}
                          </div>

                          <div className="font-semibold text-white">
                            {stock
                              ? `${stock.current_quantity} ${
                                  stock.unit_code ?? ""
                                }`
                              : "—"}
                          </div>

                          <div className="font-semibold text-white">
                            {stock ? formatCurrency(stock.stock_value) : "—"}
                          </div>

                          <div>
                            <Badge
                              tone={getStockStatusTone(stock?.current_quantity)}
                            >
                              {getStockStatusLabel(stock?.current_quantity)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}