import type { OrderStatus } from "@/src/lib/constants";

export type OrderStatusTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export const orderStatusLabels: Record<OrderStatus | string, string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  in_progress: "В работе",
  completed: "Завершен",
  delivered: "Выдан",
  canceled: "Отменен",
};

export const orderStatusTones: Record<OrderStatus | string, OrderStatusTone> = {
  new: "primary",
  confirmed: "warning",
  in_progress: "warning",
  completed: "success",
  delivered: "success",
  canceled: "danger",
};

export function getOrderStatusLabel(status: OrderStatus | string): string {
  return orderStatusLabels[status] ?? status;
}

export function getOrderStatusTone(status: OrderStatus | string): OrderStatusTone {
  return orderStatusTones[status] ?? "default";
}