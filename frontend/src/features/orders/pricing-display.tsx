import { Badge } from "@/src/components/ui/badge";
import { formatCurrency } from "@/src/lib/formatters";
import { cn } from "@/src/lib/cn";

type PriceDisplayProps = {
  value: number | null | undefined;
  pricingLocked: boolean;
  className?: string;
  pendingLabel?: string;
};

type PricingStateBadgeProps = {
  value: number | null | undefined;
  pricingLocked: boolean;
};

export function isPricingPending(
  value: number | null | undefined,
  pricingLocked: boolean,
) {
  return !pricingLocked && (value === null || value === undefined || value === 0);
}

export function PriceDisplay({
  value,
  pricingLocked,
  className,
  pendingLabel = "Ожидает расчета",
}: PriceDisplayProps) {
  if (isPricingPending(value, pricingLocked)) {
    return (
      <span
        className={cn(
          "font-semibold text-[rgb(252_211_77)]",
          className,
        )}
      >
        {pendingLabel}
      </span>
    );
  }

  return (
    <span className={cn("font-semibold text-white", className)}>
      {formatCurrency(value)}
    </span>
  );
}

export function PricingStateBadge({
  value,
  pricingLocked,
}: PricingStateBadgeProps) {
  if (isPricingPending(value, pricingLocked)) {
    return <Badge tone="warning">Ожидает расчета</Badge>;
  }

  if (pricingLocked) {
    return <Badge tone="warning">Зафиксировано</Badge>;
  }

  return <Badge tone="muted">Не зафиксировано</Badge>;
}