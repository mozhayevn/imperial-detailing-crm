import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name;

  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {label}
        </span>
      ) : null}

      <textarea
        id={textareaId}
        className={cn(
          "min-h-28 w-full resize-y rounded-2xl border bg-[hsl(var(--surface-2))] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[hsl(var(--muted))]",
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