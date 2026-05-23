import { apiRequest } from "@/src/lib/api/client";
import type {
  Payment,
  PaymentAuditLog,
  PaymentCancelPayload,
  PaymentCreatePayload,
  PaymentSummary,
} from "@/src/features/payments/types";

export async function getOrderPayments(orderId: number): Promise<Payment[]> {
  return apiRequest<Payment[]>(`/orders/${orderId}/payments`, {
    method: "GET",
  });
}

export async function getOrderPaymentSummary(
  orderId: number,
): Promise<PaymentSummary> {
  return apiRequest<PaymentSummary>(`/orders/${orderId}/payments/summary`, {
    method: "GET",
  });
}

export async function createOrderPayment(
  orderId: number,
  payload: PaymentCreatePayload,
): Promise<Payment> {
  return apiRequest<Payment>(`/orders/${orderId}/payments`, {
    method: "POST",
    body: payload,
  });
}

export async function cancelPayment(
  paymentId: number,
  payload: PaymentCancelPayload,
): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${paymentId}/cancel`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getPaymentAuditLogs(
  orderId: number,
): Promise<PaymentAuditLog[]> {
  return apiRequest<PaymentAuditLog[]>(
    `/orders/${orderId}/payments/audit-logs`,
    {
      method: "GET",
    },
  );
}