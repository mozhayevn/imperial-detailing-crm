import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { formatDateTime } from "@/src/lib/formatters";
import type { OrderStatusHistoryItem } from "@/src/features/orders/types";
import { getOrderStatusLabel } from "@/src/features/orders/status";

type OrderStatusTimelineProps = {
  history: OrderStatusHistoryItem[];
};

export function OrderStatusTimeline({ history }: OrderStatusTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>История статусов</CardTitle>
        <CardDescription>
          Последовательность изменений статуса заказа.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
            История статусов пока отсутствует или недоступна.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item, index) => (
              <div key={item.id} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.12)] text-xs font-semibold text-[rgb(94_234_212)]">
                    {index + 1}
                  </div>

                  {index < history.length - 1 ? (
                    <div className="mt-2 h-full w-px flex-1 bg-[hsl(var(--border))]" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.old_status ? (
                      <Badge tone="muted">
                        {getOrderStatusLabel(item.old_status)}
                      </Badge>
                    ) : (
                      <Badge tone="muted">Создание</Badge>
                    )}

                    <span className="text-xs text-[hsl(var(--muted))]">→</span>

                    <Badge tone="primary">
                      {getOrderStatusLabel(item.new_status)}
                    </Badge>
                  </div>

                  <div className="mt-3 text-xs text-[hsl(var(--muted))]">
                    {formatDateTime(item.changed_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}