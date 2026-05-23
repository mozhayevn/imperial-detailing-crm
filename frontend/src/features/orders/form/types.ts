import type {
  OrderCreatePayload,
  OrderUpdatePayload,
} from "@/src/features/orders/types";
import type { Service } from "@/src/features/services/types";

export type OrderFormMode = "create" | "edit";

export type OrderFormItem = {
  /**
   * UI-only stable key for React rendering.
   * Never send this to backend.
   */
  ui_key: string;

  /**
   * Existing backend order_item_id.
   * Must be preserved in edit mode.
   * New items have id = null.
   */
  id: number | null;

  service_id: number | null;
  material_brand_id: number | null;
  service_package_id: number | null;

  quantity: number;
  discount_percent: number;
  discount_reason: string;
};

export type OrderFormValues = {
  client_id: number | null;
  car_id: number | null;
  assigned_user_id: number | null;
  work_bay_id: number | null;

  /**
   * Stored as datetime-local input value:
   * YYYY-MM-DDTHH:mm
   */
  scheduled_at: string;
  planned_start_at: string;
  planned_end_at: string;

  comment: string;

  items: OrderFormItem[];
};

export type OrderFormItemErrors = {
  service_id?: string;
  material_brand_id?: string;
  service_package_id?: string;
  quantity?: string;
  discount_percent?: string;
  discount_reason?: string;
};

export type OrderFormErrors = {
  form?: string;
  client_id?: string;
  car_id?: string;
  scheduled_at?: string;
  planned_start_at?: string;
  planned_end_at?: string;
  items?: Record<string, OrderFormItemErrors>;
};

export type OrderFormValidationContext = {
  services: Service[];
};

export type OrderFormValidationResult = {
  isValid: boolean;
  errors: OrderFormErrors;
};

export type OrderFormPayloads = {
  create: OrderCreatePayload;
  update: OrderUpdatePayload;
};