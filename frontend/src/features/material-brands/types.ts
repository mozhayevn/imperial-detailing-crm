export type MaterialBrand = {
  id: number;
  name: string;
  category: string | null;
  is_active: boolean;
};

export type MaterialBrandOption = {
  id: number;
  label: string;
  description: string;
};

export type MaterialBrandCreatePayload = {
  name: string;
  category?: string | null;
  is_active?: boolean;
};

export type MaterialBrandUpdatePayload = {
  name?: string;
  category?: string | null;
  is_active?: boolean;
};