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