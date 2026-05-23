import { apiRequest } from "@/src/lib/api/client";
import type { Car, CarSearchOption } from "@/src/features/cars/types";

type GetCarsParams = {
  client_id?: number | null;
};

function buildCarsQuery(params?: GetCarsParams) {
  const searchParams = new URLSearchParams();

  if (params?.client_id) {
    searchParams.set("client_id", String(params.client_id));
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function getCars(params?: GetCarsParams): Promise<Car[]> {
  return apiRequest<Car[]>(`/cars/${buildCarsQuery(params)}`, {
    method: "GET",
  });
}

export async function getCarById(carId: number): Promise<Car> {
  return apiRequest<Car>(`/cars/${carId}`, {
    method: "GET",
  });
}

export async function getCarsByClientId(clientId: number): Promise<Car[]> {
  const cars = await getCars({
    client_id: clientId,
  });

  return cars.filter((car) => car.client_id === clientId);
}

export async function updateCar(
  carId: number,
  payload: {
    client_id?: number;
    car_type_id?: number | null;
    brand?: string;
    model?: string;
    year?: number | null;
    plate_number?: string | null;
    color?: string | null;
  },
): Promise<Car> {
  return apiRequest<Car>(`/cars/${carId}`, {
    method: "PUT",
    body: payload,
  });
}

export function mapCarsToOptions(cars: Car[]): CarSearchOption[] {
  return cars.map((car) => {
    const label = [car.brand, car.model].filter(Boolean).join(" ");
    const details = [
      car.plate_number ? `Госномер: ${car.plate_number}` : null,
      car.year ? `Год: ${car.year}` : null,
      car.color ? `Цвет: ${car.color}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      id: car.id,
      label: label || `Авто #${car.id}`,
      description: details || `Авто клиента #${car.client_id}`,
    };
  });
}

export async function createCar(payload: {
  client_id: number;
  car_type_id: number | null;
  brand: string;
  model: string;
  year: number | null;
  plate_number: string | null;
  color: string | null;
}): Promise<Car> {
  return apiRequest<Car>("/cars/", {
    method: "POST",
    body: payload,
  });
}

export async function deleteCar(carId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/cars/${carId}`, {
    method: "DELETE",
  });
}