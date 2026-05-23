import { Badge } from "@/src/components/ui/badge";

type OrderAccessSummaryProps = {
  canCreate: boolean;
  canUpdate: boolean;
  pricingLocked: boolean;
};

export function OrderAccessSummary({
  canCreate,
  canUpdate,
  pricingLocked,
}: OrderAccessSummaryProps) {
  return (
    <div className="mb-5 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-5 py-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">
            Доступные действия
          </div>
          <div className="mt-1 text-xs text-[hsl(var(--muted))]">
            Возможности текущего пользователя для этого заказа.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone={canCreate ? "success" : "muted"}>
            Создание: {canCreate ? "доступно" : "нет доступа"}
          </Badge>

          <Badge tone={canUpdate && !pricingLocked ? "success" : "muted"}>
            Редактирование:{" "}
            {canUpdate && !pricingLocked ? "доступно" : "недоступно"}
          </Badge>

          <Badge tone={pricingLocked ? "warning" : "primary"}>
            Pricing: {pricingLocked ? "зафиксирован" : "не зафиксирован"}
          </Badge>
        </div>
      </div>
    </div>
  );
}