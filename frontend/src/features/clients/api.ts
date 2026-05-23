import { apiRequest } from "@/src/lib/api/client";
import type { Car } from "@/src/features/cars/types";
import type { Order } from "@/src/features/orders/types";
import type {
  Client,
  ClientCreatePayload,
  ClientHistoryItem,
  ClientSearchParams,
  ClientUpdatePayload,
} from "@/src/features/clients/types";

function buildClientSearchQuery(params: ClientSearchParams) {
  const searchParams = new URLSearchParams();

  if (params.phone?.trim()) {
    searchParams.set("phone", params.phone.trim());
  }

  if (params.full_name?.trim()) {
    searchParams.set("full_name", params.full_name.trim());
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function getClients(): Promise<Client[]> {
  return apiRequest<Client[]>("/clients/", {
    method: "GET",
  });
}

export async function searchClients(
  params: ClientSearchParams,
): Promise<Client[]> {
  return apiRequest<Client[]>(
    `/clients/search${buildClientSearchQuery(params)}`,
    {
      method: "GET",
    },
  );
}

export async function getClientById(clientId: number): Promise<Client> {
  return apiRequest<Client>(`/clients/${clientId}`, {
    method: "GET",
  });
}

export async function createClient(
  payload: ClientCreatePayload,
): Promise<Client> {
  return apiRequest<Client>("/clients/", {
    method: "POST",
    body: payload,
  });
}

export async function updateClient(
  clientId: number,
  payload: ClientUpdatePayload,
): Promise<Client> {
  return apiRequest<Client>(`/clients/${clientId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteClient(
  clientId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/clients/${clientId}`, {
    method: "DELETE",
  });
}

export async function getClientCars(clientId: number): Promise<Car[]> {
  return apiRequest<Car[]>(`/clients/${clientId}/cars`, {
    method: "GET",
  });
}

export async function getClientOrders(clientId: number): Promise<Order[]> {
  return apiRequest<Order[]>(`/clients/${clientId}/orders`, {
    method: "GET",
  });
}

export async function getClientHistory(
  clientId: number,
): Promise<ClientHistoryItem[]> {
  return apiRequest<ClientHistoryItem[]>(`/clients/${clientId}/history`, {
    method: "GET",
  });
}