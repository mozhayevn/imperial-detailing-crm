export type Service = {
  id: number;
  name: string;
  description: string | null;
  requires_brand: boolean;
  requires_package: boolean;
  base_labor_cost: number;
  is_active: boolean;
};

export type ServiceCreatePayload = {
  name: string;
  description: string | null;
  requires_brand: boolean;
  requires_package: boolean;
  base_labor_cost: number;
  is_active?: boolean;
};

export type ServiceUpdatePayload = {
  name?: string;
  description?: string | null;
  requires_brand?: boolean;
  requires_package?: boolean;
  base_labor_cost?: number;
  is_active?: boolean;
};

export type ServiceSearchOption = {
  id: number;
  label: string;
  description: string;
  requires_brand: boolean;
  requires_package: boolean;
};