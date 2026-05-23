"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { routes } from "@/src/config/routes";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { useAuth } from "@/src/features/auth/use-auth";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";

import { getClients } from "@/src/features/clients/api";
import type { Client } from "@/src/features/clients/types";

import { getCarsByClientId } from "@/src/features/cars/api";
import type { Car } from "@/src/features/cars/types";

import { getServices } from "@/src/features/services/api";
import type { Service } from "@/src/features/services/types";

import { getServicePackages } from "@/src/features/service-packages/api";
import type { ServicePackage } from "@/src/features/service-packages/types";

import { getMaterialBrands } from "@/src/features/material-brands/api";
import type { MaterialBrand } from "@/src/features/material-brands/types";

import { getWorkBays } from "@/src/features/work-bays/api";
import type { WorkBay } from "@/src/features/work-bays/types";

import { getUsersWithRoles } from "@/src/features/users/api";
import type { UserWithRoles } from "@/src/features/users/types";

import { createOrder } from "@/src/features/orders/api";
import { OrderFormShell } from "@/src/features/orders/form/order-form-shell";
import { OrderClientCarSection } from "@/src/features/orders/form/order-client-car-section";
import { OrderScheduleSection } from "@/src/features/orders/form/order-schedule-section";
import { OrderItemsEditor } from "@/src/features/orders/form/order-items-editor";
import { createDefaultOrderFormValues } from "@/src/features/orders/form/defaults";
import { mapFormValuesToCreatePayload } from "@/src/features/orders/form/mappers";
import {
  getFirstOrderFormError,
  validateOrderForm,
} from "@/src/features/orders/form/validation";
import type {
  OrderFormErrors,
  OrderFormValues,
} from "@/src/features/orders/form/types";

export function NewOrderPageClient() {
  const router = useRouter();
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId");
  const preselectedCarId = searchParams.get("carId");

  const canCreateOrders = canAccessByPermission(session, "orders.create");

  const [values, setValues] = useState<OrderFormValues>(() =>
    createDefaultOrderFormValues(),
  );

  useEffect(() => {
    if (!preselectedClientId) {
      return;
    }

    const clientId = Number(preselectedClientId);
    const carId = preselectedCarId ? Number(preselectedCarId) : null;

    if (!Number.isFinite(clientId)) {
      return;
    }

    if (carId !== null && !Number.isFinite(carId)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setValues((current) => {
        const nextCarId = carId ?? current.car_id ?? null;

        if (current.client_id === clientId && current.car_id === nextCarId) {
          return current;
        }

        return {
          ...current,
          client_id: clientId,
          car_id: nextCarId,
        };
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [preselectedClientId, preselectedCarId]);

  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
  const [materialBrands, setMaterialBrands] = useState<MaterialBrand[]>([]);
  const [workBays, setWorkBays] = useState<WorkBay[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);

  const [isLookupsLoading, setIsLookupsLoading] = useState(true);
  const [isCarsLoading, setIsCarsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const masters = useMemo(
    () =>
      users.filter(
        (user) => user.is_active && user.roles.includes("master"),
      ),
    [users],
  );

  const activeMaterialBrands = useMemo(
    () => materialBrands.filter((brand) => brand.is_active !== false),
    [materialBrands],
  );

  const activeServices = useMemo(
    () => services.filter((service) => service.is_active !== false),
    [services],
  );

  function handleValuesChange(nextValues: OrderFormValues) {
    setValues(nextValues);
    setErrors({});
    setSubmitError(null);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      if (!canCreateOrders) {
        setIsLookupsLoading(false);
        return;
      }

      setIsLookupsLoading(true);
      setLookupError(null);

      try {
        const [
          clientsResult,
          servicesResult,
          packagesResult,
          brandsResult,
          workBaysResult,
          usersResult,
        ] = await Promise.allSettled([
          getClients(),
          getServices(),
          getServicePackages(),
          getMaterialBrands(),
          getWorkBays(),
          getUsersWithRoles(),
        ]);

        if (!isMounted) {
          return;
        }

        if (clientsResult.status === "fulfilled") {
          setClients(clientsResult.value);
        } else {
          setLookupError("Не удалось загрузить список клиентов");
        }

        if (servicesResult.status === "fulfilled") {
          setServices(servicesResult.value);
        } else {
          setLookupError("Не удалось загрузить список услуг");
        }

        if (packagesResult.status === "fulfilled") {
          setServicePackages(packagesResult.value);
        }

        if (brandsResult.status === "fulfilled") {
          setMaterialBrands(brandsResult.value);
        }

        if (workBaysResult.status === "fulfilled") {
          setWorkBays(workBaysResult.value);
        }

        if (usersResult.status === "fulfilled") {
          setUsers(usersResult.value);
        }
      } catch (loadError) {
        if (isMounted) {
          setLookupError(getApiErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLookupsLoading(false);
        }
      }
    }

    void loadLookups();

    return () => {
      isMounted = false;
    };
  }, [canCreateOrders]);

  useEffect(() => {
    let isMounted = true;

    async function loadCars() {
      if (!values.client_id) {
        setCars([]);
        return;
      }

      setIsCarsLoading(true);

      try {
        const data = await getCarsByClientId(values.client_id);

        if (isMounted) {
          setCars(data);
        }
      } catch {
        if (isMounted) {
          setCars([]);
        }
      } finally {
        if (isMounted) {
          setIsCarsLoading(false);
        }
      }
    }

    void loadCars();

    return () => {
      isMounted = false;
    };
  }, [values.client_id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateOrderForm(values, {
      services,
    });

    setErrors(validation.errors);

    if (!validation.isValid) {
      setSubmitError(
        getFirstOrderFormError(validation.errors) ??
          "Проверьте обязательные поля заказа",
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = mapFormValuesToCreatePayload(values);
      const createdOrder = await createOrder(payload);

      router.push(routes.orderDetails(createdOrder.id));
      router.refresh();
    } catch (createError) {
      setSubmitError(getApiErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canCreateOrders) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card className="border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-sm font-semibold text-[rgb(252_165_165)]">
                Нет доступа к созданию заказов
              </h1>
              <p className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                Для создания заказа нужен permission{" "}
                <span className="font-semibold">orders.create</span>.
              </p>
            </div>

            <Link href={routes.orders}>
              <Button variant="secondary">Вернуться к заказам</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <OrderFormShell
      mode="create"
      title="Новый заказ"
      description="Создайте заказ, выберите клиента, автомобиль, бокс, мастера и позиции услуг. Фактический расход материалов добавляется после создания заказа к конкретной позиции."
      error={submitError ?? lookupError}
      isSubmitting={isSubmitting}
      submitLabel="Создать заказ"
      onSubmit={handleSubmit}
      onCancel={() => router.push(routes.orders)}
    >
      <OrderClientCarSection
        values={values}
        errors={errors}
        clients={clients}
        cars={cars}
        isClientsLoading={isLookupsLoading}
        isCarsLoading={isCarsLoading}
        onChange={handleValuesChange}
      />

      <OrderScheduleSection
        values={values}
        errors={errors}
        workBays={workBays}
        masters={masters}
        isLookupsLoading={isLookupsLoading}
        onChange={handleValuesChange}
      />

      <OrderItemsEditor
        values={values}
        errors={errors}
        services={activeServices}
        materialBrands={activeMaterialBrands}
        servicePackages={servicePackages}
        isLookupsLoading={isLookupsLoading}
        onChange={handleValuesChange}
      />
    </OrderFormShell>
  );
}