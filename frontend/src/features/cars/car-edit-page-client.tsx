"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Combobox } from "@/src/components/ui/combobox";
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getClients } from "@/src/features/clients/api";
import type { Client } from "@/src/features/clients/types";
import { getCarById, updateCar } from "@/src/features/cars/api";
import type { Car } from "@/src/features/cars/types";

type CarEditPageClientProps = {
  carId: number;
};

type CarEditForm = {
  client_id: number | null;
  brand: string;
  model: string;
  year: string;
  plate_number: string;
  color: string;
};

const defaultForm: CarEditForm = {
  client_id: null,
  brand: "",
  model: "",
  year: "",
  plate_number: "",
  color: "",
};

function mapCarToForm(car: Car): CarEditForm {
  return {
    client_id: car.client_id,
    brand: car.brand ?? "",
    model: car.model ?? "",
    year: car.year ? String(car.year) : "",
    plate_number: car.plate_number ?? "",
    color: car.color ?? "",
  };
}

function getCarLabel(car: Car) {
  const label = `${car.brand ?? ""} ${car.model ?? ""}`.trim();

  return label || `Автомобиль #${car.id}`;
}

export function CarEditPageClient({ carId }: CarEditPageClientProps) {
  const router = useRouter();
  const { session } = useAuth();

  const [car, setCar] = useState<Car | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<CarEditForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadCars = canAccessByPermission(session, "cars.read");
  const canUpdateCars = canAccessByPermission(session, "cars.update");
  const canReadClients = canAccessByPermission(session, "clients.read");

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: String(client.id),
        label: `${client.full_name} · ${client.phone}`,
      })),
    [clients],
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  );

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
        const [carResult, clientsResult] = await Promise.allSettled([
          getCarById(carId),
          canReadClients ? getClients() : Promise.resolve([]),
        ]);

        if (!isMounted) {
          return;
        }

        if (carResult.status === "fulfilled") {
          setCar(carResult.value);
          setForm(mapCarToForm(carResult.value));
        } else {
          throw carResult.reason;
        }

        if (clientsResult.status === "fulfilled") {
          setClients(clientsResult.value);
        } else {
          setClients([]);
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
  }, [carId, canReadCars, canReadClients]);

  function updateForm(patch: Partial<CarEditForm>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  async function handleSubmit() {
    if (!form.client_id) {
      setError("Выберите клиента.");
      return;
    }

    if (!form.brand.trim()) {
      setError("Укажите марку автомобиля.");
      return;
    }

    if (!form.model.trim()) {
      setError("Укажите модель автомобиля.");
      return;
    }

    const year = form.year.trim() ? Number(form.year.trim()) : null;

    if (
      year !== null &&
      (!Number.isInteger(year) ||
        year < 1950 ||
        year > new Date().getFullYear() + 1)
    ) {
      setError("Укажите корректный год автомобиля.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updatedCar = await updateCar(carId, {
        client_id: form.client_id,
        car_type_id: null,
        brand: form.brand.trim(),
        model: form.model.trim(),
        year,
        plate_number: form.plate_number.trim() || null,
        color: form.color.trim() || null,
      });

      router.push(`/cars/${updatedCar.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
              Загружаем данные автомобиля...
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!canReadCars || !canUpdateCars) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к редактированию автомобиля. Нужны permissions{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                cars.read
              </span>{" "}
              и{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                cars.update
              </span>
              .
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (error && !car) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Автомобили"
          title="Автомобиль не найден"
          description="Не удалось загрузить данные автомобиля для редактирования."
          actions={
            <Link href="/clients">
              <Button type="button" variant="secondary">
                К списку клиентов
              </Button>
            </Link>
          }
        />

        <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
          {error}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Автомобили"
        title="Редактировать автомобиль"
        description={
          car
            ? `Изменение данных автомобиля ${getCarLabel(car)}.`
            : "Изменение данных автомобиля."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {car ? (
              <Link href={`/cars/${car.id}`}>
                <Button type="button" variant="secondary">
                  Назад к авто
                </Button>
              </Link>
            ) : null}

            {selectedClient ? (
              <Link href={`/clients/${selectedClient.id}`}>
                <Button type="button" variant="secondary">
                  К клиенту
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Данные автомобиля</CardTitle>
          <CardDescription>
            Измените владельца, марку, модель, год, госномер и цвет автомобиля.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Combobox
              label="Клиент"
              placeholder="Выберите клиента"
              value={form.client_id ? String(form.client_id) : ""}
              options={clientOptions}
              onChange={(value) =>
                updateForm({
                  client_id: value ? Number(value) : null,
                })
              }
            />

            <Input
              label="Госномер"
              placeholder="Например: 555XXX02"
              value={form.plate_number}
              onChange={(event) =>
                updateForm({
                  plate_number: event.target.value,
                })
              }
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Input
              label="Марка"
              placeholder="Например: Toyota"
              value={form.brand}
              onChange={(event) =>
                updateForm({
                  brand: event.target.value,
                })
              }
            />

            <Input
              label="Модель"
              placeholder="Например: Camry 70"
              value={form.model}
              onChange={(event) =>
                updateForm({
                  model: event.target.value,
                })
              }
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Input
              label="Год"
              placeholder="Например: 2024"
              inputMode="numeric"
              maxLength={4}
              value={form.year}
              onChange={(event) =>
                updateForm({
                  year: event.target.value.replace(/\D/g, "").slice(0, 4),
                })
              }
            />

            <Input
              label="Цвет"
              placeholder="Например: black"
              value={form.color}
              onChange={(event) =>
                updateForm({
                  color: event.target.value,
                })
              }
            />
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link href={car ? `/cars/${car.id}` : "/clients"}>
              <Button type="button" variant="secondary">
                Отмена
              </Button>
            </Link>

            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Сохраняем..." : "Сохранить изменения"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}