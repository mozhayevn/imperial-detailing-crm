"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency } from "@/src/lib/formatters";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";

import { getDashboardSummary } from "@/src/features/dashboard/api";
import type {
  DashboardMetric,
  DashboardPeriod,
  DashboardSummary,
} from "@/src/features/dashboard/types";

const periodOptions: {
  value: DashboardPeriod;
  label: string;
  description: string;
}[] = [
  {
    value: "today",
    label: "Сегодня",
    description: "Только за текущий день",
  },
  {
    value: "7d",
    label: "7 дней",
    description: "Последняя неделя",
  },
  {
    value: "30d",
    label: "30 дней",
    description: "Последний месяц",
  },
  {
    value: "all",
    label: "Все время",
    description: "Вся история CRM",
  },
];

const chartColors = [
  "rgb(45 212 191)",
  "rgb(96 165 250)",
  "rgb(251 191 36)",
  "rgb(248 113 113)",
  "rgb(167 139 250)",
  "rgb(74 222 128)",
];

function getPeriodLabel(period: DashboardPeriod) {
  return periodOptions.find((item) => item.value === period)?.label ?? period;
}

function formatNumber(value: number) {
  return value.toLocaleString("ru-RU");
}

function normalizeChartData(items: DashboardMetric[]) {
  return items.filter((item) => item.value > 0);
}

function DashboardTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    name?: string;
    payload?: DashboardMetric;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const title = label ?? item.payload?.label ?? item.name ?? "Показатель";

  return (
    <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[hsl(var(--surface-2))] px-4 py-3 text-xs shadow-2xl shadow-black/30">
      <div className="font-semibold text-white">{title}</div>

      <div className="mt-1 text-[hsl(var(--muted))]">
        Значение:{" "}
        <span className="font-semibold text-[rgb(94_234_212)]">
          {formatNumber(Number(item.value ?? 0))}
        </span>
      </div>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-3xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
      Недостаточно данных для графика.
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string;
  value: string | number;
  description?: string;
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
      className={`rounded-3xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[rgb(45_212_191_/_0.35)] hover:shadow-lg hover:shadow-black/20 ${className}`}
    >
      <div className="text-xs font-medium text-[hsl(var(--muted))]">
        {title}
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>

      {description ? (
        <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
          {description}
        </div>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20 ${className}`}
    >
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DashboardPageClient() {
  const { session } = useAuth();

  const [period, setPeriod] = useState<DashboardPeriod>("7d");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadDashboard = canAccessByPermission(session, "orders.read");

  async function loadDashboard(nextPeriod: DashboardPeriod = period) {
    if (!canReadDashboard) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getDashboardSummary(nextPeriod);
      setSummary(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialDashboard() {
      if (!canReadDashboard) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getDashboardSummary(period);

        if (!isMounted) {
          return;
        }

        setSummary(result);
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

    void loadInitialDashboard();

    return () => {
      isMounted = false;
    };
  }, [canReadDashboard, period]);

  const ordersByStatus = useMemo(
    () => normalizeChartData(summary?.charts.orders_by_status ?? []),
    [summary],
  );

  const financeBreakdown = useMemo(
    () => normalizeChartData(summary?.charts.finance_breakdown ?? []),
    [summary],
  );

  const inventoryStatus = useMemo(
    () => normalizeChartData(summary?.charts.inventory_status ?? []),
    [summary],
  );

  const productionHealth = useMemo(
    () => normalizeChartData(summary?.charts.production_health ?? []),
    [summary],
  );

  const ordersByDay = summary?.charts.orders_by_day ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Dashboard"
        title="Панель управления"
        description="Операционная сводка по заказам, оплатам, производству и складу."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/orders/create">
              <Button type="button">Создать заказ</Button>
            </Link>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void loadDashboard()}
            >
              Обновить
            </Button>
          </div>
        }
      />

      {!canReadDashboard ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к панели управления
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для просмотра dashboard нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              orders.read
            </span>
            .
          </div>
        </div>
      ) : null}

      {canReadDashboard ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <Card className="transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Период</CardTitle>
                  <CardDescription>
                    Сейчас выбран период: {getPeriodLabel(period)}.
                  </CardDescription>
                </div>

                <Badge tone="primary">{getPeriodLabel(period)}</Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={[
                      "rounded-3xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20",
                      period === option.value
                        ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.12)]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] hover:border-[hsl(var(--border-strong))]",
                    ].join(" ")}
                    onClick={() => setPeriod(option.value)}
                  >
                    <div className="text-sm font-semibold text-white">
                      {option.label}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
              Загружаем данные dashboard...
            </div>
          ) : null}

          {!isLoading && summary ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Всего заказов"
                  value={formatNumber(summary.orders.total)}
                  description={`Активных: ${formatNumber(
                    summary.orders.active_count,
                  )}`}
                />

                <MetricCard
                  title="Сумма заказов"
                  value={formatCurrency(summary.finance.total_price)}
                  description={`Оплачено: ${formatCurrency(
                    summary.finance.paid_amount,
                  )}`}
                  tone="success"
                />

                <MetricCard
                  title="Остаток к оплате"
                  value={formatCurrency(summary.finance.remaining_amount)}
                  description="Разница между суммой заказов и оплатами"
                  tone={
                    summary.finance.remaining_amount > 0
                      ? "warning"
                      : "success"
                  }
                />

                <MetricCard
                  title="Прибыль"
                  value={formatCurrency(summary.finance.total_profit)}
                  description="По зафиксированным snapshots"
                  tone="success"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Активные заказы"
                  value={formatNumber(summary.production.active_orders)}
                  description="Не отменены и не выданы"
                />

                <MetricCard
                  title="Без бокса"
                  value={formatNumber(summary.production.orders_without_work_bay)}
                  description="Нужно назначить рабочий бокс"
                  tone={
                    summary.production.orders_without_work_bay > 0
                      ? "warning"
                      : "success"
                  }
                />

                <MetricCard
                  title="Без мастера"
                  value={formatNumber(summary.production.orders_without_master)}
                  description="Нужно назначить ответственного"
                  tone={
                    summary.production.orders_without_master > 0
                      ? "warning"
                      : "success"
                  }
                />

                <MetricCard
                  title="Складская стоимость"
                  value={formatCurrency(summary.inventory.total_stock_value)}
                  description={`Нет остатка: ${summary.inventory.out_of_stock_count}`}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <ChartCard
                  title="Заказы по дням"
                  description="Количество созданных заказов по дням."
                >
                  {ordersByDay.length > 0 ? (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ordersByDay}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <Tooltip
                            content={<DashboardTooltip />}
                            cursor={{
                              stroke: "rgb(45 212 191 / 0.35)",
                              strokeWidth: 1,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="rgb(45 212 191)"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                            isAnimationActive
                            animationDuration={800}
                            animationEasing="ease-out"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>

                <ChartCard
                  title="Заказы по статусам"
                  description="Структура заказов за выбранный период."
                >
                  {ordersByStatus.length > 0 ? (
                    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={ordersByStatus}
                              dataKey="value"
                              nameKey="label"
                              innerRadius={62}
                              outerRadius={96}
                              paddingAngle={4}
                              isAnimationActive
                              animationDuration={700}
                            >
                              {ordersByStatus.map((entry, index) => (
                                <Cell
                                  key={entry.label}
                                  fill={chartColors[index % chartColors.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<DashboardTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-2">
                        {ordersByStatus.map((item, index) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 transition hover:border-[rgb(45_212_191_/_0.24)]"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    chartColors[index % chartColors.length],
                                }}
                              />
                              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                {item.label}
                              </span>
                            </div>

                            <span className="text-sm font-semibold text-white">
                              {formatNumber(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>

                <ChartCard
                  title="Финансы"
                  description="Оплачено, остаток к оплате и прибыль."
                >
                  {financeBreakdown.length > 0 ? (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financeBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <YAxis
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <Tooltip
                            content={<DashboardTooltip />}
                            cursor={{ fill: "rgb(45 212 191 / 0.08)" }}
                          />
                          <Bar
                            dataKey="value"
                            radius={[12, 12, 0, 0]}
                            isAnimationActive
                            animationDuration={700}
                            animationEasing="ease-out"
                          >
                            {financeBreakdown.map((entry, index) => (
                              <Cell
                                key={entry.label}
                                fill={chartColors[index % chartColors.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>

                <ChartCard
                  title="Склад"
                  description="Материалы в наличии, с малым остатком и без остатка."
                >
                  {inventoryStatus.length > 0 ? (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={inventoryStatus}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <Tooltip
                            content={<DashboardTooltip />}
                            cursor={{ fill: "rgb(45 212 191 / 0.08)" }}
                          />
                          <Bar
                            dataKey="value"
                            radius={[12, 12, 0, 0]}
                            isAnimationActive
                            animationDuration={700}
                            animationEasing="ease-out"
                          >
                            {inventoryStatus.map((entry, index) => (
                              <Cell
                                key={entry.label}
                                fill={chartColors[index % chartColors.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>

                <ChartCard
                  title="Производственные риски"
                  description="Заказы, где не хватает бокса, мастера, pricing или завершенного чеклиста."
                  className="xl:col-span-2"
                >
                  {productionHealth.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={productionHealth}
                          layout="vertical"
                          margin={{ left: 28 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="label"
                            width={150}
                            tick={{ fill: "rgb(148 163 184)", fontSize: 12 }}
                          />
                          <Tooltip
                            content={<DashboardTooltip />}
                            cursor={{ fill: "rgb(45 212 191 / 0.08)" }}
                          />
                          <Bar
                            dataKey="value"
                            radius={[0, 12, 12, 0]}
                            isAnimationActive
                            animationDuration={700}
                            animationEasing="ease-out"
                          >
                            {productionHealth.map((entry, index) => (
                              <Cell
                                key={entry.label}
                                fill={chartColors[index % chartColors.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>
              </div>

              <Card className="transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20">
                <CardHeader className="pb-3">
                  <CardTitle>Быстрые действия</CardTitle>
                  <CardDescription>
                    Частые переходы для ежедневной работы.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Link href="/orders/create">
                      <Button type="button" className="w-full">
                        Создать заказ
                      </Button>
                    </Link>

                    <Link href="/orders">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                      >
                        Заказы
                      </Button>
                    </Link>

                    <Link href="/inventory">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                      >
                        Склад
                      </Button>
                    </Link>

                    <Link href="/audits">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                      >
                        Аудит
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
}