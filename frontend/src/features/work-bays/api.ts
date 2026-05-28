import { apiRequest } from "@/src/lib/api/client";
import type {
  WorkBay,
  WorkBayAvailability,
  WorkBayCreatePayload,
  WorkBaySchedule,
  WorkBayUpdatePayload,
} from "@/src/features/work-bays/types";

export async function getWorkBays(): Promise<WorkBay[]> {
  return apiRequest<WorkBay[]>("/work-bays/", {
    method: "GET",
  });
}

export async function getWorkBayById(workBayId: number): Promise<WorkBay> {
  return apiRequest<WorkBay>(`/work-bays/${workBayId}`, {
    method: "GET",
  });
}

export async function createWorkBay(
  payload: WorkBayCreatePayload,
): Promise<WorkBay> {
  return apiRequest<WorkBay>("/work-bays/", {
    method: "POST",
    body: payload,
  });
}

export async function updateWorkBay(
  workBayId: number,
  payload: WorkBayUpdatePayload,
): Promise<WorkBay> {
  return apiRequest<WorkBay>(`/work-bays/${workBayId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteWorkBay(
  workBayId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/work-bays/${workBayId}`, {
    method: "DELETE",
  });
}

export async function getAvailableWorkBays(params: {
  planned_start_at: string;
  planned_end_at: string;
  exclude_order_id?: number | null;
}): Promise<WorkBayAvailability[]> {
  const searchParams = new URLSearchParams();

  searchParams.set("planned_start_at", params.planned_start_at);
  searchParams.set("planned_end_at", params.planned_end_at);

  if (params.exclude_order_id) {
    searchParams.set("exclude_order_id", String(params.exclude_order_id));
  }

  return apiRequest<WorkBayAvailability[]>(
    `/work-bays/available?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function getWorkBaySchedule(params: {
  schedule_date: string;
}): Promise<WorkBaySchedule> {
  const searchParams = new URLSearchParams();

  searchParams.set("schedule_date", params.schedule_date);

  return apiRequest<WorkBaySchedule>(
    `/work-bays/schedule?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}