"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { Combobox } from "@/src/components/ui/combobox";
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
import {
  getFinanceCharts,
  getFinanceOrdersMargin,
  getFinanceOverview,
} from "@/src/features/finance/api";
import type {
  FinanceCharts,
  FinanceDailyChartItem,
  FinanceOrderMargin,
  FinanceOverview,
  FinancePeriod,
} from "@/src/features/finance/types";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency, formatDateTime } from "@/src/lib/formatters";
import { routes } from "@/src/config/routes";

const periodOptions: {
  value: FinancePeriod;
  label: string;
}[] = [
  { value: "today", label: "Сегодня" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "all", label: "Все время" },
];

const chartColors = [
  "rgb(45 212 191)",
  "rgb(96 165 250)",
  "rgb(251 191 36)",
  "rgb(248 113 113)",
  "rgb(167 139 250)",
  "rgb(74 222 128)",
];

function formatChartValue(value: number) {
  return value.toLocaleString("ru-RU");
}

function FinanceChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    name?: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[hsl(var(--surface-2))] px-4 py-3 text-xs shadow-2xl shadow-black/30">
      <div className="font-semibold text-white">{label}</div>

      <div className="mt-2 space-y-1 text-[hsl(var(--muted))]">
        {payload.map((item) => (
          <div key={item.name} className="flex justify-between gap-4">
            <span>{item.name}</span>
            <span className="font-semibold text-[rgb(94_234_212)]">
              {item.name?.includes("%")
                ? `${formatChartValue(Number(item.value ?? 0))}%`
                : `${formatChartValue(Number(item.value ?? 0))} ₸`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartLegend({
  items,
}: {
  items: {
    label: string;
    color: string;
  }[];
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))]"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-3xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
      Недостаточно данных для построения графика.
    </div>
  );
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');

  return `"${escaped}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csvContent = rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function getReportDateLabel() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPeriodText(period: FinancePeriod) {
  const labels: Record<FinancePeriod, string> = {
    today: "Сегодня",
    "7d": "7 дней",
    "30d": "30 дней",
    all: "Все время",
  };

  return labels[period];
}

type FinanceInsightTone = "success" | "warning" | "danger" | "muted";

type OrdersMarginFilter = "all" | "debt" | "low_margin" | "negative_margin";

type OrdersMarginSort =
  | "created_desc"
  | "total_desc"
  | "profit_desc"
  | "margin_asc"
  | "debt_desc";

type FinanceInsight = {
  title: string;
  description: string;
  tone: FinanceInsightTone;
};

const ordersMarginFilterOptions: {
  value: OrdersMarginFilter;
  label: string;
}[] = [
  { value: "all", label: "Все заказы" },
  { value: "debt", label: "С долгом" },
  { value: "low_margin", label: "Низкая маржа" },
  { value: "negative_margin", label: "Отрицательная маржа" },
];

const ordersMarginSortOptions: {
  value: OrdersMarginSort;
  label: string;
}[] = [
  { value: "created_desc", label: "Сначала новые" },
  { value: "total_desc", label: "По сумме заказа" },
  { value: "profit_desc", label: "По прибыли" },
  { value: "margin_asc", label: "По низкой марже" },
  { value: "debt_desc", label: "По долгу" },
];

function getPaymentStatusTone(status: string) {
  if (status === "Оплачено") {
    return "success";
  }

  if (status === "Частично оплачено") {
    return "warning";
  }

  if (status === "Переплата") {
    return "danger";
  }

  return "muted";
}

function getFinanceResultTone(overview: FinanceOverview) {
  if (overview.net_profit < 0) {
    return "danger";
  }

  if (overview.accounts_receivable > 0 || overview.net_margin_percent < 10) {
    return "warning";
  }

  return "success";
}

function getFinanceResultTitle(overview: FinanceOverview) {
  if (overview.net_profit < 0) {
    return "Период убыточный";
  }

  if (overview.accounts_receivable > 0) {
    return "Есть прибыль, но есть долги клиентов";
  }

  return "Финансовый результат положительный";
}

function getFinanceResultDescription(overview: FinanceOverview) {
  if (overview.net_profit < 0) {
    return `Чистая прибыль отрицательная: ${formatCurrency(
      overview.net_profit,
    )}. Нужно проверить расходы, цены и себестоимость.`;
  }

  if (overview.accounts_receivable > 0) {
    return `Чистая прибыль: ${formatCurrency(
      overview.net_profit,
    )}, но клиенты еще должны ${formatCurrency(overview.accounts_receivable)}.`;
  }

  return `Чистая прибыль за период: ${formatCurrency(
    overview.net_profit,
  )}. Дебиторки по зафиксированным заказам нет.`;
}

function getMarginTone(marginPercent: number) {
  if (marginPercent < 0) {
    return "danger";
  }

  if (marginPercent < 15) {
    return "warning";
  }

  return "success";
}

function getOrderMarginCardClass(order: FinanceOrderMargin) {
  if (order.margin_percent < 0) {
    return "border-[rgb(248_113_113_/_0.38)] bg-[rgb(248_113_113_/_0.06)]";
  }

  if (order.margin_percent < 15 || order.remaining_amount > 0) {
    return "border-[rgb(251_191_36_/_0.32)] bg-[rgb(251_191_36_/_0.06)]";
  }

  return "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]";
}

function buildFinanceInsights(overview: FinanceOverview): FinanceInsight[] {
  const insights: FinanceInsight[] = [];

  if (overview.accounts_receivable > 0) {
    insights.push({
      title: "Есть дебиторка",
      description: `Клиенты должны ${formatCurrency(
        overview.accounts_receivable,
      )}. Нужно проконтролировать оплату заказов.`,
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Дебиторки нет",
      description: "Все зафиксированные заказы полностью закрыты по оплате.",
      tone: "success",
    });
  }

  if (overview.net_profit < 0) {
    insights.push({
      title: "Чистая прибыль отрицательная",
      description: `Расходы превышают валовую прибыль. Текущий результат: ${formatCurrency(
        overview.net_profit,
      )}.`,
      tone: "danger",
    });
  } else if (overview.net_profit === 0) {
    insights.push({
      title: "Чистая прибыль на нуле",
      description:
        "За выбранный период бизнес пока не показывает чистую прибыль.",
      tone: "muted",
    });
  } else {
    insights.push({
      title: "Чистая прибыль положительная",
      description: `После расходов бизнес заработал ${formatCurrency(
        overview.net_profit,
      )}.`,
      tone: "success",
    });
  }

  if (overview.gross_margin_percent < 0) {
    insights.push({
      title: "Маржа отрицательная",
      description:
        "Есть риск убыточных заказов. Нужно проверить цены, скидки и себестоимость.",
      tone: "danger",
    });
  } else if (overview.gross_margin_percent < 15) {
    insights.push({
      title: "Маржа низкая",
      description: `Текущая валовая маржа ${overview.gross_margin_percent}%. Стоит проверить себестоимость, скидки и правила цен.`,
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Маржа в норме",
      description: `Текущая валовая маржа ${overview.gross_margin_percent}%.`,
      tone: "success",
    });
  }

  if (overview.orders_with_debt_count > 0) {
    insights.push({
      title: "Есть заказы с долгом",
      description: `Количество заказов с неполной оплатой: ${overview.orders_with_debt_count}.`,
      tone: "warning",
    });
  }

  if (overview.business_expenses <= 0) {
    insights.push({
      title: "Расходы бизнеса не внесены",
      description:
        "За выбранный период нет расходов. Если расходы были, добавьте их для корректной чистой прибыли.",
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Расходы учтены",
      description: `За выбранный период внесено расходов на ${formatCurrency(
        overview.business_expenses,
      )}.`,
      tone: "muted",
    });
  }

  return insights;
}

function buildFinanceReportRows({
  period,
  overview,
  ordersMargin,
}: {
  period: FinancePeriod;
  overview: FinanceOverview;
  ordersMargin: FinanceOrderMargin[];
}) {
  const rows: Array<Array<string | number | null | undefined>> = [];

  rows.push(["Финансовый отчет Imperial Detailing"]);
  rows.push(["Период", getPeriodText(period)]);
  rows.push(["Дата выгрузки", formatDateTime(new Date().toISOString())]);
  rows.push([]);

  rows.push(["Финансовая сводка"]);
  rows.push(["Показатель", "Значение"]);

  rows.push(["Выручка по заказам", overview.orders_revenue]);
  rows.push(["Получено оплат", overview.cash_received]);
  rows.push(["Дебиторка", overview.accounts_receivable]);
  rows.push(["Валовая прибыль", overview.gross_profit]);
  rows.push(["Расходы бизнеса", overview.business_expenses]);
  rows.push(["Чистая прибыль", overview.net_profit]);
  rows.push(["Средний чек", overview.average_order_value]);
  rows.push(["Процент оплаты", `${overview.payment_rate_percent}%`]);
  rows.push(["Маржа", `${overview.gross_margin_percent}%`]);
  rows.push(["Чистая маржа", `${overview.net_margin_percent}%`]);
  rows.push(["Заказы с долгом", overview.orders_with_debt_count]);
  rows.push(["Зафиксированных заказов", overview.locked_orders_count]);
  rows.push(["Полностью оплачено", overview.paid_orders_count]);
  rows.push(["Частично оплачено", overview.partial_orders_count]);
  rows.push(["Не оплачено", overview.unpaid_orders_count]);

  rows.push([]);
  rows.push(["Маржинальность заказов"]);
  rows.push([
    "Номер заказа",
    "Клиент",
    "Автомобиль",
    "Дата создания",
    "Сумма заказа",
    "Оплачено",
    "Остаток",
    "Себестоимость",
    "Валовая прибыль",
    "Маржа",
    "Статус оплаты",
    "Количество позиций",
  ]);

  for (const order of ordersMargin) {
    rows.push([
      order.order_id,
      order.client_full_name ?? `Клиент #${order.client_id}`,
      order.car_label ?? `Автомобиль #${order.car_id}`,
      formatDateTime(order.created_at),
      order.total_price,
      order.paid_amount,
      order.remaining_amount,
      order.base_cost,
      order.gross_profit,
      `${order.margin_percent}%`,
      order.payment_status,
      order.items_count,
    ]);
  }

  return rows;
}

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
      className={`min-h-[150px] rounded-3xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[rgb(45_212_191_/_0.35)] hover:shadow-lg hover:shadow-black/20 ${className}`}
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
  const [ordersMargin, setOrdersMargin] = useState<FinanceOrderMargin[]>([]);
  const [ordersMarginFilter, setOrdersMarginFilter] =
    useState<OrdersMarginFilter>("all");

  const [ordersMarginSort, setOrdersMarginSort] =
    useState<OrdersMarginSort>("created_desc");
  const [showAllOrdersMargin, setShowAllOrdersMargin] = useState(false);
  const [charts, setCharts] = useState<FinanceCharts | null>(null);
  const financeInsights = overview ? buildFinanceInsights(overview) : [];
  const marginChartData = ordersMargin.slice(0, 8).map((order) => ({
    label: `Заказ #${order.order_id}`,
    margin_percent: order.margin_percent,
    gross_profit: order.gross_profit,
  }));

  const filteredOrdersMargin = ordersMargin
    .filter((order) => {
      if (ordersMarginFilter === "debt") {
        return order.remaining_amount > 0;
      }

      if (ordersMarginFilter === "low_margin") {
        return order.margin_percent >= 0 && order.margin_percent < 15;
      }

      if (ordersMarginFilter === "negative_margin") {
        return order.margin_percent < 0;
      }

      return true;
    })
    .sort((a, b) => {
      if (ordersMarginSort === "total_desc") {
        return b.total_price - a.total_price;
      }

      if (ordersMarginSort === "profit_desc") {
        return b.gross_profit - a.gross_profit;
      }

      if (ordersMarginSort === "margin_asc") {
        return a.margin_percent - b.margin_percent;
      }

      if (ordersMarginSort === "debt_desc") {
        return b.remaining_amount - a.remaining_amount;
      }

      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

  const visibleOrdersMargin = showAllOrdersMargin
    ? filteredOrdersMargin
    : filteredOrdersMargin.slice(0, 10);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadFinance = canAccessByPermission(session, "finance.read");

  async function loadFinance(nextPeriod: FinancePeriod = period) {
    if (!canReadFinance) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [overviewResult, ordersMarginResult, chartsResult] =
        await Promise.all([
          getFinanceOverview(nextPeriod),
          getFinanceOrdersMargin(nextPeriod),
          getFinanceCharts(nextPeriod),
        ]);

      setOverview(overviewResult);
      setOrdersMargin(ordersMarginResult);
      setCharts(chartsResult);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownloadReport() {
    if (!overview) {
      setError("Сначала загрузите финансовую сводку.");
      return;
    }

    const rows = buildFinanceReportRows({
      period,
      overview,
      ordersMargin,
    });

    downloadCsv(`finance-report-${getReportDateLabel()}.csv`, rows);
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
        const [overviewResult, ordersMarginResult, chartsResult] =
          await Promise.all([
            getFinanceOverview(period),
            getFinanceOrdersMargin(period),
            getFinanceCharts(period),
          ]);

        if (!isMounted) {
          return;
        }

        setOverview(overviewResult);
        setOrdersMargin(ordersMarginResult);
        setCharts(chartsResult);
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isLoading || !overview}
              onClick={handleDownloadReport}
            >
              Скачать отчет
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void loadFinance()}
            >
              Обновить
            </Button>
          </div>
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
              finance.read
            </span>
            .
          </div>
        </div>
      ) : null}

      {canReadFinance ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
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
            <div className="space-y-6">
              <Card>
                <CardContent className="mt-5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <Badge tone={getFinanceResultTone(overview)}>
                        Финансовый результат
                      </Badge>

                      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                        {getFinanceResultTitle(overview)}
                      </div>

                      <div className="mt-2 max-w-3xl text-sm leading-6 text-[hsl(var(--muted))]">
                        {getFinanceResultDescription(overview)}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Чистая прибыль
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {formatCurrency(overview.net_profit)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Чистая маржа
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {overview.net_margin_percent}%
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Дебиторка
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {formatCurrency(overview.accounts_receivable)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Выводы по финансам</CardTitle>
                      <CardDescription>
                        Короткие подсказки по выбранному периоду.
                      </CardDescription>
                    </div>

                    <Badge tone="primary">
                      Выводов: {financeInsights.length}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {financeInsights.map((insight) => (
                      <div
                        key={`${insight.title}-${insight.description}`}
                        className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {insight.title}
                            </div>

                            <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                              {insight.description}
                            </div>
                          </div>

                          <Badge tone={insight.tone}>
                            {insight.tone === "success"
                              ? "Хорошо"
                              : insight.tone === "warning"
                                ? "Внимание"
                                : insight.tone === "danger"
                                  ? "Риск"
                                  : "Инфо"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Графики финансов</CardTitle>
                  <CardDescription>
                    Динамика выручки, оплат, расходов, прибыли и маржинальности.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-white">
                          Динамика денег
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                          Выручка, оплаты, расходы и чистая прибыль по дням.
                        </div>
                      </div>

                      <ChartLegend
                        items={[
                          {
                            label: "Выручка",
                            color: chartColors[0],
                          },
                          {
                            label: "Оплачено",
                            color: chartColors[1],
                          },
                          {
                            label: "Расходы",
                            color: chartColors[2],
                          },
                          {
                            label: "Чистая прибыль",
                            color: chartColors[5],
                          },
                        ]}
                      />

                      {charts?.daily?.some(
                        (item) =>
                          item.orders_revenue > 0 ||
                          item.cash_received > 0 ||
                          item.business_expenses > 0 ||
                          item.net_profit !== 0,
                      ) ? (
                        <div className="mt-5 h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={charts.daily}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="label"
                                tick={{
                                  fill: "hsl(var(--muted))",
                                  fontSize: 12,
                                }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                tick={{
                                  fill: "hsl(var(--muted))",
                                  fontSize: 12,
                                }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) =>
                                  `${Math.round(Number(value) / 1000)}k`
                                }
                              />
                              <Tooltip content={<FinanceChartTooltip />} />

                              <Line
                                type="monotone"
                                dataKey="orders_revenue"
                                name="Выручка"
                                stroke={chartColors[0]}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                                animationDuration={900}
                              />

                              <Line
                                type="monotone"
                                dataKey="cash_received"
                                name="Оплачено"
                                stroke={chartColors[1]}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                                animationDuration={1000}
                              />

                              <Line
                                type="monotone"
                                dataKey="business_expenses"
                                name="Расходы"
                                stroke={chartColors[2]}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                                animationDuration={1100}
                              />

                              <Line
                                type="monotone"
                                dataKey="net_profit"
                                name="Чистая прибыль"
                                stroke={chartColors[5]}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                                animationDuration={1200}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyChartState />
                      )}
                    </div>

                    <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-white">
                          Расходы по категориям
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                          Какие категории формируют основную часть расходов.
                        </div>
                      </div>

                      {charts?.expenses_by_category?.length ? (
                        <ChartLegend
                          items={charts.expenses_by_category.map(
                            (item, index) => ({
                              label: item.label,
                              color: chartColors[index % chartColors.length],
                            }),
                          )}
                        />
                      ) : null}

                      {charts?.expenses_by_category?.length ? (
                        <div className="mt-5 h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip content={<FinanceChartTooltip />} />
                              <Pie
                                data={charts.expenses_by_category}
                                dataKey="value"
                                nameKey="label"
                                innerRadius={70}
                                outerRadius={115}
                                paddingAngle={4}
                                isAnimationActive
                                animationDuration={900}
                              >
                                {charts.expenses_by_category.map(
                                  (item, index) => (
                                    <Cell
                                      key={item.label}
                                      fill={
                                        chartColors[index % chartColors.length]
                                      }
                                    />
                                  ),
                                )}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyChartState />
                      )}
                    </div>

                    <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 xl:col-span-2">
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-white">
                          Маржинальность заказов
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                          Сравнение маржи и валовой прибыли по последним
                          зафиксированным заказам.
                        </div>
                      </div>

                      <ChartLegend
                        items={[
                          {
                            label: "Валовая прибыль",
                            color: chartColors[0],
                          },
                          {
                            label: "Маржа, %",
                            color: chartColors[2],
                          },
                        ]}
                      />

                      {marginChartData.length ? (
                        <div className="mt-5 h-[340px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={marginChartData}
                              barGap={8}
                              barCategoryGap="28%"
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="label"
                                tick={{
                                  fill: "hsl(var(--muted))",
                                  fontSize: 12,
                                }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                tick={{
                                  fill: "hsl(var(--muted))",
                                  fontSize: 12,
                                }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <Tooltip
                                content={<FinanceChartTooltip />}
                                cursor={{
                                  fill: "rgba(45, 212, 191, 0.06)",
                                  radius: 18,
                                }}
                              />

                              <Bar
                                dataKey="gross_profit"
                                name="Валовая прибыль"
                                radius={[12, 12, 0, 0]}
                                fill={chartColors[0]}
                                isAnimationActive
                                animationDuration={900}
                              />

                              <Bar
                                dataKey="margin_percent"
                                name="Маржа, %"
                                radius={[12, 12, 0, 0]}
                                fill={chartColors[2]}
                                isAnimationActive
                                animationDuration={1100}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyChartState />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Основные показатели</CardTitle>
                  <CardDescription>
                    Ключевые суммы за выбранный период.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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

                    <FinanceMetricCard
                      title="Расходы бизнеса"
                      value={formatCurrency(overview.business_expenses)}
                      description="Сумма расходов бизнеса за выбранный период."
                      tone={
                        overview.business_expenses > 0 ? "warning" : "default"
                      }
                    />

                    <FinanceMetricCard
                      title="Чистая прибыль"
                      value={formatCurrency(overview.net_profit)}
                      description="Валовая прибыль за вычетом расходов бизнеса."
                      tone={overview.net_profit < 0 ? "danger" : "success"}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Эффективность</CardTitle>
                  <CardDescription>
                    Средний чек, оплата, маржинальность и долги клиентов.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
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
                        overview.payment_rate_percent >= 80
                          ? "success"
                          : "warning"
                      }
                    />

                    <FinanceMetricCard
                      title="Маржа"
                      value={`${overview.gross_margin_percent}%`}
                      description="Доля валовой прибыли от выручки по заказам."
                      tone={
                        overview.gross_margin_percent < 15
                          ? "warning"
                          : "success"
                      }
                    />

                    <FinanceMetricCard
                      title="Чистая маржа"
                      value={`${overview.net_margin_percent}%`}
                      description="Доля чистой прибыли от выручки по заказам."
                      tone={
                        overview.net_margin_percent < 10 ? "warning" : "success"
                      }
                    />

                    <FinanceMetricCard
                      title="Заказы с долгом"
                      value={overview.orders_with_debt_count}
                      description="Заказы, которые не оплачены полностью."
                      tone={
                        overview.orders_with_debt_count > 0
                          ? "warning"
                          : "success"
                      }
                    />
                  </div>
                </CardContent>
              </Card>

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

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Маржинальность заказов</CardTitle>
                      <CardDescription>
                        Валовая прибыль и маржа по зафиксированным заказам.
                      </CardDescription>
                    </div>

                    <Badge
                      tone={
                        filteredOrdersMargin.length > 0 ? "primary" : "muted"
                      }
                    >
                      Заказов: {filteredOrdersMargin.length}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_280px] lg:items-end">
                    <div>
                      <div className="mb-2 text-xs font-medium text-[hsl(var(--muted))]">
                        Фильтр
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {ordersMarginFilterOptions.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={
                              ordersMarginFilter === option.value
                                ? "primary"
                                : "secondary"
                            }
                            onClick={() => setOrdersMarginFilter(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Combobox
                      label="Сортировка"
                      placeholder="Выберите сортировку"
                      value={ordersMarginSort}
                      options={ordersMarginSortOptions}
                      onChange={(value) =>
                        setOrdersMarginSort(String(value) as OrdersMarginSort)
                      }
                    />
                  </div>

                  {filteredOrdersMargin.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Нет заказов, подходящих под выбранный фильтр.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleOrdersMargin.map((order) => (
                        <div
                          key={order.order_id}
                          className={`rounded-3xl border p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20 ${getOrderMarginCardClass(order)}`}
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={routes.orderDetails(order.order_id)}
                                >
                                  <Badge tone="primary">
                                    Заказ #{order.order_id}
                                  </Badge>
                                </Link>

                                <Badge
                                  tone={getPaymentStatusTone(
                                    order.payment_status,
                                  )}
                                >
                                  {order.payment_status}
                                </Badge>

                                <Badge
                                  tone={getMarginTone(order.margin_percent)}
                                >
                                  Маржа: {order.margin_percent}%
                                </Badge>
                              </div>

                              <div className="mt-3 text-base font-semibold text-white">
                                {order.client_full_name ??
                                  `Клиент #${order.client_id}`}
                              </div>

                              <div className="mt-1 text-sm leading-6 text-[hsl(var(--muted))]">
                                {order.car_label ??
                                  `Автомобиль #${order.car_id}`}
                              </div>

                              <div className="mt-2 text-xs text-[hsl(var(--muted))]">
                                Создан: {formatDateTime(order.created_at)}
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[620px] xl:grid-cols-3">
                              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                <div className="text-xs text-[hsl(var(--muted))]">
                                  Сумма заказа
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white">
                                  {formatCurrency(order.total_price)}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-3">
                                <div className="text-xs text-[rgb(94_234_212)]">
                                  Оплачено
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white">
                                  {formatCurrency(order.paid_amount)}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-3">
                                <div className="text-xs text-[rgb(252_211_77)]">
                                  Остаток
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white">
                                  {formatCurrency(order.remaining_amount)}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                <div className="text-xs text-[hsl(var(--muted))]">
                                  Себестоимость
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white">
                                  {formatCurrency(order.base_cost)}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-3">
                                <div className="text-xs text-[rgb(94_234_212)]">
                                  Валовая прибыль
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white">
                                  {formatCurrency(order.gross_profit)}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                                <div className="text-xs text-[hsl(var(--muted))]">
                                  Позиций
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white">
                                  {order.items_count}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {filteredOrdersMargin.length > 10 ? (
                        <div className="flex justify-center pt-3">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              setShowAllOrdersMargin((current) => !current)
                            }
                          >
                            {showAllOrdersMargin
                              ? "Скрыть часть заказов"
                              : `Показать все заказы (${filteredOrdersMargin.length})`}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}