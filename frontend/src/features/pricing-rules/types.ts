export type ServicePriceRule = {
  id: number;
  service_id: number;
  car_type_id: number;
  material_brand_id: number | null;
  service_package_id: number | null;
  price: number;
};

export type ServicePriceRuleCreatePayload = {
  service_id: number;
  car_type_id: number;
  material_brand_id: number | null;
  service_package_id: number | null;
  price: number;
};

export type ServicePriceRuleUpdatePayload = {
  service_id?: number;
  car_type_id?: number;
  material_brand_id?: number | null;
  service_package_id?: number | null;
  price?: number;
};

export type ServicePriceRuleFilters = {
  service_id?: number | null;
  car_type_id?: number | null;
  material_brand_id?: number | null;
  service_package_id?: number | null;
};