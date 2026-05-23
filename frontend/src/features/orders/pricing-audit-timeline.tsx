import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { formatCurrency, formatDateTime } from "@/src/lib/formatters";
import type { PricingAuditLog } from "@/src/features/pricing/types";

type PricingAuditTimelineProps = {
  logs: PricingAuditLog[];
};

type PricingApplyDetails = {
  totals?: {
    gross?: number;
    discount?: number;
    materials_cost?: number;
    labor_cost?: number;
    final_price?: number;
    profit?: number;
    warning_level?: string;
    warning?: string[];
    items_count?: number;
  };
  items?: {
    order_item_id?: number;
    service_id?: number;
    quantity?: number;
    materials_cost?: number;
    labor_cost?: number;
    base_cost?: number;
    multiplier?: number;
    gross_price?: number;
    discount_percent?: number;
    discount_amount?: number;
    final_price?: number;
    profit?: number;
    has_warning?: boolean;
    warning_level?: string;
    warning_message?: string | null;
  }[];
};

function safeParsePricingDetails(details: string | null | undefined) {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details);

    if (parsed && typeof parsed === "object") {
      return parsed as PricingApplyDetails;
    }

    return null;
  } catch {
    return null;
  }
}

function getPricingActionLabel(action: string) {
  const labels: Record<string, string> = {
    pricing_applied: "Pricing применен",
    pricing_unlocked: "Pricing разблокирован",
  };

  return labels[action] ?? action;
}

function getPricingActionTone(action: string) {
  if (action === "pricing_applied") {
    return "success";
  }

  if (action === "pricing_unlocked") {
    return "warning";
  }

  return "muted";
}

function getWarningTone(level: string | undefined) {
  if (level === "negative_profit") {
    return "danger";
  }

  if (level === "low_margin") {
    return "warning";
  }

  return "success";
}

function getWarningLabel(level: string | undefined) {
  if (!level || level === "none") {
    return "Без предупреждений";
  }

  if (level === "negative_profit") {
    return "Отрицательная прибыль";
  }

  if (level === "low_margin") {
    return "Низкая маржа";
  }

  return level;
}

function translatePricingWarningMessage(message: string) {
  if (message === "Order item has low margin") {
    return "низкая маржа. Проверьте скидку, себестоимость материалов и multiplier.";
  }

  if (message === "Order item is unprofitable") {
    return "отрицательная прибыль. Проверьте себестоимость, скидку и итоговую цену.";
  }

  return message;
}

function formatPricingWarning(warning: string) {
  const match = warning.match(/^Order item #(\d+):\s*(.+)$/);

  if (!match) {
    return translatePricingWarningMessage(warning);
  }

  const [, orderItemId, message] = match;

  return `Позиция #${orderItemId}: ${translatePricingWarningMessage(message)}`;
}

function getUnlockReason(details: string | null | undefined) {
  if (!details) {
    return null;
  }

  if (details.startsWith("Pricing unlocked for recalculation. Reason:")) {
    return details.replace(
      "Pricing unlocked for recalculation. Reason:",
      "",
    ).trim();
  }

  return details;
}

function MoneyMetric({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
      <div className="text-xs text-[hsl(var(--muted))]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-white">
        {formatCurrency(value ?? 0)}
      </div>
    </div>
  );
}

export function PricingAuditTimeline({ logs }: PricingAuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История pricing</CardTitle>
          <CardDescription>
            Финансовые действия по расчету и фиксации стоимости.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm text-[hsl(var(--muted))]">
            История pricing пока пустая.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История pricing</CardTitle>
        <CardDescription>
          Кто применял, разблокировал и пересчитывал стоимость заказа.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => {
            const parsedDetails = safeParsePricingDetails(log.details);
            const totals = parsedDetails?.totals;
            const items = parsedDetails?.items ?? [];
            const unlockReason = getUnlockReason(log.details);

            return (
              <div
                key={log.id}
                className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge tone={getPricingActionTone(log.action)}>
                      {getPricingActionLabel(log.action)}
                    </Badge>

                    <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted))]">
                      <div>{formatDateTime(log.created_at)}</div>
                      <div>
                        Инициатор:{" "}
                        {log.actor_user_full_name ??
                          `Сотрудник #${log.actor_user_id}`}
                      </div>
                    </div>
                  </div>

                  <Badge tone="muted">Pricing audit №{log.id}</Badge>
                </div>

                {log.action === "pricing_applied" && parsedDetails ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <MoneyMetric label="Материалы" value={totals?.materials_cost} />
                      <MoneyMetric label="Работа" value={totals?.labor_cost} />
                      <MoneyMetric label="Gross" value={totals?.gross} />
                      <MoneyMetric label="Скидка" value={totals?.discount} />
                      <MoneyMetric label="Финальная цена" value={totals?.final_price} />
                      <MoneyMetric label="Прибыль" value={totals?.profit} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge tone="primary">
                        Позиций: {totals?.items_count ?? items.length}
                      </Badge>

                      <Badge tone={getWarningTone(totals?.warning_level)}>
                        {getWarningLabel(totals?.warning_level)}
                      </Badge>
                    </div>

                    {totals?.warning && totals.warning.length > 0 ? (
                      <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
                        <div className="mb-2 font-semibold">
                          Предупреждения pricing
                        </div>

                        <div className="space-y-1">
                          {totals.warning.map((warning, index) => (
                            <div
                             key={`${log.id}-warning-${index}`}
                             className="rounded-xl bg-[rgb(251_191_36_/_0.08)] px-3 py-2"
                            >
                              {formatPricingWarning(warning)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {items.length > 0 ? (
                      <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                          Расчет по позициям
                        </div>

                        <div className="space-y-3">
                          {items.map((item, index) => (
                            <div
                              key={`${log.id}-item-${item.order_item_id ?? index}`}
                              className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                            >
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <Badge tone="muted">
                                  Позиция #{item.order_item_id ?? "—"}
                                </Badge>

                                <Badge tone="primary">
                                  Кол-во: {item.quantity ?? 1}
                                </Badge>

                                {item.has_warning ? (
                                  <Badge tone={getWarningTone(item.warning_level)}>
                                    {getWarningLabel(item.warning_level)}
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <MoneyMetric
                                  label="Материалы"
                                  value={item.materials_cost}
                                />
                                <MoneyMetric
                                  label="Работа"
                                  value={item.labor_cost}
                                />
                                <MoneyMetric
                                  label="Gross"
                                  value={item.gross_price}
                                />
                                <MoneyMetric
                                  label="Final"
                                  value={item.final_price}
                                />
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <MoneyMetric
                                  label="Base cost"
                                  value={item.base_cost}
                                />
                                <MoneyMetric
                                  label="Скидка"
                                  value={item.discount_amount}
                                />
                                <MoneyMetric
                                  label="Прибыль"
                                  value={item.profit}
                                />

                                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                  <div className="text-xs text-[hsl(var(--muted))]">
                                    Multiplier
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-white">
                                    {item.multiplier ?? 100}%
                                  </div>
                                </div>
                              </div>

                              {item.warning_message ? (
                                <div className="mt-3 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-3 text-sm leading-6 text-[rgb(252_211_77)]">
                                  {translatePricingWarningMessage(item.warning_message)}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : log.action === "pricing_unlocked" ? (
                  <div className="mt-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
                    <div className="mb-2 font-semibold">
                      Причина разблокировки
                    </div>
                    {unlockReason || "Причина не указана"}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
                    {log.details ?? "Детали отсутствуют"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}