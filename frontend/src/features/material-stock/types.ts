export type MaterialStockMovementType =
  | "receipt"
  | "write_off"
  | "adjustment"
  | "order_usage"
  | "order_usage_reversal";

export type MaterialStockMovement = {
  id: number;
  material_id: number;
  order_item_material_id: number | null;
  movement_type: MaterialStockMovementType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  comment: string | null;
  created_by_user_id: number;
  created_by_user_full_name: string | null;
  created_at: string;
};

export type MaterialStockMovementCreatePayload = {
  movement_type: "receipt" | "write_off" | "adjustment";
  quantity: number;
  unit_cost?: number | null;
  comment?: string | null;
};

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type MaterialStockSummary = {
  material_id: number;
  material_name: string | null;
  unit_id: number;
  unit_name: string | null;
  unit_code: string | null;
  min_stock_quantity: number;
  stock_status: StockStatus;
  current_quantity: number;
  stock_value: number;
  last_unit_cost: number | null;
};