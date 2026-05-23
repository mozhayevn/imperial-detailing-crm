"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";
import {
  completeOrderChecklistItem,
  getOrderChecklist,
  reopenOrderChecklistItem,
} from "@/src/features/order-checklist/api";
import type { OrderChecklistItem } from "@/src/features/order-checklist/types";
import type { Order } from "@/src/features/orders/types";

export type OrderChecklistSummary = {
  totalCount: number;
  doneCount: number;
  requiredPendingCount: number;
  percent: number;
};

type OrderProductionChecklistPanelProps = {
  order: Order;
  canReadChecklist: boolean;
  canUpdateChecklist: boolean;
  refreshKey?: number;
  photoCountsByType?: Record<string, number>;
  onAuditShouldRefresh?: () => void | Promise<void>;
  onPhotoUploadRequest?: (photoType: string) => void;
  onSummaryChange?: (summary: OrderChecklistSummary) => void;
};

function getChecklistStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Ожидает",
    done: "Выполнено",
  };

  return labels[status] ?? status;
}

function getChecklistStatusTone(status: string) {
  if (status === "done") {
    return "success";
  }

  return "muted";
}

function getChecklistIcon(status: string) {
  if (status === "done") {
    return "✓";
  }

  return "•";
}

function getPhotoTypeByChecklistKey(key: string | null) {
  const map: Record<string, string> = {
    before_photos: "before",
    after_photos: "after",
    quality_control: "quality_control",
  };

  if (!key) {
    return null;
  }

  return map[key] ?? null;
}

function getPhotoCountLabel(count: number) {
  if (count === 1) {
    return "1 фото";
  }

  return `${count} фото`;
}

function getChecklistCardStatusLabel(isDone: boolean, isRequiredPending: boolean) {
  if (isDone) {
    return "Готово";
  }

  if (isRequiredPending) {
    return "Обязательный пункт открыт";
  }

  return "Ожидает выполнения";
}

function getChecklistCardStatusTone(isDone: boolean, isRequiredPending: boolean) {
  if (isDone) {
    return "success";
  }

  if (isRequiredPending) {
    return "warning";
  }

  return "muted";
}

function getPhotoRequirementLabel(photoType: string | null, photoCount: number) {
  if (!photoType) {
    return null;
  }

  if (photoCount > 0) {
    return "Фото загружено";
  }

  return "Фото нужно загрузить";
}

function getPhotoRequirementTone(photoType: string | null, photoCount: number) {
  if (!photoType) {
    return "muted";
  }

  return photoCount > 0 ? "success" : "warning";
}

export function OrderProductionChecklistPanel({
  order,
  canReadChecklist,
  canUpdateChecklist,
  refreshKey = 0,
  photoCountsByType = {},
  onAuditShouldRefresh,
  onPhotoUploadRequest,
  onSummaryChange,
}: OrderProductionChecklistPanelProps) {
  const [items, setItems] = useState<OrderChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCommentItemId, setActiveCommentItemId] = useState<number | null>(
    null,
  );
  const [commentByItemId, setCommentByItemId] = useState<
    Record<number, string>
  >({});
  const [submittingItemId, setSubmittingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTerminalOrderStatus =
    order.status === "canceled" || order.status === "delivered";

  const canModifyChecklist =
    canUpdateChecklist && !isTerminalOrderStatus;

  const completedItemsCount = useMemo(
    () => items.filter((item) => item.status === "done").length,
    [items],
  );

  const progressPercent = items.length > 0 ? Math.round((completedItemsCount / items.length) * 100) : 0;

  const requiredPendingItemsCount = useMemo(
    () =>
      items.filter((item) => item.is_required && item.status !== "done").length,
    [items],
  );

  const checklistSummary = useMemo(
    () => ({
      totalCount: items.length,
      doneCount: completedItemsCount,
      requiredPendingCount: requiredPendingItemsCount,
      percent: progressPercent,
    }),
    [
      items.length,
      completedItemsCount,
      requiredPendingItemsCount,
      progressPercent,
    ],
  );

  useEffect(() => {
    onSummaryChange?.(checklistSummary);
  }, [checklistSummary, onSummaryChange]);

  async function loadChecklist() {
    if (!canReadChecklist) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getOrderChecklist(order.id);
      setItems(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialChecklist() {
      try {
        if (!canReadChecklist) {
          if (isMounted) {
            setItems([]);
          }

          return;
        }

        const result = await getOrderChecklist(order.id);

        if (isMounted) {
          setItems(result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
        }
      }
    }

    void loadInitialChecklist();

    return () => {
      isMounted = false;
    };
  }, [order.id, canReadChecklist, refreshKey]);

  function updateComment(itemId: number, value: string) {
    setCommentByItemId((current) => ({
      ...current,
      [itemId]: value,
    }));
    setError(null);
  }

async function handleComplete(itemId: number) {
  setSubmittingItemId(itemId);
  setError(null);

  try {
        const updatedItem = await completeOrderChecklistItem(itemId, {
        comment: commentByItemId[itemId]?.trim() || null,
        });

        setItems((current) =>
        current.map((item) => (item.id === itemId ? updatedItem : item)),
        );

        setActiveCommentItemId(null);
        setCommentByItemId((current) => ({
        ...current,
        [itemId]: "",
        }));

        await onAuditShouldRefresh?.();
    } catch (completeError) {
        setError(getApiErrorMessage(completeError));
    } finally {
        setSubmittingItemId(null);
    }
}

  async function handleReopen(itemId: number) {
  setSubmittingItemId(itemId);
  setError(null);

  try {
    const updatedItem = await reopenOrderChecklistItem(itemId);

    setItems((current) =>
      current.map((item) => (item.id === itemId ? updatedItem : item)),
    );

    await onAuditShouldRefresh?.();
  } catch (reopenError) {
    setError(getApiErrorMessage(reopenError));
  } finally {
    setSubmittingItemId(null);
  }
}

  return (
    <Card className="self-start">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Производственный чеклист</CardTitle>
            <CardDescription>
              Контроль выполнения работ по заказу.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={progressPercent === 100 ? "success" : "primary"}>
              {progressPercent}% выполнено
            </Badge>

            {requiredPendingItemsCount > 0 ? (
              <Badge tone="warning">
                Обязательных открыто: {requiredPendingItemsCount}
              </Badge>
            ) : (
              <Badge tone="success">Обязательные закрыты</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!canReadChecklist ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            У вас нет доступа к производственному чеклисту. Нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              order_checklist.read
            </span>
            .
          </div>
        ) : null}

        {isTerminalOrderStatus ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            Заказ находится в финальном статусе. Изменение чеклиста недоступно.
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}

        {canReadChecklist ? (
          <>
            <div className="mb-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Выполнено {completedItemsCount} из {items.length}
                  </div>

                  <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                    Производственный прогресс заказа
                  </div>
                </div>

                <Badge tone={progressPercent === 100 ? "success" : "primary"}>
                  {progressPercent}%
                </Badge>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-1))]">
                <div
                  className="h-full rounded-full bg-[rgb(45_212_191)] transition-all duration-300"
                  style={{
                    width: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
                    maxWidth: "100%",
                  }}
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-xs text-[hsl(var(--muted))]">
                    Всего пунктов
                  </div>

                  <div className="mt-1 text-sm font-semibold text-white">
                    {items.length}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="text-xs text-[hsl(var(--muted))]">
                    Выполнено
                  </div>

                  <div className="mt-1 text-sm font-semibold text-white">
                    {completedItemsCount}
                  </div>
                </div>

                <div
                  className={[
                    "rounded-2xl border p-3",
                    requiredPendingItemsCount > 0
                      ? "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)]"
                      : "border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)]",
                  ].join(" ")}
                >
                  <div className="text-xs text-[hsl(var(--muted))]">
                    Обязательных открыто
                  </div>

                  <div className="mt-1 text-sm font-semibold text-white">
                    {requiredPendingItemsCount}
                  </div>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm text-[hsl(var(--muted))]">
                Загружаем чеклист...
              </div>
            ) : null}

            {items.length === 0 && !isLoading ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                Чеклист пока пустой.
              </div>
            ) : null}

            <div className="space-y-3">
              {items.map((item) => {
                const isDone = item.status === "done";
                const isRequiredPending = item.is_required && !isDone;
                const isCommentOpen = activeCommentItemId === item.id;
                const relatedPhotoType = getPhotoTypeByChecklistKey(item.key);

                const relatedPhotoCount = relatedPhotoType
                  ? (photoCountsByType[relatedPhotoType] ?? 0)
                  : 0;

                const photoRequirementLabel = getPhotoRequirementLabel(
                  relatedPhotoType,
                  relatedPhotoCount,
                );

                return (
                  <div
                    key={item.id}
                    className={[
                      "rounded-3xl border p-4 transition duration-200 hover:border-[hsl(var(--border-strong))]",
                      isDone
                        ? "border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.07)]"
                        : isRequiredPending
                          ? "border-[rgb(251_191_36_/_0.35)] bg-[rgb(251_191_36_/_0.08)]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div
                          className={[
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
                            isDone
                              ? "bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                              : isRequiredPending
                                ? "bg-[rgb(251_191_36_/_0.14)] text-[rgb(252_211_77)]"
                                : "bg-[hsl(var(--surface-3))] text-[hsl(var(--muted-foreground))]",
                          ].join(" ")}
                        >
                          {getChecklistIcon(item.status)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="break-words text-sm font-semibold text-white">
                              {item.title}
                            </div>

                            <Badge
                              tone={getChecklistCardStatusTone(
                                isDone,
                                isRequiredPending,
                              )}
                            >
                              {getChecklistCardStatusLabel(
                                isDone,
                                isRequiredPending,
                              )}
                            </Badge>

                            {item.is_required ? (
                              <Badge tone={isDone ? "success" : "warning"}>
                                {isDone
                                  ? "Обязательное закрыто"
                                  : "Обязательно"}
                              </Badge>
                            ) : (
                              <Badge tone="muted">Дополнительно</Badge>
                            )}

                            {photoRequirementLabel ? (
                              <Badge
                                tone={getPhotoRequirementTone(
                                  relatedPhotoType,
                                  relatedPhotoCount,
                                )}
                              >
                                {photoRequirementLabel}
                              </Badge>
                            ) : null}

                            {relatedPhotoType && relatedPhotoCount > 0 ? (
                              <Badge tone="primary">
                                {getPhotoCountLabel(relatedPhotoCount)}
                              </Badge>
                            ) : null}

                            {item.comment ? (
                              <Badge tone="muted">Есть комментарий</Badge>
                            ) : null}
                          </div>

                          {item.description ? (
                            <div className="mt-2 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted))]">
                              {item.description}
                            </div>
                          ) : null}

                          {isRequiredPending ? (
                            <div className="mt-3 rounded-2xl border border-[rgb(251_191_36_/_0.24)] bg-[rgb(251_191_36_/_0.06)] px-3 py-2 text-xs leading-5 text-[rgb(252_211_77)]">
                              Этот обязательный пункт еще не закрыт. Его нужно
                              выполнить перед завершением производственного
                              процесса.
                            </div>
                          ) : null}

                          {relatedPhotoType && relatedPhotoCount === 0 ? (
                            <div className="mt-3 rounded-2xl border border-[rgb(251_191_36_/_0.24)] bg-[rgb(251_191_36_/_0.06)] px-3 py-2 text-xs leading-5 text-[rgb(252_211_77)]">
                              Для этого этапа желательно загрузить фото.
                            </div>
                          ) : null}

                          {item.comment ? (
                            <div className="mt-3 line-clamp-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                              {item.comment}
                            </div>
                          ) : null}

                          {item.completed_at ? (
                            <div className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted))]">
                              Выполнено: {formatDateTime(item.completed_at)}
                              {item.completed_by_user_full_name
                                ? ` · ${item.completed_by_user_full_name}`
                                : ""}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {canModifyChecklist ? (
                        <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                          {relatedPhotoType && onPhotoUploadRequest ? (
                            relatedPhotoCount > 0 ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  onPhotoUploadRequest(relatedPhotoType)
                                }
                              >
                                Добавить фото
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  onPhotoUploadRequest(relatedPhotoType)
                                }
                              >
                                Загрузить фото
                              </Button>
                            )
                          ) : null}

                          {!isDone ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={submittingItemId === item.id}
                                onClick={() =>
                                  setActiveCommentItemId((current) =>
                                    current === item.id ? null : item.id,
                                  )
                                }
                              >
                                {isCommentOpen ? "Скрыть" : "Комментарий"}
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                disabled={submittingItemId === item.id}
                                onClick={() => void handleComplete(item.id)}
                              >
                                {submittingItemId === item.id
                                  ? "Сохраняем..."
                                  : "Выполнить"}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={submittingItemId === item.id}
                              onClick={() => void handleReopen(item.id)}
                            >
                              {submittingItemId === item.id
                                ? "Открываем..."
                                : "Переоткрыть"}
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {isCommentOpen && !isDone ? (
                      <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                        <Textarea
                          label="Комментарий к выполнению"
                          placeholder="Например: авто принято, повреждения зафиксированы..."
                          value={commentByItemId[item.id] ?? ""}
                          onChange={(event) =>
                            updateComment(item.id, event.target.value)
                          }
                        />

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={submittingItemId === item.id}
                            onClick={() => {
                              setActiveCommentItemId(null);
                              updateComment(item.id, "");
                            }}
                          >
                            Отмена
                          </Button>

                          <Button
                            type="button"
                            disabled={submittingItemId === item.id}
                            onClick={() => void handleComplete(item.id)}
                          >
                            {submittingItemId === item.id
                              ? "Сохраняем..."
                              : "Выполнить с комментарием"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}