import { apiRequest } from "@/src/lib/api/client";
import type {
  Service,
  ServiceCreatePayload,
  ServiceSearchOption,
  ServiceUpdatePayload,
} from "@/src/features/services/types";

export async function getServices(): Promise<Service[]> {
  return apiRequest<Service[]>("/services/", {
    method: "GET",
  });
}

export async function getServiceById(serviceId: number): Promise<Service> {
  return apiRequest<Service>(`/services/${serviceId}`, {
    method: "GET",
  });
}

export async function createService(
  payload: ServiceCreatePayload,
): Promise<Service> {
  return apiRequest<Service>("/services/", {
    method: "POST",
    body: payload,
  });
}

export async function updateService(
  serviceId: number,
  payload: ServiceUpdatePayload,
): Promise<Service> {
  return apiRequest<Service>(`/services/${serviceId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteService(
  serviceId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/services/${serviceId}`, {
    method: "DELETE",
  });
}

export function filterServicesBySearch(
  services: Service[],
  searchValue: string,
): ServiceSearchOption[] {
  const query = searchValue.trim().toLowerCase();

  const filteredServices = query
    ? services.filter((service) => {
        const name = service.name.toLowerCase();
        const description = service.description?.toLowerCase() ?? "";

        return name.includes(query) || description.includes(query);
      })
    : services;

  return filteredServices.map((service) => {
    const requirements = [
      service.requires_brand ? "нужен бренд" : null,
      service.requires_package ? "нужен пакет" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const description = [service.description ?? null, requirements || null]
      .filter(Boolean)
      .join(" · ");

    return {
      id: service.id,
      label: service.name,
      description: description || "Услуга без описания",
      requires_brand: service.requires_brand,
      requires_package: service.requires_package,
    };
  });
}