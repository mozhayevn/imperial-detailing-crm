import { apiRequest } from "@/src/lib/api/client";
import type {
  MaterialStockMovement,
  MaterialStockMovementCreatePayload,
  MaterialStockSummary,
} from "@/src/features/material-stock/types";

export async function getMaterialStock(
  materialId: number,
): Promise<MaterialStockSummary> {
  return apiRequest<MaterialStockSummary>(`/materials/${materialId}/stock`, {
    method: "GET",
  });
}

export async function getMaterialStockMovements(
  materialId: number,
): Promise<MaterialStockMovement[]> {
  return apiRequest<MaterialStockMovement[]>(
    `/materials/${materialId}/stock-movements`,
    {
      method: "GET",
    },
  );
}

export async function createMaterialStockMovement(
  materialId: number,
  payload: MaterialStockMovementCreatePayload,
): Promise<MaterialStockMovement> {
  return apiRequest<MaterialStockMovement>(
    `/materials/${materialId}/stock-movements`,
    {
      method: "POST",
      body: payload,
    },
  );
}