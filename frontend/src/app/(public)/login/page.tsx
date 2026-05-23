"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/src/features/auth/login-form";
import { appConfig } from "@/src/config/app";
import { Badge } from "@/src/components/ui/badge";
import { useAuth } from "@/src/features/auth/use-auth";
import { SessionLoading } from "@/src/components/app-shell/session-loading";

const capabilities = [
  "Заказы и производственный поток",
  "Клиенты, автомобили и история",
  "Pricing engine и фиксация расчетов",
  "Боксы, расписание и конфликты",
  "Audit logs и RBAC",
];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <SessionLoading />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[hsl(var(--background))] px-6 py-8 text-[hsl(var(--foreground))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgb(45_212_191_/_0.16),transparent_34rem),radial-gradient(circle_at_80%_12%,rgb(251_191_36_/_0.12),transparent_30rem),radial-gradient(circle_at_50%_90%,rgb(59_130_246_/_0.08),transparent_28rem)]" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:block">
          <Badge tone="primary">Imperial Detailing CRM</Badge>

          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-white">
            Премиальная операционная CRM для детейлинг-центра
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
            Управляйте заказами, клиентами, автомобилями, боксами,
            ценообразованием и аудитом в едином рабочем пространстве.
          </p>

          <div className="mt-10 grid max-w-2xl gap-3">
            {capabilities.map((capability) => (
              <div
                key={capability}
                className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]/72 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-xl"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(45_212_191_/_0.12)] text-sm font-semibold text-[rgb(94_234_212)]">
                  ✓
                </div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                  {capability}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]/72 p-5 backdrop-blur-xl">
              <div className="text-2xl font-semibold text-white">RBAC</div>
              <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                Роли и permissions
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]/72 p-5 backdrop-blur-xl">
              <div className="text-2xl font-semibold text-white">KZT</div>
              <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                Расчеты в тенге
              </div>
            </div>

            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]/72 p-5 backdrop-blur-xl">
              <div className="text-2xl font-semibold text-white">AI</div>
              <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                Готовность к AI-слою
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[480px]">
          <div className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]/88 p-2 shadow-[var(--shadow-soft)] backdrop-blur-2xl">
            <div className="rounded-[1.6rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/78 p-6 sm:p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[hsl(var(--primary))] text-xl font-black text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-glow)]">
                  I
                </div>

                <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                  Вход в {appConfig.shortName}
                </h2>

                <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted))]">
                  Авторизуйтесь, чтобы продолжить работу в операционной CRM
                  Imperial Detailing.
                </p>
              </div>

              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[hsl(var(--muted))]">
            {appConfig.companyName} · Production CRM foundation
          </p>
        </section>
      </div>
    </main>
  );
}