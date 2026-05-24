import { apiRequest } from "@/src/lib/api/client";
import type {
  FinanceOverview,
  FinancePeriod,
} from "@/src/features/finance/types";

export async function getFinanceOverview(
  period: FinancePeriod = "30d",
): Promise<FinanceOverview> {
  const searchParams = new URLSearchParams();

  searchParams.set("period", period);

  return apiRequest<FinanceOverview>(
    `/finance/overview?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}