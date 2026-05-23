export type WorkBay = {
  id: number;
  name: string;
  description: string | null;
  is_active?: boolean;
};

export type WorkBayCreatePayload = {
  name: string;
  description?: string | null;
};

export type WorkBayUpdatePayload = {
  name?: string;
  description?: string | null;
  is_active?: boolean;
};

export type WorkBayAvailability = {
  id: number;
  name: string;
  description: string | null;
  is_available: boolean;
  conflicting_order_id: number | null;
};