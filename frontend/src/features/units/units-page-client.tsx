"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { createUnit, getUnits } from "@/src/features/units/api";
import type { Unit } from "@/src/features/units/types";

type UnitFormState = {
  name: string;
  code: string;
};

const defaultForm: UnitFormState = {
  name: "",
  code: "",
};

export function UnitsPageClient() {
  const { session } = useAuth();

  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState<UnitFormState>(defaultForm);
  const [search, setSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadUnits = canAccessByPermission(session, "materials.read");
  const canManageUnits = canAccessByPermission(session, "materials.manage");

  const filteredUnits = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return units;
    }

    return units.filter((unit) => {
      return (
        unit.name.toLowerCase().includes(normalizedSearch) ||
        unit.code.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [units, search]);

  useEffect(() => {
    let isMounted = true;

    async function loadUnits() {
      if (!canReadUnits) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getUnits();

        if (isMounted) {
          setUnits(result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUnits();

    return () => {
      isMounted = false;
    };
  }, [canReadUnits]);

  function updateForm(patch: Partial<UnitFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  async function handleCreateUnit() {
    const name = form.name.trim();
    const code = form.code.trim();

    if (!name) {
      setError("Укажите название единицы измерения.");
      return;
    }

    if (!code) {
      setError("Укажите короткий код единицы измерения.");
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdUnit = await createUnit({
        name,
        code,
      });

      setUnits((current) => [createdUnit, ...current]);
      setForm(defaultForm);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Материалы"
        title="Единицы измерения"
        description="Справочник единиц измерения для материалов и фактического расхода."
      />

      {!canReadUnits ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к единицам измерения. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                materials.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadUnits ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            {error ? (
              <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
                {error}
              </div>
            ) : null}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Список единиц</CardTitle>
                    <CardDescription>
                      Всего единиц: {units.length}. Найдено:{" "}
                      {filteredUnits.length}.
                    </CardDescription>
                  </div>

                  <Badge tone={units.length > 0 ? "primary" : "muted"}>
                    {units.length}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <Input
                  label="Поиск"
                  placeholder="Например: мл, литр, метр, штука..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                {isLoading ? (
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                    Загружаем единицы измерения...
                  </div>
                ) : null}

                {!isLoading && filteredUnits.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                    Единицы измерения не найдены.
                  </div>
                ) : null}

                {!isLoading && filteredUnits.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {filteredUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-semibold text-white">
                                {unit.name}
                              </div>

                              <Badge tone="muted">Unit ID #{unit.id}</Badge>
                            </div>

                            <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                              Код единицы измерения:{" "}
                              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                                {unit.code}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 py-3 text-center">
                            <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                              Код
                            </div>
                            <div className="mt-1 text-lg font-semibold text-white">
                              {unit.code}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Создать единицу</CardTitle>
                <CardDescription>
                  Добавьте новую единицу измерения для материалов.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {!canManageUnits ? (
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                    Для создания единиц нужен permission{" "}
                    <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                      materials.manage
                    </span>
                    .
                  </div>
                ) : null}

                {canManageUnits ? (
                  <div className="space-y-4">
                    <Input
                      label="Название"
                      placeholder="Например: Миллилитр"
                      value={form.name}
                      onChange={(event) =>
                        updateForm({
                          name: event.target.value,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleCreateUnit();
                        }
                      }}
                    />

                    <Input
                      label="Код"
                      placeholder="Например: мл"
                      value={form.code}
                      onChange={(event) =>
                        updateForm({
                          code: event.target.value,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleCreateUnit();
                        }
                      }}
                    />

                    <Button
                      type="button"
                      className="w-full"
                      disabled={isSubmittingCreate}
                      onClick={() => void handleCreateUnit()}
                    >
                      {isSubmittingCreate
                        ? "Создаем..."
                        : "Создать единицу"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Примеры</CardTitle>
                <CardDescription>
                  Рекомендуемые единицы для детейлинга.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-2 text-sm leading-6 text-[hsl(var(--muted))]">
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2">
                    Миллилитр — мл
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2">
                    Литр — л
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2">
                    Штука — шт
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2">
                    Метр — м
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2">
                    Квадратный метр — м²
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}
    </PageContainer>
  );
}