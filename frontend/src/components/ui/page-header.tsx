import { cn } from "@/src/lib/cn";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <div className="text-sm font-medium text-[hsl(var(--primary))]">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>

        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
    </div>
  );
}