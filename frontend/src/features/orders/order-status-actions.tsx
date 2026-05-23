"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { cancelOrder, updateOrderStatus } from "@/src/features/orders/api";
import { getOrderStatusLabel } from "@/src/features/orders/status";
import type { Order } from "@/src/features/orders/types";

type OrderStatusActionsProps = {
  order: Order;
  canUpdate: boolean;
  onChanged: () => void;
};

type NextStatusAction = {
  status: string;
  label: string;
  description: string;
};

const statusTransitions: Record<string, NextStatusAction | null> = {
  new: {
    status: "confirmed",
    label: "Подтвердить",
    description: "Заказ проверен и готов к планированию работ.",
  },
  confirmed: {
    status: "in_progress",
    label: "Начать работу",
    description: "Мастер приступает к выполнению заказа.",
  },
  in_progress: {
    status: "completed",
    label: "Завершить",
    description: "Работы по заказу завершены.",
  },
  completed: {
    status: "delivered",
    label: "Выдать клиенту",
    description: "Автомобиль выдан клиенту.",
  },
  delivered: null,
  canceled: null,
};

const statusSteps = ["new", "confirmed", "in_progress", "completed", "delivered"];

function isTerminalStatus(status: string) {
  return status === "delivered" || status === "canceled";
}

function getStatusStepIndex(status: string) {
  return statusSteps.indexOf(status);
}

export function OrderStatusActions({
  order,
  canUpdate,
  onChanged,
}: OrderStatusActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nextAction = useMemo(
    () => statusTransitions[order.status] ?? null,
    [order.status],
  );

  const currentStepIndex = getStatusStepIndex(order.status);
  const canCancel = canUpdate && !isTerminalStatus(order.status);

  async function handleStatusChange(nextStatus: string) {
    setIsSubmitting(true);
    setError(null);

    try {
      await updateOrderStatus(order.id, nextStatus);
      onChanged();
    } catch (statusError) {
      setError(getApiErrorMessage(statusError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    const reason = cancelReason.trim();

    if (!reason) {
      setError("Укажите причину отмены заказа");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await cancelOrder(order.id, reason);
      setCancelReason("");
      setIsCancelOpen(false);
      onChanged();
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Статус заказа</CardTitle>
            <CardDescription>
              Управление рабочим процессом заказа.
            </CardDescription>
          </div>

          <Badge tone="primary">{getOrderStatusLabel(order.status)}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
              Прогресс
            </div>

            {isTerminalStatus(order.status) ? (
              <Badge tone="muted">Финальный статус</Badge>
            ) : (
              <Badge tone="muted">В работе</Badge>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {statusSteps.map((status, index) => {
              const isActive = order.status === status;
              const isPassed =
                currentStepIndex >= 0 && index < currentStepIndex;

              return (
                <div
                  key={status}
                  className={[
                    "h-2 rounded-full transition",
                    isActive
                      ? "bg-[hsl(var(--primary))] shadow-[var(--shadow-glow)]"
                      : isPassed
                        ? "bg-[rgb(45_212_191_/_0.45)]"
                        : "bg-[hsl(var(--surface-3))]",
                  ].join(" ")}
                />
              );
            })}
          </div>

          <div className="mt-4 text-sm font-semibold text-white">
            {getOrderStatusLabel(order.status)}
          </div>

          {nextAction ? (
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
              {nextAction.description}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
              Для текущего статуса нет следующего действия.
            </p>
          )}
        </div>

        {!canUpdate ? (
          <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            У вас нет доступа к изменению статуса.
          </div>
        ) : null}

        {canUpdate && nextAction ? (
          <Button
            type="button"
            className="mt-4 w-full"
            disabled={isSubmitting}
            onClick={() => void handleStatusChange(nextAction.status)}
          >
            {isSubmitting ? "Сохраняем..." : nextAction.label}
          </Button>
        ) : null}

        {canCancel ? (
          <div className="mt-3">
            {!isCancelOpen ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => setIsCancelOpen(true)}
              >
                Отменить заказ
              </Button>
            ) : (
              <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                <Textarea
                  label="Причина отмены"
                  placeholder="Например: клиент отменил запись..."
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsCancelOpen(false);
                      setCancelReason("");
                      setError(null);
                    }}
                  >
                    Назад
                  </Button>

                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleCancel()}
                  >
                    {isSubmitting ? "Отменяем..." : "Подтвердить отмену"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}