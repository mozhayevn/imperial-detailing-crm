import { apiRequest } from "@/src/lib/api/client";
import type { Unit, UnitCreatePayload } from "@/src/features/units/types";

export async function getUnits(): Promise<Unit[]> {
  return apiRequest<Unit[]>("/units/", {
    method: "GET",
  });
}

export async function createUnit(payload: UnitCreatePayload): Promise<Unit> {
  return apiRequest<Unit>("/units/", {
    method: "POST",
    body: payload,
  });
}