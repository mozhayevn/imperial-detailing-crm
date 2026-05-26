"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Combobox } from "@/src/components/ui/combobox";
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";

import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatDateTime } from "@/src/lib/formatters";
import { routes } from "@/src/config/routes";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";

import {
  assignRoleToAdminUser,
  createAdminUser,
  getAdminRoles,
  getAdminUserAuditLogs,
  getAdminUserPermissions,
  getAdminUserRoles,
  getAdminUsers,
  removeRoleFromAdminUser,
} from "@/src/features/admin/api";
import type {
  AdminRole,
  AdminUser,
  AdminUserPermissions,
  AdminUserRoleAuditLog,
  AdminUserRoles,
} from "@/src/features/admin/types";

type AdminUserFormState = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  is_active: boolean;
  is_super_admin: boolean;
  must_change_password: boolean;
  role_ids: number[];
};

const defaultUserForm: AdminUserFormState = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  is_active: true,
  is_super_admin: false,
  must_change_password: true,
  role_ids: [],
};

function getRoleLabel(roleName: string) {
  const labels: Record<string, string> = {
    admin: "Администратор",
    manager: "Менеджер",
    master: "Мастер",
    viewer: "Наблюдатель",
  };

  return labels[roleName] ?? roleName;
}

function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    user_created: "Пользователь создан",
    role_assigned: "Роль назначена",
    role_removed: "Роль удалена",
  };

  return labels[action] ?? action;
}

function getAuditActionTone(action: string) {
  if (action === "user_created") {
    return "success";
  }

  if (action === "role_assigned") {
    return "primary";
  }

  if (action === "role_removed") {
    return "warning";
  }

  return "muted";
}

function getUserStatusTone(user: AdminUser) {
  if (!user.is_active) {
    return "muted";
  }

  if (user.is_super_admin) {
    return "danger";
  }

  return "success";
}

function getUserStatusLabel(user: AdminUser) {
  if (!user.is_active) {
    return "Неактивен";
  }

  if (user.is_super_admin) {
    return "Super admin";
  }

  return "Активен";
}

export function AdminPageClient() {
  const { session } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [userRolesById, setUserRolesById] = useState<
    Record<number, AdminUserRoles>
  >({});
  const [selectedUserPermissions, setSelectedUserPermissions] =
    useState<AdminUserPermissions | null>(null);
  const [selectedUserAuditLogs, setSelectedUserAuditLogs] = useState<
    AdminUserRoleAuditLog[]
  >([]);

  const [form, setForm] = useState<AdminUserFormState>(defaultUserForm);
  const [assignRoleId, setAssignRoleId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUserDetailsLoading, setIsUserDetailsLoading] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [removingRoleName, setRemovingRoleName] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const canManageUsers = canAccessByPermission(session, "users.manage");
  const isCurrentUserSuperAdmin = Boolean(session?.user?.is_super_admin);

  const selectedUser = useMemo(() => {
    return users.find((user) => user.id === selectedUserId) ?? null;
  }, [users, selectedUserId]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      return (
        !normalizedSearch ||
        user.full_name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        (user.phone?.toLowerCase() ?? "").includes(normalizedSearch)
      );
    });
  }, [users, search]);

  const visibleRoles = useMemo(() => {
    if (isCurrentUserSuperAdmin) {
      return roles;
    }

    return roles.filter(
      (role) => role.name !== "admin" && role.name !== "super_admin",
    );
  }, [roles, isCurrentUserSuperAdmin]);

  const selectedUserRoles = selectedUserId
    ? userRolesById[selectedUserId]?.roles ?? []
    : [];

  const availableRolesForAssign = roles.filter(
    (role) => !selectedUserRoles.includes(role.name),
  );

  const assignRoleOptions = availableRolesForAssign.map((role) => ({
    value: String(role.id),
    label: role.description
      ? `${getRoleLabel(role.name)} · ${role.description}`
      : getRoleLabel(role.name),
  }));

  async function loadUsersAndRoles() {
    if (!canManageUsers) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [usersResult, rolesResult] = await Promise.allSettled([
        getAdminUsers(),
        getAdminRoles(),
      ]);

      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value);
      } else {
        setUsers([]);
        setError(getApiErrorMessage(usersResult.reason));
      }

      if (rolesResult.status === "fulfilled") {
        setRoles(rolesResult.value);
      } else {
        setRoles([]);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      if (!canManageUsers) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [usersResult, rolesResult] = await Promise.allSettled([
          getAdminUsers(),
          getAdminRoles(),
        ]);

        if (!isMounted) {
          return;
        }

        if (usersResult.status === "fulfilled") {
          setUsers(usersResult.value);
        } else {
          setUsers([]);
          setError(getApiErrorMessage(usersResult.reason));
        }

        if (rolesResult.status === "fulfilled") {
          setRoles(rolesResult.value);
        } else {
          setRoles([]);
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

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [canManageUsers]);

  function updateForm(patch: Partial<AdminUserFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function toggleRoleInForm(roleId: number) {
    setForm((current) => {
      const exists = current.role_ids.includes(roleId);

      return {
        ...current,
        role_ids: exists
          ? current.role_ids.filter((id) => id !== roleId)
          : [...current.role_ids, roleId],
      };
    });

    setError(null);
  }

  function validateUserForm() {
    const fullName = form.full_name.trim();
    const email = form.email.trim();
    const password = form.password.trim();

    if (!fullName) {
      return "Укажите ФИО сотрудника.";
    }

    if (!email) {
      return "Укажите email сотрудника.";
    }

    if (!password || password.length < 8) {
      return "Пароль должен содержать минимум 8 символов.";
    }

    return null;
  }

  async function handleCreateUser() {
    const validationError = validateUserForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdUser = await createAdminUser({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password.trim(),
        is_active: form.is_active,
        is_super_admin: isCurrentUserSuperAdmin ? form.is_super_admin : false,
        must_change_password: form.must_change_password,
        role_ids: form.role_ids,
      });

      setUsers((current) => [createdUser, ...current]);
      setForm(defaultUserForm);

      await handleSelectUser(createdUser.id);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  async function handleSelectUser(userId: number) {
    setSelectedUserId(userId);
    setAssignRoleId(null);
    setSelectedUserPermissions(null);
    setSelectedUserAuditLogs([]);
    setIsUserDetailsLoading(true);
    setError(null);

    try {
      const [rolesResult, permissionsResult, auditResult] =
        await Promise.allSettled([
          getAdminUserRoles(userId),
          getAdminUserPermissions(userId),
          getAdminUserAuditLogs(userId),
        ]);

      if (rolesResult.status === "fulfilled") {
        setUserRolesById((current) => ({
          ...current,
          [userId]: rolesResult.value,
        }));
      }

      if (permissionsResult.status === "fulfilled") {
        setSelectedUserPermissions(permissionsResult.value);
      }

      if (auditResult.status === "fulfilled") {
        setSelectedUserAuditLogs(auditResult.value);
      }
    } catch (detailsError) {
      setError(getApiErrorMessage(detailsError));
    } finally {
      setIsUserDetailsLoading(false);
    }
  }

  async function handleAssignRole() {
    if (!selectedUserId || !assignRoleId) {
      setError("Выберите сотрудника и роль.");
      return;
    }

    setIsAssigningRole(true);
    setError(null);

    try {
      await assignRoleToAdminUser({
        user_id: selectedUserId,
        role_id: assignRoleId,
      });

      setAssignRoleId(null);
      await handleSelectUser(selectedUserId);
    } catch (assignError) {
      setError(getApiErrorMessage(assignError));
    } finally {
      setIsAssigningRole(false);
    }
  }

  async function handleRemoveRole(roleName: string) {
    if (!selectedUserId) {
      return;
    }

    const role = roles.find((item) => item.name === roleName);

    if (!role) {
      setError("Роль не найдена.");
      return;
    }

    setRemovingRoleName(roleName);
    setError(null);

    try {
      await removeRoleFromAdminUser(selectedUserId, role.id);
      await handleSelectUser(selectedUserId);
    } catch (removeError) {
      setError(getApiErrorMessage(removeError));
    } finally {
      setRemovingRoleName(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Администрирование"
        title="Администрирование"
        description="Управление пользователями, ролями, правами доступа и историей изменений."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => void loadUsersAndRoles()}
          >
            Обновить
          </Button>
        }
      />

      {!canManageUsers ? (
        <div className="max-w-3xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5">
          <div className="text-sm font-semibold text-white">
            Нет доступа к администрированию
          </div>

          <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
            Для управления пользователями, ролями и правами нужен permission{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              users.manage
            </span>
            .
          </div>
        </div>
      ) : null}

      {canManageUsers ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Пользователи
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {users.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <div className="text-xs font-medium text-[hsl(var(--muted))]">
                Роли
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {roles.length}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
              <div className="text-xs font-medium text-[rgb(94_234_212)]">
                Активные
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {users.filter((user) => user.is_active).length}
              </div>
            </div>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Пользователи</CardTitle>
                  <CardDescription>
                    Список сотрудников, их роли и статус доступа.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <Input
                    label="Поиск"
                    placeholder="Например: Иван, admin@test.com, +770..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                      Загружаем пользователей...
                    </div>
                  ) : null}

                  {!isLoading && filteredUsers.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Пользователи не найдены.
                    </div>
                  ) : null}

                  {!isLoading && filteredUsers.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {filteredUsers.map((user) => {
                        const isSelected = selectedUserId === user.id;
                        const userRoles = userRolesById[user.id]?.roles ?? [];

                        return (
                          <button
                            key={user.id}
                            type="button"
                            className={[
                              "w-full rounded-3xl border p-4 text-left transition",
                              isSelected
                                ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.08)]"
                                : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] hover:border-[hsl(var(--border-strong))]",
                            ].join(" ")}
                            onClick={() => void handleSelectUser(user.id)}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-base font-semibold text-white">
                                    {user.full_name}
                                  </div>

                                  <Badge tone={getUserStatusTone(user)}>
                                    {getUserStatusLabel(user)}
                                  </Badge>

                                  {user.must_change_password ? (
                                    <Badge tone="warning">Смена пароля</Badge>
                                  ) : null}
                                </div>

                                <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                  {user.email} · {user.phone || "Без телефона"}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  {userRoles.length > 0 ? (
                                    userRoles.map((role) => (
                                      <Badge key={role} tone="primary">
                                        {getRoleLabel(role)}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge tone="muted">
                                      Роли не загружены
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2 text-xs leading-5 text-[hsl(var(--muted))] lg:items-end lg:text-right">
                                <div>
                                  <div>User ID #{user.id}</div>
                                  <div>{formatDateTime(user.created_at)}</div>
                                </div>

                                <Link
                                  href={routes.userProfile(user.id)}
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-xs font-semibold text-white transition hover:border-[rgb(45_212_191_/_0.35)] hover:bg-[rgb(45_212_191_/_0.08)]"
                                >
                                  Профиль
                                </Link>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {selectedUser ? (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>{selectedUser.full_name}</CardTitle>
                        <CardDescription>
                          Роли, права доступа и история изменений пользователя.
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={getUserStatusTone(selectedUser)}>
                          {getUserStatusLabel(selectedUser)}
                        </Badge>

                        <Link href={routes.userProfile(selectedUser.id)}>
                          <Button type="button" variant="secondary" size="sm">
                            Открыть профиль
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {isUserDetailsLoading ? (
                      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                        Загружаем данные пользователя...
                      </div>
                    ) : null}

                    {!isUserDetailsLoading ? (
                      <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                            <div className="text-xs text-[hsl(var(--muted))]">
                              Email
                            </div>
                            <div className="mt-2 break-words text-sm font-semibold text-white">
                              {selectedUser.email}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                            <div className="text-xs text-[hsl(var(--muted))]">
                              Телефон
                            </div>
                            <div className="mt-2 break-words text-sm font-semibold text-white">
                              {selectedUser.phone || "—"}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
                            <div className="text-xs text-[hsl(var(--muted))]">
                              Создан
                            </div>
                            <div className="mt-2 break-words text-sm font-semibold text-white">
                              {formatDateTime(selectedUser.created_at)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                          <div className="mb-3 text-sm font-semibold text-white">
                            Роли пользователя
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {selectedUserRoles.length > 0 ? (
                              selectedUserRoles.map((roleName) => (
                                <div
                                  key={roleName}
                                  className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2"
                                >
                                  <span className="text-xs font-semibold text-white">
                                    {getRoleLabel(roleName)}
                                  </span>

                                  <button
                                    type="button"
                                    className="text-xs text-[rgb(252_165_165)] hover:text-[rgb(254_202_202)]"
                                    disabled={removingRoleName === roleName}
                                    onClick={() =>
                                      void handleRemoveRole(roleName)
                                    }
                                  >
                                    {removingRoleName === roleName
                                      ? "..."
                                      : "убрать"}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-[hsl(var(--muted))]">
                                Роли не назначены.
                              </div>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                            <Combobox
                              label="Добавить роль"
                              placeholder="Выберите роль"
                              value={assignRoleId ? String(assignRoleId) : ""}
                              options={assignRoleOptions}
                              onChange={(value) =>
                                setAssignRoleId(value ? Number(value) : null)
                              }
                            />

                            <div className="flex items-end">
                              <Button
                                type="button"
                                className="w-full md:w-auto"
                                disabled={isAssigningRole || !assignRoleId}
                                onClick={() => void handleAssignRole()}
                              >
                                {isAssigningRole ? "Назначаем..." : "Назначить"}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                          <div className="mb-3 text-sm font-semibold text-white">
                            Права доступа
                          </div>

                          {selectedUserPermissions?.permissions.length ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedUserPermissions.permissions.map(
                                (permission) => (
                                  <Badge key={permission} tone="muted">
                                    {permission}
                                  </Badge>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-[hsl(var(--muted))]">
                              Права доступа не найдены.
                            </div>
                          )}
                        </div>

                        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                          <div className="mb-3 text-sm font-semibold text-white">
                            История доступа
                          </div>

                          {selectedUserAuditLogs.length === 0 ? (
                            <div className="text-sm text-[hsl(var(--muted))]">
                              История изменений пока пустая.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {selectedUserAuditLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      tone={getAuditActionTone(log.action)}
                                    >
                                      {getAuditActionLabel(log.action)}
                                    </Badge>

                                    {log.role_name ? (
                                      <Badge tone="muted">
                                        {getRoleLabel(log.role_name)}
                                      </Badge>
                                    ) : null}
                                  </div>

                                  <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                                    {formatDateTime(log.created_at)} · Автор:{" "}
                                    {log.actor_user_full_name ??
                                      `Сотрудник #${log.actor_user_id}`}
                                  </div>

                                  {log.details ? (
                                    <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                                      {log.details}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <aside className="space-y-5 xl:sticky xl:top-24">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Создать пользователя</CardTitle>
                  <CardDescription>
                    Создайте сотрудника и сразу назначьте ему роли.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <Input
                      label="ФИО"
                      placeholder="Например: Иван Иванов"
                      value={form.full_name}
                      onChange={(event) =>
                        updateForm({
                          full_name: event.target.value,
                        })
                      }
                    />

                    <Input
                      label="Email"
                      type="email"
                      placeholder="name@example.com"
                      value={form.email}
                      onChange={(event) =>
                        updateForm({
                          email: event.target.value,
                        })
                      }
                    />

                    <Input
                      label="Телефон"
                      placeholder="+7..."
                      value={form.phone}
                      onChange={(event) =>
                        updateForm({
                          phone: event.target.value,
                        })
                      }
                    />

                    <Input
                      label="Временный пароль"
                      type="password"
                      placeholder="Минимум 8 символов"
                      value={form.password}
                      onChange={(event) =>
                        updateForm({
                          password: event.target.value,
                        })
                      }
                    />

                    <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="mb-3 text-sm font-semibold text-white">
                        Роли при создании
                      </div>

                      {visibleRoles.length === 0 ? (
                        <div className="text-sm text-[hsl(var(--muted))]">
                          Роли не загружены.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {visibleRoles.map((role) => {
                            const isSelected = form.role_ids.includes(role.id);

                            return (
                              <button
                                key={role.id}
                                type="button"
                                className={[
                                  "rounded-full border px-3 py-2 text-xs font-semibold transition",
                                  isSelected
                                    ? "border-[rgb(45_212_191_/_0.35)] bg-[rgb(45_212_191_/_0.14)] text-[rgb(94_234_212)]"
                                    : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))]",
                                ].join(" ")}
                                onClick={() => toggleRoleInForm(role.id)}
                              >
                                {getRoleLabel(role.name)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <label className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(event) =>
                            updateForm({
                              is_active: event.target.checked,
                            })
                          }
                        />
                        Активный пользователь
                      </label>

                      <label className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                        <input
                          type="checkbox"
                          checked={form.must_change_password}
                          onChange={(event) =>
                            updateForm({
                              must_change_password: event.target.checked,
                            })
                          }
                        />
                        Потребовать смену пароля при входе
                      </label>

                      {isCurrentUserSuperAdmin ? (
                        <label className="flex items-center gap-3 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-3 text-sm text-[rgb(252_165_165)]">
                          <input
                            type="checkbox"
                            checked={form.is_super_admin}
                            onChange={(event) =>
                              updateForm({
                                is_super_admin: event.target.checked,
                              })
                            }
                          />
                          Super admin
                        </label>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      disabled={isSubmittingCreate}
                      onClick={() => void handleCreateUser()}
                    >
                      {isSubmittingCreate
                        ? "Создаем..."
                        : "Создать пользователя"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}