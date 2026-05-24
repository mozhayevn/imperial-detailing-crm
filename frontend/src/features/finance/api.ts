import { apiRequest } from "@/src/lib/api/client";
import type {
  FinanceCharts,
  FinanceOrderMargin,
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

export async function getFinanceOrdersMargin(
  period: FinancePeriod = "30d",
): Promise<FinanceOrderMargin[]> {
  const searchParams = new URLSearchParams();

  searchParams.set("period", period);

  return apiRequest<FinanceOrderMargin[]>(
    `/finance/orders-margin?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function getFinanceCharts(
  period: FinancePeriod = "30d",
): Promise<FinanceCharts> {
  const searchParams = new URLSearchParams();

  searchParams.set("period", period);

  return apiRequest<FinanceCharts>(
    `/finance/charts?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}