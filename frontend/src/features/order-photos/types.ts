export type OrderPhotoType =
  | "before"
  | "after"
  | "damage"
  | "progress"
  | "quality_control"
  | "other"
  | string;

export type OrderPhoto = {
  id: number;
  order_id: number;
  checklist_item_id: number | null;

  photo_type: OrderPhotoType;

  storage_provider: string;
  storage_key: string;
  file_url: string;

  original_filename: string | null;
  mime_type: string | null;
  file_size: number;

  comment: string | null;

  uploaded_by_user_id: number;
  uploaded_by_user_full_name: string | null;

  created_at: string;
};

export type OrderPhotoUploadPayload = {
  file: File;
  photo_type: OrderPhotoType;
  checklist_item_id?: number | null;
  comment?: string | null;
};