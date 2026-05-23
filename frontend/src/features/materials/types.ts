export type Material = {
  id: number;
  name: string;
  brand_id: number | null;
  category: string | null;
  unit_id: number;
  cost_per_unit: number;
  min_stock_quantity: number;
  is_active: boolean;
};

export type MaterialCreatePayload = {
  name: string;
  brand_id: number | null;
  category: string | null;
  unit_id: number;
  cost_per_unit: number;
  min_stock_quantity: number;
  is_active?: boolean;
};

export type MaterialUpdatePayload = {
  name?: string;
  brand_id?: number | null;
  category?: string | null;
  unit_id?: number;
  cost_per_unit?: number;
  min_stock_quantity?: number;
  is_active?: boolean;
};

export type MaterialFilters = {
  category?: string | null;
  brand_id?: number | null;
  is_active?: boolean | null;
};

export type MaterialOption = {
  id: number;
  label: string;
  description: string;
  cost_per_unit: number;
};