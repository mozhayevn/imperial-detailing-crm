"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { routes } from "@/src/config/routes";
import { useAuth } from "@/src/features/auth/use-auth";
import { cn } from "@/src/lib/cn";

function getAbsoluteFileUrl(fileUrl: string | null | undefined) {
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

function getPrimaryRole(roles: string[]) {
  const priority = ["admin", "manager", "master", "viewer"];

  return priority.find((role) => roles.includes(role)) ?? roles[0] ?? "user";
}

function getInitials(fullName: string | undefined) {
  if (!fullName) {
    return "ID";
  }

  return (
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ID"
  );
}

function UserAvatar({
  avatarUrl,
  initials,
  size = "sm",
}: {
  avatarUrl: string | null;
  initials: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center overflow-hidden border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] font-semibold text-white",
        size === "md" ? "rounded-2xl" : "rounded-full",
        sizeClass,
      ].join(" ")}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Аватар профиля"
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );
}

export function UserMenu() {
  const { session, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const avatarUrl = getAbsoluteFileUrl(session?.user.avatar_url);
  const initials = getInitials(session?.user.full_name);

  const primaryRole = session?.is_super_admin
    ? "super admin"
    : getPrimaryRole(session?.roles ?? []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex items-center gap-3 rounded-2xl border border-transparent p-1.5 transition hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))]"
      >
        <div className="hidden text-right md:block">
          <div className="text-xs font-semibold text-white">
            {session?.user.full_name}
          </div>

          <div className="mt-0.5 text-[11px] text-[hsl(var(--muted))]">
            {primaryRole}
          </div>
        </div>

        <UserAvatar avatarUrl={avatarUrl} initials={initials} />
      </button>

      <div
        className={cn(
          "absolute right-0 top-14 z-50 w-[320px] origin-top-right rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-2 shadow-[var(--shadow-soft)] transition",
          isOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="rounded-2xl bg-[hsl(var(--surface-2))] p-4">
          <div className="flex items-start gap-3">
            <UserAvatar avatarUrl={avatarUrl} initials={initials} size="md" />

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {session?.user.full_name}
              </div>

              <div className="mt-1 truncate text-xs text-[hsl(var(--muted))]">
                {session?.user.email}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={session?.is_super_admin ? "warning" : "primary"}>
                  {primaryRole}
                </Badge>

                {session?.is_super_admin ? (
                  <Badge tone="warning">Super admin</Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <Link
            href={routes.profile}
            onClick={() => setIsOpen(false)}
            className="block rounded-2xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--surface-2))] hover:text-white"
          >
            Мой профиль
          </Link>

          <Link
            href={routes.profileSecurity}
            onClick={() => setIsOpen(false)}
            className="block rounded-2xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--surface-2))] hover:text-white"
          >
            Безопасность
          </Link>

          <Link
            href={routes.profilePrivacy}
            onClick={() => setIsOpen(false)}
            className="block rounded-2xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--surface-2))] hover:text-white"
          >
            Конфиденциальность
          </Link>
        </div>

        <div className="mt-2 border-t border-[hsl(var(--border))] pt-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
          >
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}