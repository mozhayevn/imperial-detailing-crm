"use client";

import { useMemo } from "react";
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
import type { MaterialBrand } from "@/src/features/material-brands/types";
import type { ServicePackage } from "@/src/features/service-packages/types";
import type { Service } from "@/src/features/services/types";
import {
  cloneOrderFormItem,
  createEmptyOrderFormItem,
} from "@/src/features/orders/form/defaults";
import type {
  OrderFormErrors,
  OrderFormItem,
  OrderFormValues,
} from "@/src/features/orders/form/types";

type OrderItemsEditorProps = {
  values: OrderFormValues;
  errors?: OrderFormErrors;
  services: Service[];
  materialBrands: MaterialBrand[];
  servicePackages: ServicePackage[];
  isLookupsLoading?: boolean;
  onChange: (values: OrderFormValues) => void;
};

function getSelectedService(services: Service[], serviceId: number | null) {
  if (!serviceId) {
    return null;
  }

  return services.find((service) => service.id === serviceId) ?? null;
}

function getNumberValue(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function OrderItemsEditor({
  values,
  errors,
  services,
  materialBrands,
  servicePackages,
  isLookupsLoading,
  onChange,
}: OrderItemsEditorProps) {
  const serviceOptions = useMemo(() => {
    const selectedServiceIds = new Set(
      values.items
        .map((item) => item.service_id)
        .filter((serviceId): serviceId is number => Boolean(serviceId)),
    );

    return services
      .filter(
        (service) =>
          service.is_active !== false || selectedServiceIds.has(service.id),
      )
      .map((service) => {
        const requirements = [
          service.requires_brand ? "нужен бренд" : null,
          service.requires_package ? "нужен пакет" : null,
          service.is_active === false ? "архив" : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return {
          label: service.name,
          value: service.id,
          description:
            service.description || requirements || "Услуга без описания",
        };
      });
  }, [services, values.items]);

  const materialBrandOptions = useMemo(
    () =>
      materialBrands.map((brand) => ({
        label: brand.name,
        value: brand.id,
        description: brand.category || "Бренд материала",
      })),
    [materialBrands],
  );

  function updateItems(nextItems: OrderFormItem[]) {
    onChange({
      ...values,
      items: nextItems,
    });
  }

  function updateItem(uiKey: string, patch: Partial<OrderFormItem>) {
    updateItems(
      values.items.map((item) =>
        item.ui_key === uiKey
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }

  function handleServiceChange(
    item: OrderFormItem,
    value: string | number | null,
  ) {
    updateItem(item.ui_key, {
      service_id: Number(value) || null,
      material_brand_id: null,
      service_package_id: null,
    });
  }

  function addItem() {
    updateItems([...values.items, createEmptyOrderFormItem()]);
  }

  function duplicateItem(item: OrderFormItem) {
    updateItems([...values.items, cloneOrderFormItem(item)]);
  }

  function removeItem(uiKey: string) {
    if (values.items.length <= 1) {
      return;
    }

    updateItems(values.items.filter((item) => item.ui_key !== uiKey));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Позиции заказа</CardTitle>
            <CardDescription>
              Добавьте услуги, количество, пакет, бренд материала и скидку.
              Existing item ID сохраняется для безопасного edit workflow.
            </CardDescription>
          </div>

          <Button type="button" variant="secondary" onClick={addItem}>
            Добавить позицию
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {values.items.map((item, index) => {
            const selectedService = getSelectedService(
              services,
              item.service_id,
            );

            const selectedPackage = item.service_package_id
              ? (servicePackages.find(
                  (servicePackage) =>
                    servicePackage.id === item.service_package_id,
                ) ?? null)
              : null;

            const packageOptions = servicePackages
              .filter((servicePackage) => {
                const belongsToSelectedService = selectedService
                  ? servicePackage.service_id === selectedService.id
                  : true;

                const isActiveOrAlreadySelected =
                  servicePackage.is_active !== false ||
                  servicePackage.id === item.service_package_id;

                return belongsToSelectedService && isActiveOrAlreadySelected;
              })
              .map((servicePackage) => {
                const requirements = [
                  servicePackage.is_active === false ? "архив" : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                const description = [
                  servicePackage.description ?? null,
                  requirements || null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return {
                  label: servicePackage.name,
                  value: servicePackage.id,
                  description:
                    description || `Пакет услуги #${servicePackage.service_id}`,
                };
              });

            const itemErrors = errors?.items?.[item.ui_key];

            return (
              <div
                key={item.ui_key}
                className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">Позиция {index + 1}</Badge>

                    {item.id ? (
                      <Badge tone="muted">ID позиции заказа #{item.id}</Badge>
                    ) : (
                      <Badge tone="success">Новая позиция</Badge>
                    )}

                    {selectedService?.requires_brand ? (
                      <Badge tone="warning">Нужен бренд</Badge>
                    ) : null}

                    {selectedService?.requires_package ? (
                      <Badge tone="warning">Нужен пакет</Badge>
                    ) : null}

                    {selectedService?.is_active === false ? (
                      <Badge tone="muted">Услуга в архиве</Badge>
                    ) : null}

                    {selectedPackage?.is_active === false ? (
                      <Badge tone="muted">Пакет в архиве</Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateItem(item)}
                    >
                      Дублировать
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={values.items.length <= 1}
                      onClick={() => removeItem(item.ui_key)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
                  <div>
                    <Combobox
                      label="Услуга"
                      placeholder={
                        isLookupsLoading
                          ? "Загрузка услуг..."
                          : "Выберите услугу"
                      }
                      value={item.service_id}
                      options={serviceOptions}
                      disabled={isLookupsLoading}
                      onChange={(value) => handleServiceChange(item, value)}
                    />

                    {itemErrors?.service_id ? (
                      <div className="mt-2 text-xs text-[hsl(var(--danger))]">
                        {itemErrors.service_id}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Combobox
                      label="Бренд материала"
                      placeholder={
                        selectedService?.requires_brand
                          ? "Выберите бренд"
                          : "Не требуется"
                      }
                      value={item.material_brand_id}
                      options={materialBrandOptions}
                      disabled={isLookupsLoading || !selectedService}
                      onChange={(value) =>
                        updateItem(item.ui_key, {
                          material_brand_id: Number(value) || null,
                        })
                      }
                    />

                    {itemErrors?.material_brand_id ? (
                      <div className="mt-2 text-xs text-[hsl(var(--danger))]">
                        {itemErrors.material_brand_id}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Combobox
                      label="Пакет услуги"
                      placeholder={
                        selectedService?.requires_package
                          ? "Выберите пакет"
                          : "Не требуется"
                      }
                      value={item.service_package_id}
                      options={packageOptions}
                      disabled={
                        isLookupsLoading ||
                        !selectedService ||
                        packageOptions.length === 0
                      }
                      onChange={(value) =>
                        updateItem(item.ui_key, {
                          service_package_id: Number(value) || null,
                        })
                      }
                    />

                    {itemErrors?.service_package_id ? (
                      <div className="mt-2 text-xs text-[hsl(var(--danger))]">
                        {itemErrors.service_package_id}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[0.5fr_0.5fr_1fr]">
                  <Input
                    label="Количество"
                    name={`quantity-${item.ui_key}`}
                    type="number"
                    min={1}
                    value={item.quantity}
                    error={itemErrors?.quantity}
                    onChange={(event) =>
                      updateItem(item.ui_key, {
                        quantity: getNumberValue(event.target.value),
                      })
                    }
                  />

                  <Input
                    label="Скидка, %"
                    name={`discount-${item.ui_key}`}
                    type="number"
                    min={0}
                    max={100}
                    value={item.discount_percent}
                    error={itemErrors?.discount_percent}
                    onChange={(event) =>
                      updateItem(item.ui_key, {
                        discount_percent: getNumberValue(event.target.value),
                      })
                    }
                  />

                  <Textarea
                    label="Причина скидки"
                    name={`discount-reason-${item.ui_key}`}
                    placeholder={
                      item.discount_percent > 0
                        ? "Обязательно укажите причину скидки"
                        : "Не требуется, если скидки нет"
                    }
                    value={item.discount_reason}
                    error={itemErrors?.discount_reason}
                    onChange={(event) =>
                      updateItem(item.ui_key, {
                        discount_reason: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}