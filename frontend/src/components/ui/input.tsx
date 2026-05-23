import type { InputHTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {label}
        </span>
      ) : null}

      <input
        id={inputId}
        className={cn(
          "h-11 w-full rounded-2xl border bg-[hsl(var(--surface-2))] px-4 text-sm text-white outline-none transition placeholder:text-[hsl(var(--muted))]",
          error
            ? "border-[hsl(var(--danger))] focus:border-[hsl(var(--danger))]"
            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]",
          className,
        )}
        {...props}
      />

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