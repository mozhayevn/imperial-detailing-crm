import { apiRequest } from "@/src/lib/api/client";
import type {
  ServicePriceRule,
  ServicePriceRuleCreatePayload,
  ServicePriceRuleFilters,
  ServicePriceRuleUpdatePayload,
} from "@/src/features/pricing-rules/types";

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}

function buildServicePriceRulesQuery(filters?: ServicePriceRuleFilters) {
  const params = new URLSearchParams();

  appendQueryParam(params, "service_id", filters?.service_id);
  appendQueryParam(params, "car_type_id", filters?.car_type_id);
  appendQueryParam(params, "material_brand_id", filters?.material_brand_id);
  appendQueryParam(params, "service_package_id", filters?.service_package_id);

  const query = params.toString();

  return query ? `?${query}` : "";
}

export async function getServicePriceRules(
  filters?: ServicePriceRuleFilters,
): Promise<ServicePriceRule[]> {
  return apiRequest<ServicePriceRule[]>(
    `/service-price-rules/${buildServicePriceRulesQuery(filters)}`,
    {
      method: "GET",
    },
  );
}

export async function getServicePriceRuleById(
  ruleId: number,
): Promise<ServicePriceRule> {
  return apiRequest<ServicePriceRule>(`/service-price-rules/${ruleId}`, {
    method: "GET",
  });
}

export async function createServicePriceRule(
  payload: ServicePriceRuleCreatePayload,
): Promise<ServicePriceRule> {
  return apiRequest<ServicePriceRule>("/service-price-rules/", {
    method: "POST",
    body: payload,
  });
}

export async function updateServicePriceRule(
  ruleId: number,
  payload: ServicePriceRuleUpdatePayload,
): Promise<ServicePriceRule> {
  return apiRequest<ServicePriceRule>(`/service-price-rules/${ruleId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteServicePriceRule(
  ruleId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/service-price-rules/${ruleId}`, {
    method: "DELETE",
  });
}