export type DashboardPeriod = "today" | "7d" | "30d" | "all";

export type DashboardMetric = {
  label: string;
  value: number;
};

export type DashboardOrdersSummary = {
  total: number;
  new_count: number;
  in_progress_count: number;
  completed_count: number;
  canceled_count: number;
  delivered_count: number;
  active_count: number;
};

export type DashboardFinanceSummary = {
  total_price: number;
  paid_amount: number;
  remaining_amount: number;
  total_profit: number;
};

export type DashboardProductionSummary = {
  active_orders: number;
  orders_without_work_bay: number;
  orders_without_master: number;
  orders_without_locked_pricing: number;
  orders_with_unfinished_checklist: number;
};

export type DashboardInventorySummary = {
  total_stock_value: number;
  in_stock_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
};

export type DashboardCharts = {
  orders_by_status: DashboardMetric[];
  finance_breakdown: DashboardMetric[];
  inventory_status: DashboardMetric[];
  production_health: DashboardMetric[];
  orders_by_day: DashboardMetric[];
};

export type DashboardSummary = {
  orders: DashboardOrdersSummary;
  finance: DashboardFinanceSummary;
  production: DashboardProductionSummary;
  inventory: DashboardInventorySummary;
  charts: DashboardCharts;
};