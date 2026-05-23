import { appConfig } from "@/src/config/app";

export function SessionLoading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(var(--background))] px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgb(45_212_191_/_0.16),transparent_34rem),radial-gradient(circle_at_80%_12%,rgb(251_191_36_/_0.12),transparent_30rem)]" />

      <div className="relative z-10 w-full max-w-[420px] rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]/88 p-2 shadow-[var(--shadow-soft)] backdrop-blur-2xl">
        <div className="rounded-[1.6rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/78 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[hsl(var(--primary))] text-lg font-black text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-glow)]">
            I
          </div>

          <div className="mt-6 text-sm font-semibold text-white">
            Проверяем сессию
          </div>

          <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
            Подключаемся к backend auth и загружаем права доступа для{" "}
            {appConfig.companyName}.
          </div>

          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-3))]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
          </div>
        </div>
      </div>
    </main>
  );
}