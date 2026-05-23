"use client";

import Link from "next/link";
import { routes } from "@/src/config/routes";
import { useAuth } from "@/src/features/auth/use-auth";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { PageHeader } from "@/src/components/ui/page-header";
import { PageContainer } from "@/src/components/layout/page-container";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { getOrderById, getOrders } from "@/src/features/orders/api";
import type {
  OrderFilters,
  OrderListItem,
} from "@/src/features/orders/types";
import { parseOrderSearch } from "@/src/features/orders/search";
import { OrdersFilters } from "@/src/features/orders/orders-filters";
import { OrdersTable } from "@/src/features/orders/orders-table";
import { OrdersEmptyState } from "@/src/features/orders/orders-empty-state";
import { OrdersErrorState } from "@/src/features/orders/orders-error-state";
import { OrdersLoadingState } from "@/src/features/orders/orders-loading-state";
import { getWorkBays } from "@/src/features/work-bays/api";
import type { WorkBay } from "@/src/features/work-bays/types";
import { getUsersWithRoles } from "@/src/features/users/api";
import type { UserWithRoles } from "@/src/features/users/types";

function mapOrderToListItem(order: {
  id: number;
  status: string;
  total_price: number;
  pricing_locked: boolean;
  created_at: string;
  scheduled_at: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  client_id: number;
  car_id: number;
  assigned_user_id?: number | null;
  work_bay_id?: number | null;
}): OrderListItem {
  return {
    id: order.id,
    status: order.status,
    total_price: order.total_price,
    pricing_locked: order.pricing_locked,

    created_at: order.created_at,
    scheduled_at: order.scheduled_at,
    planned_start_at: order.planned_start_at,
    planned_end_at: order.planned_end_at,

    client_id: order.client_id,
    client_full_name: null,
    client_phone: null,

    car_id: order.car_id,
    car_brand: null,
    car_model: null,
    car_plate_number: null,

    work_bay_id: order.work_bay_id ?? null,
    work_bay_name: null,

    assigned_user_id: order.assigned_user_id ?? null,
    assigned_user_full_name: null,
  };
}

export function OrdersPageClient() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [filters, setFilters] = useState<OrderFilters>({});
  const [searchValue, setSearchValue] = useState("");

  const [workBays, setWorkBays] = useState<WorkBay[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLookupsLoading, setIsLookupsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const canCreateOrders = canAccessByPermission(session, "orders.create");  

  const masters = users.filter((user) => user.roles.includes("master"));
  const usersLookupAvailable = masters.length > 0;

  const loadOrders = useCallback(async (nextFilters: OrderFilters = filters) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getOrders(nextFilters);
      setOrders(data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let isMounted = true;

    async function initializeOrders() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getOrders({});

        if (isMounted) {
          setOrders(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
          setOrders([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initializeOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeLookups() {
      setIsLookupsLoading(true);

      try {
        const [baysResult, usersResult] = await Promise.allSettled([
          getWorkBays(),
          getUsersWithRoles(),
        ]);

        if (!isMounted) {
          return;
        }

        if (baysResult.status === "fulfilled") {
          setWorkBays(baysResult.value);
        }

        if (usersResult.status === "fulfilled") {
          setUsers(usersResult.value);
        }
      } finally {
        if (isMounted) {
          setIsLookupsLoading(false);
        }
      }
    }

    void initializeLookups();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSmartSearch(
    value: string,
    extraFilters: OrderFilters = {},
  ) {
    const parsed = parseOrderSearch(value);

    if (parsed.type === "order_id" && parsed.orderId) {
      setIsLoading(true);
      setError(null);

      try {
        const order = await getOrderById(parsed.orderId);
        setOrders([mapOrderToListItem(order)]);
        setFilters(extraFilters);
      } catch (searchError) {
        setError(getApiErrorMessage(searchError));
        setOrders([]);
      } finally {
        setIsLoading(false);
      }

      return;
    }

    const nextFilters: OrderFilters = {
      ...parsed.filters,
      ...extraFilters,
    };

    setFilters(nextFilters);
    await loadOrders(nextFilters);
  }

  function handleFiltersChange(nextFilters: OrderFilters) {
    const parsed = parseOrderSearch(searchValue);

    const mergedFilters: OrderFilters = {
      ...parsed.filters,
      ...nextFilters,
    };

    setFilters(mergedFilters);
    void loadOrders(mergedFilters);
  }

  function handleResetFilters() {
    setFilters({});
    setSearchValue("");
    void loadOrders({});
  }

  const ordersSummary = useMemo(() => {
    const activeCount = orders.filter((order) =>
      ["new", "confirmed", "in_progress"].includes(order.status),
    ).length;

    const lockedCount = orders.filter((order) => order.pricing_locked).length;

    return {
      total: orders.length,
      active: activeCount,
      locked: lockedCount,
    };
  }, [orders]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Заказы"
        title="Операционные заказы"
        description="Ищите заказы по телефону, госномеру, номеру заказа или ФИО клиента. Данные загружаются из существующего backend API."
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadOrders()}>
              Обновить
            </Button>

            {canCreateOrders ? (
              <Link href={routes.newOrder}>
                <Button>Новый заказ</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-5 shadow-[var(--shadow-card)]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
            Найдено
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {ordersSummary.total}
          </div>
        </div>

        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-5 shadow-[var(--shadow-card)]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
            Активные
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {ordersSummary.active}
          </div>
        </div>

        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-5 shadow-[var(--shadow-card)]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
            Pricing locked
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {ordersSummary.locked}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <OrdersFilters
          filters={filters}
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearch={handleSmartSearch}
          onChange={handleFiltersChange}
          onReset={handleResetFilters}
          isLoading={isLoading}
          isLookupsLoading={isLookupsLoading}
          workBays={workBays}
          users={masters}
          usersLookupAvailable={usersLookupAvailable}
        />

        {isLoading ? (
          <OrdersLoadingState />
        ) : error ? (
          <OrdersErrorState message={error} onRetry={() => void loadOrders()} />
        ) : orders.length === 0 ? (
          <OrdersEmptyState onReset={handleResetFilters} />
        ) : (
          <OrdersTable orders={orders} workBays={workBays} users={users} />
        )}
      </div>
    </PageContainer>
  );
}