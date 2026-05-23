import { cn } from "@/src/lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

type CardHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

type CardTitleProps = {
  children: React.ReactNode;
  className?: string;
};

type CardDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

type CardContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn("p-6 pb-4", className)}>{children}</div>;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn("text-sm font-semibold tracking-tight text-white", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p
      className={cn(
        "mt-2 text-sm leading-6 text-[hsl(var(--muted))]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>;
}