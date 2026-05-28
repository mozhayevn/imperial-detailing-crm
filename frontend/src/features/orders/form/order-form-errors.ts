import { getApiErrorMessage } from "@/src/lib/api/errors";

export function getOrderFormSubmitErrorMessage(error: unknown) {
  const fallbackMessage = getApiErrorMessage(error);

  const maybeApiError = error as {
    payload?: {
      detail?: unknown;
      message?: string;
    };
  };

  const detail = maybeApiError.payload?.detail;

  if (
    typeof detail === "object" &&
    detail !== null &&
    "code" in detail &&
    (detail as { code?: string }).code === "work_bay_time_conflict"
  ) {
    const conflictingOrderId = (detail as {
      conflicting_order_id?: number;
    }).conflicting_order_id;

    const workBayId = (detail as {
      work_bay_id?: number;
    }).work_bay_id;

    return conflictingOrderId
      ? `Выбранный бокс${workBayId ? ` #${workBayId}` : ""} уже занят в это время заказом #${conflictingOrderId}. Измените время или выберите другой бокс.`
      : "Выбранный бокс уже занят в это время. Измените время или выберите другой бокс.";
  }

  if (
    typeof detail === "string" &&
    detail === "planned_end_at must be greater than planned_start_at"
  ) {
    return "Плановое окончание должно быть позже планового начала.";
  }

  return fallbackMessage;
}