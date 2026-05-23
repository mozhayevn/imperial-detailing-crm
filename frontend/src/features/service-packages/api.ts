import { apiRequest } from "@/src/lib/api/client";
import type {
  ServicePackage,
  ServicePackageCreatePayload,
  ServicePackageOption,
  ServicePackageUpdatePayload,
} from "@/src/features/service-packages/types";

export type GetServicePackagesParams = {
  service_id?: number | null;
};

function buildServicePackagesQuery(params?: GetServicePackagesParams) {
  const searchParams = new URLSearchParams();

  if (params?.service_id) {
    searchParams.set("service_id", String(params.service_id));
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function getServicePackages(
  params?: GetServicePackagesParams,
): Promise<ServicePackage[]> {
  return apiRequest<ServicePackage[]>(
    `/service-packages/${buildServicePackagesQuery(params)}`,
    {
      method: "GET",
    },
  );
}

export async function getServicePackageById(
  packageId: number,
): Promise<ServicePackage> {
  return apiRequest<ServicePackage>(`/service-packages/${packageId}`, {
    method: "GET",
  });
}

export async function createServicePackage(
  payload: ServicePackageCreatePayload,
): Promise<ServicePackage> {
  return apiRequest<ServicePackage>("/service-packages/", {
    method: "POST",
    body: payload,
  });
}

export async function updateServicePackage(
  packageId: number,
  payload: ServicePackageUpdatePayload,
): Promise<ServicePackage> {
  return apiRequest<ServicePackage>(`/service-packages/${packageId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteServicePackage(
  packageId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/service-packages/${packageId}`, {
    method: "DELETE",
  });
}

export async function getServicePackagesByServiceId(
  serviceId: number,
): Promise<ServicePackage[]> {
  const packages = await getServicePackages({
    service_id: serviceId,
  });

  return packages.filter((item) => item.service_id === serviceId);
}

export function mapServicePackagesToOptions(
  packages: ServicePackage[],
): ServicePackageOption[] {
  return packages.map((item) => ({
    id: item.id,
    label: item.name,
    description: item.description || `Пакет услуги #${item.service_id}`,
  }));
}