"use client";

import type { FormEvent } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { PageContainer } from "@/src/components/layout/page-container";
import type { OrderFormMode } from "@/src/features/orders/form/types";

type OrderFormShellProps = {
  mode: OrderFormMode;
  title: string;
  description: string;
  error?: string | null;
  isSubmitting?: boolean;
  submitLabel: string;
  cancelLabel?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  children: React.ReactNode;
};

export function OrderFormShell({
  mode,
  title,
  description,
  error,
  isSubmitting,
  submitLabel,
  cancelLabel = "Отмена",
  onSubmit,
  onCancel,
  children,
}: OrderFormShellProps) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={mode === "create" ? "Новый заказ" : "Редактирование заказа"}
        title={title}
        description={description}
        actions={
          <>
            {onCancel ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
            ) : null}

            <Button type="submit" form="order-form" disabled={isSubmitting}>
              {isSubmitting ? "Сохраняем..." : submitLabel}
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="mb-5 border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-5">
          <div className="text-sm font-semibold text-[rgb(252_165_165)]">
            Не удалось сохранить заказ
          </div>
          <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
            {error}
          </div>
        </Card>
      ) : null}

      <form id="order-form" onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge tone={mode === "create" ? "primary" : "warning"}>
            {mode === "create" ? "Создание" : "Редактирование"}
          </Badge>
          <Badge tone="muted">Backend-safe form state</Badge>
        </div>

        {children}

        <div className="flex justify-end gap-3 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-5 shadow-[var(--shadow-card)]">
          {onCancel ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Сохраняем..." : submitLabel}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}