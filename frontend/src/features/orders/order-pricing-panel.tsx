"use client";

import { useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency } from "@/src/lib/formatters";
import {
  applyOrderPricing,
  getOrderPricing,
  unlockOrderPricing,
} from "@/src/features/pricing/api";
import type { OrderPricing } from "@/src/features/pricing/types";
import { PriceDisplay } from "@/src/features/orders/pricing-display";
import { PricingStateBadge } from "@/src/features/orders/pricing-display";
import type { Order } from "@/src/features/orders/types";

type OrderPricingPanelProps = {
  order: Order;
  canReadPricing: boolean;
  canManagePricing: boolean;
  onChanged: () => void;
};

function getWarningText(pricing: OrderPricing | null) {
  if (!pricing?.has_warning) {
    return null;
  }

  if (pricing.warning_level === "negative_profit") {
    return "Есть позиции с отрицательной прибылью. Проверьте себестоимость, скидки и multiplier.";
  }

  if (pricing.warning_level === "low_margin") {
    return "Есть позиции с низкой маржой. Проверьте скидки и стоимость материалов.";
  }

  return pricing.warning_message ?? "Есть предупреждения по расчету стоимости.";
}

function getWarningTone(pricing: OrderPricing | null) {
  if (pricing?.warning_level === "negative_profit") {
    return "danger";
  }

  if (pricing?.warning_level === "low_margin") {
    return "warning";
  }

  return "muted";
}

export function OrderPricingPanel({
  order,
  canReadPricing,
  canManagePricing,
  onChanged,
}: OrderPricingPanelProps) {
  const [pricing, setPricing] = useState<OrderPricing | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplyLoading, setIsApplyLoading] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isUnlockLoading, setIsUnlockLoading] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isCanceled = order.status === "canceled";
  const isDelivered = order.status === "delivered";
  const isPricingActionBlockedByStatus = isCanceled || isDelivered;

  const displayedFinalPrice = pricing?.total_final_price ?? order.total_price;
  const warningText = getWarningText(pricing);

  async function handlePreview() {
    setIsPreviewLoading(true);
    setError(null);

    try {
      const result = await getOrderPricing(order.id);
      setPricing(result);
    } catch (previewError) {
      setError(getApiErrorMessage(previewError));
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleApply() {
    setIsApplyLoading(true);
    setError(null);

    try {
      const result = await applyOrderPricing(order.id);
      setPricing(result);
      onChanged();
    } catch (applyError) {
      setError(getApiErrorMessage(applyError));
    } finally {
      setIsApplyLoading(false);
    }
  }

  async function handleUnlock() {
    const reason = unlockReason.trim();

    if (!reason) {
      setError("Укажите причину разблокировки pricing.");
      return;
    }

    setIsUnlockLoading(true);
    setError(null);

    try {
      const result = await unlockOrderPricing(order.id, {
        reason,
      });

      setPricing(result);
      setUnlockReason("");
      setIsUnlockOpen(false);
      onChanged();
    } catch (unlockError) {
      setError(getApiErrorMessage(unlockError));
    } finally {
      setIsUnlockLoading(false);
    }
  }

  return (
    <Card className="self-start">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Статус и pricing</CardTitle>
            <CardDescription>
              Preview, расчет стоимости и фиксация pricing.
            </CardDescription>
          </div>

          <PricingStateBadge
            value={displayedFinalPrice}
            pricingLocked={order.pricing_locked}
          />
        </div>
      </CardHeader>

      <CardContent>
        {!canReadPricing ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            У вас нет доступа к расчету pricing. Нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              pricing.read
            </span>
            .
          </div>
        ) : null}

        {isCanceled ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            Заказ отменен. Расчет и фиксация pricing недоступны.
          </div>
        ) : isDelivered ? (
          <div className="mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            Заказ выдан клиенту. Изменение pricing недоступно.
          </div>
        ) : null}

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
            Сумма заказа
          </div>

          <div className="mt-2 text-3xl tracking-tight">
            <PriceDisplay
              value={displayedFinalPrice}
              pricingLocked={order.pricing_locked}
            />
          </div>
        </div>

        {pricing ? (
          <div className="mt-5 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                <div className="text-xs text-[hsl(var(--muted))]">
                  Материалы
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {formatCurrency(pricing.total_materials_cost)}
                </div>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                <div className="text-xs text-[hsl(var(--muted))]">Работа</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {formatCurrency(pricing.total_labor_cost)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                <div className="text-xs text-[hsl(var(--muted))]">
                  Gross price
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {formatCurrency(pricing.total_gross_price)}
                </div>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                <div className="text-xs text-[hsl(var(--muted))]">Скидка</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {formatCurrency(pricing.total_discount_amount)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-[rgb(94_234_212)]">
                    Итоговая цена
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {formatCurrency(pricing.total_final_price)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Прибыль
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {formatCurrency(pricing.total_profit)}
                  </div>
                </div>
              </div>
            </div>

            {pricing.items?.length ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                  Источник цены по позициям
                </div>

                <div className="space-y-2">
                  {pricing.items.map((item) => (
                    <div
                      key={item.order_item_id}
                      className="flex flex-col gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Позиция #{item.order_item_id}
                        </div>

                        <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                          Gross: {formatCurrency(item.gross_price)} · Final:{" "}
                          {formatCurrency(item.final_price)} · Profit:{" "}
                          {formatCurrency(item.profit)}
                        </div>
                      </div>

                      <Badge
                        tone={
                          item.pricing_source === "service_price_rule"
                            ? "success"
                            : "muted"
                        }
                      >
                        {item.pricing_source === "service_price_rule"
                          ? `Правило цены #${item.service_price_rule_id}`
                          : "Fallback multiplier"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {warningText ? (
              <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
                <div className="mb-2">
                  <Badge tone={getWarningTone(pricing)}>
                    {pricing.warning_level}
                  </Badge>
                </div>
                {warningText}
              </div>
            ) : (
              <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4 text-sm leading-6 text-[rgb(94_234_212)]">
                Pricing preview рассчитан без предупреждений.
              </div>
            )}
          </div>
        ) : order.pricing_locked ? (
          <div className="mt-5 rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4 text-sm leading-6 text-[rgb(94_234_212)]">
            Pricing уже зафиксирован. Для пересчета сначала выполните unlock.
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
            Стоимость еще не рассчитана. Проверьте состав заказа, добавьте
            фактические материалы и запустите pricing preview.
          </div>
        )}

        <div className="mt-5 border-t border-[hsl(var(--border))] pt-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
            Доступы
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={canReadPricing ? "success" : "muted"}>
              Preview: {canReadPricing ? "доступно" : "нет доступа"}
            </Badge>

            <Badge tone={canManagePricing ? "success" : "muted"}>
              Apply: {canManagePricing ? "доступно" : "нет доступа"}
            </Badge>

            <Badge tone={order.pricing_locked ? "warning" : "primary"}>
              Pricing:{" "}
              {order.pricing_locked ? "зафиксирован" : "не зафиксирован"}
            </Badge>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}

        {canReadPricing ? (
          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPreviewLoading || isCanceled}
              onClick={() => void handlePreview()}
            >
              {isPreviewLoading ? "Считаем..." : "Запустить pricing preview"}
            </Button>

            {!order.pricing_locked &&
            canManagePricing &&
            !isPricingActionBlockedByStatus ? (
              <Button
                type="button"
                disabled={isApplyLoading}
                onClick={() => void handleApply()}
              >
                {isApplyLoading
                  ? "Фиксируем..."
                  : "Применить pricing и зафиксировать"}
              </Button>
            ) : null}

            {order.pricing_locked &&
            canManagePricing &&
            !isPricingActionBlockedByStatus ? (
              <>
                {!isUnlockOpen ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsUnlockOpen(true)}
                  >
                    Разблокировать pricing
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4">
                    <Textarea
                      label="Причина разблокировки"
                      placeholder="Например: нужно пересчитать после корректировки материалов..."
                      value={unlockReason}
                      onChange={(event) => setUnlockReason(event.target.value)}
                    />

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isUnlockLoading}
                        onClick={() => {
                          setIsUnlockOpen(false);
                          setUnlockReason("");
                          setError(null);
                        }}
                      >
                        Отмена
                      </Button>

                      <Button
                        type="button"
                        disabled={isUnlockLoading}
                        onClick={() => void handleUnlock()}
                      >
                        {isUnlockLoading
                          ? "Разблокируем..."
                          : "Подтвердить unlock"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}