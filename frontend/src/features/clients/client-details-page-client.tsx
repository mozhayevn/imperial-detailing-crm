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
import {
  getClientById,
  getClientCars,
  getClientHistory,
  getClientOrders,
} from "@/src/features/clients/api";
import type { Client, ClientHistoryItem } from "@/src/features/clients/types";
import type { Car } from "@/src/features/cars/types";
import type { Order } from "@/src/features/orders/types";

type ClientDetailsPageClientProps = {
  clientId: number;
};

function getClientInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "К";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatBirthDate(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizePhoneForHref(phone: string | null | undefined) {
  if (!phone) {
    return "";
  }

  return phone.replace(/[^\d+]/g, "");
}

function normalizePhoneForWhatsapp(phone: string | null | undefined) {
  if (!phone) {
    return "";
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("8") && digits.length === 11) {
    return `7${digits.slice(1)}`;
  }

  return digits;
}

function getCarLabel(car: Car) {
  const brand = car.brand ?? "";
  const model = car.model ?? "";
  const label = `${brand} ${model}`.trim();

  return label || `Автомобиль #${car.id}`;
}

function getCarOrdersStats(carId: number, orders: Order[]) {
  const carOrders = orders.filter((order) => order.car_id === carId);

  const totalAmount = carOrders.reduce(
    (sum, order) => sum + Number(order.total_price ?? 0),
    0,
  );

  const lastOrder = carOrders[0] ?? null;

  return {
    ordersCount: carOrders.length,
    totalAmount,
    lastOrder,
  };
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

  if (status === "in_progress" || status === "confirmed") {
    return "primary";
  }

  if (status === "canceled") {
    return "danger";
  }

  return "muted";
}

export function ClientDetailsPageClient({
  clientId,
}: ClientDetailsPageClientProps) {
  const { session } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [history, setHistory] = useState<ClientHistoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadClients = canAccessByPermission(session, "clients.read");
  const canUpdateClients = canAccessByPermission(session, "clients.update");
  const canCreateCars = canAccessByPermission(session, "cars.create");
  const canCreateOrders = canAccessByPermission(session, "orders.create");

  const totalOrdersAmount = useMemo(
    () =>
      history.reduce(
        (sum, item) => sum + Number(item.total_price ?? 0),
        0,
      ),
    [history],
  );

  const lastOrder = history[0] ?? null;

  const averageOrderAmount =
    history.length > 0 ? totalOrdersAmount / history.length : 0;

  const phoneHref = normalizePhoneForHref(client?.phone);
  const whatsappPhone = normalizePhoneForWhatsapp(client?.phone);

  const lastVisitText = lastOrder
    ? formatShortDateTime(lastOrder.created_at)
    : "Визитов пока нет";

  useEffect(() => {
    let isMounted = true;

    async function loadClientDetails() {
      if (!canReadClients) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [clientResult, carsResult, historyResult, ordersResult] =
          await Promise.allSettled([
            getClientById(clientId),
            getClientCars(clientId),
            getClientHistory(clientId),
            getClientOrders(clientId),
          ]);

        if (!isMounted) {
          return;
        }

        if (clientResult.status === "fulfilled") {
          setClient(clientResult.value);
        } else {
          throw clientResult.reason;
        }

        if (carsResult.status === "fulfilled") {
          setCars(carsResult.value);
        } else {
          setCars([]);
        }

        if (historyResult.status === "fulfilled") {
          setHistory(historyResult.value);
        } else {
          setHistory([]);
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

    void loadClientDetails();

    return () => {
      isMounted = false;
    };
  }, [clientId, canReadClients]);

  if (isLoading) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
              Загружаем карточку клиента...
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!canReadClients) {
    return (
      <PageContainer>
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к карточке клиента. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                clients.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (error || !client) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Клиенты"
          title="Клиент не найден"
          description="Не удалось загрузить карточку клиента."
          actions={
            <Link href="/clients">
              <Button type="button" variant="secondary">
                К списку клиентов
              </Button>
            </Link>
          }
        />

        <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
          {error ?? "Клиент не найден"}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Клиент"
        title={client.full_name}
        description="Карточка клиента: контактные данные, автомобили и история заказов."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/clients">
              <Button type="button" variant="secondary">
                К списку клиентов
              </Button>
            </Link>

            {canUpdateClients ? (
              <Link href={`/clients/${client.id}/edit`}>
                <Button type="button" variant="secondary">
                  Редактировать
                </Button>
              </Link>
            ) : null}

            {canCreateOrders ? (
              <Link href={`/orders/new?clientId=${client.id}`}>
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
              <CardTitle>Данные клиента</CardTitle>
              <CardDescription>
                Основная информация для коммуникации и приемки автомобиля.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[rgb(45_212_191_/_0.12)] text-lg font-semibold text-[rgb(94_234_212)]">
                  {getClientInitials(client.full_name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xl font-semibold text-white">
                      {client.full_name}
                    </div>

                    <Badge tone="muted">Client ID #{client.id}</Badge>
                  </div>

                  <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                    {client.phone}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Дата рождения
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {formatBirthDate(client.birth_date)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Телефон
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {client.phone}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                      Предпочтения клиента
                    </div>

                    {client.preferences ? (
                      <div className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                        {client.preferences}
                      </div>
                    ) : (
                      <div className="text-sm leading-6 text-[hsl(var(--muted))]">
                        Предпочтения пока не указаны. Можно добавить важные
                        детали: удобный канал связи, любимые услуги, особенности
                        общения или пожелания по авто.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Автомобили клиента</CardTitle>
                  <CardDescription>
                    Машины, закрепленные за клиентом.
                  </CardDescription>
                </div>

                {canCreateCars ? (
                  <Link href={`/cars/new?clientId=${client.id}`}>
                    <Button type="button" variant="secondary" size="sm">
                      Добавить авто
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              {cars.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                  У клиента пока нет автомобилей.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {cars.map((car) => {
                    const stats = getCarOrdersStats(car.id, orders);

                    return (
                      <Link
                        key={car.id}
                        href={`/cars/${car.id}`}
                        className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition hover:border-[hsl(var(--border-strong))]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-white">
                              {getCarLabel(car)}
                            </div>
                            <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                              {car.plate_number ?? "Госномер не указан"}
                            </div>
                          </div>

                          <Badge tone="muted">Auto #{car.id}</Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                            <div className="text-xs text-[hsl(var(--muted))]">
                              Год
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {car.year ?? "—"}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                            <div className="text-xs text-[hsl(var(--muted))]">
                              Цвет
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {car.color ?? "—"}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                            <div className="text-xs text-[hsl(var(--muted))]">
                              Заказов
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {stats.ordersCount}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                            <div className="text-xs text-[hsl(var(--muted))]">
                              Сумма
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {formatCurrency(stats.totalAmount)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Последний заказ
                          </div>

                          {stats.lastOrder ? (
                            <div className="mt-1 text-sm font-semibold text-white">
                              Заказ #{stats.lastOrder.id}
                            </div>
                          ) : (
                            <div className="mt-1 text-sm text-[hsl(var(--muted))]">
                              Заказов пока нет
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Связь с клиентом</CardTitle>
              <CardDescription>Быстрые действия для менеджера.</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Телефон
                  </div>

                  <div className="mt-2 text-base font-semibold text-white">
                    {client.phone}
                  </div>
                </div>

                <div className="grid gap-2">
                  {phoneHref ? (
                    <a href={`tel:${phoneHref}`} className="block">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                      >
                        Позвонить
                      </Button>
                    </a>
                  ) : null}

                  {whatsappPhone ? (
                    <a
                      href={`https://wa.me/${whatsappPhone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                      >
                        Написать в WhatsApp
                      </Button>
                    </a>
                  ) : null}

                  {canCreateOrders ? (
                    <Link href={`/orders/new?clientId=${client.id}`}>
                      <Button type="button" className="w-full">
                        Создать заказ
                      </Button>
                    </Link>
                  ) : null}

                  {canCreateCars ? (
                    <Link href={`/cars/new?clientId=${client.id}`}>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                      >
                        Добавить автомобиль
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Сводка клиента</CardTitle>
              <CardDescription>
                Быстрый обзор активности клиента.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Автомобилей
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {cars.length}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Заказов
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {history.length}
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
                    Средний чек
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatCurrency(averageOrderAmount)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Последний визит
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {lastVisitText}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Последний заказ
                  </div>

                  {lastOrder ? (
                    <Link
                      href={`/orders/${lastOrder.order_id}`}
                      className="mt-2 block text-sm font-semibold text-white transition hover:text-[rgb(94_234_212)]"
                    >
                      Заказ #{lastOrder.order_id}
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
        </aside>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>История заказов</CardTitle>
          <CardDescription>
            Все заказы клиента и основные данные по ним.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
              У клиента пока нет заказов.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <Link
                  key={item.order_id}
                  href={`/orders/${item.order_id}`}
                  className="block rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition hover:border-[hsl(var(--border-strong))]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-white">
                          Заказ #{item.order_id}
                        </div>

                        <Badge tone={getOrderStatusTone(item.status)}>
                          {getOrderStatusLabel(item.status)}
                        </Badge>

                        <Badge tone="muted">Позиций: {item.items_count}</Badge>
                      </div>

                      <div className="mt-2 text-sm text-[hsl(var(--muted))]">
                        Создан: {formatDateTime(item.created_at)}
                      </div>

                      {item.scheduled_at ? (
                        <div className="mt-1 text-sm text-[hsl(var(--muted))]">
                          Запланирован: {formatDateTime(item.scheduled_at)}
                        </div>
                      ) : null}

                      {item.comment ? (
                        <div className="mt-3 line-clamp-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                          {item.comment}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Сумма
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {formatCurrency(item.total_price)}
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