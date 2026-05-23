import type { OrderFormItem, OrderFormValues } from "@/src/features/orders/form/types";

function createFormKey() {
  return `order-item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyOrderFormItem(): OrderFormItem {
  return {
    ui_key: createFormKey(),
    id: null,
    service_id: null,
    material_brand_id: null,
    service_package_id: null,
    quantity: 1,
    discount_percent: 0,
    discount_reason: "",
  };
}

export function createDefaultOrderFormValues(): OrderFormValues {
  return {
    client_id: null,
    car_id: null,
    assigned_user_id: null,
    work_bay_id: null,
    scheduled_at: "",
    planned_start_at: "",
    planned_end_at: "",
    comment: "",
    items: [createEmptyOrderFormItem()],
  };
}

export function cloneOrderFormItem(item: OrderFormItem): OrderFormItem {
  return {
    ...item,
    ui_key: createFormKey(),
    id: null,
  };
}