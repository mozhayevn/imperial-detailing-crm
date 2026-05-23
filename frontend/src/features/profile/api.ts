import { apiRequest } from "@/src/lib/api/client";
import type {
  ChangePasswordPayload,
  Profile,
  ProfilePrivacyUpdatePayload,
  ProfileUpdatePayload,
  TwoFactorDisablePayload,
  TwoFactorEnablePayload,
  TwoFactorSendCodePayload,
  TwoFactorSendCodeResponse,
  TwoFactorStatus,
  UserSession,
} from "@/src/features/profile/types";

export async function getMyProfile(): Promise<Profile> {
  return apiRequest<Profile>("/profile/me", {
    method: "GET",
  });
}

export async function updateMyProfile(
  payload: ProfileUpdatePayload,
): Promise<Profile> {
  return apiRequest<Profile>("/profile/me", {
    method: "PATCH",
    body: payload,
  });
}

export async function uploadMyAvatar(file: File): Promise<Profile> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<Profile>("/profile/avatar", {
    method: "POST",
    body: formData,
  });
}

export async function updateMyPrivacy(
  payload: ProfilePrivacyUpdatePayload,
): Promise<Profile> {
  return apiRequest<Profile>("/profile/privacy", {
    method: "PATCH",
    body: payload,
  });
}

export async function changeMyPassword(
  payload: ChangePasswordPayload,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/profile/change-password", {
    method: "POST",
    body: payload,
  });
}

export async function getMySessions(): Promise<UserSession[]> {
  return apiRequest<UserSession[]>("/profile/sessions", {
    method: "GET",
  });
}

export async function revokeMySession(
  sessionId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/profile/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return apiRequest<TwoFactorStatus>("/profile/2fa/status", {
    method: "GET",
  });
}

export async function sendTwoFactorCode(
  payload: TwoFactorSendCodePayload,
): Promise<TwoFactorSendCodeResponse> {
  return apiRequest<TwoFactorSendCodeResponse>("/profile/2fa/send-code", {
    method: "POST",
    body: payload,
  });
}

export async function enableTwoFactor(
  payload: TwoFactorEnablePayload,
): Promise<TwoFactorStatus> {
  return apiRequest<TwoFactorStatus>("/profile/2fa/enable", {
    method: "POST",
    body: payload,
  });
}

export async function disableTwoFactor(
  payload: TwoFactorDisablePayload,
): Promise<TwoFactorStatus> {
  return apiRequest<TwoFactorStatus>("/profile/2fa/disable", {
    method: "POST",
    body: payload,
  });
}