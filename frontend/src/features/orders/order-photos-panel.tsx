"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Combobox } from "@/src/components/ui/combobox";
import { Textarea } from "@/src/components/ui/textarea";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";
import {
  deleteOrderPhoto,
  getOrderPhotos,
  uploadOrderPhoto,
} from "@/src/features/order-photos/api";
import type {
  OrderPhoto,
  OrderPhotoType,
} from "@/src/features/order-photos/types";
import type { Order } from "@/src/features/orders/types";

type OrderPhotosPanelProps = {
  order: Order;
  canReadPhotos: boolean;
  canUploadPhotos: boolean;
  canDeletePhotos: boolean;
  requestedPhotoType?: string | null;
  onPhotoTypeRequestHandled?: () => void;
  onPhotoCountsChange?: (counts: Record<string, number>) => void;
  onChecklistShouldRefresh?: () => void;
  onChecklistAuditShouldRefresh?: () => void | Promise<void>;
};

type UploadFormState = {
  photo_type: OrderPhotoType;
  comment: string;
};

const defaultUploadForm: UploadFormState = {
  photo_type: "before",
  comment: "",
};

const photoTypeOptions: {
  value: OrderPhotoType;
  label: string;
  description: string;
}[] = [
  {
    value: "before",
    label: "Фото до работ",
    description: "Состояние автомобиля перед началом работ.",
  },
  {
    value: "after",
    label: "Фото после работ",
    description: "Результат после завершения работ.",
  },
  {
    value: "damage",
    label: "Повреждения",
    description: "Сколы, царапины, дефекты и спорные зоны.",
  },
  {
    value: "progress",
    label: "Процесс работ",
    description: "Промежуточные фото выполнения работ.",
  },
  {
    value: "quality_control",
    label: "Контроль качества",
    description: "Фото после внутренней проверки качества.",
  },
  {
    value: "other",
    label: "Другое",
    description: "Дополнительные фото по заказу.",
  },
];

const comboboxPhotoTypeOptions = photoTypeOptions.map((type) => ({
  value: type.value,
  label: type.label,
}));

function getPhotoTypeLabel(photoType: string) {
  const found = photoTypeOptions.find((item) => item.value === photoType);

  return found?.label ?? photoType;
}

function getPhotoTypeDescription(photoType: string) {
  const found = photoTypeOptions.find((item) => item.value === photoType);

  return found?.description ?? "Фотографии по заказу.";
}

function getPhotoTypeTone(photoType: string) {
  if (photoType === "before") {
    return "primary";
  }

  if (photoType === "after") {
    return "success";
  }

  if (photoType === "quality_control") {
    return "warning";
  }

  if (photoType === "damage") {
    return "danger";
  }

  return "muted";
}

function getUploadHint(photoType: OrderPhotoType) {
  if (photoType === "before") {
    return "Сфотографируйте автомобиль до начала работ: общий вид, проблемные зоны, повреждения и состояние салона/кузова.";
  }

  if (photoType === "progress") {
    return "Добавьте промежуточные фото процесса: демонтаж, подготовка, нанесение материалов, этапы выполнения.";
  }

  if (photoType === "after") {
    return "Покажите итоговый результат после выполнения работ: общий вид и крупные планы.";
  }

  if (photoType === "quality_control") {
    return "Зафиксируйте внутреннюю проверку качества перед выдачей автомобиля клиенту.";
  }

  if (photoType === "damage") {
    return "Зафиксируйте царапины, сколы, вмятины, спорные зоны и другие дефекты.";
  }

  return "Добавьте дополнительные фото, которые могут быть полезны для истории заказа.";
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getAbsoluteFileUrl(fileUrl: string) {
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:8000";

  return `${baseUrl}${fileUrl}`;
}

export function OrderPhotosPanel({
  order,
  canReadPhotos,
  canUploadPhotos,
  canDeletePhotos,
  requestedPhotoType,
  onPhotoTypeRequestHandled,
  onPhotoCountsChange,
  onChecklistShouldRefresh,
  onChecklistAuditShouldRefresh,
}: OrderPhotosPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [photos, setPhotos] = useState<OrderPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedPhotoTypeFilter, setSelectedPhotoTypeFilter] = useState<
    OrderPhotoType | "all"
    >("all");
  const [uploadForm, setUploadForm] =
    useState<UploadFormState>(defaultUploadForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submittingUpload, setSubmittingUpload] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<OrderPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTerminalOrderStatus =
    order.status === "canceled" || order.status === "delivered";

  const canUploadForOrder = canUploadPhotos;

  const photosByType = useMemo(() => {
    const grouped = new Map<OrderPhotoType, OrderPhoto[]>();

    for (const option of photoTypeOptions) {
      grouped.set(option.value, []);
    }

    for (const photo of photos) {
      const current = grouped.get(photo.photo_type) ?? [];
      current.push(photo);
      grouped.set(photo.photo_type, current);
    }

    return grouped;
  }, [photos]);

  const filteredPhotoTypeOptions = useMemo(() => {
    if (selectedPhotoTypeFilter === "all") {
      return photoTypeOptions;
    }

    return photoTypeOptions.filter(
      (photoType) => photoType.value === selectedPhotoTypeFilter,
    );
  }, [selectedPhotoTypeFilter]);

  const totalPhotosCount = photos.length;
  
  const photoCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const photo of photos) {
      counts[photo.photo_type] = (counts[photo.photo_type] ?? 0) + 1;
    }

    return counts;
  }, [photos]);

  const beforePhotosCount = photoCountsByType.before ?? 0;
  const afterPhotosCount = photoCountsByType.after ?? 0;
  const qualityControlPhotosCount = photoCountsByType.quality_control ?? 0;
  const damagePhotosCount = photoCountsByType.damage ?? 0;

  const requiredPhotoStepsCompleted =
    beforePhotosCount > 0 &&
    afterPhotosCount > 0 &&
    qualityControlPhotosCount > 0;

  useEffect(() => {
    onPhotoCountsChange?.(photoCountsByType);
  }, [photoCountsByType, onPhotoCountsChange]);

  async function loadPhotos() {
    if (!canReadPhotos) {
      setPhotos([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getOrderPhotos(order.id);
      setPhotos(result);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialPhotos() {
      try {
        if (!canReadPhotos) {
          if (isMounted) {
            setPhotos([]);
          }

          return;
        }

        const result = await getOrderPhotos(order.id);

        if (isMounted) {
          setPhotos(result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
        }
      }
    }

    void loadInitialPhotos();

    return () => {
      isMounted = false;
    };
  }, [order.id, canReadPhotos]);

  useEffect(() => {
    if (!requestedPhotoType) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUploadForm((current) => ({
        ...current,
        photo_type: requestedPhotoType as OrderPhotoType,
      }));

      setIsUploadOpen(true);
      setError(null);
      onPhotoTypeRequestHandled?.();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [requestedPhotoType, onPhotoTypeRequestHandled]);

  function updateUploadForm(patch: Partial<UploadFormState>) {
    setUploadForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function resetUploadForm() {
    setUploadForm(defaultUploadForm);
    setSelectedFiles([]);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUploadPhoto() {
    if (selectedFiles.length === 0) {
      setError("Выберите хотя бы одно фото для загрузки.");
      return;
    }

    setSubmittingUpload(true);
    setError(null);

    try {
      const uploadedPhotos: OrderPhoto[] = [];

      for (const file of selectedFiles) {
        const uploadedPhoto = await uploadOrderPhoto(order.id, {
          file,
          photo_type: uploadForm.photo_type,
          comment: uploadForm.comment.trim() || null,
        });

        uploadedPhotos.push(uploadedPhoto);
      }

      setPhotos((current) => [...uploadedPhotos, ...current]);
      resetUploadForm();
      setIsUploadOpen(false);

      if (
        uploadForm.photo_type === "before" ||
        uploadForm.photo_type === "after" ||
        uploadForm.photo_type === "quality_control"
      ) {
        onChecklistShouldRefresh?.();
        await onChecklistAuditShouldRefresh?.();
      }
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setSubmittingUpload(false);
    }
  }

  async function handleDeletePhoto(photoId: number) {
    setDeletingPhotoId(photoId);
    setError(null);

    try {
      await deleteOrderPhoto(photoId);

      setPhotos((current) => current.filter((photo) => photo.id !== photoId));

      setPreviewPhoto((current) =>
        current?.id === photoId ? null : current,
      );
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <Card className="self-start">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Фотографии заказа</CardTitle>
            <CardDescription>
              Фото до работ, процесс, результат, повреждения и контроль
              качества.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={totalPhotosCount > 0 ? "primary" : "muted"}>
              {totalPhotosCount} фото
            </Badge>

            <Badge tone={requiredPhotoStepsCompleted ? "success" : "warning"}>
              {requiredPhotoStepsCompleted
                ? "Основные фото есть"
                : "Основные фото не закрыты"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!canReadPhotos ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm leading-6 text-[hsl(var(--muted))]">
            У вас нет доступа к фотографиям заказа. Нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              order_photos.read
            </span>
            .
          </div>
        ) : null}

        {isTerminalOrderStatus ? (
          <div className="mb-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
            Заказ находится в финальном статусе. Новые фото можно добавить как
            доказательную историю, но удаление фото недоступно.
          </div>
        ) : null}

        {/* {order.pricing_locked ? (
          <div className="mb-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4 text-sm leading-6 text-[rgb(252_211_77)]">
            Pricing зафиксирован. Чтобы изменить производственные данные,
            сначала выполните unlock pricing.
          </div>
        ) : null} */}

        {error ? (
          <div className="mb-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}

        {canReadPhotos ? (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                <div className="text-xs text-[hsl(var(--muted))]">
                  Всего фото
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {totalPhotosCount}
                </div>
              </div>

              <div
                className={[
                  "rounded-2xl border p-3",
                  beforePhotosCount > 0
                    ? "border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)]"
                    : "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)]",
                ].join(" ")}
              >
                <div className="text-xs text-[hsl(var(--muted))]">До работ</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {beforePhotosCount}
                </div>
              </div>

              <div
                className={[
                  "rounded-2xl border p-3",
                  afterPhotosCount > 0
                    ? "border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)]"
                    : "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)]",
                ].join(" ")}
              >
                <div className="text-xs text-[hsl(var(--muted))]">
                  После работ
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {afterPhotosCount}
                </div>
              </div>

              <div
                className={[
                  "rounded-2xl border p-3",
                  qualityControlPhotosCount > 0
                    ? "border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)]"
                    : "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)]",
                ].join(" ")}
              >
                <div className="text-xs text-[hsl(var(--muted))]">
                  Контроль качества
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {qualityControlPhotosCount}
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Галерея заказа
                  </div>

                  <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                    Загружайте фото по этапам: до работ, процесс, результат и
                    контроль качества. Можно выбрать сразу несколько файлов
                    одного типа.
                  </div>
                </div>

                {canUploadForOrder ? (
                  <Button
                    type="button"
                    variant={isUploadOpen ? "secondary" : undefined}
                    onClick={() => {
                      setIsUploadOpen((current) => !current);
                      setError(null);
                    }}
                  >
                    {isUploadOpen ? "Скрыть форму" : "Загрузить фото"}
                  </Button>
                ) : null}
              </div>

              {!requiredPhotoStepsCompleted ? (
                <div className="mt-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-3 text-xs leading-5 text-[rgb(252_211_77)]">
                  Для полного фотоотчета желательно загрузить фото до работ,
                  после работ и фото контроля качества.
                </div>
              ) : null}
            </div>

            {photos.length > 0 ? (
              <div className="mb-5 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                  Фильтр фотографий
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={[
                      "rounded-full border px-3 py-2 text-xs font-semibold transition",
                      selectedPhotoTypeFilter === "all"
                        ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                    ].join(" ")}
                    onClick={() => setSelectedPhotoTypeFilter("all")}
                  >
                    Все · {totalPhotosCount}
                  </button>

                  {photoTypeOptions.map((photoType) => {
                    const count =
                      photosByType.get(photoType.value)?.length ?? 0;

                    if (count === 0) {
                      return null;
                    }

                    const isActive =
                      selectedPhotoTypeFilter === photoType.value;

                    return (
                      <button
                        key={photoType.value}
                        type="button"
                        className={[
                          "rounded-full border px-3 py-2 text-xs font-semibold transition",
                          isActive
                            ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                        ].join(" ")}
                        onClick={() =>
                          setSelectedPhotoTypeFilter(photoType.value)
                        }
                      >
                        {photoType.label} · {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {isUploadOpen && canUploadForOrder ? (
              <div className="mb-5 rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.06)] p-4">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Загрузка фотографий
                    </div>

                    <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                      Выберите тип фото, добавьте один или несколько файлов и
                      при необходимости оставьте комментарий.
                    </div>
                  </div>

                  <Badge tone={getPhotoTypeTone(uploadForm.photo_type)}>
                    {getPhotoTypeLabel(uploadForm.photo_type)}
                  </Badge>
                </div>

                <div className="mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                    Быстрый выбор типа
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {photoTypeOptions.map((photoType) => {
                      const isSelected =
                        uploadForm.photo_type === photoType.value;

                      return (
                        <button
                          key={photoType.value}
                          type="button"
                          className={[
                            "rounded-full border px-3 py-2 text-xs font-semibold transition",
                            isSelected
                              ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                              : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                          ].join(" ")}
                          onClick={() =>
                            updateUploadForm({
                              photo_type: photoType.value,
                            })
                          }
                        >
                          {photoType.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-4">
                    <Combobox
                      label="Тип фото"
                      placeholder="Выберите тип фото"
                      value={uploadForm.photo_type}
                      options={comboboxPhotoTypeOptions}
                      onChange={(value) =>
                        updateUploadForm({
                          photo_type: String(value) as OrderPhotoType,
                        })
                      }
                    />

                    <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-3 text-xs leading-5 text-[rgb(252_211_77)]">
                      {getUploadHint(uploadForm.photo_type)}
                    </div>

                    <Textarea
                      label="Комментарий"
                      placeholder="Например: царапина на правом крыле, фото до начала работ..."
                      value={uploadForm.comment}
                      onChange={(event) =>
                        updateUploadForm({
                          comment: event.target.value,
                        })
                      }
                    />
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white">
                      Файлы
                    </span>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="block w-full cursor-pointer rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] file:mr-4 file:rounded-xl file:border-0 file:bg-[hsl(var(--primary))] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        setSelectedFiles(files);
                        setError(null);
                      }}
                    />

                    {selectedFiles.length > 0 ? (
                      <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                            Выбрано файлов
                          </div>

                          <Badge tone="primary">{selectedFiles.length}</Badge>
                        </div>

                        <div className="max-h-56 space-y-2 overflow-auto pr-1">
                          {selectedFiles.map((file, index) => (
                            <div
                              key={`${file.name}-${file.size}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-[hsl(var(--surface-2))] px-3 py-2 text-xs"
                            >
                              <span className="min-w-0 truncate text-[hsl(var(--muted-foreground))]">
                                {file.name}
                              </span>

                              <span className="shrink-0 text-[hsl(var(--muted))]">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-1))] p-5 text-center text-xs leading-5 text-[hsl(var(--muted))]">
                        Выберите изображения в формате JPG, PNG или WEBP. Можно
                        загрузить несколько файлов сразу.
                      </div>
                    )}
                  </label>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submittingUpload}
                    onClick={() => {
                      resetUploadForm();
                      setIsUploadOpen(false);
                    }}
                  >
                    Отмена
                  </Button>

                  <Button
                    type="button"
                    disabled={submittingUpload}
                    onClick={() => void handleUploadPhoto()}
                  >
                    {submittingUpload
                      ? "Загружаем..."
                      : selectedFiles.length > 1
                        ? `Загрузить ${selectedFiles.length} фото`
                        : "Загрузить фото"}
                  </Button>
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 text-sm text-[hsl(var(--muted))]">
                Загружаем фотографии...
              </div>
            ) : null}

            {photos.length === 0 && !isLoading ? (
              <div className="rounded-3xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center">
                <div className="text-sm font-semibold text-white">
                  Фотографии пока не загружены
                </div>

                <div className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted))]">
                  Начните с фото до работ, чтобы зафиксировать исходное
                  состояние автомобиля. Позже можно добавить процесс, результат
                  и контроль качества.
                </div>

                {canUploadForOrder ? (
                  <div className="mt-5 flex justify-center">
                    <Button
                      type="button"
                      onClick={() => {
                        updateUploadForm({ photo_type: "before" });
                        setIsUploadOpen(true);
                      }}
                    >
                      Загрузить фото до работ
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {photos.length > 0 &&
            selectedPhotoTypeFilter !== "all" &&
            (photosByType.get(selectedPhotoTypeFilter)?.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-6 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                Для выбранного типа пока нет фотографий.
              </div>
            ) : null}

            <div className="space-y-5">
              {filteredPhotoTypeOptions.map((photoType) => {
                const groupPhotos = photosByType.get(photoType.value) ?? [];

                if (groupPhotos.length === 0) {
                  return null;
                }

                return (
                  <div
                    key={photoType.value}
                    className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition duration-200 hover:border-[rgb(45_212_191_/_0.24)]"
                  >
                    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white">
                            {photoType.label}
                          </div>

                          <Badge tone={getPhotoTypeTone(photoType.value)}>
                            {groupPhotos.length} фото
                          </Badge>
                        </div>

                        <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                          {photoType.description}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {groupPhotos.map((photo) => {
                        const photoUrl = getAbsoluteFileUrl(photo.file_url);

                        return (
                          <div
                            key={photo.id}
                            className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] transition duration-200 hover:-translate-y-0.5 hover:border-[rgb(45_212_191_/_0.24)] hover:shadow-lg hover:shadow-black/20"
                          >
                            <button
                              type="button"
                              className="block aspect-[4/3] w-full overflow-hidden bg-[hsl(var(--surface-3))]"
                              onClick={() => setPreviewPhoto(photo)}
                            >
                              <img
                                src={photoUrl}
                                alt={
                                  photo.original_filename ??
                                  getPhotoTypeLabel(photo.photo_type)
                                }
                                className="h-full w-full object-cover transition duration-200 hover:scale-105"
                              />
                            </button>

                            <div className="p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  tone={getPhotoTypeTone(photo.photo_type)}
                                >
                                  {getPhotoTypeLabel(photo.photo_type)}
                                </Badge>

                                <Badge tone="muted">
                                  {formatFileSize(photo.file_size)}
                                </Badge>
                              </div>

                              <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                                <div>{formatDateTime(photo.created_at)}</div>
                                <div>
                                  Загрузил:{" "}
                                  {photo.uploaded_by_user_full_name ??
                                    `Сотрудник #${photo.uploaded_by_user_id}`}
                                </div>
                              </div>

                              {photo.comment ? (
                                <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                                  {photo.comment}
                                </div>
                              ) : null}

                              {canDeletePhotos && !isTerminalOrderStatus ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="mt-3"
                                  disabled={deletingPhotoId === photo.id}
                                  onClick={() =>
                                    void handleDeletePhoto(photo.id)
                                  }
                                >
                                  {deletingPhotoId === photo.id
                                    ? "Удаляем..."
                                    : "Удалить фото"}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {previewPhoto ? (
              <div
                className="fixed inset-y-0 right-0 left-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm xl:left-[236px]"
                onClick={() => setPreviewPhoto(null)}
              >
                <div
                  className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white">
                          {getPhotoTypeLabel(previewPhoto.photo_type)}
                        </div>

                        <Badge tone={getPhotoTypeTone(previewPhoto.photo_type)}>
                          {getPhotoTypeLabel(previewPhoto.photo_type)}
                        </Badge>
                      </div>

                      <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                        {getPhotoTypeDescription(previewPhoto.photo_type)}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setPreviewPhoto(null)}
                    >
                      Закрыть
                    </Button>
                  </div>

                  <div className="max-h-[68vh] overflow-auto bg-black">
                    <img
                      src={getAbsoluteFileUrl(previewPhoto.file_url)}
                      alt={
                        previewPhoto.original_filename ??
                        getPhotoTypeLabel(previewPhoto.photo_type)
                      }
                      className="mx-auto max-h-[68vh] object-contain"
                    />
                  </div>

                  <div className="grid gap-3 border-t border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted))] sm:grid-cols-4">
                    <div>
                      <div className="text-[hsl(var(--muted-foreground))]">
                        Файл
                      </div>
                      <div className="mt-1 truncate">
                        {previewPhoto.original_filename ?? "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[hsl(var(--muted-foreground))]">
                        Размер
                      </div>
                      <div className="mt-1">
                        {formatFileSize(previewPhoto.file_size)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[hsl(var(--muted-foreground))]">
                        Загружено
                      </div>
                      <div className="mt-1">
                        {formatDateTime(previewPhoto.created_at)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[hsl(var(--muted-foreground))]">
                        Автор
                      </div>
                      <div className="mt-1 truncate">
                        {previewPhoto.uploaded_by_user_full_name ??
                          `Сотрудник #${previewPhoto.uploaded_by_user_id}`}
                      </div>
                    </div>
                  </div>

                  {previewPhoto.comment ? (
                    <div className="border-t border-[hsl(var(--border))] p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Комментарий
                      </div>

                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                        {previewPhoto.comment}
                      </div>
                    </div>
                  ) : null}

                  {canDeletePhotos && !isTerminalOrderStatus ? (
                    <div className="flex justify-end border-t border-[hsl(var(--border))] p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={deletingPhotoId === previewPhoto.id}
                        onClick={() => void handleDeletePhoto(previewPhoto.id)}
                      >
                        {deletingPhotoId === previewPhoto.id
                          ? "Удаляем..."
                          : "Удалить фото"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}