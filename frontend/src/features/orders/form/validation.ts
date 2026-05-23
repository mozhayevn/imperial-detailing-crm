import type {
  OrderFormErrors,
  OrderFormItem,
  OrderFormItemErrors,
  OrderFormValidationContext,
  OrderFormValidationResult,
  OrderFormValues,
} from "@/src/features/orders/form/types";

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && !Number.isNaN(value);
}

function getServiceById(
  services: OrderFormValidationContext["services"],
  serviceId: number | null,
) {
  if (!serviceId) {
    return null;
  }

  return services.find((service) => service.id === serviceId) ?? null;
}

function validateDateRange(values: OrderFormValues, errors: OrderFormErrors) {
  const hasStart = Boolean(values.planned_start_at);
  const hasEnd = Boolean(values.planned_end_at);

  if (hasStart && !hasEnd) {
    errors.planned_end_at = "Укажите окончание работ";
  }

  if (!hasStart && hasEnd) {
    errors.planned_start_at = "Укажите начало работ";
  }

  if (hasStart && hasEnd) {
    const start = new Date(values.planned_start_at);
    const end = new Date(values.planned_end_at);

    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      start >= end
    ) {
      errors.planned_end_at = "Окончание должно быть позже начала";
    }
  }
}

function validateOrderFormItem(
  item: OrderFormItem,
  context: OrderFormValidationContext,
): OrderFormItemErrors {
  const errors: OrderFormItemErrors = {};
  const selectedService = getServiceById(context.services, item.service_id);

  if (!hasValue(item.service_id)) {
    errors.service_id = "Выберите услугу";
  }

  if (!Number.isFinite(item.quantity) || item.quantity < 1) {
    errors.quantity = "Количество должно быть больше 0";
  }

  if (
    !Number.isFinite(item.discount_percent) ||
    item.discount_percent < 0 ||
    item.discount_percent > 100
  ) {
    errors.discount_percent = "Скидка должна быть от 0 до 100%";
  }

  if (item.discount_percent > 0 && !item.discount_reason.trim()) {
    errors.discount_reason = "Укажите причину скидки";
  }

  if (selectedService?.requires_brand && !hasValue(item.material_brand_id)) {
    errors.material_brand_id = "Для этой услуги нужен бренд материала";
  }

  if (
    selectedService?.requires_package &&
    !hasValue(item.service_package_id)
  ) {
    errors.service_package_id = "Для этой услуги нужен пакет";
  }

  return errors;
}

function hasItemErrors(errors: OrderFormItemErrors) {
  return Object.values(errors).some(Boolean);
}

export function validateOrderForm(
  values: OrderFormValues,
  context: OrderFormValidationContext,
): OrderFormValidationResult {
  const errors: OrderFormErrors = {};

  if (!hasValue(values.client_id)) {
    errors.client_id = "Выберите клиента";
  }

  if (!hasValue(values.car_id)) {
    errors.car_id = "Выберите автомобиль";
  }

  if (values.items.length === 0) {
    errors.form = "Добавьте хотя бы одну позицию заказа";
  }

  validateDateRange(values, errors);

  const itemErrors: Record<string, OrderFormItemErrors> = {};

  values.items.forEach((item) => {
    const currentItemErrors = validateOrderFormItem(item, context);

    if (hasItemErrors(currentItemErrors)) {
      itemErrors[item.ui_key] = currentItemErrors;
    }
  });

  if (Object.keys(itemErrors).length > 0) {
    errors.items = itemErrors;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getFirstOrderFormError(errors: OrderFormErrors): string | null {
  if (errors.form) {
    return errors.form;
  }

  if (errors.client_id) {
    return errors.client_id;
  }

  if (errors.car_id) {
    return errors.car_id;
  }

  if (errors.scheduled_at) {
    return errors.scheduled_at;
  }

  if (errors.planned_start_at) {
    return errors.planned_start_at;
  }

  if (errors.planned_end_at) {
    return errors.planned_end_at;
  }

  const firstItemErrors = errors.items
    ? Object.values(errors.items)[0]
    : undefined;

  if (firstItemErrors) {
    return (
      firstItemErrors.service_id ??
      firstItemErrors.material_brand_id ??
      firstItemErrors.service_package_id ??
      firstItemErrors.quantity ??
      firstItemErrors.discount_percent ??
      firstItemErrors.discount_reason ??
      null
    );
  }

  return null;
}