"use client";

import { getServices } from "@/src/features/services/api";
import type { Service } from "@/src/features/services/types";
import { getMaterialBrands } from "@/src/features/material-brands/api";
import type { MaterialBrand } from "@/src/features/material-brands/types";
import { getServicePackages } from "@/src/features/service-packages/api";
import type { ServicePackage } from "@/src/features/service-packages/types";
import Link from "next/link";
import { OrderStatusActions } from "@/src/features/orders/order-status-actions";
import { OrderItemMaterialsPanel } from "@/src/features/orders/order-item-materials-panel";
import { getMaterials } from "@/src/features/materials/api";
import type { Material } from "@/src/features/materials/types";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/ui/page-header";
import { routes } from "@/src/config/routes";
import { formatDateTime, formatCurrency } from "@/src/lib/formatters";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { getClientById } from "@/src/features/clients/api";
import type { Client } from "@/src/features/clients/types";
import { getCarById, getCars } from "@/src/features/cars/api";
import type { Car } from "@/src/features/cars/types";
import { getWorkBays } from "@/src/features/work-bays/api";
import type { WorkBay } from "@/src/features/work-bays/types";
import { getUsersWithRoles } from "@/src/features/users/api";
import type { UserWithRoles } from "@/src/features/users/types";
import {
  getOrderAuditLogs,
  getOrderById,
  getOrderStatusHistory,
} from "@/src/features/orders/api";
import type {
  Order,
  OrderAuditLog,
  OrderStatusHistoryItem,
} from "@/src/features/orders/types";
import { OrderItemsTable } from "@/src/features/orders/order-items-table";
import { OrderPricingPanel } from "@/src//features/orders/order-pricing-panel";
import { OrderStatusTimeline } from "@/src/features/orders/order-status-timeline";
import { OrderAuditTimeline } from "@/src/features/orders/order-audit-timeline";

import { useAuth } from "@/src/features/auth/use-auth";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";

import { getPricingAuditLogs } from "@/src/features/pricing/api";
import type { PricingAuditLog } from "@/src/features/pricing/types";
//import { PricingAuditTimeline } from "@/src/features/orders/pricing-audit-timeline";
import { OrderPaymentsPanel } from "@/src/features/orders/order-payments-panel";

import { getPaymentAuditLogs } from "@/src/features/payments/api";
import type { PaymentAuditLog } from "@/src/features/payments/types";
//import { PaymentAuditTimeline } from "@/src/features/orders/payment-audit-timeline";
import {
  OrderProductionChecklistPanel,
  type OrderChecklistSummary,
} from "@/src/features/orders/order-production-checklist-panel";
import { OrderPhotosPanel } from "@/src/features/orders/order-photos-panel";
import { getOrderChecklistAuditLogs } from "@/src/features/order-checklist/api";
import type { OrderChecklistAuditLog } from "@/src/features/order-checklist/types";
//import { ChecklistAuditTimeline } from "@/src/features/orders/checklist-audit-timeline";
import { OrderUnifiedTimeline } from "@/src/features/orders/order-unified-timeline";

function getProgressBarClass(value: number) {
  if (value >= 100) {
    return "bg-[rgb(45_212_191)]";
  }

  if (value > 0) {
    return "bg-[rgb(251_191_36)]";
  }

  return "bg-[hsl(var(--muted))]";
}

function getPricingOverviewLabel(pricingLocked: boolean, totalPrice: number) {
  if (pricingLocked) {
    return "Цена зафиксирована";
  }

  if (totalPrice > 0) {
    return "Цена рассчитана, не зафиксирована";
  }

  return "Ожидает расчета";
}

function getPricingOverviewTone(pricingLocked: boolean, totalPrice: number) {
  if (pricingLocked) {
    return "success";
  }

  if (totalPrice > 0) {
    return "warning";
  }

  return "warning";
}

function getOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Новый",
    scheduled: "Запланирован",
    in_progress: "В работе",
    waiting: "Ожидает",
    completed: "Завершен",
    delivered: "Выдан",
    canceled: "Отменен",
  };

  return labels[status] ?? status;
}

function getOrderStatusTone(status: string) {
  if (status === "canceled") {
    return "danger";
  }

  if (status === "delivered" || status === "completed") {
    return "success";
  }

  if (status === "in_progress") {
    return "primary";
  }

  if (status === "waiting" || status === "scheduled") {
    return "warning";
  }

  return "muted";
}

function getTotalPhotoCount(photoCountsByType: Record<string, number>) {
  return Object.values(photoCountsByType).reduce(
    (sum, count) => sum + count,
    0,
  );
}

/*const DEFAULT_CHECKLIST_ITEMS_COUNT = 7;*/

export function OrderDetailsPageClient() {
  const params = useParams();
  const { session } = useAuth();

  const orderIdParam = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  const orderId = Number(orderIdParam);

  const [services, setServices] = useState<Service[]>([]);
  const [materialBrands, setMaterialBrands] = useState<MaterialBrand[]>([]);
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [order, setOrder] = useState<Order | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [car, setCar] = useState<Car | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [workBays, setWorkBays] = useState<WorkBay[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistoryItem[]>(
    [],
  );
  const [auditLogs, setAuditLogs] = useState<OrderAuditLog[]>([]);
  const [pricingAuditLogs, setPricingAuditLogs] = useState<PricingAuditLog[]>([]);
  const [paymentAuditLogs, setPaymentAuditLogs] = useState<PaymentAuditLog[]>([]);
  const [checklistAuditLogs, setChecklistAuditLogs] = useState<OrderChecklistAuditLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canCreateOrders = canAccessByPermission(session, "orders.create");
  const canUpdateOrders = canAccessByPermission(session, "orders.update");
  const canReadMaterials = canAccessByPermission(session, "materials.read");
  const canConsumeMaterials = canAccessByPermission(session, "materials.consume");

  const canReadPricing = canAccessByPermission(session, "pricing.read");
  const canManagePricing = canAccessByPermission(session, "pricing.manage");
  const canReadPayments = canAccessByPermission(session, "payments.read");
  const canCreatePayments = canAccessByPermission(session, "payments.create");
  const canCancelPayments = canAccessByPermission(session, "payments.cancel");
  const canReadChecklist = canAccessByPermission(
    session,
    "order_checklist.read",
  );
  const canUpdateChecklist = canAccessByPermission(
    session,
    "order_checklist.update",
  );
  const canReadOrderPhotos = canAccessByPermission(session, "order_photos.read");
  const canUploadOrderPhotos = canAccessByPermission(
    session,
    "order_photos.upload",
  );
  const canDeleteOrderPhotos = canAccessByPermission(
    session,
    "order_photos.delete",
  );
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0);
  const [checklistSummary, setChecklistSummary] =
    useState<OrderChecklistSummary>({
      totalCount: 0,
      doneCount: 0,
      requiredPendingCount: 0,
      percent: 0,
    });
  const [requestedPhotoType, setRequestedPhotoType] = useState<string | null>(
    null,
  );
  const [photoCountsByType, setPhotoCountsByType] = useState<
    Record<string, number>
  >({});

  const carId = order?.car_id ?? null;
const workBayId = order?.work_bay_id ?? null;
const assignedUserId = order?.assigned_user_id ?? null;

const carLabel = useMemo(() => {
  if (!car) {
    return carId ? `Авто #${carId}` : "Автомобиль";
  }

  return [car.brand, car.model].filter(Boolean).join(" ");
}, [car, carId]);

const workBayLabel = useMemo(() => {
  if (!workBayId) {
    return "—";
  }

  const workBay = workBays.find((item) => item.id === workBayId);

  return workBay?.name ?? `Бокс #${workBayId}`;
}, [workBayId, workBays]);

const assignedUserLabel = useMemo(() => {
  if (!assignedUserId) {
    return "—";
  }

  const user = users.find((item) => item.id === assignedUserId);

  return user?.full_name ?? `Сотрудник #${assignedUserId}`;
}, [assignedUserId, users]);

/*const checklistProgress = useMemo(() => {
  const completedLogsCount = checklistAuditLogs.filter(
    (log) => log.action === "item_completed",
  ).length;

  const reopenedLogsCount = checklistAuditLogs.filter(
    (log) => log.action === "item_reopened",
  ).length;

  const doneCount = Math.max(completedLogsCount - reopenedLogsCount, 0);
  const totalCount = Math.max(DEFAULT_CHECKLIST_ITEMS_COUNT, doneCount);

  const percent =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return {
    doneCount,
    totalCount,
    percent,
  };
}, [checklistAuditLogs]);*/

const paymentSummary = useMemo(() => {
  const paidAmount = paymentAuditLogs.reduce((sum, log) => {
    if (log.action !== "payment_created" || !log.details) {
      return sum;
    }

    try {
      const parsed = JSON.parse(log.details) as {
        payment?: {
          amount?: number;
        };
        amount?: number;
      };

      return (
        sum +
        Number(parsed.payment?.amount ?? parsed.amount ?? 0)
      );
    } catch {
      return sum;
    }
  }, 0);

  const canceledAmount = paymentAuditLogs.reduce((sum, log) => {
    if (log.action !== "payment_canceled" || !log.details) {
      return sum;
    }

    try {
      const parsed = JSON.parse(log.details) as {
        payment?: {
          amount?: number;
        };
        amount?: number;
      };

      return (
        sum +
        Number(parsed.payment?.amount ?? parsed.amount ?? 0)
      );
    } catch {
      return sum;
    }
  }, 0);

  const actualPaidAmount = Math.max(paidAmount - canceledAmount, 0);

  const orderTotalFromItems = order
    ? order.items.reduce((sum, item) => {
        return sum + Number(item.total ?? item.price ?? 0);
      }, 0)
    : 0;

  const effectiveOrderTotal = Math.max(
    order?.total_price ?? 0,
    orderTotalFromItems,
    actualPaidAmount,
  );

  const remainingAmount = Math.max(effectiveOrderTotal - actualPaidAmount, 0);

  const percent =
    effectiveOrderTotal > 0
      ? Math.min(
          Math.round((actualPaidAmount / effectiveOrderTotal) * 100),
          100,
        )
      : 0;

  return {
    orderTotal: effectiveOrderTotal,
    paidAmount: actualPaidAmount,
    remainingAmount,
    percent,
  };
}, [order, paymentAuditLogs]);

const totalPhotoCount = useMemo(
  () => getTotalPhotoCount(photoCountsByType),
  [photoCountsByType],
);

  useEffect(() => {
    let isMounted = true;

    async function loadOrderDetails() {
      if (!Number.isFinite(orderId) || orderId <= 0) {
        setError("Некорректный номер заказа");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const orderData = await getOrderById(orderId);

        const [
          clientResult,
          carResult,
          statusHistoryResult,
          auditLogsResult,
          pricingAuditLogsResult,
          paymentAuditLogsResult,
          checklistAuditLogsResult,
          workBaysResult,
          usersResult,
          servicesResult,
          materialBrandsResult,
          servicePackagesResult,
          materialsResult,
          carsResult,
        ] = await Promise.allSettled([
          getClientById(orderData.client_id),
          getCarById(orderData.car_id),
          getOrderStatusHistory(orderData.id),
          getOrderAuditLogs(orderData.id),
          getPricingAuditLogs(orderData.id),
          getPaymentAuditLogs(orderData.id),
          getOrderChecklistAuditLogs(orderData.id),
          getWorkBays(),
          getUsersWithRoles(),
          getServices(),
          getMaterialBrands(),
          getServicePackages(),
          getMaterials({ is_active: true }),
          getCars(),
        ]);

        if (!isMounted) {
          return;
        }

        setOrder(orderData);

        if (clientResult.status === "fulfilled") {
          setClient(clientResult.value);
        } else {
          setClient(null);
        }

        if (carResult.status === "fulfilled") {
          setCar(carResult.value);
        } else {
          setCar(null);
        }

        if (statusHistoryResult.status === "fulfilled") {
          setStatusHistory(statusHistoryResult.value);
        } else {
          setStatusHistory([]);
        }

        if (auditLogsResult.status === "fulfilled") {
          setAuditLogs(auditLogsResult.value);
        } else {
          setAuditLogs([]);
        }

        if (pricingAuditLogsResult.status === "fulfilled") {
          setPricingAuditLogs(pricingAuditLogsResult.value);
        } else {
          setPricingAuditLogs([]);
        }

        if (paymentAuditLogsResult.status === "fulfilled") {
          setPaymentAuditLogs(paymentAuditLogsResult.value);
        } else {
          setPaymentAuditLogs([]);
        }

        if (checklistAuditLogsResult.status === "fulfilled") {
          setChecklistAuditLogs(checklistAuditLogsResult.value);
        } else {
          setChecklistAuditLogs([]);
        }

        if (workBaysResult.status === "fulfilled") {
          setWorkBays(workBaysResult.value);
        } else {
          setWorkBays([]);
        }

        if (usersResult.status === "fulfilled") {
          setUsers(usersResult.value);
        } else {
          setUsers([]);
        }

        if (servicesResult.status === "fulfilled") {
          setServices(servicesResult.value);
        } else {
          setServices([]);
        }

        if (materialBrandsResult.status === "fulfilled") {
          setMaterialBrands(materialBrandsResult.value);
        } else {
          setMaterialBrands([]);
        }

        if (servicePackagesResult.status === "fulfilled") {
          setServicePackages(servicePackagesResult.value);
        } else {
          setServicePackages([]);
        }

        if (materialsResult.status === "fulfilled") {
          setMaterials(materialsResult.value);
        } else {
          setMaterials([]);
        }

        if (carsResult.status === "fulfilled") {
          setCars(carsResult.value);
        } else {
          setCars([]);
        }

      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
          setOrder(null);
          setClient(null);
          setCar(null);
          setStatusHistory([]);
          setAuditLogs([]);
          setWorkBays([]);
          setUsers([]);
          setServices([]);
          setMaterialBrands([]);
          setServicePackages([]);
          setMaterials([]);
          setCars([]);
          setPricingAuditLogs([]);
          setPaymentAuditLogs([]);
          setChecklistAuditLogs([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrderDetails();

    return () => {
      isMounted = false;
    };
  }, [orderId, reloadKey]);

  function handleOrderChanged() {
    setReloadKey((current) => current + 1);
  }

  async function refreshChecklistAuditLogs() {
    try {
      const result = await getOrderChecklistAuditLogs(orderId);
      setChecklistAuditLogs(result);
    } catch {
      setChecklistAuditLogs([]);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card className="p-8">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[hsl(var(--primary))]" />
            <div className="mt-5 text-sm font-semibold text-white">
              Загружаем заказ
            </div>
            <div className="mt-2 text-xs text-[hsl(var(--muted))]">
              Получаем заказ, историю статусов и audit logs из backend...
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (error || !order) {
    return (
      <PageContainer>
        <Card className="border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-sm font-semibold text-[rgb(252_165_165)]">
                Не удалось открыть заказ
              </h1>
              <p className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                {error ?? "Заказ не найден"}
              </p>
            </div>

            <Link href={routes.orders}>
              <Button variant="secondary">Вернуться к заказам</Button>
            </Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  /*const editBlockedByPricing = order.pricing_locked;
  const canShowEditAction = canUpdateOrders;
  const pricingPending = isPricingPending(
  order.total_price,
  order.pricing_locked,
  );*/

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Заказ"
        title={`Заказ #${order.id}`}
        description="Детальная карточка заказа: клиент, автомобиль, сроки, статус, pricing, оплаты, позиции, материалы и история."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/orders">
              <Button type="button" variant="secondary">
                К списку заказов
              </Button>
            </Link>

            {canUpdateOrders && !order.pricing_locked ? (
              <Link href={`/orders/${order.id}/edit`}>
                <Button type="button">Редактировать</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <Card className="mb-5 overflow-hidden border-[rgb(45_212_191_/_0.22)] bg-[linear-gradient(135deg,rgb(45_212_191_/_0.07),rgb(15_23_42_/_0.46))] shadow-xl shadow-black/10">
        <CardContent className="p-5">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div>
                <div className="pt-2">
                  {client?.full_name ?? `Клиент #${order.client_id}`} ·{" "}
                  {carLabel}
                </div>

                <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                  {car?.plate_number ?? "Без госномера"} ·{" "}
                  {client?.phone ?? "Телефон не загружен"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-xs text-[hsl(var(--muted))]">
                    Сумма заказа
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatCurrency(paymentSummary.orderTotal)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-xs text-[hsl(var(--muted))]">
                    Оплачено
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatCurrency(paymentSummary.paidAmount)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-xs text-[hsl(var(--muted))]">
                    Остаток
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatCurrency(paymentSummary.remainingAmount)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-xs text-[hsl(var(--muted))]">Фото</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {totalPhotoCount}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Операционный статус
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                      Оплата, чеклист, бокс, мастер и сроки.
                    </div>
                  </div>

                  <Badge
                    tone={
                      paymentSummary.remainingAmount === 0 &&
                      checklistSummary.percent >= 100
                        ? "success"
                        : "warning"
                    }
                  >
                    {paymentSummary.remainingAmount === 0 &&
                    checklistSummary.percent >= 100
                      ? "Готово"
                      : "В работе"}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-[hsl(var(--muted))]">
                        Оплата
                      </span>
                      <span className="font-semibold text-white">
                        {paymentSummary.percent}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressBarClass(
                          paymentSummary.percent,
                        )}`}
                        style={{ width: `${paymentSummary.percent}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[hsl(var(--muted))]">
                      <span>{formatCurrency(paymentSummary.paidAmount)}</span>
                      <span>
                        из {formatCurrency(paymentSummary.orderTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-[hsl(var(--muted))]">
                        Чеклист
                      </span>
                      <span className="font-semibold text-white">
                        {checklistSummary.doneCount}/
                        {checklistSummary.totalCount}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressBarClass(
                          checklistSummary.percent,
                        )}`}
                        style={{ width: `${checklistSummary.percent}%` }}
                      />
                    </div>

                    <div className="mt-2 text-[11px] text-[hsl(var(--muted))]">
                      Выполнено {checklistSummary.percent}% производственного
                      чеклиста.
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                    <div className="text-xs text-[hsl(var(--muted))]">
                      Рабочий бокс
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {workBayLabel}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                    <div className="text-xs text-[hsl(var(--muted))]">
                      Мастер
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {assignedUserLabel}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                    <div className="text-xs text-[hsl(var(--muted))]">
                      Начало
                    </div>
                    <div className="mt-1 text-sm font-semibold leading-5 text-white">
                      {formatDateTime(order.planned_start_at)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                    <div className="text-xs text-[hsl(var(--muted))]">
                      Конец
                    </div>
                    <div className="mt-1 text-sm font-semibold leading-5 text-white">
                      {formatDateTime(order.planned_end_at)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 xl:mt-[80px] xl:self-start">
              <div className="text-sm font-semibold text-white">
                Состояние заказа
              </div>

              <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                Ключевые статусы для быстрого контроля.
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Статус заказа
                  </div>

                  <div className="mt-2">
                    <Badge tone={getOrderStatusTone(order.status)}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Ценообразование
                  </div>

                  <div className="mt-2">
                    <Badge
                      tone={getPricingOverviewTone(
                        order.pricing_locked,
                        paymentSummary.orderTotal,
                      )}
                    >
                      {getPricingOverviewLabel(
                        order.pricing_locked,
                        paymentSummary.orderTotal,
                      )}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Оплата
                  </div>

                  <div className="mt-2">
                    <Badge
                      tone={
                        paymentSummary.remainingAmount > 0
                          ? "warning"
                          : paymentSummary.paidAmount > 0
                            ? "success"
                            : "muted"
                      }
                    >
                      {paymentSummary.remainingAmount > 0
                        ? "Частично оплачено"
                        : paymentSummary.paidAmount > 0
                          ? "Оплачено"
                          : "Нет оплат"}
                    </Badge>
                  </div>
                </div>

                {order.cancellation_reason ? (
                  <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-3 text-sm leading-6 text-[rgb(252_165_165)]">
                    Причина отмены: {order.cancellation_reason}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card className="self-start">
            <CardHeader className="pb-3">
              <CardTitle>Клиент и автомобиль</CardTitle>
              <CardDescription>
                Основные данные для приемки и операционной работы.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                      Клиент
                    </div>

                    <Badge tone="muted">CRM ID #{order.client_id}</Badge>
                  </div>

                  <div className="text-base font-semibold text-white">
                    {client?.full_name ?? `Клиент #${order.client_id}`}
                  </div>

                  <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    {client?.phone ?? "Телефон не загружен"}
                  </div>

                  {client?.preferences ? (
                    <div className="mt-3 line-clamp-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-sm leading-6 text-[hsl(var(--muted))]">
                      {client.preferences}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                      Автомобиль
                    </div>

                    <Badge tone="muted">CRM ID #{order.car_id}</Badge>
                  </div>

                  <div className="text-base font-semibold text-white">
                    {carLabel}
                  </div>

                  <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    {car?.plate_number ?? "Госномер не указан"}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Год
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {car?.year ?? "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                      <div className="text-xs text-[hsl(var(--muted))]">
                        Цвет
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {car?.color ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <OrderProductionChecklistPanel
            order={order}
            canReadChecklist={canReadChecklist}
            canUpdateChecklist={canUpdateChecklist}
            refreshKey={checklistRefreshKey}
            photoCountsByType={photoCountsByType}
            onAuditShouldRefresh={refreshChecklistAuditLogs}
            onPhotoUploadRequest={(photoType) =>
              setRequestedPhotoType(photoType)
            }
            onSummaryChange={setChecklistSummary}
          />

          <OrderPhotosPanel
            order={order}
            canReadPhotos={canReadOrderPhotos}
            canUploadPhotos={canUploadOrderPhotos}
            canDeletePhotos={canDeleteOrderPhotos}
            requestedPhotoType={requestedPhotoType}
            onPhotoTypeRequestHandled={() => setRequestedPhotoType(null)}
            onPhotoCountsChange={setPhotoCountsByType}
            onChecklistShouldRefresh={() =>
              setChecklistRefreshKey((current) => current + 1)
            }
            onChecklistAuditShouldRefresh={refreshChecklistAuditLogs}
          />

          <OrderItemsTable
            items={order.items}
            pricingLocked={order.pricing_locked}
            services={services}
            materialBrands={materialBrands}
            servicePackages={servicePackages}
          />

          <OrderItemMaterialsPanel
            orderItems={order.items}
            materials={materials}
            materialBrands={materialBrands}
            services={services}
            servicePackages={servicePackages}
            pricingLocked={order.pricing_locked}
            orderStatus={order.status}
            canReadMaterials={canReadMaterials}
            canConsumeMaterials={canConsumeMaterials}
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <OrderPricingPanel
            order={order}
            canReadPricing={canReadPricing}
            canManagePricing={canManagePricing}
            onChanged={handleOrderChanged}
          />

          <OrderPaymentsPanel
            order={order}
            canReadPayments={canReadPayments}
            canCreatePayments={canCreatePayments}
            canCancelPayments={canCancelPayments}
            onChanged={handleOrderChanged}
          />

          <OrderStatusActions
            order={order}
            canUpdate={canUpdateOrders}
            onChanged={handleOrderChanged}
          />
        </aside>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <OrderUnifiedTimeline
          statusHistory={statusHistory}
          orderAuditLogs={auditLogs}
          pricingAuditLogs={pricingAuditLogs}
          paymentAuditLogs={paymentAuditLogs}
          checklistAuditLogs={checklistAuditLogs}
        />

        <div className="space-y-5">
          <OrderAuditTimeline
            logs={auditLogs}
            workBays={workBays}
            users={users}
            cars={cars}
            services={services}
            materialBrands={materialBrands}
            servicePackages={servicePackages}
          />

          <OrderStatusTimeline history={statusHistory} />
        </div>
      </div>
    </PageContainer>
  );
}