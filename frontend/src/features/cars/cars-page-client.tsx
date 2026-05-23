"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";

import { getCars } from "@/src/features/cars/api";
import type { Car } from "@/src/features/cars/types";

import { getClients } from "@/src/features/clients/api";
import type { Client } from "@/src/features/clients/types";
import { getCarTypes } from "@/src/features/car-types/api";
import type { CarType } from "@/src/features/car-types/types";



function getClientName(clients: Client[], clientId: number) {
  return clients.find((client) => client.id === clientId)?.full_name ?? `Client #${clientId}`;
}

function getClientPhone(clients: Client[], clientId: number) {
  return clients.find((client) => client.id === clientId)?.phone ?? "—";
}

function getCarTitle(car: Car) {
  return `${car.brand} ${car.model}`.trim();
}

function getPlateLabel(plateNumber: string | null | undefined) {
  return plateNumber?.trim() || "Без номера";
}

function getCarTypeName(carTypes: CarType[], carTypeId: number | null) {
  if (!carTypeId) {
    return "Без типа";
  }

  return (
    carTypes.find((carType) => carType.id === carTypeId)?.name ??
    `Тип #${carTypeId}`
  );
}

export function CarsPageClient() {
  const { session } = useAuth();

  const [cars, setCars] = useState<Car[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [carTypes, setCarTypes] = useState<CarType[]>([]);

  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadCars = canAccessByPermission(session, "cars.read");
  const canCreateCars = canAccessByPermission(session, "cars.create");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!canReadCars) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
       const [carsResult, clientsResult, carTypesResult] =
         await Promise.allSettled([getCars(), getClients(), getCarTypes()]);

        if (!isMounted) {
          return;
        }

        if (carsResult.status === "fulfilled") {
          setCars(carsResult.value);
        } else {
          setCars([]);
          setError(getApiErrorMessage(carsResult.reason));
        }

        if (clientsResult.status === "fulfilled") {
          setClients(clientsResult.value);
        } else {
          setClients([]);
        }
        if (carTypesResult.status === "fulfilled") {
          setCarTypes(carTypesResult.value);
        } else {
          setCarTypes([]);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [canReadCars]);

  const filteredCars = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return cars.filter((car) => {
      const clientName = getClientName(clients, car.client_id).toLowerCase();
      const clientPhone = getClientPhone(clients, car.client_id).toLowerCase();
      const title = getCarTitle(car).toLowerCase();
      const plate = getPlateLabel(car.plate_number).toLowerCase();
      const color = car.color?.toLowerCase() ?? "";
      const year = car.year ? String(car.year) : "";
      const carTypeName = getCarTypeName(carTypes, car.car_type_id).toLowerCase();

      return (
        !normalizedSearch ||
        title.includes(normalizedSearch) ||
        plate.includes(normalizedSearch) ||
        color.includes(normalizedSearch) ||
        year.includes(normalizedSearch) ||
        clientName.includes(normalizedSearch) ||
        clientPhone.includes(normalizedSearch) ||
        carTypeName.includes(normalizedSearch)
      );
    });
  }, [cars, clients, carTypes, search]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Автомобили"
        title="Автомобили"
        description="Машины клиентов: бренд, модель, номер, владелец и история заказов."
        actions={
          canCreateCars ? (
            <Link href="/cars/create">
              <Button type="button">Добавить автомобиль</Button>
            </Link>
          ) : null
        }
      />

      {!canReadCars ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к автомобилям. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                cars.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadCars ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Всего автомобилей
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {cars.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Найдено
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {filteredCars.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                С номером
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {cars.filter((car) => Boolean(car.plate_number)).length}
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Список автомобилей</CardTitle>
                  <CardDescription>
                    Поиск по машине, номеру, цвету, году, клиенту или телефону.
                  </CardDescription>
                </div>

                <Badge tone={cars.length > 0 ? "primary" : "muted"}>
                  {cars.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <Input
                label="Поиск"
                placeholder="Например: Toyota, Camry, 555xxx02, Nadir..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {isLoading ? (
                <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                  Загружаем автомобили...
                </div>
              ) : null}

              {!isLoading && filteredCars.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Автомобили не найдены.
                </div>
              ) : null}

              {!isLoading && filteredCars.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {filteredCars.map((car) => (
                    <div
                      key={car.id}
                      className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold text-white">
                              {getCarTitle(car)}
                            </div>

                            <Badge tone="muted">Car ID #{car.id}</Badge>

                            <Badge tone={car.plate_number ? "primary" : "muted"}>
                              {getPlateLabel(car.plate_number)}
                            </Badge>
                          </div>

                          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                            Клиент: {getClientName(clients, car.client_id)} ·{" "}
                            {getClientPhone(clients, car.client_id)}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                          <Link href={`/cars/${car.id}`}>
                            <Button type="button" variant="secondary" size="sm">
                              Открыть
                            </Button>
                          </Link>

                          <Link href={`/clients/${car.client_id}`}>
                            <Button type="button" variant="secondary" size="sm">
                              Клиент
                            </Button>
                          </Link>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Бренд
                          </div>
                          <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                            {car.brand}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Модель
                          </div>
                          <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                            {car.model}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Год / Цвет
                          </div>
                          <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                            {car.year ?? "—"} · {car.color || "—"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Тип авто
                          </div>
                          <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                            {getCarTypeName(carTypes, car.car_type_id)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}