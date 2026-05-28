"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Combobox } from "@/src/components/ui/combobox";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import type { WorkBay } from "@/src/features/work-bays/types";
import type { UserWithRoles } from "@/src/features/users/types";
import type {
  OrderFormErrors,
  OrderFormValues,
} from "@/src/features/orders/form/types";
import { DateTimeInput } from "@/src/components/ui/date-time-input";
import { routes } from "@/src/config/routes";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { getAvailableWorkBays } from "@/src/features/work-bays/api";

type OrderScheduleSectionProps = {
  orderId?: number | null;
  values: OrderFormValues;
  errors?: OrderFormErrors;
  workBays: WorkBay[];
  masters: UserWithRoles[];
  isLookupsLoading?: boolean;
  onChange: (values: OrderFormValues) => void;
};

export function OrderScheduleSection({
  orderId,
  values,
  errors,
  workBays,
  masters,
  isLookupsLoading,
  onChange,
}: OrderScheduleSectionProps) {
  const workBayOptions = useMemo(
    () =>
      workBays.map((bay) => ({
        label: bay.name,
        value: bay.id,
        description: bay.description || "Рабочий бокс",
      })),
    [workBays],
  );

  const masterOptions = useMemo(
    () =>
      masters.map((master) => ({
        label: master.full_name,
        value: master.id,
        description: master.email,
      })),
    [masters],
  );

  const canSelectMaster = masters.length > 0;

  const [conflictingOrderId, setConflictingOrderId] = useState<number | null>(
    null,
  );
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  function toApiDateTime(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      return "";
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
      return `${normalized}:00`;
    }

    return normalized;
  }

  useEffect(() => {
    let isMounted = true;

    async function checkAvailability() {
      setConflictingOrderId(null);
      setAvailabilityError(null);

      if (
        !values.work_bay_id ||
        !values.planned_start_at ||
        !values.planned_end_at
      ) {
        return;
      }

      const startDate = new Date(values.planned_start_at);
      const endDate = new Date(values.planned_end_at);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return;
      }

      if (startDate >= endDate) {
        setAvailabilityError("Плановое окончание должно быть позже начала.");
        return;
      }

      setIsCheckingAvailability(true);

      try {
        const result = await getAvailableWorkBays({
          planned_start_at: toApiDateTime(values.planned_start_at),
          planned_end_at: toApiDateTime(values.planned_end_at),
          exclude_order_id: orderId ?? null,
        });

        if (!isMounted) {
          return;
        }

        const selectedBayAvailability = result.find(
          (item) => item.id === values.work_bay_id,
        );

        if (
          selectedBayAvailability &&
          !selectedBayAvailability.is_available &&
          selectedBayAvailability.conflicting_order_id
        ) {
          setConflictingOrderId(selectedBayAvailability.conflicting_order_id);
        }
      } catch (error) {
        if (isMounted) {
          setAvailabilityError(getApiErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsCheckingAvailability(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void checkAvailability();
    }, 350);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    orderId,
    values.work_bay_id,
    values.planned_start_at,
    values.planned_end_at,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Планирование и исполнение</CardTitle>
        <CardDescription>
          Временной интервал, рабочий бокс, мастер и комментарий к заказу.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 lg:grid-cols-3">
          <DateTimeInput
            label="Дата записи"
            value={values.scheduled_at}
            onChange={(value: string) =>
              onChange({
                ...values,
                scheduled_at: value,
              })
            }
          />

          <DateTimeInput
            label="Плановое начало"
            value={values.planned_start_at}
            onChange={(value: string) =>
              onChange({
                ...values,
                planned_start_at: value,
              })
            }
          />

          <DateTimeInput
            label="Плановое окончание"
            value={values.planned_end_at}
            onChange={(value: string) =>
              onChange({
                ...values,
                planned_end_at: value,
              })
            }
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Combobox
            label="Рабочий бокс"
            placeholder={
              isLookupsLoading ? "Загрузка боксов..." : "Не назначен"
            }
            value={values.work_bay_id}
            options={workBayOptions}
            disabled={isLookupsLoading}
            onChange={(value) =>
              onChange({
                ...values,
                work_bay_id: Number(value) || null,
              })
            }
          />

          {canSelectMaster ? (
            <Combobox
              label="Мастер"
              placeholder="Не назначен"
              value={values.assigned_user_id}
              options={masterOptions}
              disabled={isLookupsLoading}
              onChange={(value) =>
                onChange({
                  ...values,
                  assigned_user_id: Number(value) || null,
                })
              }
            />
          ) : (
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                Мастер
              </div>
              <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                Список мастеров недоступен для текущего пользователя. Поле будет
                скрыто до подключения безопасного endpoint&apos;а мастеров.
              </div>
            </div>
          )}
        </div>

        {isCheckingAvailability ? (
          <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            Проверяем доступность выбранного бокса...
          </div>
        ) : null}

        {availabilityError ? (
          <div className="mt-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
            {availabilityError}
          </div>
        ) : null}

        {conflictingOrderId ? (
          <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
            <div className="text-sm font-semibold text-[rgb(252_165_165)]">
              Этот бокс занят в выбранное время
            </div>

            <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.82)]">
              Найден конфликт с заказом #{conflictingOrderId}. Измените время
              или выберите другой бокс.
            </div>

            <div className="mt-4">
              <Link href={routes.orderDetails(conflictingOrderId)}>
                <Button type="button" variant="secondary" size="sm">
                  Открыть конфликтующий заказ
                </Button>
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <Textarea
            label="Комментарий"
            name="comment"
            placeholder="Например: клиент просит не использовать ароматизатор, предпочитает WhatsApp..."
            value={values.comment}
            onChange={(event) =>
              onChange({
                ...values,
                comment: event.target.value,
              })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}