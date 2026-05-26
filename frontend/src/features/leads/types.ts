export type LeadStatus =
  | "new"
  | "in_review"
  | "confirmed"
  | "rejected"
  | "duplicate";

export type LeadItem = {
  id: number;
  lead_id: number;

  service_id: number | null;
  service_name_text: string | null;
  service_name: string | null;

  material_brand_id: number | null;
  material_brand_name: string | null;

  service_package_id: number | null;
  service_package_name: string | null;

  quantity: number;
  comment: string | null;

  created_at: string;
};

export type LeadContact = {
  id: number;

  full_name: string | null;
  phone: string;

  source: string;
  external_user_id: string | null;
  external_username: string | null;

  created_client_id: number | null;

  created_at: string;
  updated_at: string | null;
};

export type Lead = {
  id: number;

  lead_contact_id: number;
  lead_contact: LeadContact | null;

  source: string;
  status: LeadStatus;

  client_name: string | null;
  phone: string;

  message: string | null;

  car_brand: string | null;
  car_model: string | null;
  car_year: number | null;
  car_color: string | null;
  plate_number: string | null;

  preferred_date: string | null;
  preferred_time: string | null;

  comment: string | null;

  assigned_user_id: number | null;
  assigned_user_full_name: string | null;

  reviewed_by_user_id: number | null;
  reviewed_by_user_full_name: string | null;
  reviewed_at: string | null;

  created_client_id: number | null;
  created_car_id: number | null;
  created_order_id: number | null;

  created_at: string;
  updated_at: string | null;

  items: LeadItem[];
};

export type LeadCreatePayload = {
  source: string;

  client_name?: string | null;
  phone: string;

  message?: string | null;

  car_brand?: string | null;
  car_model?: string | null;
  car_year?: number | null;
  car_color?: string | null;
  plate_number?: string | null;

  preferred_date?: string | null;
  preferred_time?: string | null;

  comment?: string | null;

  external_user_id?: string | null;
  external_username?: string | null;

  items: {
    service_id?: number | null;
    service_name_text?: string | null;
    material_brand_id?: number | null;
    service_package_id?: number | null;
    quantity: number;
    comment?: string | null;
  }[];
};

export type LeadAuditLog = {
  id: number;

  lead_id: number;
  actor_user_id: number | null;
  actor_user_full_name: string | null;

  action: string;
  details: string | null;

  created_at: string;
};

export type LeadConfirmItemPayload = {
  lead_item_id?: number | null;
  service_id: number;
  material_brand_id?: number | null;
  service_package_id?: number | null;
  quantity: number;
  discount_percent?: number;
  discount_reason?: string | null;
};

export type LeadConfirmPayload = {
  client_id?: number | null;
  car_id?: number | null;

  client_name?: string | null;
  phone?: string | null;

  car_type_id?: number | null;
  car_brand?: string | null;
  car_model?: string | null;
  car_year?: number | null;
  car_color?: string | null;
  plate_number?: string | null;

  assigned_user_id?: number | null;
  work_bay_id?: number | null;
  scheduled_at?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;

  comment?: string | null;
  items: LeadConfirmItemPayload[];
};

export type LeadConfirmResponse = {
  lead: Lead;
  order: {
    id: number;
    client_id: number;
    car_id: number;
    status: string;
    total_price: number;
  };
};