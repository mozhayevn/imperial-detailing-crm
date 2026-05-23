"use client";

import { appConfig } from "@/src/config/app";
import { Badge } from "@/src/components/ui/badge";
import { UserMenu } from "@/src/features/auth/user-menu";
import { useAuth } from "@/src/features/auth/use-auth";

type TopbarProps = {
  onMenuClick?: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const { isAuthenticated, session } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/78 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Открыть меню"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--surface-3))] hover:text-white lg:hidden"
        >
          <span className="block h-0.5 w-4 rounded-full bg-current before:mt-[-6px] before:block before:h-0.5 before:w-4 before:rounded-full before:bg-current after:mt-[10px] after:block after:h-0.5 after:w-4 after:rounded-full after:bg-current" />
        </button>

        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted))]">
            Рабочая область
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {appConfig.companyName}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {session?.is_super_admin ? (
          <div className="hidden xl:block">
            <Badge tone="warning">Super admin</Badge>
          </div>
        ) : null}

        {isAuthenticated ? (
          <UserMenu />
        ) : (
          <div className="hidden rounded-full border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] px-4 py-2 text-xs font-medium text-[rgb(94_234_212)] md:block">
            Production-ready shell
          </div>
        )}
      </div>
    </header>
  );
}