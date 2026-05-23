import { apiConfig } from "@/src/config/api";
import { ApiError, type ApiErrorPayload } from "@/src/lib/api/errors";

const ACCESS_TOKEN_STORAGE_KEY = "imperial_crm_access_token";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
};

function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type");

  if (response.status === 204) {
    return null;
  }

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers, token, ...restOptions } = options;
  const accessToken = token ?? getStoredAccessToken();

  const isFormData = isFormDataBody(body);

  const requestHeaders: HeadersInit = {
    Accept: "application/json",
    ...(body !== undefined && !isFormData
      ? { "Content-Type": "application/json" }
      : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  };

  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...restOptions,
    credentials: "include",
    headers: requestHeaders,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
  });

  const parsed = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      `API request failed with status ${response.status}`,
      response.status,
      typeof parsed === "object" && parsed !== null
        ? (parsed as ApiErrorPayload)
        : null,
    );
  }

  return parsed as T;
}