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

const privacyItems = [
  "Кто видит мой телефон",
  "Кто видит мой email",
  "Кто видит мою активность",
  "Показывать ли статус онлайн",
  "Кто видит мою загрузку по заказам",
  "Кто видит историю моих действий",
];

export default function ProfilePrivacyPage() {
  return (
    <ProfileLayout active="privacy">
      <PageHeader
        eyebrow="Аккаунт"
        title="Конфиденциальность"
        description="Идея раздела privacy settings, адаптированная под операционную CRM."
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Будущие настройки приватности</CardTitle>
              <CardDescription>
                Сейчас это архитектурный placeholder. Реальная
                конфиденциальность должна применяться backend’ом, а не только
                frontend-интерфейсом.
              </CardDescription>
            </div>
            <Badge tone="warning">Backend needed</Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {privacyItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
              >
                <div className="text-sm font-medium text-white">{item}</div>
                <div className="mt-2 text-xs leading-5 text-[hsl(var(--muted))]">
                  Настройка будет доступна после добавления backend-политик
                  приватности.
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </ProfileLayout>
  );
}