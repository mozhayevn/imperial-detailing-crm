export type PricingWarningLevel = "none" | "low_margin" | "negative_profit" | string;

export type OrderPricingItem = {
  order_item_id: number;
  service_id: number;
  quantity: number;
  materials_cost: number;
  labor_cost: number;
  base_cost: number;
  car_type_multiplier: number;
  pricing_source: string;
  service_price_rule_id: number | null;
  gross_price: number;
  discount_percent: number;
  discount_amount: number;
  final_price: number;
  profit: number;
  has_warning: boolean;
  warning_level: string;
  warning_message: string | null;
};

export type OrderPricing = {
  order_id: number;
  items_count: number;
  total_materials_cost: number;
  total_labor_cost: number;
  total_gross_price: number;
  total_discount_amount: number;
  total_final_price: number;
  total_profit: number;
  has_warning: boolean;
  warning_level: string;
  warning_message: string | null;
  items: OrderPricingItem[];
};

export type PricingUnlockPayload = {
  reason: string;
};

export type PricingAuditLog = {
  id: number;
  order_id: number;
  actor_user_id: number;
  actor_user_full_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};