import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";

type OrdersErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function OrdersErrorState({ message, onRetry }: OrdersErrorStateProps) {
  return (
    <Card className="border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[rgb(252_165_165)]">
            Не удалось загрузить заказы
          </h2>
          <p className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
            {message}
          </p>
        </div>

        <Button variant="danger" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    </Card>
  );
}