import Link from "next/link";
import { routes } from "@/src/config/routes";
import { Card } from "@/src/components/ui/card";
import { PageContainer } from "@/src/components/layout/page-container";
import { cn } from "@/src/lib/cn";

type ProfileLayoutProps = {
  children: React.ReactNode;
  active: "profile" | "security" | "privacy";
};

const profileNav = [
  {
    key: "profile",
    title: "Профиль",
    description: "Аккаунт, роли и доступы",
    href: routes.profile,
  },
  {
    key: "security",
    title: "Безопасность",
    description: "Пароль, сессии и защита",
    href: routes.profileSecurity,
  },
  {
    key: "privacy",
    title: "Конфиденциальность",
    description: "Видимость данных и приватность",
    href: routes.profilePrivacy,
  },
] as const;

export function ProfileLayout({ children, active }: ProfileLayoutProps) {
  return (
    <PageContainer>
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <Card className="h-fit p-2">
          <nav className="space-y-1">
            {profileNav.map((item) => {
              const isActive = item.key === active;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "block rounded-2xl px-4 py-3 transition",
                    isActive
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-glow)]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))] hover:text-white",
                  )}
                >
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div
                    className={cn(
                      "mt-1 text-xs",
                      isActive
                        ? "text-[hsl(var(--primary-foreground))]/75"
                        : "text-[hsl(var(--muted))]",
                    )}
                  >
                    {item.description}
                  </div>
                </Link>
              );
            })}
          </nav>
        </Card>

        <div>{children}</div>
      </div>
    </PageContainer>
  );
}