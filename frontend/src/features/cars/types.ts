export type Car = {
  id: number;
  client_id: number;
  car_type_id: number | null;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  plate_number: string | null;
};

export type CarSearchOption = {
  id: number;
  label: string;
  description: string;
};