import { apiRequest } from "@/src/lib/api/client";
import type {
  CarType,
  CarTypeCreatePayload,
  CarTypeUpdatePayload,
} from "@/src/features/car-types/types";

export async function getCarTypes(): Promise<CarType[]> {
  return apiRequest<CarType[]>("/car-types/", {
    method: "GET",
  });
}

export async function createCarType(
  payload: CarTypeCreatePayload,
): Promise<CarType> {
  return apiRequest<CarType>("/car-types/", {
    method: "POST",
    body: payload,
  });
}

export async function updateCarType(
  carTypeId: number,
  payload: CarTypeUpdatePayload,
): Promise<CarType> {
  return apiRequest<CarType>(`/car-types/${carTypeId}`, {
    method: "PUT",
    body: payload,
  });
}