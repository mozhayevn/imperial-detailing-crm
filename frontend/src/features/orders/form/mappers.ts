import type {
  Order,
  OrderCreatePayload,
  OrderItem,
  OrderItemCreatePayload,
  OrderItemUpdatePayload,
  OrderUpdatePayload,
} from "@/src/features/orders/types";
import type { OrderFormItem, OrderFormValues } from "@/src/features/orders/form/types";
import { createDefaultOrderFormValues } from "@/src/features/orders/form/defaults";

function createFormKey(id?: number | null) {
  return `order-item-${id ?? "new"}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toApiDateTime(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`;
  }

  return normalized;
}

function nullableNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function requiredNumber(
  value: number | null | undefined,
  fieldName = "value",
): number {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function normalizeQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function normalizeDiscountPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.floor(value);
}

function normalizeTextToNull(value: string): string | null {
  const normalized = value.trim();

  return normalized ? normalized : null;
}

export function mapOrderItemToFormItem(item: OrderItem): OrderFormItem {
  return {
    ui_key: createFormKey(item.id),
    id: item.id,
    service_id: item.service_id,
    material_brand_id: item.material_brand_id,
    service_package_id: item.service_package_id,
    quantity: item.quantity,
    discount_percent: item.discount_percent,
    discount_reason: item.discount_reason ?? "",
  };
}

export function mapOrderToFormValues(order: Order): OrderFormValues {
  return {
    client_id: order.client_id,
    car_id: order.car_id,
    assigned_user_id: order.assigned_user_id ?? null,
    work_bay_id: order.work_bay_id ?? null,
    scheduled_at: toDateTimeLocalValue(order.scheduled_at),
    planned_start_at: toDateTimeLocalValue(order.planned_start_at),
    planned_end_at: toDateTimeLocalValue(order.planned_end_at),
    comment: order.comment ?? "",
    items: order.items.length
      ? order.items.map(mapOrderItemToFormItem)
      : createDefaultOrderFormValues().items,
  };
}

function mapFormItemToCreatePayload(
  item: OrderFormItem,
): OrderItemCreatePayload {
  return {
    service_id: requiredNumber(item.service_id, "service.id"),
    material_brand_id: nullableNumber(item.material_brand_id),
    service_package_id: nullableNumber(item.service_package_id),
    quantity: normalizeQuantity(item.quantity),
    discount_percent: normalizeDiscountPercent(item.discount_percent),
    discount_reason: normalizeTextToNull(item.discount_reason),
  };
}

function mapFormItemToUpdatePayload(
  item: OrderFormItem,
): OrderItemUpdatePayload {
  return {
    id: item.id,
    service_id: requiredNumber(item.service_id, "service.id"),
    material_brand_id: nullableNumber(item.material_brand_id),
    service_package_id: nullableNumber(item.service_package_id),
    quantity: normalizeQuantity(item.quantity),
    discount_percent: normalizeDiscountPercent(item.discount_percent),
    discount_reason: normalizeTextToNull(item.discount_reason),
  };
}

export function mapFormValuesToCreatePayload(
  values: OrderFormValues,
):OrderCreatePayload {
  return {
    client_id: requiredNumber(values.client_id, "client.id"),
    car_id: requiredNumber(values.car_id, "car_id.id"),
    assigned_user_id: nullableNumber(values.assigned_user_id),
    work_bay_id: nullableNumber(values.work_bay_id),
    scheduled_at: toApiDateTime(values.scheduled_at),
    planned_start_at: toApiDateTime(values.planned_start_at),
    planned_end_at: toApiDateTime(values.planned_end_at),
    comment: normalizeTextToNull(values.comment),
    items: values.items.map(mapFormItemToCreatePayload),
  };
}

export function mapFormValuesToUpdatePayload(
  values: OrderFormValues,
): OrderUpdatePayload {
  return {
    client_id: values.client_id,
    car_id: values.car_id,
    assigned_user_id: values.assigned_user_id,
    work_bay_id: values.work_bay_id,
    scheduled_at: toApiDateTime(values.scheduled_at),
    planned_start_at: toApiDateTime(values.planned_start_at),
    planned_end_at: toApiDateTime(values.planned_end_at),
    comment: values.comment.trim() || null,
    items: values.items.map((item) => ({
      id: item.id,
      service_id: requiredNumber(item.service_id, "service_id"),
      material_brand_id: item.material_brand_id,
      service_package_id: item.service_package_id,
      quantity: item.quantity,
      discount_percent: item.discount_percent,
      discount_reason: item.discount_reason.trim() || null,
    })),
  };
}