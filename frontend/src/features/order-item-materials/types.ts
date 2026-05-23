export type OrderItemMaterial = {
  id: number;
  order_item_id: number;
  material_id: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  comment: string | null;
};

export type OrderItemMaterialCreatePayload = {
  material_id: number;
  quantity: number;
  comment: string | null;
};

export type OrderItemMaterialFormValues = {
  material_id: number | null;
  quantity: number;
  comment: string;
};

export type OrderItemMaterialFormErrors = {
  material_id?: string;
  quantity?: string;
  comment?: string;
};