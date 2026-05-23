import { cn } from "@/src/lib/cn";

type SectionProps = {
  children: React.ReactNode;
  className?: string;
};

export function Section({ children, className }: SectionProps) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-6 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </section>
  );
}