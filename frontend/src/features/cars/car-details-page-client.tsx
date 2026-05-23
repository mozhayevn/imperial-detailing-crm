"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency, formatDateTime } from "@/src/lib/formatters";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getClientById } from "@/src/features/clients/api";
import type { Client } from "@/src/features/clients/types";
import { deleteCar, getCarById } from "@/src/features/cars/api";
import type { Car } from "@/src/features/cars/types";
import { getOrdersByCarId } from "@/src/features/orders/api";
import type { OrderListItem } from "@/src/features/orders/types";
import { useRouter } from "next/navigation";

type CarDetailsPageClientProps = {
  carId: number;
};

function getCarLabel(car: Car) {
  const label = `${car.brand ?? ""} ${car.model ?? ""}`.trim();

  return label || `Автомобиль #${car.id}`;
}

function getOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Новый",
    confirmed: "Подтвержден",
    in_progress: "В работе",
    completed: "Завершен",
    delivered: "Выдан",
    canceled: "Отменен",
  };

  return labels[status] ?? status;
}

function getOrderStatusTone(status: string) {
  if (status === "delivered" || status === "completed") {
    return "success";
  }

  if (status === "confirmed" || status === "in_progress") {
    return "primary";
  }

  if (status === "canceled") {
    return "danger";
  }

  return "muted";
}

export function CarDetailsPageClient({ carId }: CarDetailsPageClientProps) {
  const router = useRouter();
  const { session } = useAuth();

  const [car, setCar] = useState<Car | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadCars = canAccessByPermission(session, "cars.read");
  const canUpdateCars = canAccessByPermission(session, "cars.update");
  const canDeleteCars = canAccessByPermission(session, "cars.delete");
  const canReadClients = canAccessByPermission(session, "clients.read");
  const canCreateOrders = canAccessByPermission(session, "orders.create");

  const totalOrdersAmount = useMemo(
    () =>
      orders.reduce(
        (sum, order) => sum + Number(order.total_price ?? 0),
        0,
      ),
    [orders],
  );

  const lastOrder = orders[0] ?? null;

  useEffect(() => {
    let isMounted = true;

    async function loadCarDetails() {
      if (!canReadCars) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const carResult = await getCarById(carId);

        const [clientResult, ordersResult] = await Promise.allSettled([
          canReadClients
            ? getClientById(carResult.client_id)
            : Promise.resolve(null),
          getOrdersByCarId(carResult.id),
        ]);

        if (!isMounted) {
          return;
        }

        setCar(carResult);

        if (clientResult.status === "fulfilled") {
          setClient(clientResult.value);
        } else {
          setClient(null);
        }

        if (ordersResult.status === "fulfilled") {
          setOrders(ordersResult.value);
        } else {
          setOrders([]);
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

    void loadCarDetails();

    return () => {
      isMounted = false;
    };
  }, [carId, canReadCars, canReadClients]);

  async function handleDeleteCar() {
    if (!car) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteCar(car.id);

      router.push(client ? `/clients/${client.id}` : "/clients");
      router.refresh();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
              Загружаем карточку автомобиля...
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!canReadCars) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к карточке автомобиля. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                cars.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (error || !car) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Автомобили"
          title="Автомобиль не найден"
          description="Не удалось загрузить карточку автомобиля."
          actions={
            <Link href="/clients">
              <Button type="button" variant="secondary">
                К списку клиентов
              </Button>
            </Link>
          }
        />

        <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
          {error ?? "Автомобиль не найден"}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Автомобиль"
        title={getCarLabel(car)}
        description="Карточка автомобиля: владелец, данные авто и история заказов."
        actions={
          <div className="flex flex-wrap gap-2">
            {client ? (
              <Link href={`/clients/${client.id}`}>
                <Button type="button" variant="secondary">
                  К клиенту
                </Button>
              </Link>
            ) : (
              <Link href="/clients">
                <Button type="button" variant="secondary">
                  К клиентам
                </Button>
              </Link>
            )}

            {canUpdateCars ? (
              <Link href={`/cars/${car.id}/edit`}>
                <Button type="button" variant="secondary">
                  Редактировать авто
                </Button>
              </Link>
            ) : null}

            {canCreateOrders ? (
              <Link
                href={`/orders/new?clientId=${car.client_id}&carId=${car.id}`}
              >
                <Button type="button">Создать заказ</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Данные автомобиля</CardTitle>
              <CardDescription>
                Основная информация об автомобиле клиента.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Марка
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {car.brand || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Модель
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {car.model || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Госномер
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {car.plate_number || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Год
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {car.year ?? "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Цвет
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {car.color || "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Владелец</CardTitle>
              <CardDescription>
                Клиент, к которому привязан автомобиль.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {client ? (
                <Link
                  href={`/clients/${client.id}`}
                  className="block rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition hover:border-[hsl(var(--border-strong))]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {client.full_name}
                      </div>
                      <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                        {client.phone}
                      </div>
                    </div>

                    <Badge tone="muted">Client ID #{client.id}</Badge>
                  </div>

                  {client.preferences ? (
                    <div className="mt-3 line-clamp-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-sm leading-6 text-[hsl(var(--muted))]">
                      {client.preferences}
                    </div>
                  ) : null}
                </Link>
              ) : (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  Владелец не загружен или нет доступа к клиентам.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Сводка авто</CardTitle>
              <CardDescription>
                Быстрый обзор истории автомобиля.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Заказов
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {orders.length}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Сумма заказов
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatCurrency(totalOrdersAmount)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Последний заказ
                  </div>

                  {lastOrder ? (
                    <Link
                      href={`/orders/${lastOrder.id}`}
                      className="mt-2 block text-sm font-semibold text-white transition hover:text-[rgb(94_234_212)]"
                    >
                      Заказ #{lastOrder.id}
                    </Link>
                  ) : (
                    <div className="mt-2 text-sm text-[hsl(var(--muted))]">
                      Заказов пока нет
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {canDeleteCars ? (
            <Card className="border-[rgb(248_113_113_/_0.24)]">
              <CardHeader className="pb-3">
                <CardTitle>Опасная зона</CardTitle>
                <CardDescription>
                  Удаление доступно только для автомобиля без заказов.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {!isDeleteConfirmOpen ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isDeleting}
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    Удалить автомобиль
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                    <div className="text-sm font-semibold text-[rgb(252_165_165)]">
                      Подтвердить удаление?
                    </div>

                    <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                      Автомобиль можно удалить только если по нему нет заказов.
                      Если заказы есть, backend отклонит удаление.
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteCar()}
                      >
                        {isDeleting ? "Удаляем..." : "Да, удалить"}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isDeleting}
                        onClick={() => setIsDeleteConfirmOpen(false)}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>История заказов по автомобилю</CardTitle>
          <CardDescription>
            Все заказы, связанные с этим автомобилем.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
              По этому автомобилю пока нет заказов.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition hover:border-[hsl(var(--border-strong))]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-white">
                          Заказ #{order.id}
                        </div>

                        <Badge tone={getOrderStatusTone(order.status)}>
                          {getOrderStatusLabel(order.status)}
                        </Badge>

                        {order.pricing_locked ? (
                          <Badge tone="success">Pricing locked</Badge>
                        ) : (
                          <Badge tone="muted">Pricing open</Badge>
                        )}
                      </div>

                      <div className="mt-2 text-sm text-[hsl(var(--muted))]">
                        Создан: {formatDateTime(order.created_at)}
                      </div>

                      {order.scheduled_at ? (
                        <div className="mt-1 text-sm text-[hsl(var(--muted))]">
                          Запланирован: {formatDateTime(order.scheduled_at)}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Сумма
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {formatCurrency(order.total_price)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}