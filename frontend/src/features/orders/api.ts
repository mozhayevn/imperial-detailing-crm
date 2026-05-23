import { apiRequest } from "@/src/lib/api/client";
import type {
  Order,
  OrderAuditLog,
  OrderCreatePayload,
  OrderFilters,
  OrderListItem,
  OrderReschedulePayload,
  OrderStatusHistoryItem,
  OrderUpdatePayload,
} from "@/src/features/orders/types";

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}

function buildOrdersQuery(filters?: OrderFilters) {
  const params = new URLSearchParams();

  appendQueryParam(params, "status", filters?.status);
  appendQueryParam(params, "client_id", filters?.client_id);
  appendQueryParam(params, "car_id", filters?.car_id);
  appendQueryParam(params, "client_name", filters?.client_name);
  appendQueryParam(params, "phone", filters?.phone);
  appendQueryParam(params, "plate_number", filters?.plate_number);
  appendQueryParam(params, "work_bay_id", filters?.work_bay_id);
  appendQueryParam(params, "assigned_user_id", filters?.assigned_user_id);

  const query = params.toString();

  return query ? `?${query}` : "";
}

export async function getOrders(
  filters?: OrderFilters,
): Promise<OrderListItem[]> {
  return apiRequest<OrderListItem[]>(`/orders/${buildOrdersQuery(filters)}`, {
    method: "GET",
  });
}

export async function getOrdersByCarId(
  carId: number,
): Promise<OrderListItem[]> {
  return getOrders({
    car_id: carId,
  });
}

export async function getOrderById(orderId: number): Promise<Order> {
  return apiRequest<Order>(`/orders/${orderId}`, {
    method: "GET",
  });
}

export async function createOrder(
  payload: OrderCreatePayload,
): Promise<Order> {
  return apiRequest<Order>("/orders/", {
    method: "POST",
    body: payload,
  });
}

export async function updateOrder(
  orderId: number,
  payload: OrderUpdatePayload,
): Promise<Order> {
  return apiRequest<Order>(`/orders/${orderId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function updateOrderStatus(
  orderId: number,
  status: string,
): Promise<Order> {
  return apiRequest<Order>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: {
      status,
    },
  });
}

export async function rescheduleOrder(
  orderId: number,
  payload: OrderReschedulePayload,
): Promise<Order> {
  return apiRequest<Order>(`/orders/${orderId}/reschedule`, {
    method: "PATCH",
    body: payload,
  });
}

export async function cancelOrder(
  orderId: number,
  reason: string,
): Promise<Order> {
  return apiRequest<Order>(`/orders/${orderId}/cancel`, {
    method: "PATCH",
    body: {
      reason,
    },
  });
}

export async function getOrderStatusHistory(
  orderId: number,
): Promise<OrderStatusHistoryItem[]> {
  return apiRequest<OrderStatusHistoryItem[]>(
    `/orders/${orderId}/status-history`,
    {
      method: "GET",
    },
  );
}

export async function getOrderAuditLogs(
  orderId: number,
): Promise<OrderAuditLog[]> {
  return apiRequest<OrderAuditLog[]>(`/orders/${orderId}/audit-logs`, {
    method: "GET",
  });
}

