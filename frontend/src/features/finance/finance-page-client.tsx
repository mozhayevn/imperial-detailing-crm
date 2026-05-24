"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getFinanceOverview } from "@/src/features/finance/api";
import type {
  FinanceOverview,
  FinancePeriod,
} from "@/src/features/finance/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency } from "@/src/lib/formatters";

const periodOptions: {
  value: FinancePeriod;
  label: string;
}[] = [
  { value: "today", label: "Сегодня" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "all", label: "Все время" },
];

function FinanceMetricCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string;
  value: string | number;
  description: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const className =
    tone === "success"
      ? "border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)]"
      : tone === "warning"
        ? "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)]"
        : tone === "danger"
          ? "border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]";

  return (
    <div
      className={`rounded-3xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[rgb(45_212_191_/_0.35)] hover:shadow-lg hover:shadow-black/20 ${className}`}
    >
      <div className="text-xs font-medium text-[hsl(var(--muted))]">
        {title}
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>

      <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
        {description}
      </div>
    </div>
  );
}

export function FinancePageClient() {
  const { session } = useAuth();

  const [period, setPeriod] = useState<FinancePeriod>("30d");
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadFinance = canAccessByPermission(session, "payments.read");

  async function loadFinance(nextPeriod: FinancePeriod = period) {
    if (!canReadFinance) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getFinanceOverview(nextPeriod);
      setOverview(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialFinance() {
      if (!canReadFinance) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getFinanceOverview(period);

        if (!isMounted) {
          return;
        }

        setOverview(result);
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

    void loadInitialFinance();

    return () => {
      isMounted = false;
    };
  }, [canReadFinance, period]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Финансы"
        title="Финансы"
        description="Финансовая сводка по текущим заказам, оплатам и зафиксированным расчетам."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => void loadFinance()}
          >
            Обновить
          </Button>
        }
      />

      {!canReadFinance ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к финансам
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для просмотра финансовой сводки нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              payments.read
            </span>
            .
          </div>
        </div>
      ) : null}

      {canReadFinance ? (
        <>
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={period === option.value ? "primary" : "secondary"}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {error ? (
            <div className="rounded-3xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-5 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-[hsl(var(--muted))]">
                Загружаем финансовую сводку...
              </CardContent>
            </Card>
          ) : null}

          {!isLoading && overview ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FinanceMetricCard
                  title="Выручка по заказам"
                  value={formatCurrency(overview.orders_revenue)}
                  description="Сумма зафиксированных заказов без отмененных."
                  tone="success"
                />

                <FinanceMetricCard
                  title="Получено оплат"
                  value={formatCurrency(overview.cash_received)}
                  description="Проведенные оплаты за выбранный период."
                  tone="default"
                />

                <FinanceMetricCard
                  title="Дебиторка"
                  value={formatCurrency(overview.accounts_receivable)}
                  description="Разница между выручкой и полученными оплатами."
                  tone={
                    overview.accounts_receivable > 0 ? "warning" : "success"
                  }
                />

                <FinanceMetricCard
                  title="Валовая прибыль"
                  value={formatCurrency(overview.gross_profit)}
                  description="Сумма зафиксированной прибыли по позициям заказов."
                  tone={overview.gross_profit < 0 ? "danger" : "success"}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FinanceMetricCard
                  title="Средний чек"
                  value={formatCurrency(overview.average_order_value)}
                  description="Средняя сумма одного зафиксированного заказа."
                  tone="default"
                />

                <FinanceMetricCard
                  title="Процент оплаты"
                  value={`${overview.payment_rate_percent}%`}
                  description="Доля полученных оплат от суммы зафиксированных заказов."
                  tone={
                    overview.payment_rate_percent >= 80 ? "success" : "warning"
                  }
                />

                <FinanceMetricCard
                  title="Маржа"
                  value={`${overview.gross_margin_percent}%`}
                  description="Доля валовой прибыли от выручки по заказам."
                  tone={
                    overview.gross_margin_percent < 15 ? "warning" : "success"
                  }
                />

                <FinanceMetricCard
                  title="Заказы с долгом"
                  value={overview.orders_with_debt_count}
                  description="Заказы, которые не оплачены полностью."
                  tone={
                    overview.orders_with_debt_count > 0 ? "warning" : "success"
                  }
                />
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Статусы оплат</CardTitle>
                      <CardDescription>
                        Состояние зафиксированных заказов в выбранном периоде.
                      </CardDescription>
                    </div>

                    <Badge tone="primary">
                      Зафиксированных заказов: {overview.locked_orders_count}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
                      <div className="text-xs text-[rgb(94_234_212)]">
                        Полностью оплачено
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {overview.paid_orders_count}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4">
                      <div className="text-xs text-[rgb(252_211_77)]">
                        Частично оплачено
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {overview.partial_orders_count}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Не оплачено
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {overview.unpaid_orders_count}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}