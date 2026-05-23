import { Badge } from "@/src/components/ui/badge";
import type { OrderStatus } from "@/src/lib/constants";
import {
  getOrderStatusLabel,
  getOrderStatusTone,
} from "@/src/features/orders/status";

type OrderStatusBadgeProps = {
  status: OrderStatus | string;
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <Badge tone={getOrderStatusTone(status)}>
      {getOrderStatusLabel(status)}
    </Badge>
  );
}