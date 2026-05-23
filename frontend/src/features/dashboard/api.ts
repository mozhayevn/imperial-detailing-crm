import { apiRequest } from "@/src/lib/api/client";
import type {
  DashboardPeriod,
  DashboardSummary,
} from "@/src/features/dashboard/types";

export async function getDashboardSummary(
  period: DashboardPeriod = "7d",
): Promise<DashboardSummary> {
  const searchParams = new URLSearchParams();

  searchParams.set("period", period);

  return apiRequest<DashboardSummary>(
    `/dashboard/summary?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}