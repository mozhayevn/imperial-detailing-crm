"use client";

import { useMemo, useState } from "react";
import { cn } from "@/src/lib/cn";

export type ComboboxOption = {
  label: string;
  value: string | number;
  description?: string;
};

type ComboboxProps = {
  label?: string;
  hint?: string;
  placeholder?: string;
  value?: string | number | null;
  options: ComboboxOption[];
  onChange: (value: string | number | null) => void;
  disabled?: boolean;
  className?: string;
};

export function Combobox({
  label,
  hint,
  placeholder = "Выберите значение",
  value,
  options,
  onChange,
  disabled,
  className,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = options.find(
    (option) => String(option.value) === String(value ?? ""),
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const label = option.label.toLowerCase();
      const description = option.description?.toLowerCase() ?? "";

      return (
        label.includes(normalizedQuery) ||
        description.includes(normalizedQuery)
      );
    });
  }, [options, query]);

  function handleSelect(nextValue: string | number | null) {
    onChange(nextValue);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className={cn("relative", className)}>
      {label ? (
        <span className="mb-2 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {label}
        </span>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 text-left text-sm text-white outline-none transition",
          "hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--surface-3))]",
          "focus:border-[hsl(var(--primary))]",
          disabled && "cursor-not-allowed opacity-50",
          isOpen && "border-[hsl(var(--primary))] shadow-[var(--shadow-glow)]",
        )}
      >
        <span className="min-w-0 truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <span
          className={cn(
            "shrink-0 text-[hsl(var(--muted))] transition",
            isOpen && "rotate-180 text-[hsl(var(--primary))]",
          )}
        >
          ▾
        </span>
      </button>

      {hint ? (
        <span className="mt-2 block text-xs text-[hsl(var(--muted))]">
          {hint}
        </span>
      ) : null}

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Закрыть список"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => {
              setIsOpen(false);
              setQuery("");
            }}
          />

          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-2 shadow-[var(--shadow-soft)]">
            <div className="p-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск..."
                className="h-10 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 text-sm text-white outline-none transition placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--primary))]"
              />
            </div>

            <div className="crm-scrollbar max-h-72 overflow-y-auto p-1">
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition hover:bg-[hsl(var(--surface-2))]",
                  value === null || value === undefined || value === ""
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-white",
                )}
              >
                <span>{placeholder}</span>
                {value === null || value === undefined || value === "" ? (
                  <span className="text-xs font-semibold">Выбрано</span>
                ) : null}
              </button>

              {filteredOptions.map((option) => {
                const isSelected =
                  String(option.value) === String(value ?? "");

                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "mt-1 flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[hsl(var(--surface-2))]",
                      isSelected
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "text-[hsl(var(--muted-foreground))] hover:text-white",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {option.label}
                      </span>

                      {option.description ? (
                        <span
                          className={cn(
                            "mt-1 block truncate text-xs",
                            isSelected
                              ? "text-[hsl(var(--primary-foreground))]/70"
                              : "text-[hsl(var(--muted))]",
                          )}
                        >
                          {option.description}
                        </span>
                      ) : null}
                    </span>

                    {isSelected ? (
                      <span className="shrink-0 text-xs font-semibold">
                        Выбрано
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-[hsl(var(--muted))]">
                  Ничего не найдено
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}