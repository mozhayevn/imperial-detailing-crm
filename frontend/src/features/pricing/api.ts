import { apiRequest } from "@/src/lib/api/client";
import type {
  OrderItemPricing,
  OrderPricing,
  PricingAuditLog,
  PricingUnlockPayload,
} from "@/src/features/pricing/types";

export async function getOrderItemPricing(
  orderItemId: number,
): Promise<OrderItemPricing> {
  return apiRequest<OrderItemPricing>(`/pricing/order-item/${orderItemId}`, {
    method: "GET",
  });
}

export async function getOrderPricing(orderId: number): Promise<OrderPricing> {
  return apiRequest<OrderPricing>(`/pricing/order/${orderId}`, {
    method: "GET",
  });
}

export async function applyOrderPricing(
  orderId: number,
): Promise<OrderPricing> {
  return apiRequest<OrderPricing>(`/pricing/order/${orderId}/apply`, {
    method: "POST",
  });
}

export async function unlockOrderPricing(
  orderId: number,
  payload: PricingUnlockPayload,
): Promise<OrderPricing> {
  return apiRequest<OrderPricing>(`/pricing/order/${orderId}/unlock`, {
    method: "POST",
    body: payload,
  });
}

export async function getPricingAuditLogs(
  orderId: number,
): Promise<PricingAuditLog[]> {
  return apiRequest<PricingAuditLog[]>(
    `/pricing/order/${orderId}/audit-logs`,
    {
      method: "GET",
    },
  );
}