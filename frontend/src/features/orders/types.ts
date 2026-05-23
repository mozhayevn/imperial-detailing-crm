import type { OrderStatus } from "@/src/lib/constants";

export type ISODateTimeString = string;

export type OrderItemCreatePayload = {
  service_id: number;
  material_brand_id?: number | null;
  service_package_id?: number | null;
  quantity?: number;
  discount_percent?: number;
  discount_reason?: string | null;
};

export type OrderCreatePayload = {
  client_id: number;
  car_id: number;
  assigned_user_id?: number | null;
  work_bay_id?: number | null;
  scheduled_at?: ISODateTimeString | null;
  planned_start_at?: ISODateTimeString | null;
  planned_end_at?: ISODateTimeString | null;
  comment?: string | null;
  items: OrderItemCreatePayload[];
};

export type OrderItemUpdatePayload = {
  id?: number | null;
  service_id: number;
  material_brand_id?: number | null;
  service_package_id?: number | null;
  quantity?: number;
  discount_percent?: number;
  discount_reason?: string | null;
};

export type OrderUpdatePayload = {
  client_id: number | null;
  car_id: number | null;
  assigned_user_id?: number | null;
  work_bay_id?: number | null;
  scheduled_at?: ISODateTimeString | null;
  planned_start_at?: ISODateTimeString | null;
  planned_end_at?: ISODateTimeString | null;
  comment?: string | null;
  items: OrderItemUpdatePayload[];
};

export type OrderItem = {
  id: number;
  order_id: number;
  service_id: number;
  material_brand_id: number | null;
  service_package_id: number | null;
  price: number;
  quantity: number;
  discount_amount: number;
  discount_percent: number;
  discount_reason: string | null;
  discount_applied_by_user_id: number | null;
  total: number;
  base_cost_snapshot: number;
  gross_price_snapshot: number;
  discount_amount_snapshot: number;
  final_price_snapshot: number;
  profit_snapshot: number;
};

export type OrderListItem = {
  id: number;
  status: OrderStatus | string;
  total_price: number;
  pricing_locked: boolean;

  created_at: ISODateTimeString;
  scheduled_at: ISODateTimeString | null;
  planned_start_at: ISODateTimeString | null;
  planned_end_at: ISODateTimeString | null;

  client_id: number;
  client_full_name: string | null;
  client_phone: string | null;

  car_id: number;
  car_brand: string | null;
  car_model: string | null;
  car_plate_number: string | null;

  work_bay_id: number | null;
  work_bay_name: string | null;

  assigned_user_id: number | null;
  assigned_user_full_name: string | null;
};

export type Order = {
  id: number;
  client_id: number;
  car_id: number;
  assigned_user_id?: number | null;
  work_bay_id?: number | null;
  status: OrderStatus | string;
  comment: string | null;
  cancellation_reason: string | null;
  total_price: number;

  created_at: ISODateTimeString;
  scheduled_at: ISODateTimeString | null;
  planned_start_at: ISODateTimeString | null;
  planned_end_at: ISODateTimeString | null;
  completed_at: ISODateTimeString | null;
  delivered_at: ISODateTimeString | null;
  rescheduled_from: ISODateTimeString | null;
  pricing_locked: boolean;

  items: OrderItem[];
};

export type OrderFilters = {
  status?: OrderStatus | string | null;
  client_id?: number | null;
  client_name?: string | null;
  car_id?: number | null;
  phone?: string | null;
  plate_number?: string | null;
  work_bay_id?: number | null;
  assigned_user_id?: number | null;
};

export type OrderStatusUpdatePayload = {
  status: OrderStatus | string;
};

export type OrderReschedulePayload = {
  scheduled_at?: ISODateTimeString | null;
  planned_start_at?: ISODateTimeString | null;
  planned_end_at?: ISODateTimeString | null;
  comment?: string | null;
};

export type OrderCancelPayload = {
  reason: string;
};

export type OrderStatusHistoryItem = {
  id: number;
  order_id: number;
  old_status: string | null;
  new_status: string;
  changed_at: ISODateTimeString;
};

export type OrderAuditLog = {
  id: number;
  order_id: number;
  actor_user_id: number;
  actor_user_full_name?: string | null;
  target_user_id?: number | null;
  target_user_full_name?: string | null;
  action: string;
  details: string | null;
  created_at: ISODateTimeString;
};

export type ParsedOrderAuditDetails = {
  order_before?: Record<string, unknown>;
  order_after?: Record<string, unknown>;
  items_added?: unknown[];
  items_updated?: unknown[];
  items_removed?: unknown[];
};