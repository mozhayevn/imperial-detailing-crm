import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/ui/page-header";

type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  status?: "foundation" | "next" | "future";
  primaryAction?: string;
  secondaryAction?: string;
  points?: string[];
};

const statusMap = {
  foundation: {
    label: "Foundation",
    tone: "primary" as const,
  },
  next: {
    label: "Следующий этап",
    tone: "warning" as const,
  },
  future: {
    label: "Будущий модуль",
    tone: "muted" as const,
  },
};

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  status = "foundation",
  primaryAction = "Продолжить настройку",
  secondaryAction = "Открыть позже",
  points = [],
}: ModulePlaceholderProps) {
  const statusInfo = statusMap[status];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <Button variant="secondary">{secondaryAction}</Button>
            <Button>{primaryAction}</Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Состояние раздела</CardTitle>
                <CardDescription>
                  Этот экран уже подключен к navigation shell. Реальная
                  бизнес-логика будет добавлена по плану, после auth и API
                  foundation.
                </CardDescription>
              </div>

              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-3xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8">
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[hsl(var(--surface-3))] text-xl font-semibold text-[hsl(var(--primary))]">
                  +
                </div>

                <h2 className="mt-5 text-lg font-semibold text-white">
                  Раздел готов к разработке
                </h2>

                <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted))]">
                  Здесь появятся таблицы, фильтры, формы, статусы, audit
                  timeline, pricing panels и другие рабочие элементы CRM.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Что будет внутри</CardTitle>
            <CardDescription>
              Основные элементы, которые будут добавлены на следующих этапах.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {points.map((point, index) => (
                <div
                  key={point}
                  className="flex gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-3))] text-xs font-semibold text-[hsl(var(--primary))]">
                    {index + 1}
                  </div>
                  <div className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    {point}
                  </div>
                </div>
              ))}

              {points.length === 0 ? (
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3 text-sm text-[hsl(var(--muted))]">
                  Детали раздела будут описаны перед началом разработки.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}