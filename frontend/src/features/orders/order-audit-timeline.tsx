import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import type { MaterialBrand } from "@/src/features/material-brands/types";
import type { ServicePackage } from "@/src/features/service-packages/types";
import type { Service } from "@/src/features/services/types";
import type { UserWithRoles } from "@/src/features/users/types";
import type { WorkBay } from "@/src/features/work-bays/types";
import { formatDateTime } from "@/src/lib/formatters";
import { getOrderStatusLabel } from "@/src/features/orders/status";
import type { OrderAuditLog } from "@/src/features/orders/types";
import type {Car} from "@/src/features/cars/types"

type PricingAuditDetails = {
  totals?: {
    gross?: number;
    discount?: number;
    materials_cost?: number;
    labor_cost?: number;
    final_price?: number;
    profit?: number;
    warning_level?: string;
    warning?: string[];
    items_count?: number;
  };
  items?: Array<{
    order_item_id: number;
    service_id: number;
    quantity: number;
    materials_cost: number;
    labor_cost: number;
    base_cost: number;
    multiplier: number;
    pricing_source?: string;
    service_price_rule_id?: number | null;
    gross_price: number;
    discount_percent: number;
    discount_amount: number;
    final_price: number;
    profit: number;
    has_warning: boolean;
    warning_level: string;
    warning_message: string | null;
  }>;
};

function parsePricingAuditDetails(details: string | null | undefined) {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details) as PricingAuditDetails;
  } catch {
    return null;
  }
}

function getPricingAuditDetails(details: string | null | undefined) {
  const parsed = parsePricingAuditDetails(details);

  if (!parsed?.totals && !parsed?.items?.length) {
    return null;
  }

  return parsed;
}

function getPricingSourceLabel(
  pricingSource: string | null | undefined,
  ruleId: number | null | undefined,
) {
  if (pricingSource === "service_price_rule") {
    return ruleId ? `Правило цены #${ruleId}` : "Правило цены";
  }

  if (pricingSource === "fallback_multiplier") {
    return "Fallback multiplier";
  }

  return "Источник не указан";
}

type OrderAuditTimelineProps = {
  logs: OrderAuditLog[];
  workBays?: WorkBay[];
  users?: UserWithRoles[];
  cars?: Car[];
  services?: Service[];
  materialBrands?: MaterialBrand[];
  servicePackages?: ServicePackage[];
};

type FieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

type ParsedAuditDetails = {
  order_before?: Record<string, unknown>;
  order_after?: Record<string, unknown>;
  items_added?: Record<string, unknown>[];
  items_updated?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }[];
  items_removed?: Record<string, unknown>[];
};

const fieldLabels: Record<string, string> = {
  id: "ID",
  client_id: "Клиент",
  car_id: "Автомобиль",
  assigned_user_id: "Мастер",
  work_bay_id: "Рабочий бокс",
  scheduled_at: "Запланировано",
  planned_start_at: "Начало работ",
  planned_end_at: "Конец работ",
  comment: "Комментарий",
  status: "Статус",

  service_id: "Услуга",
  material_brand_id: "Бренд материала",
  service_package_id: "Пакет услуги",
  quantity: "Количество",
  discount_percent: "Скидка",
  discount_reason: "Причина скидки",
  price: "Цена",
  total: "Итог",
  base_cost_snapshot: "Себестоимость snapshot",
  gross_price_snapshot: "Gross price snapshot",
  discount_amount_snapshot: "Сумма скидки snapshot",
  final_price_snapshot: "Финальная цена snapshot",
  profit_snapshot: "Прибыль snapshot",
};

const hiddenFields = new Set([
  "order_id",
  "discount_applied_by_user_id",
  "discount_amount",
  "base_cost_snapshot",
  "gross_price_snapshot",
  "discount_amount_snapshot",
  "final_price_snapshot",
  "profit_snapshot",
  "price",
  "total",
]);

function getFieldLabel(field: string) {
  return fieldLabels[field] ?? field;
}

function safeParseJson(value: string | null | undefined): ParsedAuditDetails | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object") {
      return parsed as ParsedAuditDetails;
    }

    return null;
  } catch {
    return null;
  }
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function normalizeValue(value: unknown) {
  if (isEmptyValue(value)) {
    return null;
  }

  return String(value);
}

function valuesAreEqual(before: unknown, after: unknown) {
  return normalizeValue(before) === normalizeValue(after);
}

function formatFieldValue(field: string, value: unknown) {
  if (isEmptyValue(value)) {
    return "—";
  }

  if (field === "status" && typeof value === "string") {
    return getOrderStatusLabel(value);
  }

  if (
    field === "scheduled_at" ||
    field === "planned_start_at" ||
    field === "planned_end_at"
  ) {
    return formatDateTime(String(value));
  }

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  return String(value);
}

function formatRelatedEntityValue(
  field: string,
  value: unknown,
  workBays: WorkBay[],
  users: UserWithRoles[],
  cars: Car[],
  services: Service[],
  materialBrands: MaterialBrand[],
  servicePackages: ServicePackage[],
) {
  if (isEmptyValue(value)) {
    return "—";
  }

  const numericValue = Number(value);

  if (field === "client_id" && Number.isFinite(numericValue)) {
    return `Клиент #${numericValue}`;
  }

  if (field === "car_id" && Number.isFinite(numericValue)) {
  const car = cars.find((item) => item.id === numericValue);

  if (car) {
    return [
      [car.brand, car.model].filter(Boolean).join(" "),
      car.plate_number,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return `Автомобиль #${numericValue}`;
}

  if (field === "assigned_user_id" && Number.isFinite(numericValue)) {
    const user = users.find((item) => item.id === numericValue);

    return user?.full_name ?? `Сотрудник #${numericValue}`;
  }

  if (field === "work_bay_id" && Number.isFinite(numericValue)) {
    const workBay = workBays.find((item) => item.id === numericValue);

    return workBay?.name ?? `Бокс #${numericValue}`;
  }

  if (field === "service_id" && Number.isFinite(numericValue)) {
    const service = services.find((item) => item.id === numericValue);

    return service?.name ?? `Услуга #${numericValue}`;
  }

  if (field === "material_brand_id" && Number.isFinite(numericValue)) {
    const brand = materialBrands.find((item) => item.id === numericValue);

    return brand?.name ?? `Бренд #${numericValue}`;
  }

  if (field === "service_package_id" && Number.isFinite(numericValue)) {
    const servicePackage = servicePackages.find(
      (item) => item.id === numericValue,
    );

    return servicePackage?.name ?? `Пакет #${numericValue}`;
  }

  return formatFieldValue(field, value);
}

function getFieldChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  workBays: WorkBay[],
  users: UserWithRoles[],
  cars: Car[],
  services: Service[],
  materialBrands: MaterialBrand[],
  servicePackages: ServicePackage[],
): FieldChange[] {
  if (!before || !after) {
    return [];
  }

  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  );

  return keys
    .filter((key) => !hiddenFields.has(key))
    .filter((key) => !valuesAreEqual(before[key], after[key]))
    .map((key) => ({
      field: key,
      label: getFieldLabel(key),
      before: formatRelatedEntityValue(
        key,
        before[key],
        workBays,
        users,
        cars,
        services,
        materialBrands,
        servicePackages,
      ),
      after: formatRelatedEntityValue(
        key,
        after[key],
        workBays,
        users,
        cars,
        services,
        materialBrands,
        servicePackages,
      ),
    }));
}

function getItemTitle(
  item: Record<string, unknown> | undefined,
  services: Service[],
) {
  if (!item) {
    return "Позиция заказа";
  }

  const itemId = item.id ? `#${item.id}` : "";
  const serviceId = Number(item.service_id);
  const service = Number.isFinite(serviceId)
    ? services.find((serviceItem) => serviceItem.id === serviceId)
    : null;

  if (service?.name) {
    return `${service.name} ${itemId}`.trim();
  }

  return `Позиция ${itemId}`.trim();
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    created: "Создание заказа",
    updated: "Обновление заказа",
    status_changed: "Смена статуса",
    canceled: "Отмена заказа",
    rescheduled: "Перенос заказа",
    pricing_applied: "Pricing зафиксирован",
    pricing_unlocked: "Pricing разблокирован",
  };

  return labels[action] ?? action;
}

function getActionTone(action: string) {
  if (action === "canceled") {
    return "danger";
  }

  if (action === "status_changed" || action === "pricing_unlocked") {
    return "warning";
  }

  if (action === "created" || action === "pricing_applied") {
    return "success";
  }

  return "primary";
}

function getPlainDetailsText(details: string | null | undefined) {
  if (!details) {
    return null;
  }

  if (details.startsWith("{") || details.startsWith("[")) {
    return null;
  }

  if (details.startsWith("Status changed from ")) {
    const cleaned = details
      .replace("Status changed from ", "")
      .replace(" to ", " → ");

    const [fromStatus, toStatus] = cleaned.split(" → ");

    if (fromStatus && toStatus) {
      return `Статус изменен: ${getOrderStatusLabel(
        fromStatus,
      )} → ${getOrderStatusLabel(toStatus)}`;
    }
  }

  if (details.startsWith("Order canceled. Reason:")) {
    return details.replace("Order canceled. Reason:", "Причина отмены:");
  }

  return details;
}

function ChangeBlock({ change }: { change: FieldChange }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
      <div className="mb-3 text-sm font-semibold text-white">
        {change.label}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--muted))]">
            Было
          </div>
          <div className="mt-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">
            {change.before}
          </div>
        </div>

        <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(94_234_212)]">
            Стало
          </div>
          <div className="mt-2 text-sm font-medium text-white">
            {change.after}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderAuditTimeline({
  logs,
  workBays = [],
  users = [],
  cars = [],
  services = [],
  materialBrands = [],
  servicePackages = [],
}: OrderAuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История изменений</CardTitle>
          <CardDescription>
            Операционная история изменений заказа.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm text-[hsl(var(--muted))]">
            История изменений пока пустая.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История изменений</CardTitle>
        <CardDescription>
          Понятная операционная история действий по заказу.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => {
            const parsedPricingDetails = getPricingAuditDetails(log.details);
            const parsedDetails = parsedPricingDetails
              ? null
              : safeParseJson(log.details);
            const plainText = getPlainDetailsText(log.details);

            const orderChanges = getFieldChanges(
              parsedDetails?.order_before,
              parsedDetails?.order_after,
              workBays,
              users,
              cars,
              services,
              materialBrands,
              servicePackages,
            );

            const itemsAdded = parsedDetails?.items_added ?? [];
            const itemsRemoved = parsedDetails?.items_removed ?? [];
            const itemsUpdated = parsedDetails?.items_updated ?? [];

            const itemUpdateChanges = itemsUpdated.map((itemUpdate) => ({
              before: itemUpdate.before,
              after: itemUpdate.after,
              changes: getFieldChanges(
                itemUpdate.before,
                itemUpdate.after,
                workBays,
                users,
                cars,
                services,
                materialBrands,
                servicePackages,
              ),
            }));

            const totalItemChanges = itemUpdateChanges.reduce(
              (sum, item) => sum + item.changes.length,
              0,
            );

            const totalChanges =
              orderChanges.length +
              itemsAdded.length +
              itemsRemoved.length +
              totalItemChanges;

            return (
              <div
                key={log.id}
                className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge tone={getActionTone(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>

                    <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted))]">
                      <div>{formatDateTime(log.created_at)}</div>
                      <div>
                        Инициатор:{" "}
                        {log.actor_user_full_name ??
                          `Сотрудник #${log.actor_user_id}`}
                      </div>
                    </div>
                  </div>

                  <Badge tone="muted">Запись аудита №{log.id}</Badge>
                </div>

                {parsedPricingDetails ? (
                  <div className="mt-4 space-y-5">
                    {parsedPricingDetails.totals ? (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Gross
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {parsedPricingDetails.totals.gross?.toLocaleString(
                              "ru-RU",
                            ) ?? 0}{" "}
                            ₸
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Final
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {parsedPricingDetails.totals.final_price?.toLocaleString(
                              "ru-RU",
                            ) ?? 0}{" "}
                            ₸
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Profit
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {parsedPricingDetails.totals.profit?.toLocaleString(
                              "ru-RU",
                            ) ?? 0}{" "}
                            ₸
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                          <div className="text-xs text-[hsl(var(--muted))]">
                            Items
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {parsedPricingDetails.totals.items_count ??
                              parsedPricingDetails.items?.length ??
                              0}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {parsedPricingDetails.items?.length ? (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                          Источник цены по позициям
                        </div>

                        {parsedPricingDetails.items.map((item) => (
                          <div
                            key={item.order_item_id}
                            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-sm font-semibold text-white">
                                  Позиция #{item.order_item_id}
                                </div>

                                <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                                  Gross:{" "}
                                  {item.gross_price.toLocaleString("ru-RU")} ₸ ·
                                  Final:{" "}
                                  {item.final_price.toLocaleString("ru-RU")} ₸ ·
                                  Profit: {item.profit.toLocaleString("ru-RU")}{" "}
                                  ₸
                                </div>
                              </div>

                              <Badge
                                tone={
                                  item.pricing_source === "service_price_rule"
                                    ? "success"
                                    : "muted"
                                }
                              >
                                {getPricingSourceLabel(
                                  item.pricing_source,
                                  item.service_price_rule_id,
                                )}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {parsedPricingDetails.totals?.warning?.length ? (
                      <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
                        <div className="mb-2 font-semibold">
                          Предупреждения pricing
                        </div>

                        <div className="space-y-1">
                          {parsedPricingDetails.totals.warning.map(
                            (warning, index) => (
                              <div key={`${log.id}-pricing-warning-${index}`}>
                                {warning}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : parsedDetails ? (
                  <div className="mt-4 space-y-5">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Всего изменений
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {totalChanges}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Добавлено позиций
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {itemsAdded.length}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Изменено позиций
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {itemsUpdated.length}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                        <div className="text-xs text-[hsl(var(--muted))]">
                          Удалено позиций
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {itemsRemoved.length}
                        </div>
                      </div>
                    </div>

                    {orderChanges.length > 0 ? (
                      <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                          Изменения заказа
                        </div>

                        <div className="space-y-3">
                          {orderChanges.map((change) => (
                            <ChangeBlock
                              key={`${log.id}-order-${change.field}`}
                              change={change}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {itemsAdded.length > 0 ? (
                      <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                          Добавленные позиции
                        </div>

                        <div className="space-y-3">
                          {itemsAdded.map((item, index) => (
                            <div
                              key={`${log.id}-added-${index}`}
                              className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-3"
                            >
                              <div className="text-sm font-semibold text-white">
                                {getItemTitle(item, services)}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(item)
                                  .filter(([key]) => !hiddenFields.has(key))
                                  .map(([key, value]) => (
                                    <Badge key={key} tone="muted">
                                      {getFieldLabel(key)}:{" "}
                                      {formatRelatedEntityValue(
                                        key,
                                        value,
                                        workBays,
                                        users,
                                        cars,
                                        services,
                                        materialBrands,
                                        servicePackages,
                                      )}
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {itemUpdateChanges.length > 0 ? (
                      <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                          Изменения позиций заказа
                        </div>

                        <div className="space-y-3">
                          {itemUpdateChanges.map((itemUpdate, index) => {
                            const itemTitle = getItemTitle(
                              itemUpdate.after ?? itemUpdate.before,
                              services,
                            );

                            return (
                              <div
                                key={`${log.id}-updated-${index}`}
                                className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                              >
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-semibold text-white">
                                    {itemTitle}
                                  </div>

                                  {itemUpdate.after?.id ||
                                  itemUpdate.before?.id ? (
                                    <Badge tone="muted">
                                      Позиция #
                                      {String(
                                        itemUpdate.after?.id ??
                                          itemUpdate.before?.id,
                                      )}
                                    </Badge>
                                  ) : null}
                                </div>

                                <div className="space-y-3">
                                  {itemUpdate.changes.map((change) => (
                                    <ChangeBlock
                                      key={`${log.id}-item-${index}-${change.field}`}
                                      change={change}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {itemsRemoved.length > 0 ? (
                      <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                          Удаленные позиции
                        </div>

                        <div className="space-y-3">
                          {itemsRemoved.map((item, index) => (
                            <div
                              key={`${log.id}-removed-${index}`}
                              className="rounded-2xl border border-[rgb(248_113_113_/_0.22)] bg-[rgb(248_113_113_/_0.08)] p-3"
                            >
                              <div className="text-sm font-semibold text-white">
                                {getItemTitle(item, services)}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(item)
                                  .filter(([key]) => !hiddenFields.has(key))
                                  .map(([key, value]) => (
                                    <Badge key={key} tone="muted">
                                      {getFieldLabel(key)}:{" "}
                                      {formatRelatedEntityValue(
                                        key,
                                        value,
                                        workBays,
                                        users,
                                        cars,
                                        services,
                                        materialBrands,
                                        servicePackages,
                                      )}
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {totalChanges === 0 ? (
                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
                        Изменений в заказе не найдено.
                      </div>
                    ) : null}
                  </div>
                ) : plainText ? (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    {plainText}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
                    Детали действия отсутствуют.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}