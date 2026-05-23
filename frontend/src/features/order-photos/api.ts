import { apiRequest } from "@/src/lib/api/client";
import type {
  OrderPhoto,
  OrderPhotoType,
  OrderPhotoUploadPayload,
} from "@/src/features/order-photos/types";

function buildPhotosQuery(photoType?: OrderPhotoType | null) {
  const searchParams = new URLSearchParams();

  if (photoType) {
    searchParams.set("photo_type", photoType);
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function getOrderPhotos(
  orderId: number,
  photoType?: OrderPhotoType | null,
): Promise<OrderPhoto[]> {
  return apiRequest<OrderPhoto[]>(
   `/orders/${orderId}/photos${buildPhotosQuery(photoType)}`,
    {
      method: "GET",
    },
  );
}

export async function uploadOrderPhoto(
  orderId: number,
  payload: OrderPhotoUploadPayload,
): Promise<OrderPhoto> {
  const formData = new FormData();

  formData.append("file", payload.file);
  formData.append("photo_type", payload.photo_type);

  if (payload.checklist_item_id) {
    formData.append("checklist_item_id", String(payload.checklist_item_id));
  }

  if (payload.comment) {
    formData.append("comment", payload.comment);
  }

  return apiRequest<OrderPhoto>(`/orders/${orderId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteOrderPhoto(
  photoId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/order-photos/${photoId}`, {
    method: "DELETE",
  });
}