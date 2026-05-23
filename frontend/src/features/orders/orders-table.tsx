import Link from "next/link";
// import { Badge } from "@/src/components/ui/badge";
import { routes } from "@/src/config/routes";
// import { formatCurrency, formatDateTime } from "@/src/lib/formatters";
import { OrderStatusBadge } from "@/src/features/orders/order-status-badge";
import type { OrderListItem } from "@/src/features/orders/types";
import type { WorkBay } from "@/src/features/work-bays/types";
import type { UserWithRoles } from "@/src/features/users/types";
import { formatDateTime } from "@/src/lib/formatters";
import {
  PriceDisplay,
  PricingStateBadge,
} from "@/src/features/orders/pricing-display";

type OrdersTableProps = {
  orders: OrderListItem[];
  workBays?: WorkBay[];
  users?: UserWithRoles[];
};

function getClientLabel(order: OrderListItem) {
  return order.client_full_name || `Клиент #${order.client_id}`;
}

function getClientSubLabel(order: OrderListItem) {
  return order.client_phone || null;
}

function getCarLabel(order: OrderListItem) {
  const brandModel = [order.car_brand, order.car_model]
    .filter(Boolean)
    .join(" ");

  return brandModel || `Авто #${order.car_id}`;
}

function getCarSubLabel(order: OrderListItem) {
  return order.car_plate_number || null;
}

function getWorkBayLabel(order: OrderListItem, workBays: WorkBay[]) {
  if (order.work_bay_name) {
    return order.work_bay_name;
  }

  if (!order.work_bay_id) {
    return null;
  }

  const bay = workBays.find((item) => item.id === order.work_bay_id);

  return bay?.name ?? `Бокс #${order.work_bay_id}`;
}

function getAssignedUserLabel(order: OrderListItem, users: UserWithRoles[]) {
  if (order.assigned_user_full_name) {
    return order.assigned_user_full_name;
  }

  if (!order.assigned_user_id) {
    return null;
  }

  const user = users.find((item) => item.id === order.assigned_user_id);

  return user?.full_name ?? `Мастер #${order.assigned_user_id}`;
}

export function OrdersTable({
  orders,
  workBays = [],
  users = [],
}: OrdersTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Заказ
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Статус
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Клиент
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Автомобиль
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Исполнение
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                План
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Сумма
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                Pricing
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => {
              const clientLabel = getClientLabel(order);
              const clientSubLabel = getClientSubLabel(order);
              const carLabel = getCarLabel(order);
              const carSubLabel = getCarSubLabel(order);
              const bayLabel = getWorkBayLabel(order, workBays);
              const assignedUserLabel = getAssignedUserLabel(order, users);

              return (
                <tr
                  key={order.id}
                  className="border-b border-[hsl(var(--border))] transition last:border-b-0 hover:bg-[hsl(var(--surface-2))]/70"
                >
                  <td className="px-5 py-4 align-top">
                    <Link
                      href={routes.orderDetails(order.id)}
                      className="font-semibold text-white transition hover:text-[hsl(var(--primary))]"
                    >
                      #{order.id}
                    </Link>
                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      Создан: {formatDateTime(order.created_at)}
                    </div>
                  </td>

                  <td className="px-5 py-4 align-top">
                    <OrderStatusBadge status={order.status} />
                  </td>

                  <td className="px-5 py-4 align-top">
                    <div className="text-sm font-medium text-white">
                      {clientLabel}
                    </div>
                    {clientSubLabel ? (
                      <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                        {clientSubLabel}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-5 py-4 align-top">
                    <div className="text-sm font-medium text-white">
                      {carLabel}
                    </div>
                    {carSubLabel ? (
                      <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                        {carSubLabel}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-5 py-4 align-top">
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                      {bayLabel ?? "Бокс не назначен"}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      {assignedUserLabel ?? "Мастер не назначен"}
                    </div>
                  </td>

                  <td className="px-5 py-4 align-top">
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(order.planned_start_at)}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      до {formatDateTime(order.planned_end_at)}
                    </div>
                  </td>

                  <td className="px-5 py-4 align-top">
                    <PriceDisplay
                      value={order.total_price}
                      pricingLocked={order.pricing_locked}
                      className="text-sm"
                    />
                  </td>

                  <td className="px-5 py-4 align-top">
                    <PricingStateBadge
                      value={order.total_price}
                      pricingLocked={order.pricing_locked}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}