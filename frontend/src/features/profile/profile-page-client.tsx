"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";

import {
  changeMyPassword,
  disableTwoFactor,
  enableTwoFactor,
  getMyProfile,
  getMySessions,
  getTwoFactorStatus,
  revokeMySession,
  sendTwoFactorCode,
  updateMyPrivacy,
  updateMyProfile,
  uploadMyAvatar,
} from "@/src/features/profile/api";
import type {
  Profile,
  ProfilePrivacyUpdatePayload,
  UserSession,
  TwoFactorStatus,
} from "@/src/features/profile/types";
import { Eye, EyeOff } from "lucide-react";

type ProfileFormState = {
  full_name: string;
  phone: string;
};

type PasswordFormState = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

const defaultPasswordForm: PasswordFormState = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

function getAbsoluteFileUrl(fileUrl: string | null) {
  if (!fileUrl) {
    return null;
  }

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:8000";

  return `${baseUrl}${fileUrl}`;
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getSessionDeviceLabel(userAgent: string | null) {
  if (!userAgent) {
    return "Неизвестное устройство";
  }

  if (userAgent.includes("Chrome")) {
    return "Chrome";
  }

  if (userAgent.includes("Firefox")) {
    return "Firefox";
  }

  if (userAgent.includes("Safari")) {
    return "Safari";
  }

  if (userAgent.includes("Edg")) {
    return "Microsoft Edge";
  }

  return "Браузер";
}

function getPrivacyItems(profile: Profile): {
  key: keyof ProfilePrivacyUpdatePayload;
  title: string;
  description: string;
  value: boolean;
}[] {
  return [
    {
      key: "privacy_show_phone",
      title: "Показывать телефон",
      description: "Разрешить отображать ваш номер в карточках сотрудников.",
      value: profile.privacy_show_phone,
    },
    {
      key: "privacy_show_email",
      title: "Показывать email",
      description: "Разрешить отображать ваш email другим пользователям CRM.",
      value: profile.privacy_show_email,
    },
    {
      key: "privacy_show_activity",
      title: "Показывать активность",
      description: "Разрешить показывать вашу активность в рабочих событиях.",
      value: profile.privacy_show_activity,
    },
    {
      key: "privacy_show_online_status",
      title: "Показывать online-статус",
      description: "Разрешить показывать, что вы сейчас в системе.",
      value: profile.privacy_show_online_status,
    },
    {
      key: "privacy_show_order_load",
      title: "Показывать загрузку заказами",
      description: "Разрешить показывать вашу текущую загрузку по заказам.",
      value: profile.privacy_show_order_load,
    },
    {
      key: "privacy_show_audit_history",
      title: "Показывать историю действий",
      description: "Разрешить показывать ваши действия в audit history.",
      value: profile.privacy_show_audit_history,
    },
  ];
}

export function ProfilePageClient() {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    full_name: "",
    phone: "",
  });

  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(defaultPasswordForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const avatarUrl = useMemo(
    () => getAbsoluteFileUrl(profile?.avatar_url ?? null),
    [profile?.avatar_url],
  );

  const activeSessions = useMemo(
    () => sessions.filter((session) => session.is_active),
    [sessions],
  );

  const [twoFactorStatus, setTwoFactorStatus] =
    useState<TwoFactorStatus | null>(null);

  const [twoFactorChallengeId, setTwoFactorChallengeId] = useState<
    number | null
  >(null);

  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorDisablePassword, setTwoFactorDisablePassword] = useState("");

  const [isSendingTwoFactorCode, setIsSendingTwoFactorCode] = useState(false);
  const [isEnablingTwoFactor, setIsEnablingTwoFactor] = useState(false);
  const [isDisablingTwoFactor, setIsDisablingTwoFactor] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  

  async function loadProfilePage() {
    setIsLoading(true);
    setError(null);

    try {
      const [profileResult, sessionsResult, twoFactorResult] =
        await Promise.allSettled([
          getMyProfile(),
          getMySessions(),
          getTwoFactorStatus(),
        ]);

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
        setProfileForm({
          full_name: profileResult.value.full_name,
          phone: profileResult.value.phone ?? "",
        });
      } else {
        setError(getApiErrorMessage(profileResult.reason));
      }

      if (sessionsResult.status === "fulfilled") {
        setSessions(sessionsResult.value);
      } else {
        setSessions([]);
      }

      if (twoFactorResult.status === "fulfilled") {
        setTwoFactorStatus(twoFactorResult.value);
      } else {
        setTwoFactorStatus(null);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialProfilePage() {
      setIsLoading(true);
      setError(null);

      try {
        const [profileResult, sessionsResult, twoFactorResult] =
          await Promise.allSettled([
            getMyProfile(),
            getMySessions(),
            getTwoFactorStatus(),
          ]);

        if (!isMounted) {
          return;
        }

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value);
          setProfileForm({
            full_name: profileResult.value.full_name,
            phone: profileResult.value.phone ?? "",
          });
        } else {
          setError(getApiErrorMessage(profileResult.reason));
        }

        if (sessionsResult.status === "fulfilled") {
          setSessions(sessionsResult.value);
        } else {
          setSessions([]);
        }

        if (twoFactorResult.status === "fulfilled") {
          setTwoFactorStatus(twoFactorResult.value);
        } else {
          setTwoFactorStatus(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialProfilePage();

    return () => {
      isMounted = false;
    };
  }, []);

  function showSuccess(message: string) {
    setSuccessMessage(message);
    window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3500);
  }

  async function handleSaveProfile() {
    if (!profile) {
      return;
    }

    const fullName = profileForm.full_name.trim();

    if (!fullName) {
      setError("Укажите ФИО.");
      return;
    }

    setIsSavingProfile(true);
    setError(null);

    try {
      const updatedProfile = await updateMyProfile({
        full_name: fullName,
        phone: profileForm.phone.trim() || null,
      });

      setProfile(updatedProfile);
      setProfileForm({
        full_name: updatedProfile.full_name,
        phone: updatedProfile.phone ?? "",
      });

      showSuccess("Профиль обновлен.");
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleAvatarSelected(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploadingAvatar(true);
    setError(null);

    try {
      const updatedProfile = await uploadMyAvatar(file);
      setProfile(updatedProfile);
      showSuccess("Аватарка обновлена.");
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setIsUploadingAvatar(false);

      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  }

  async function handleChangePassword() {
    const currentPassword = passwordForm.current_password.trim();
    const newPassword = passwordForm.new_password.trim();
    const confirmPassword = passwordForm.confirm_password.trim();

    if (!currentPassword) {
      setError("Введите текущий пароль.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Новый пароль должен содержать минимум 8 символов.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Новый пароль и подтверждение не совпадают.");
      return;
    }

    setIsChangingPassword(true);
    setError(null);

    try {
      await changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordForm(defaultPasswordForm);
      showSuccess("Пароль успешно изменен.");
    } catch (passwordError) {
      setError(getApiErrorMessage(passwordError));
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handlePrivacyChange(
    key: keyof ProfilePrivacyUpdatePayload,
    value: boolean,
  ) {
    if (!profile) {
      return;
    }

    const nextPrivacy: ProfilePrivacyUpdatePayload = {
      privacy_show_phone: profile.privacy_show_phone,
      privacy_show_email: profile.privacy_show_email,
      privacy_show_activity: profile.privacy_show_activity,
      privacy_show_online_status: profile.privacy_show_online_status,
      privacy_show_order_load: profile.privacy_show_order_load,
      privacy_show_audit_history: profile.privacy_show_audit_history,
      [key]: value,
    };

    setIsSavingPrivacy(true);
    setError(null);

    try {
      const updatedProfile = await updateMyPrivacy(nextPrivacy);
      setProfile(updatedProfile);
      showSuccess("Настройки конфиденциальности обновлены.");
    } catch (privacyError) {
      setError(getApiErrorMessage(privacyError));
    } finally {
      setIsSavingPrivacy(false);
    }
  }

  async function handleRevokeSession(sessionId: number) {
    setRevokingSessionId(sessionId);
    setError(null);

    try {
      await revokeMySession(sessionId);

      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                is_active: false,
                revoked_at: new Date().toISOString(),
              }
            : session,
        ),
      );

      showSuccess("Сессия отключена.");
    } catch (revokeError) {
      setError(getApiErrorMessage(revokeError));
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function handleSendTwoFactorCode() {
    setIsSendingTwoFactorCode(true);
    setError(null);

    try {
      const result = await sendTwoFactorCode({
        method: "email",
      });

      setTwoFactorChallengeId(result.challenge_id);
      setTwoFactorCode("");

      showSuccess(
        `Код подтверждения отправлен на ${result.destination_masked}. Проверьте email.`,
      );
    } catch (sendError) {
      setError(getApiErrorMessage(sendError));
    } finally {
      setIsSendingTwoFactorCode(false);
    }
  }

  async function handleEnableTwoFactor() {
    if (!twoFactorChallengeId) {
      setError("Сначала отправьте код подтверждения.");
      return;
    }

    const code = twoFactorCode.trim();

    if (!code) {
      setError("Введите код подтверждения.");
      return;
    }

    setIsEnablingTwoFactor(true);
    setError(null);

    try {
      const result = await enableTwoFactor({
        challenge_id: twoFactorChallengeId,
        code,
      });

      setTwoFactorStatus(result);
      setTwoFactorChallengeId(null);
      setTwoFactorCode("");

      showSuccess("Двухфакторная аутентификация включена.");
    } catch (enableError) {
      setError(getApiErrorMessage(enableError));
    } finally {
      setIsEnablingTwoFactor(false);
    }
  }

  async function handleDisableTwoFactor() {
    const currentPassword = twoFactorDisablePassword.trim();

    if (!currentPassword) {
      setError("Введите текущий пароль для отключения 2FA.");
      return;
    }

    setIsDisablingTwoFactor(true);
    setError(null);

    try {
      const result = await disableTwoFactor({
        current_password: currentPassword,
      });

      setTwoFactorStatus(result);
      setTwoFactorDisablePassword("");
      setTwoFactorChallengeId(null);
      setTwoFactorCode("");

      showSuccess("Двухфакторная аутентификация отключена.");
    } catch (disableError) {
      setError(getApiErrorMessage(disableError));
    } finally {
      setIsDisablingTwoFactor(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card className="p-8">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[hsl(var(--primary))]" />
            <div className="mt-5 text-sm font-semibold text-white">
              Загружаем профиль
            </div>
            <div className="mt-2 text-xs text-[hsl(var(--muted))]">
              Получаем данные профиля, сессии и настройки безопасности...
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer>
        <Card className="border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-6">
          <div className="text-sm font-semibold text-[rgb(252_165_165)]">
            Не удалось открыть профиль
          </div>
          <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
            {error ?? "Профиль не найден"}
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Мой профиль"
        title="Мой профиль"
        description="Управление личными данными, безопасностью, активными сессиями и конфиденциальностью."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => void loadProfilePage()}
          >
            Обновить
          </Button>
        }
      />

      <div className="space-y-5">
        {error ? (
          <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4 text-sm leading-6 text-[rgb(94_234_212)]">
            {successMessage}
          </div>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Аватарка</CardTitle>
                <CardDescription>
                  Фото профиля для отображения в CRM.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-3xl font-semibold text-white">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={profile.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(profile.full_name)
                    )}
                  </div>

                  <div className="mt-4 text-sm font-semibold text-white">
                    {profile.full_name}
                  </div>

                  <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                    {profile.email}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {profile.is_super_admin ? (
                      <Badge tone="danger">Super admin</Badge>
                    ) : (
                      <Badge tone="primary">Пользователь</Badge>
                    )}

                    {profile.is_active ? (
                      <Badge tone="success">Активен</Badge>
                    ) : (
                      <Badge tone="muted">Неактивен</Badge>
                    )}
                  </div>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) =>
                      void handleAvatarSelected(event.target.files?.[0] ?? null)
                    }
                  />

                  <Button
                    type="button"
                    className="mt-5 w-full"
                    disabled={isUploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {isUploadingAvatar ? "Загружаем..." : "Загрузить аватарку"}
                  </Button>

                  <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted))]">
                    JPG, PNG или WEBP. Максимальный размер — 3 MB.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Активные сессии</CardTitle>
                <CardDescription>
                  Устройства и браузеры, где выполнен вход.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                    <div className="text-xs text-[hsl(var(--muted))]">
                      Активные
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {activeSessions.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
                    <div className="text-xs text-[hsl(var(--muted))]">
                      Всего записей
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {sessions.length}
                    </div>
                  </div>
                </div>

                {sessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                    Сессии пока не найдены.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={[
                          "rounded-2xl border p-3",
                          session.is_active
                            ? "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] opacity-70",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {getSessionDeviceLabel(session.user_agent)}
                            </div>

                            <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                              IP: {session.ip_address ?? "—"}
                            </div>
                          </div>

                          <Badge tone={session.is_active ? "success" : "muted"}>
                            {session.is_active ? "Активна" : "Отключена"}
                          </Badge>
                        </div>

                        <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted))]">
                          <div>
                            Создана: {formatDateTime(session.created_at)}
                          </div>
                          <div>
                            Последняя активность:{" "}
                            {session.last_seen_at
                              ? formatDateTime(session.last_seen_at)
                              : "—"}
                          </div>
                        </div>

                        {session.is_active ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-3"
                            disabled={revokingSessionId === session.id}
                            onClick={() => void handleRevokeSession(session.id)}
                          >
                            {revokingSessionId === session.id
                              ? "Отключаем..."
                              : "Отключить"}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <div id="profile">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Основная информация</CardTitle>
                  <CardDescription>
                    Личные данные, которые используются внутри CRM.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="ФИО"
                      value={profileForm.full_name}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          full_name: event.target.value,
                        }))
                      }
                    />

                    <Input label="Email" value={profile.email} disabled />

                    <Input
                      label="Телефон"
                      placeholder="+7..."
                      value={profileForm.phone}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />

                    <Input
                      label="Дата создания"
                      value={formatDateTime(profile.created_at)}
                      disabled
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      disabled={isSavingProfile}
                      onClick={() => void handleSaveProfile()}
                    >
                      {isSavingProfile ? "Сохраняем..." : "Сохранить данные"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div id="security">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Смена пароля</CardTitle>
                  <CardDescription>
                    Обновите пароль для входа в CRM.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="relative">
                      <Input
                        label="Текущий пароль"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.current_password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            current_password: event.target.value,
                          }))
                        }
                      />

                      <button
                        type="button"
                        className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted))] transition hover:text-white"
                        onClick={() =>
                          setShowCurrentPassword((current) => !current)
                        }
                        aria-label={
                          showCurrentPassword
                            ? "Скрыть пароль"
                            : "Показать пароль"
                        }
                      >
                        {showCurrentPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <Input
                        label="Новый пароль"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.new_password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            new_password: event.target.value,
                          }))
                        }
                      />

                      <button
                        type="button"
                        className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted))] transition hover:text-white"
                        onClick={() =>
                          setShowNewPassword((current) => !current)
                        }
                        aria-label={
                          showNewPassword ? "Скрыть пароль" : "Показать пароль"
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <Input
                        label="Повторите пароль"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirm_password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            confirm_password: event.target.value,
                          }))
                        }
                      />

                      <button
                        type="button"
                        className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted))] transition hover:text-white"
                        onClick={() =>
                          setShowConfirmPassword((current) => !current)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Скрыть пароль"
                            : "Показать пароль"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-3 text-xs leading-5 text-[rgb(252_211_77)]">
                    Пароль должен содержать минимум 8 символов. После смены
                    пароля рекомендуется отключить старые активные сессии.
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      disabled={isChangingPassword}
                      onClick={() => void handleChangePassword()}
                    >
                      {isChangingPassword ? "Меняем..." : "Изменить пароль"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div id="privacy">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Конфиденциальность</CardTitle>
                  <CardDescription>
                    Настройки видимости ваших данных внутри CRM.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {getPrivacyItems(profile).map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition hover:border-[hsl(var(--border-strong))]"
                      >
                        <input
                          type="checkbox"
                          checked={item.value}
                          disabled={isSavingPrivacy}
                          onChange={(event) =>
                            void handlePrivacyChange(
                              item.key,
                              event.target.checked,
                            )
                          }
                        />

                        <div>
                          <div className="text-sm font-semibold text-white">
                            {item.title}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[hsl(var(--muted))]">
                            {item.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div id="two-factor">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>Двухфакторная аутентификация</CardTitle>
                      <CardDescription>
                        Дополнительная защита входа в аккаунт через код
                        подтверждения.
                      </CardDescription>
                    </div>

                    <Badge
                      tone={twoFactorStatus?.enabled ? "success" : "muted"}
                    >
                      {twoFactorStatus?.enabled ? "Включена" : "Выключена"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  {!twoFactorStatus ? (
                    <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                      Не удалось загрузить статус 2FA. Нажмите “Обновить” или
                      проверьте backend endpoint `/profile/2fa/status`.
                    </div>
                  ) : twoFactorStatus.enabled ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
                        <div className="text-sm font-semibold text-white">
                          2FA включена
                        </div>

                        <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                          При следующем входе система запросит код
                          подтверждения. Метод:{" "}
                          <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                            {twoFactorStatus.method === "email"
                              ? "Email"
                              : twoFactorStatus.method}
                          </span>
                          . Адрес:{" "}
                          <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                            {twoFactorStatus.destination_masked ?? "—"}
                          </span>
                          .
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.08)] p-4">
                        <div className="text-sm font-semibold text-[rgb(252_211_77)]">
                          Отключение 2FA
                        </div>

                        <div className="mt-2 text-xs leading-5 text-[rgb(252_211_77)]">
                          Для отключения двухфакторной аутентификации нужно
                          подтвердить текущий пароль.
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                          <Input
                            label="Текущий пароль"
                            type="password"
                            value={twoFactorDisablePassword}
                            onChange={(event) =>
                              setTwoFactorDisablePassword(event.target.value)
                            }
                          />

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isDisablingTwoFactor}
                              onClick={() => void handleDisableTwoFactor()}
                            >
                              {isDisablingTwoFactor
                                ? "Отключаем..."
                                : "Отключить 2FA"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                        <div className="text-sm font-semibold text-white">
                          2FA выключена
                        </div>

                        <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                          После включения при входе в CRM нужно будет ввести
                          одноразовый код, отправленный на email{" "}
                          <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                            {twoFactorStatus.destination_masked ??
                              profile.email}
                          </span>
                          .
                        </div>

                        <div className="mt-4">
                          <Button
                            type="button"
                            disabled={isSendingTwoFactorCode}
                            onClick={() => void handleSendTwoFactorCode()}
                          >
                            {isSendingTwoFactorCode
                              ? "Отправляем код..."
                              : "Отправить код на email"}
                          </Button>
                        </div>
                      </div>

                      {twoFactorChallengeId ? (
                        <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
                          <div className="text-sm font-semibold text-white">
                            Подтверждение включения
                          </div>

                          <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                            Введите 6-значный код, отправленный на ваш email.
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[220px_auto]">
                            <Input
                              label="Код подтверждения"
                              placeholder="123456"
                              value={twoFactorCode}
                              onChange={(event) =>
                                setTwoFactorCode(event.target.value)
                              }
                            />

                            <div className="flex items-end">
                              <Button
                                type="button"
                                disabled={isEnablingTwoFactor}
                                onClick={() => void handleEnableTwoFactor()}
                              >
                                {isEnablingTwoFactor
                                  ? "Проверяем..."
                                  : "Включить 2FA"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
