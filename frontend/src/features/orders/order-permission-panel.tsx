import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

type OrderPermissionPanelProps = {
  canCreate: boolean;
  canUpdate: boolean;
  pricingLocked: boolean;
};

export function OrderPermissionPanel({
  canCreate,
  canUpdate,
  pricingLocked,
}: OrderPermissionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Доступные действия</CardTitle>
        <CardDescription>
          Действия зависят от backend permissions и состояния pricing lock.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Создание заказов
            </span>
            <Badge tone={canCreate ? "success" : "muted"}>
              {canCreate ? "Доступно" : "Нет доступа"}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Редактирование заказа
            </span>
            <Badge tone={canUpdate && !pricingLocked ? "success" : "muted"}>
              {canUpdate && !pricingLocked ? "Доступно" : "Недоступно"}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Pricing lock
            </span>
            <Badge tone={pricingLocked ? "warning" : "primary"}>
              {pricingLocked ? "Зафиксирован" : "Не зафиксирован"}
            </Badge>
          </div>
        </div>

        {pricingLocked ? (
          <div className="mt-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
            Заказ нельзя редактировать, пока pricing зафиксирован. Для
            изменения заказа потребуется unlock flow.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}