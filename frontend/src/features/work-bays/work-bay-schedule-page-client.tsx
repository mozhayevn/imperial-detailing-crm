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
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { routes } from "@/src/config/routes";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency } from "@/src/lib/formatters";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getWorkBaySchedule } from "@/src/features/work-bays/api";
import type {
  WorkBaySchedule,
  WorkBayScheduleOrder,
} from "@/src/features/work-bays/types";

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDateValue() {
  return formatDateInputValue(new Date());
}

function shiftDateValue(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  return formatDateInputValue(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Новый",
    scheduled: "Запланирован",
    in_progress: "В работе",
    waiting: "Ожидает",
    completed: "Завершен",
    delivered: "Выдан",
    canceled: "Отменен",
  };

  return labels[status] ?? status;
}

function getOrderStatusTone(status: string) {
  if (status === "in_progress") {
    return "primary";
  }

  if (status === "scheduled" || status === "waiting") {
    return "warning";
  }

  if (status === "completed" || status === "delivered") {
    return "success";
  }

  if (status === "canceled") {
    return "danger";
  }

  return "muted";
}

function getOrderDurationLabel(order: WorkBayScheduleOrder) {
  return `${formatTime(order.planned_start_at)} — ${formatTime(
    order.planned_end_at,
  )}`;
}

function ScheduleOrderCard({ order }: { order: WorkBayScheduleOrder }) {
  return (
    <Link
      href={routes.orderDetails(order.id)}
      className="block rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 transition hover:border-[hsl(var(--primary))]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={getOrderStatusTone(order.status)}>
              {getOrderStatusLabel(order.status)}
            </Badge>

            <Badge tone="muted">Заказ #{order.id}</Badge>
          </div>

          <div className="mt-3 text-sm font-semibold text-white">
            {order.client_name ?? `Клиент #${order.client_id}`}
          </div>

          <div className="mt-1 text-sm leading-6 text-[hsl(var(--muted))]">
            {order.car_label ?? `Авто #${order.car_id}`}
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <div className="text-sm font-semibold text-white">
            {getOrderDurationLabel(order)}
          </div>

          <div className="mt-1 text-xs text-[hsl(var(--muted))]">
            {formatCurrency(order.total_price)}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function WorkBaySchedulePageClient() {
  const { session } = useAuth();

  const [scheduleDate, setScheduleDate] = useState(getTodayDateValue());
  const [schedule, setSchedule] = useState<WorkBaySchedule | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadWorkBays = canAccessByPermission(session, "work_bays.read");

  const totalOrders = useMemo(() => {
    if (!schedule) {
      return 0;
    }

    const assignedOrders = schedule.bays.reduce(
      (sum, bay) => sum + bay.orders.length,
      0,
    );

    return assignedOrders + schedule.unscheduled_orders.length;
  }, [schedule]);

  const busyBaysCount = useMemo(() => {
    if (!schedule) {
      return 0;
    }

    return schedule.bays.filter((bay) => bay.orders.length > 0).length;
  }, [schedule]);

  async function loadSchedule() {
    if (!canReadWorkBays) {
      setSchedule(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getWorkBaySchedule({
        schedule_date: scheduleDate,
      });

      setSchedule(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      setSchedule(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSchedule() {
      if (!canReadWorkBays) {
        if (isMounted) {
          setSchedule(null);
          setIsLoading(false);
        }

        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const result = await getWorkBaySchedule({
          schedule_date: scheduleDate,
        });

        if (isMounted) {
          setSchedule(result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
          setSchedule(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialSchedule();

    return () => {
      isMounted = false;
    };
  }, [scheduleDate, canReadWorkBays]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Рабочие боксы"
        title="Расписание боксов"
        description="Дневное расписание заказов по рабочим боксам."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={routes.workBays}>
              <Button type="button" variant="secondary">
                К списку боксов
              </Button>
            </Link>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void loadSchedule()}
            >
              Обновить
            </Button>
          </div>
        }
      />

      {!canReadWorkBays ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к расписанию боксов. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                work_bays.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadWorkBays ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <Card>
            <CardContent>
              <div className="mt-3 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-end">
                <div>
                  <Input
                    label="Дата расписания"
                    type="date"
                    value={scheduleDate}
                    onChange={(event) => setScheduleDate(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setScheduleDate((current) => shiftDateValue(current, -1))
                    }
                  >
                    Предыдущий день
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setScheduleDate(getTodayDateValue())}
                  >
                    Сегодня
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setScheduleDate((current) => shiftDateValue(current, 1))
                    }
                  >
                    Следующий день
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Боксов
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {schedule?.bays.length ?? "—"}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                Занятых боксов
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {schedule ? busyBaysCount : "—"}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(252_211_77)]">
                Заказов в расписании
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {schedule ? totalOrders : "—"}
              </div>
            </div>
          </div>

          {isLoading ? (
            <Card className="p-8">
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[hsl(var(--primary))]" />
                <div className="mt-5 text-sm font-semibold text-white">
                  Загружаем расписание
                </div>
                <div className="mt-2 text-xs text-[hsl(var(--muted))]">
                  Получаем боксы и заказы на выбранную дату...
                </div>
              </div>
            </Card>
          ) : null}

          {!isLoading && schedule ? (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                {schedule.bays.map((bay) => (
                  <Card key={bay.id}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle>{bay.name}</CardTitle>
                          <CardDescription>
                            {bay.description || "Без описания"}
                          </CardDescription>
                        </div>

                        <Badge tone={bay.orders.length > 0 ? "warning" : "success"}>
                          {bay.orders.length > 0
                            ? `${bay.orders.length} заказ.`
                            : "Свободен"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {bay.orders.length > 0 ? (
                        <div className="space-y-3">
                          {bay.orders.map((order) => (
                            <ScheduleOrderCard key={order.id} order={order} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                          На выбранную дату в этом боксе нет заказов.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Без бокса</CardTitle>
                    <CardDescription>
                      Заказы с датой и временем, но без назначенного бокса.
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {schedule.unscheduled_orders.length > 0 ? (
                      <div className="space-y-3">
                        {schedule.unscheduled_orders.map((order) => (
                          <ScheduleOrderCard key={order.id} order={order} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                        Все заказы на эту дату распределены по боксам.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Подсказка</CardTitle>
                    <CardDescription>
                      Чтобы изменить время или бокс, откройте заказ и перейдите
                      в редактирование.
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <Link href={routes.orders}>
                      <Button type="button" variant="secondary" className="w-full">
                        Открыть заказы
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
}