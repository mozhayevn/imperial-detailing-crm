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
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import type { WorkBay } from "@/src/features/work-bays/types";
import type { UserWithRoles } from "@/src/features/users/types";
import type {
  OrderFormErrors,
  OrderFormValues,
} from "@/src/features/orders/form/types";
import { DateTimeInput } from "@/src/components/ui/date-time-input";

type OrderScheduleSectionProps = {
  values: OrderFormValues;
  errors?: OrderFormErrors;
  workBays: WorkBay[];
  masters: UserWithRoles[];
  isLookupsLoading?: boolean;
  onChange: (values: OrderFormValues) => void;
};

export function OrderScheduleSection({
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
            placeholder={isLookupsLoading ? "Загрузка боксов..." : "Не назначен"}
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
                Список мастеров недоступен для текущего пользователя. Поле
                будет скрыто до подключения безопасного endpoint&apos;а мастеров.
              </div>
            </div>
          )}
        </div>

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