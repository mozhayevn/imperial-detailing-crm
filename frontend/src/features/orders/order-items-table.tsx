import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import type { MaterialBrand } from "@/src/features/material-brands/types";
import type { ServicePackage } from "@/src/features/service-packages/types";
import type { Service } from "@/src/features/services/types";
import { PriceDisplay } from "@/src/features/orders/pricing-display";
import type { OrderItem } from "@/src/features/orders/types";

type OrderItemsTableProps = {
  items: OrderItem[];
  pricingLocked: boolean;
  services?: Service[];
  materialBrands?: MaterialBrand[];
  servicePackages?: ServicePackage[];
};

export function OrderItemsTable({
  items,
  pricingLocked,
  services = [],
  materialBrands = [],
  servicePackages = [],
}: OrderItemsTableProps) {
  function getServiceLabel(serviceId: number) {
    const service = services.find((item) => item.id === serviceId);

    return service?.name ?? `Услуга #${serviceId}`;
  }

  function getMaterialBrandLabel(materialBrandId: number | null | undefined) {
    if (!materialBrandId) {
      return null;
    }

    const brand = materialBrands.find((item) => item.id === materialBrandId);

    return brand?.name ?? `Бренд #${materialBrandId}`;
  }

  function getServicePackageLabel(
    servicePackageId: number | null | undefined,
  ) {
    if (!servicePackageId) {
      return null;
    }

    const servicePackage = servicePackages.find(
      (item) => item.id === servicePackageId,
    );

    return servicePackage?.name ?? `Пакет #${servicePackageId}`;
  }

  if (items.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--surface-3))] text-sm font-semibold text-[hsl(var(--primary))]">
            0
          </div>

          <h2 className="mt-4 text-sm font-semibold text-white">
            Позиции заказа отсутствуют
          </h2>

          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            В этом заказе пока нет позиций. Добавление и редактирование позиций
            подключим на следующем этапе.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-card)]">
      <div className="border-b border-[hsl(var(--border))] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Позиции заказа
            </h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted))]">
              Услуги в заказе, скидки, итоговая стоимость и pricing snapshots.
            </p>
          </div>

          <Badge tone="primary">{items.length} поз.</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Позиция
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Услуга
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Кол-во
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Скидка
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Цена
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Итог
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Прибыль snapshot
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const serviceLabel = getServiceLabel(item.service_id);
              const brandLabel = getMaterialBrandLabel(
                item.material_brand_id,
              );
              const packageLabel = getServicePackageLabel(
                item.service_package_id,
              );

              return (
                <tr
                  key={item.id}
                  className="border-b border-[hsl(var(--border))] transition last:border-b-0 hover:bg-[hsl(var(--surface-2))]/70"
                >
                  <td className="px-5 py-4 align-top">
                    <div className="font-semibold text-white">#{item.id}</div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      ID позиции заказа
                    </div>
                  </td>

                  <td className="px-5 py-4 align-top">
                    <div className="text-sm font-medium text-white">
                      {serviceLabel}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {brandLabel ? (
                        <Badge tone="muted">{brandLabel}</Badge>
                      ) : null}

                      {packageLabel ? (
                        <Badge tone="muted">{packageLabel}</Badge>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-5 py-4 align-top text-sm text-[hsl(var(--muted-foreground))]">
                    {item.quantity}
                  </td>

                  <td className="px-5 py-4 align-top">
                    {item.discount_percent > 0 ? (
                      <div>
                        <Badge tone="warning">{item.discount_percent}%</Badge>

                        {item.discount_reason ? (
                          <div className="mt-2 text-xs text-[hsl(var(--muted))]">
                            {item.discount_reason}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <Badge tone="muted">Нет</Badge>
                    )}
                  </td>

                  <td className="px-5 py-4 align-top text-sm">
                    <PriceDisplay
                      value={item.price}
                      pricingLocked={pricingLocked}
                    />
                  </td>

                  <td className="px-5 py-4 align-top text-sm">
                    <PriceDisplay
                      value={item.total}
                      pricingLocked={pricingLocked}
                    />
                  </td>

                  <td className="px-5 py-4 align-top">
                    <div className="text-sm">
                      <PriceDisplay
                        value={item.profit_snapshot}
                        pricingLocked={pricingLocked}
                      />
                    </div>

                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      final:{" "}
                      <PriceDisplay
                        value={item.final_price_snapshot}
                        pricingLocked={pricingLocked}
                        className="text-xs"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}