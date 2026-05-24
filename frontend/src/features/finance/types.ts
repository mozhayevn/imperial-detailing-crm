export type FinancePeriod = "today" | "7d" | "30d" | "all";

export type FinanceOverview = {
  period: FinancePeriod;

  orders_revenue: number;
  cash_received: number;
  accounts_receivable: number;
  gross_profit: number;
  business_expenses: number;
  net_profit: number;

  average_order_value: number;
  payment_rate_percent: number;
  gross_margin_percent: number;
  net_margin_percent: number;
  orders_with_debt_count: number;

  locked_orders_count: number;
  paid_orders_count: number;
  partial_orders_count: number;
  unpaid_orders_count: number;
};

export type FinanceOrderMargin = {
  order_id: number;
  status: string;
  created_at: string;
  scheduled_at: string | null;

  client_id: number;
  client_full_name: string | null;

  car_id: number;
  car_label: string | null;

  total_price: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;

  base_cost: number;
  gross_profit: number;
  margin_percent: number;

  items_count: number;
  pricing_locked: boolean;
};

export type FinanceDailyChartItem = {
  label: string;
  date: string;
  orders_revenue: number;
  cash_received: number;
  business_expenses: number;
  gross_profit: number;
  net_profit: number;
};

export type FinanceChartMetric = {
  label: string;
  value: number;
};

export type FinanceCharts = {
  period: FinancePeriod;
  daily: FinanceDailyChartItem[];
  expenses_by_category: FinanceChartMetric[];
};