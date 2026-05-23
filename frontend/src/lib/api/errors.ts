export type ApiErrorPayload = {
  detail?: string | Array<Record<string, unknown>>;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(message: string, status: number, payload: ApiErrorPayload | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.payload?.detail === "string") {
      return error.payload.detail;
    }

    if (typeof error.payload?.message === "string") {
      return error.payload.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Произошла неизвестная ошибка";
}