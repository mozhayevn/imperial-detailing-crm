"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Combobox } from "@/src/components/ui/combobox";
import type { Client } from "@/src/features/clients/types";
import type { Car } from "@/src/features/cars/types";
import type {
  OrderFormErrors,
  OrderFormValues,
} from "@/src/features/orders/form/types";

type OrderClientCarSectionProps = {
  values: OrderFormValues;
  errors?: OrderFormErrors;
  clients: Client[];
  cars: Car[];
  isClientsLoading?: boolean;
  isCarsLoading?: boolean;
  onChange: (values: OrderFormValues) => void;
};

function getCarLabel(car: Car) {
  return [car.brand, car.model].filter(Boolean).join(" ") || `Авто #${car.id}`;
}

function getCarDescription(car: Car) {
  return [
    car.plate_number ? `Госномер: ${car.plate_number}` : null,
    car.year ? `Год: ${car.year}` : null,
    car.color ? `Цвет: ${car.color}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function OrderClientCarSection({
  values,
  errors,
  clients,
  cars,
  isClientsLoading,
  isCarsLoading,
  onChange,
}: OrderClientCarSectionProps) {
  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        label: client.full_name,
        value: client.id,
        description: client.preferences || client.phone,
      })),
    [clients],
  );

  const carOptions = useMemo(
    () =>
      cars.map((car) => ({
        label: getCarLabel(car),
        value: car.id,
        description: getCarDescription(car) || `Авто клиента #${car.client_id}`,
      })),
    [cars],
  );

  function handleClientChange(value: string | number | null) {
    const clientId = Number(value) || null;

    onChange({
      ...values,
      client_id: clientId,
      car_id: null,
    });
  }

  function handleCarChange(value: string | number | null) {
    onChange({
      ...values,
      car_id: Number(value) || null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Клиент и автомобиль</CardTitle>
        <CardDescription>
          Выберите клиента и автомобиль, к которому относится заказ.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Combobox
              label="Клиент"
              placeholder={
                isClientsLoading ? "Загрузка клиентов..." : "Выберите клиента"
              }
              value={values.client_id}
              options={clientOptions}
              disabled={isClientsLoading}
              onChange={handleClientChange}
            />

            {errors?.client_id ? (
              <div className="mt-2 text-xs text-[hsl(var(--danger))]">
                {errors.client_id}
              </div>
            ) : null}
          </div>

          <div>
            <Combobox
              label="Автомобиль"
              placeholder={
                !values.client_id
                  ? "Сначала выберите клиента"
                  : isCarsLoading
                    ? "Загрузка автомобилей..."
                    : "Выберите автомобиль"
              }
              value={values.car_id}
              options={carOptions}
              disabled={!values.client_id || isCarsLoading}
              onChange={handleCarChange}
            />

            {errors?.car_id ? (
              <div className="mt-2 text-xs text-[hsl(var(--danger))]">
                {errors.car_id}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}