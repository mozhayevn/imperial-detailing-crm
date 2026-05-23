import { cn } from "@/src/lib/cn";

type SeparatorProps = {
  className?: string;
};

export function Separator({ className }: SeparatorProps) {
  return (
    <div
      className={cn("h-px w-full bg-[hsl(var(--border))]", className)}
      role="separator"
    />
  );
}