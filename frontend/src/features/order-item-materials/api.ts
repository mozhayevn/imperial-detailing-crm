import { apiRequest } from "@/src/lib/api/client";
import type {
  OrderItemMaterial,
  OrderItemMaterialCreatePayload,
} from "@/src/features/order-item-materials/types";

export async function getOrderItemMaterials(
  orderItemId: number,
): Promise<OrderItemMaterial[]> {
  return apiRequest<OrderItemMaterial[]>(
   `/order-item-materials/${orderItemId}`,
    {
      method: "GET",
    },
  );
}

export async function addMaterialToOrderItem(
  orderItemId: number,
  payload: OrderItemMaterialCreatePayload,
): Promise<OrderItemMaterial> {
  return apiRequest<OrderItemMaterial>(
    `/order-item-materials/${orderItemId}`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function deleteOrderItemMaterial(
  orderItemMaterialId: number,
): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(
    `/order-item-materials/${orderItemMaterialId}`,
    {
      method: "DELETE",
    },
  );
}