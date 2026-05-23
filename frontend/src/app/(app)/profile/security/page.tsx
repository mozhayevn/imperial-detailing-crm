import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { ProfileLayout } from "@/src/components/layout/profile-layout";

export default function ProfileSecurityPage() {
  return (
    <ProfileLayout active="security">
      <PageHeader
        eyebrow="Аккаунт"
        title="Безопасность"
        description="Раздел для управления безопасностью аккаунта. Сейчас это frontend foundation под будущие backend-возможности."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Смена пароля</CardTitle>
                <CardDescription>
                  В будущем здесь появится форма изменения пароля.
                </CardDescription>
              </div>
              <Badge tone="warning">Backend needed</Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              Для production-реализации нужен backend endpoint для смены
              пароля, проверки текущего пароля и политики сложности.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Активные сессии</CardTitle>
                <CardDescription>
                  Будущий список устройств и входов в аккаунт.
                </CardDescription>
              </div>
              <Badge tone="muted">Future</Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              Можно будет показывать устройство, IP, время входа, город и кнопку
              завершения сессии.
            </div>
          </CardContent>
        </Card>
      </div>
    </ProfileLayout>
  );
}