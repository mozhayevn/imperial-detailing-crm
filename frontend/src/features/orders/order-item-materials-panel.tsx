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
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency } from "@/src/lib/formatters";
import type { MaterialBrand } from "@/src/features/material-brands/types";
import type { Material } from "@/src/features/materials/types";
import type { OrderItemMaterial } from "@/src/features/order-item-materials/types";
import {
  addMaterialToOrderItem,
  deleteOrderItemMaterial,
  getOrderItemMaterials,
} from "@/src/features/order-item-materials/api";
import type { ServicePackage } from "@/src/features/service-packages/types";
import type { Service } from "@/src/features/services/types";
import type { OrderItem } from "@/src/features/orders/types";

type OrderItemMaterialsPanelProps = {
  orderItems: OrderItem[];
  materials: Material[];
  materialBrands: MaterialBrand[];
  services: Service[];
  servicePackages: ServicePackage[];
  pricingLocked: boolean;
  canReadMaterials: boolean;
  canConsumeMaterials: boolean;
  orderStatus: string;
};

type FormState = {
  material_id: number | null;
  quantity: number;
  comment: string;
};

const defaultFormState: FormState = {
  material_id: null,
  quantity: 1,
  comment: "",
};

function getNumberValue(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function OrderItemMaterialsPanel({
  orderItems,
  materials,
  materialBrands,
  services,
  servicePackages,
  pricingLocked,
  canReadMaterials,
  canConsumeMaterials,
  orderStatus,
}: OrderItemMaterialsPanelProps) {
  const [materialsByOrderItem, setMaterialsByOrderItem] = useState<
    Record<number, OrderItemMaterial[]>
  >({});
  const [formsByOrderItem, setFormsByOrderItem] = useState<
    Record<number, FormState>
  >({});
  const [openFormOrderItemId, setOpenFormOrderItemId] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [submittingOrderItemId, setSubmittingOrderItemId] = useState<
    number | null
  >(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<number | null>(
    null,
  );
  const isTerminalOrderStatus =
    orderStatus === "canceled" || orderStatus === "delivered";

  const canModifyMaterials =
    canConsumeMaterials && !pricingLocked && !isTerminalOrderStatus;

  const [error, setError] = useState<string | null>(null);

  const activeMaterials = useMemo(
    () => materials.filter((material) => material.is_active !== false),
    [materials],
  );

  const materialOptions = useMemo(
    () =>
      activeMaterials.map((material) => {
        const brand = materialBrands.find(
          (item) => item.id === material.brand_id,
        );

        const description = [
          brand?.name ?? null,
          material.category ?? null,
          `${material.cost_per_unit.toLocaleString("ru-RU")} ₸ / ед.`,
        ]
          .filter(Boolean)
          .join(" · ");

        return {
          label: material.name,
          value: material.id,
          description,
        };
      }),
    [activeMaterials, materialBrands],
  );

  function getServiceLabel(serviceId: number) {
    const service = services.find((item) => item.id === serviceId);

    return service?.name ?? `Услуга #${serviceId}`;
  }

  function getServiceById(serviceId: number) {
  return services.find((service) => service.id === serviceId) ?? null;
}

function itemRequiresMissingBrand(item: OrderItem) {
  const service = getServiceById(item.service_id);

  return Boolean(service?.requires_brand && !item.material_brand_id);
}

function getMaterialOptionsForOrderItem(item: OrderItem) {
  const availableMaterials = activeMaterials.filter((material) => {
    if (item.material_brand_id) {
      return material.brand_id === item.material_brand_id;
    }

    return true;
  });

  return availableMaterials.map((material) => {
    const brand = materialBrands.find(
      (brandItem) => brandItem.id === material.brand_id,
    );

    const description = [
      brand?.name ?? null,
      material.category ?? null,
      `${material.cost_per_unit.toLocaleString("ru-RU")} ₸ / ед.`,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      label: material.name,
      value: material.id,
      description,
    };
  });
}

  function getMaterialLabel(materialId: number) {
    const material = materials.find((item) => item.id === materialId);

    return material?.name ?? `Материал #${materialId}`;
  }

  function getMaterialBrandLabel(materialId: number) {
    const material = materials.find((item) => item.id === materialId);

    if (!material?.brand_id) {
      return null;
    }

    const brand = materialBrands.find((item) => item.id === material.brand_id);

    return brand?.name ?? `Бренд #${material.brand_id}`;
  }

  function getOrderItemMeta(item: OrderItem) {
    const brand = materialBrands.find(
      (brandItem) => brandItem.id === item.material_brand_id,
    );
    const servicePackage = servicePackages.find(
      (packageItem) => packageItem.id === item.service_package_id,
    );

    return [brand?.name ?? null, servicePackage?.name ?? null]
      .filter(Boolean)
      .join(" · ");
  }

  function getForm(orderItemId: number) {
    return formsByOrderItem[orderItemId] ?? defaultFormState;
  }

  function updateForm(orderItemId: number, patch: Partial<FormState>) {
    setFormsByOrderItem((current) => ({
      ...current,
      [orderItemId]: {
        ...(current[orderItemId] ?? defaultFormState),
        ...patch,
      },
    }));
  }

  async function loadOrderItemMaterials() {
    if (!canReadMaterials || orderItems.length === 0) {
      setMaterialsByOrderItem({});
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        orderItems.map(async (item) => {
          const rows = await getOrderItemMaterials(item.id);

          return [item.id, rows] as const;
        }),
      );

      setMaterialsByOrderItem(Object.fromEntries(results));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  const orderItemIdsKey = useMemo(
  () => orderItems.map((item) => item.id).join(","),
  [orderItems],
);

useEffect(() => {
  let isMounted = true;

  async function loadInitialMaterials() {
    try {
      if (!canReadMaterials || orderItems.length === 0) {
        if (isMounted) {
          setMaterialsByOrderItem({});
        }

        return;
      }

      const results = await Promise.all(
        orderItems.map(async (item) => {
          const rows = await getOrderItemMaterials(item.id);

          return [item.id, rows] as const;
        }),
      );

      if (isMounted) {
        setMaterialsByOrderItem(Object.fromEntries(results));
      }
    } catch (loadError) {
      if (isMounted) {
        setError(getApiErrorMessage(loadError));
      }
    }
  }

  void loadInitialMaterials();

  return () => {
    isMounted = false;
  };
}, [canReadMaterials, orderItemIdsKey]);

  async function handleAddMaterial(orderItemId: number) {
    const form = getForm(orderItemId);

    if (!form.material_id) {
      setError("Выберите материал");
      return;
    }

    if (!Number.isFinite(form.quantity) || form.quantity <= 0) {
      setError("Количество должно быть больше 0");
      return;
    }

    setSubmittingOrderItemId(orderItemId);
    setError(null);

    try {
      await addMaterialToOrderItem(orderItemId, {
        material_id: form.material_id,
        quantity: form.quantity,
        comment: form.comment.trim() || null,
      });

      setFormsByOrderItem((current) => ({
        ...current,
        [orderItemId]: defaultFormState,
      }));
      setOpenFormOrderItemId(null);

      await loadOrderItemMaterials();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmittingOrderItemId(null);
    }
  }

  async function handleDeleteMaterial(orderItemMaterialId: number) {
    setDeletingMaterialId(orderItemMaterialId);
    setError(null);

    try {
      await deleteOrderItemMaterial(orderItemMaterialId);
      await loadOrderItemMaterials();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingMaterialId(null);
    }
  }

  const totalMaterialsCost = Object.values(materialsByOrderItem)
    .flat()
    .reduce((sum, row) => sum + row.total_cost, 0);

  const totalRows = Object.values(materialsByOrderItem).flat().length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Материалы по заказу</CardTitle>
            <CardDescription>
              Фактический расход материалов по каждой позиции заказа.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{totalRows} мат.</Badge>
            <Badge tone="warning">{formatCurrency(totalMaterialsCost)}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!canReadMaterials ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            У вас нет доступа к просмотру материалов. Нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              materials.read
            </span>
            .
          </div>
        ) : null}

        {isTerminalOrderStatus ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            Заказ находится в финальном статусе. Добавление и удаление
            материалов недоступно.
          </div>
        ) : pricingLocked ? (
          <div className="mb-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
            Pricing зафиксирован. Добавление и удаление материалов заблокировано
            до unlock flow.
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm text-[hsl(var(--muted))]">
            Загружаем материалы позиций...
          </div>
        ) : null}

        <div className="space-y-4">
          {orderItems.map((item) => {
            const rows = materialsByOrderItem[item.id] ?? [];
            const form = getForm(item.id);
            const isFormOpen = openFormOrderItemId === item.id;
            const orderItemMeta = getOrderItemMeta(item);
            const orderItemMaterialsCost = rows.reduce(
              (sum, row) => sum + row.total_cost,
              0,
            );

            const isBrandRequiredButMissing = itemRequiresMissingBrand(item);
            const materialOptionsForItem = getMaterialOptionsForOrderItem(item);
            const canModifyThisItemMaterials = 
                canModifyMaterials && !isBrandRequiredButMissing;

            return (
              <div
                key={item.id}
                className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="muted">Позиция #{item.id}</Badge>
                      <Badge tone="primary">{rows.length} материалов</Badge>
                    </div>

                    <div className="mt-3 text-sm font-semibold text-white">
                      {getServiceLabel(item.service_id)}
                    </div>

                    {orderItemMeta ? (
                      <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                        {orderItemMeta}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-left lg:text-right">
                    <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                      Себестоимость
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatCurrency(orderItemMaterialsCost)}
                    </div>
                  </div>
                </div>

                {rows.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
                    {rows.map((row) => {
                      const brandLabel = getMaterialBrandLabel(row.material_id);

                      return (
                        <div
                          key={row.id}
                          className="flex flex-col gap-3 border-b border-[hsl(var(--border))] px-4 py-3 last:border-b-0 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {getMaterialLabel(row.material_id)}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-[hsl(var(--muted))]">
                              {brandLabel ? (
                                <Badge tone="muted">{brandLabel}</Badge>
                              ) : null}

                              <span>Кол-во: {row.quantity}</span>
                              <span>
                                Цена ед.: {formatCurrency(row.unit_cost)}
                              </span>
                              {row.comment ? <span>{row.comment}</span> : null}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 lg:justify-end">
                            <div className="text-sm font-semibold text-white">
                              {formatCurrency(row.total_cost)}
                            </div>

                            {canModifyThisItemMaterials ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={deletingMaterialId === row.id}
                                onClick={() =>
                                  void handleDeleteMaterial(row.id)
                                }
                              >
                                {deletingMaterialId === row.id
                                  ? "Удаляем..."
                                  : "Удалить"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
                    Материалы для этой позиции пока не добавлены.
                  </div>
                )}

                {canModifyThisItemMaterials ? (
                  <div className="mt-4">
                    {!isFormOpen ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setOpenFormOrderItemId(item.id)}
                      >
                        Добавить материал
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
                        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.4fr]">
                          <Combobox
                            label="Материал"
                            placeholder={
                              item.material_brand_id
                                ? "Материалы выбранного бренда"
                                : "Выберите материал"
                            }
                            value={form.material_id}
                            options={materialOptionsForItem}
                            onChange={(value) =>
                              updateForm(item.id, {
                                material_id: Number(value) || null,
                              })
                            }
                          />

                          <Input
                            label="Количество"
                            type="number"
                            min={1}
                            value={form.quantity}
                            onChange={(event) =>
                              updateForm(item.id, {
                                quantity: getNumberValue(event.target.value),
                              })
                            }
                          />
                        </div>

                        {item.material_brand_id &&
                        materialOptionsForItem.length === 0 ? (
                          <div className="mt-3 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-3 text-sm leading-6 text-[rgb(252_211_77)]">
                            Для выбранного бренда пока нет активных материалов.
                          </div>
                        ) : null}

                        <div className="mt-4">
                          <Textarea
                            label="Комментарий"
                            placeholder="Например: фактический расход на химчистку салона..."
                            value={form.comment}
                            onChange={(event) =>
                              updateForm(item.id, {
                                comment: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={submittingOrderItemId === item.id}
                            onClick={() => {
                              setOpenFormOrderItemId(null);
                              updateForm(item.id, defaultFormState);
                              setError(null);
                            }}
                          >
                            Отмена
                          </Button>

                          <Button
                            type="button"
                            disabled={
                              submittingOrderItemId === item.id ||
                              materialOptionsForItem.length === 0
                            }
                            onClick={() => void handleAddMaterial(item.id)}
                          >
                            {submittingOrderItemId === item.id
                              ? "Добавляем..."
                              : "Добавить"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isBrandRequiredButMissing ? (
                  <div className="mt-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
                    Для этой услуги сначала выберите бренд материала в
                    редактировании заказа.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}