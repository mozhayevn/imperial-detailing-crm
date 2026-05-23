export type CarType = {
  id: number;
  name: string;
};

export type CarTypeCreatePayload = {
  name: string;
};

export type CarTypeUpdatePayload = {
  name?: string;
};