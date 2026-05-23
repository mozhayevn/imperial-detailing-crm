import { apiConfig } from "@/src/config/api";
import { apiRequest } from "@/src/lib/api/client";
import { ApiError, type ApiErrorPayload } from "@/src/lib/api/errors";
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  MyPermissionsResponse,
  ResendTwoFactorRequest,
  ResendTwoFactorResponse,
  TokenResponse,
  VerifyTwoFactorRequest,
} from "@/src/types/auth";

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

export async function loginWithJsonToken(
  payload: LoginRequest,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function loginWithCookie(
  payload: LoginRequest,
): Promise<LoginResponse> {
  const formData = new URLSearchParams();

  formData.set("username", payload.email);
  formData.set("password", payload.password);

  const response = await fetch(`${apiConfig.baseUrl}/auth/login-form`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const parsed = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      `Login failed with status ${response.status}`,
      response.status,
      typeof parsed === "object" && parsed !== null
        ? (parsed as ApiErrorPayload)
        : null,
    );
  }

  return parsed as LoginResponse;
}

export async function verifyTwoFactorWithCookie(
  payload: VerifyTwoFactorRequest,
): Promise<TokenResponse> {
  const response = await fetch(`${apiConfig.baseUrl}/auth/verify-2fa`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const parsed = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      `2FA verification failed with status ${response.status}`,
      response.status,
      typeof parsed === "object" && parsed !== null
        ? (parsed as ApiErrorPayload)
        : null,
    );
  }

  return parsed as TokenResponse;
}

export async function getCurrentUser(token?: string | null): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me", {
    method: "GET",
    token,
  });
}

export async function getMyPermissions(
  token?: string | null,
): Promise<MyPermissionsResponse> {
  return apiRequest<MyPermissionsResponse>("/auth/my-permissions", {
    method: "GET",
    token,
  });
}

export async function resendTwoFactorCode(
  payload: ResendTwoFactorRequest,
): Promise<ResendTwoFactorResponse> {
  const response = await fetch(`${apiConfig.baseUrl}/auth/resend-2fa`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const parsed = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      `2FA resend failed with status ${response.status}`,
      response.status,
      typeof parsed === "object" && parsed !== null
        ? (parsed as ApiErrorPayload)
        : null,
    );
  }

  return parsed as ResendTwoFactorResponse;
}