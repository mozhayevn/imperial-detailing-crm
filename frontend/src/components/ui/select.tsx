import type { SelectHTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type SelectOption = {
  label: string;
  value: string | number;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
};

export function Select({
  label,
  hint,
  error,
  options,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {label}
        </span>
      ) : null}

      <select
        id={selectId}
        className={cn(
          "h-12 w-full rounded-2xl border bg-[hsl(var(--surface-2))] px-4 text-sm text-white outline-none transition",
          error
            ? "border-[hsl(var(--danger))] focus:border-[hsl(var(--danger))]"
            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? (
        <span className="mt-2 block text-xs text-[hsl(var(--danger))]">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-2 block text-xs text-[hsl(var(--muted))]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}