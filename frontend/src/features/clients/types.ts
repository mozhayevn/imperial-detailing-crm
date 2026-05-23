import type { Car } from "@/src/features/cars/types";
import type { Order } from "@/src/features/orders/types";

export type Client = {
  id: number;
  full_name: string;
  phone: string;
  birth_date: string | null;
  preferences: string | null;
};

export type ClientCreatePayload = {
  full_name: string;
  phone: string;
  birth_date: string | null;
  preferences: string | null;
};

export type ClientUpdatePayload = {
  full_name?: string;
  phone?: string;
  birth_date?: string | null;
  preferences?: string | null;
};

export type ClientSearchParams = {
  phone?: string;
  full_name?: string;
};

export type ClientHistoryItem = {
  order_id: number;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  total_price: number;
  comment: string | null;
  items_count: number;
};

export type ClientDetailsData = {
  client: Client;
  cars: Car[];
  orders: Order[];
  history: ClientHistoryItem[];
};