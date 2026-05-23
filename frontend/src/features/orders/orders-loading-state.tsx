import { Card } from "@/src/components/ui/card";

export function OrdersLoadingState() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 md:grid-cols-5"
          >
            <div className="h-4 animate-pulse rounded-full bg-[hsl(var(--surface-3))]" />
            <div className="h-4 animate-pulse rounded-full bg-[hsl(var(--surface-3))]" />
            <div className="h-4 animate-pulse rounded-full bg-[hsl(var(--surface-3))]" />
            <div className="h-4 animate-pulse rounded-full bg-[hsl(var(--surface-3))]" />
            <div className="h-4 animate-pulse rounded-full bg-[hsl(var(--surface-3))]" />
          </div>
        ))}
      </div>
    </Card>
  );
}