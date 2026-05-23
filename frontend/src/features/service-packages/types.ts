export type ServicePackage = {
  id: number;
  service_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type ServicePackageCreatePayload = {
  service_id: number;
  name: string;
  description: string | null;
  is_active?: boolean;
};

export type ServicePackageUpdatePayload = {
  service_id?: number;
  name?: string;
  description?: string | null;
  is_active?: boolean;
};

export type ServicePackageOption = {
  id: number;
  label: string;
  description: string;
};