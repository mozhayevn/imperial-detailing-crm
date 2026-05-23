import { apiRequest } from "@/src/lib/api/client";
import type {
  OrderChecklistAuditLog,
  OrderChecklistItem,
  OrderChecklistItemCompletePayload,
  OrderChecklistItemCreatePayload,
  OrderChecklistItemUpdatePayload,
} from "@/src/features/order-checklist/types";

export async function getOrderChecklist(
  orderId: number,
): Promise<OrderChecklistItem[]> {
  return apiRequest<OrderChecklistItem[]>(`/orders/${orderId}/checklist`, {
    method: "GET",
  });
}

export async function createOrderChecklistItem(
  orderId: number,
  payload: OrderChecklistItemCreatePayload,
): Promise<OrderChecklistItem> {
  return apiRequest<OrderChecklistItem>(`/orders/${orderId}/checklist`, {
    method: "POST",
    body: payload,
  });
}

export async function updateOrderChecklistItem(
  itemId: number,
  payload: OrderChecklistItemUpdatePayload,
): Promise<OrderChecklistItem> {
  return apiRequest<OrderChecklistItem>(`/order-checklist/${itemId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function completeOrderChecklistItem(
  itemId: number,
  payload: OrderChecklistItemCompletePayload,
): Promise<OrderChecklistItem> {
  return apiRequest<OrderChecklistItem>(
    `/order-checklist/${itemId}/complete`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function reopenOrderChecklistItem(
  itemId: number,
): Promise<OrderChecklistItem> {
  return apiRequest<OrderChecklistItem>(`/order-checklist/${itemId}/reopen`, {
    method: "PATCH",
  });
}

export async function getOrderChecklistAuditLogs(
  orderId: number,
): Promise<OrderChecklistAuditLog[]> {
  return apiRequest<OrderChecklistAuditLog[]>(
    `/orders/${orderId}/checklist/audit-logs`,
    {
      method: "GET",
    },
  );
}