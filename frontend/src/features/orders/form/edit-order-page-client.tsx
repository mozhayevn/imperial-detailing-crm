"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

import { getOrderById, updateOrder } from "@/src/features/orders/api";
import type { Order } from "@/src/features/orders/types";

import { OrderFormShell } from "@/src/features/orders/form/order-form-shell";
import { OrderClientCarSection } from "@/src/features/orders/form/order-client-car-section";
import { OrderScheduleSection } from "@/src/features/orders/form/order-schedule-section";
import { OrderItemsEditor } from "@/src/features/orders/form/order-items-editor";

import { createDefaultOrderFormValues } from "@/src/features/orders/form/defaults";
import { getOrderFormSubmitErrorMessage } from "@/src/features/orders/form/order-form-errors";
import {
  mapFormValuesToUpdatePayload,
  mapOrderToFormValues,
} from "@/src/features/orders/form/mappers";
import {
  getFirstOrderFormError,
  validateOrderForm,
} from "@/src/features/orders/form/validation";
import type {
  OrderFormErrors,
  OrderFormValues,
} from "@/src/features/orders/form/types";

export function EditOrderPageClient() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();

  const orderIdParam = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  const orderId = Number(orderIdParam);
  const canUpdateOrders = canAccessByPermission(session, "orders.update");

  const [order, setOrder] = useState<Order | null>(null);

  const [values, setValues] = useState<OrderFormValues>(() =>
    createDefaultOrderFormValues(),
  );

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

  const [isInitialLoading, setIsInitialLoading] = useState(true);
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

  function handleValuesChange(nextValues: OrderFormValues) {
    setValues(nextValues);
    setErrors({});
    setSubmitError(null);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialOrder() {
      if (!Number.isFinite(orderId) || orderId <= 0) {
        setSubmitError("Некорректный номер заказа");
        setIsInitialLoading(false);
        return;
      }

      if (!canUpdateOrders) {
        setIsInitialLoading(false);
        return;
      }

      setIsInitialLoading(true);
      setSubmitError(null);

      try {
        const orderData = await getOrderById(orderId);

        if (!isMounted) {
          return;
        }

        setOrder(orderData);
        setValues(mapOrderToFormValues(orderData));
      } catch (loadError) {
        if (isMounted) {
          setSubmitError(getApiErrorMessage(loadError));
          setOrder(null);
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    }

    void loadInitialOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, canUpdateOrders]);

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      if (!canUpdateOrders) {
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
  }, [canUpdateOrders]);

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

    if (!order) {
      setSubmitError("Заказ не загружен");
      return;
    }

    if (order.pricing_locked) {
      setSubmitError(
        "Pricing зафиксирован. Чтобы редактировать заказ, сначала нужен unlock flow.",
      );
      return;
    }

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
      const payload = mapFormValuesToUpdatePayload(values);
      const updatedOrder = await updateOrder(order.id, payload);

      router.push(routes.orderDetails(updatedOrder.id));
      router.refresh();
    } catch (updateError) {
      setSubmitError(getOrderFormSubmitErrorMessage(updateError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canUpdateOrders) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card className="border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-sm font-semibold text-[rgb(252_165_165)]">
                Нет доступа к редактированию заказа
              </h1>
              <p className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                Для редактирования заказа нужен permission{" "}
                <span className="font-semibold">orders.update</span>.
              </p>
            </div>

            <Link href={routes.orderDetails(orderId)}>
              <Button variant="secondary">Вернуться к заказу</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card className="p-8">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[hsl(var(--primary))]" />
            <div className="mt-5 text-sm font-semibold text-white">
              Загружаем заказ
            </div>
            <div className="mt-2 text-xs text-[hsl(var(--muted))]">
              Подготавливаем форму редактирования...
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card className="border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-sm font-semibold text-[rgb(252_165_165)]">
                Не удалось открыть заказ
              </h1>
              <p className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                {submitError ?? "Заказ не найден"}
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

  if (order.pricing_locked) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card className="border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-sm font-semibold text-[rgb(252_211_77)]">
                Редактирование заблокировано
              </h1>
              <p className="mt-2 text-sm leading-6 text-[rgb(252_211_77_/_0.82)]">
                Pricing по этому заказу уже зафиксирован. Чтобы изменить заказ,
                сначала нужен unlock flow.
              </p>
            </div>

            <Link href={routes.orderDetails(order.id)}>
              <Button variant="secondary">Вернуться к заказу</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <OrderFormShell
      mode="edit"
      title={`Редактирование заказа #${order.id}`}
      description="Измените планирование, исполнителя, состав услуг, количество, пакет, бренд материала или скидку. Existing order item ID сохраняется для backend-safe update workflow."
      error={submitError ?? lookupError}
      isSubmitting={isSubmitting}
      submitLabel="Сохранить изменения"
      onSubmit={handleSubmit}
      onCancel={() => router.push(routes.orderDetails(order.id))}
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
        orderId={order.id}
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
        services={services}
        materialBrands={activeMaterialBrands}
        servicePackages={servicePackages}
        isLookupsLoading={isLookupsLoading}
        onChange={handleValuesChange}
      />
    </OrderFormShell>
  );
}