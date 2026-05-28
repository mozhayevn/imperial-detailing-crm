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

export type WorkBayScheduleOrder = {
  id: number;
  client_id: number;
  car_id: number;
  work_bay_id: number;

  client_name: string | null;
  car_label: string | null;

  status: string;
  planned_start_at: string;
  planned_end_at: string;
  total_price: number;
};

export type WorkBayScheduleBay = {
  id: number;
  name: string;
  description: string | null;
  orders: WorkBayScheduleOrder[];
};

export type WorkBaySchedule = {
  date: string;
  bays: WorkBayScheduleBay[];
  unscheduled_orders: WorkBayScheduleOrder[];
};