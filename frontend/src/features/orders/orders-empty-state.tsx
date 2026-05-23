import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";

type OrdersEmptyStateProps = {
  onReset?: () => void;
};

export function OrdersEmptyState({ onReset }: OrdersEmptyStateProps) {
  return (
    <Card className="p-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[hsl(var(--surface-3))] text-xl font-semibold text-[hsl(var(--primary))]">
          0
        </div>

        <h2 className="mt-5 text-lg font-semibold text-white">
          Заказы не найдены
        </h2>

        <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted))]">
          По текущим фильтрам backend не вернул ни одного заказа. Можно сбросить
          фильтры или создать новый заказ позже, когда добавим форму создания.
        </p>

        {onReset ? (
          <div className="mt-6">
            <Button variant="secondary" onClick={onReset}>
              Сбросить фильтры
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}