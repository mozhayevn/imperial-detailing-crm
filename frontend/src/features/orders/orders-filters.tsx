"use client";

import type { FormEvent } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Combobox } from "@/src/components/ui/combobox";
import type { OrderFilters } from "@/src/features/orders/types";
import { orderStatuses } from "@/src/lib/constants";
import { getOrderStatusLabel } from "@/src/features/orders/status";
import { parseOrderSearch } from "@/src/features/orders/search";
import type { WorkBay } from "@/src/features/work-bays/types";
import type { UserWithRoles } from "@/src/features/users/types";
import { cn } from "@/src/lib/cn";

type OrdersFiltersProps = {
  filters: OrderFilters;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearch: (searchValue: string, extraFilters?: OrderFilters) => void;
  onChange: (filters: OrderFilters) => void;
  onReset: () => void;
  isLoading?: boolean;
  isLookupsLoading?: boolean;
  workBays: WorkBay[];
  users: UserWithRoles[];
  usersLookupAvailable: boolean;
};

const quickStatuses = [
  {
    label: "Все",
    value: "",
  },
  ...orderStatuses.map((status) => ({
    label: getOrderStatusLabel(status),
    value: status,
  })),
];

export function OrdersFilters({
  filters,
  searchValue,
  onSearchValueChange,
  onSearch,
  onChange,
  onReset,
  isLoading,
  isLookupsLoading,
  workBays,
  users,
  usersLookupAvailable,
}: OrdersFiltersProps) {
  const parsedSearch = parseOrderSearch(searchValue);

  const workBayOptions = workBays.map((bay) => ({
    label: bay.name,
    value: bay.id,
    description: bay.description ?? "Рабочий бокс",
  }));

  const userOptions = users.map((user) => ({
    label: user.full_name,
    value: user.id,
    description: user.email,
  }));

  function applyStatus(status: string) {
    const nextFilters = {
      ...filters,
      status: status || null,
    };

    onChange(nextFilters);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const extraFilters: OrderFilters = {
      work_bay_id: filters.work_bay_id ?? null,
      assigned_user_id: usersLookupAvailable
        ? (filters.assigned_user_id ?? null)
        : null,
      status: filters.status ?? null,
    };

    onSearch(searchValue, extraFilters);
  }

  return (
    <div className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
            Поиск заказов
          </div>
          <p className="mt-1 text-sm text-[hsl(var(--muted))]">
            Ищите по телефону, госномеру, номеру заказа или ФИО клиента.
          </p>
        </div>

        <div className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          {parsedSearch.label}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          className={
            usersLookupAvailable
              ? "grid gap-4 xl:grid-cols-[1.45fr_0.75fr_0.75fr_auto]"
              : "grid gap-4 xl:grid-cols-[1.7fr_0.8fr_auto]"
          }
        >
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">
              Умный поиск
            </span>

            <div className="relative">
              <input
                name="search"
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                placeholder="Например: +7 777 123 45 67, 777ABC, #12, Бауыржан Можаев"
                className="h-12 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 pr-28 text-sm text-white outline-none transition placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--primary))]"
              />

              <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-3))] px-3 py-1 text-[11px] text-[hsl(var(--muted))] md:block">
                Enter
              </div>
            </div>
          </label>

          <Combobox
            label="Бокс"
            placeholder={isLookupsLoading ? "Загрузка боксов..." : "Все боксы"}
            value={filters.work_bay_id ?? null}
            options={workBayOptions}
            disabled={isLookupsLoading}
            onChange={(value) =>
              onChange({
                ...filters,
                work_bay_id: Number(value) || null,
              })
            }
          />

          {usersLookupAvailable ? (
            <Combobox
              label="Мастер"
              placeholder="Все мастера"
              value={filters.assigned_user_id ?? null}
              options={userOptions}
              disabled={isLookupsLoading}
              onChange={(value) =>
                onChange({
                  ...filters,
                  assigned_user_id: Number(value) || null,
                })
              }
            />
          ) : null}

          <div className="flex items-end gap-2">
            <Button type="submit" className="h-12" disabled={isLoading}>
              Найти
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="h-12"
              disabled={isLoading}
              onClick={onReset}
            >
              Сброс
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
          Быстрый статус
        </div>

        <div className="flex flex-wrap gap-2">
          {quickStatuses.map((status) => {
            const isActive = (filters.status ?? "") === status.value;

            return (
              <button
                key={status.value || "all"}
                type="button"
                disabled={isLoading}
                onClick={() => applyStatus(status.value)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold transition disabled:opacity-50",
                  isActive
                    ? "border-[rgb(45_212_191_/_0.45)] bg-[rgb(45_212_191_/_0.16)] text-[rgb(94_234_212)] shadow-[var(--shadow-glow)]"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-3))] hover:text-white",
                )}
              >
                {status.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}