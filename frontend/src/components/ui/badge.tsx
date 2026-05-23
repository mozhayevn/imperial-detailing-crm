import { cn } from "@/src/lib/cn";

type BadgeTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "muted";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  default:
    "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))]",
  primary:
    "border-[rgb(45_212_191_/_0.28)] bg-[rgb(45_212_191_/_0.1)] text-[rgb(94_234_212)]",
  success:
    "border-[rgb(74_222_128_/_0.28)] bg-[rgb(74_222_128_/_0.1)] text-[rgb(134_239_172)]",
  warning:
    "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.1)] text-[rgb(252_211_77)]",
  danger:
    "border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.1)] text-[rgb(252_165_165)]",
  muted:
    "border-[hsl(var(--border))] bg-transparent text-[hsl(var(--muted))]",
};

export function Badge({ children, tone = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}