"use client";

import Link from "next/link";
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
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";
import { getServices } from "@/src/features/services/api";
import type { Service } from "@/src/features/services/types";
import { getMaterials } from "@/src/features/materials/api";
import type { Material } from "@/src/features/materials/types";
import { getMaterialBrands } from "@/src/features/material-brands/api";
import type { MaterialBrand } from "@/src/features/material-brands/types";
import { getServicePackages } from "@/src/features/service-packages/api";
import type { ServicePackage } from "@/src/features/service-packages/types";

function getIsActive(item: unknown) {
  if (typeof item !== "object" || item === null) {
    return true;
  }

  if (!("is_active" in item)) {
    return true;
  }

  return (item as { is_active?: boolean }).is_active !== false;
}

function getActiveCount(items: unknown[]) {
  return items.filter((item) => getIsActive(item)).length;
}

function getInactiveCount(items: unknown[]) {
  return items.filter((item) => !getIsActive(item)).length;
}

function getItemName(item: { name?: string; title?: string; id: number }) {
  return item.name ?? item.title ?? `#${item.id}`;
}

function ManagementCard({
  title,
  description,
  totalCount,
  activeCount,
  inactiveCount,
  href,
  disabled,
}: {
  title: string;
  description: string;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  href: string;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          <Badge tone={totalCount > 0 ? "primary" : "muted"}>
            {totalCount}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
              Активные
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {activeCount}
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
              Неактивные
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {inactiveCount}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {disabled ? (
            <Button type="button" variant="secondary" disabled>
              Скоро
            </Button>
          ) : (
            <Link href={href}>
              <Button type="button" variant="secondary">
                Открыть
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type RecentItem = {
  id: number;
  name?: string;
  title?: string;
  is_active?: boolean;
};

function RecentItemsCard<T extends { id: number }>({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: T[];
}) {
  const recentItems = items.slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        {recentItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-5 text-center text-sm text-[hsl(var(--muted))]">
            Данных пока нет.
          </div>
        ) : (
          <div className="space-y-2">
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {getItemName(item as RecentItem)}
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                    ID #{item.id}
                  </div>
                </div>

                <Badge tone={getIsActive(item) ? "success" : "muted"}>
                  {getIsActive(item) ? "Активно" : "Архив"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ServicesPageClient() {
  const { session } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialBrands, setMaterialBrands] = useState<MaterialBrand[]>([]);
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadServices = canAccessByPermission(session, "services.read");
  const canReadMaterials = canAccessByPermission(session, "materials.read");
  const canReadMaterialBrands = canAccessByPermission(
    session,
    "material_brands.read",
  );
  const canReadServicePackages = canAccessByPermission(
    session,
    "service_packages.read",
  );

  const hasAnyAccess =
    canReadServices ||
    canReadMaterials ||
    canReadMaterialBrands ||
    canReadServicePackages;

  const totalActiveItems = useMemo(
    () =>
      getActiveCount(services) +
      getActiveCount(materials) +
      getActiveCount(materialBrands) +
      getActiveCount(servicePackages),
    [services, materials, materialBrands, servicePackages],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!hasAnyAccess) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [
          servicesResult,
          materialsResult,
          brandsResult,
          packagesResult,
        ] = await Promise.allSettled([
          canReadServices ? getServices() : Promise.resolve([]),
          canReadMaterials ? getMaterials({ is_active: true }) : Promise.resolve([]),
          canReadMaterialBrands ? getMaterialBrands() : Promise.resolve([]),
          canReadServicePackages ? getServicePackages() : Promise.resolve([]),
        ]);

        if (!isMounted) {
          return;
        }

        if (servicesResult.status === "fulfilled") {
          setServices(servicesResult.value);
        } else {
          setServices([]);
        }

        if (materialsResult.status === "fulfilled") {
          setMaterials(materialsResult.value);
        } else {
          setMaterials([]);
        }

        if (brandsResult.status === "fulfilled") {
          setMaterialBrands(brandsResult.value);
        } else {
          setMaterialBrands([]);
        }

        if (packagesResult.status === "fulfilled") {
          setServicePackages(packagesResult.value);
        } else {
          setServicePackages([]);
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

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [
    hasAnyAccess,
    canReadServices,
    canReadMaterials,
    canReadMaterialBrands,
    canReadServicePackages,
  ]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Услуги"
        title="Услуги, материалы и ценообразование"
        description="Управление услугами детейлинга, брендами материалов, расходниками, пакетами и будущими правилами цен."
      />

      {!hasAnyAccess ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к разделу услуг и материалов. Нужен хотя бы один
              permission:{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                services.read
              </span>
              ,{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                materials.read
              </span>
              ,{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                material_brands.read
              </span>{" "}
              или{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                service_packages.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasAnyAccess ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <Card>
              <CardContent>
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6 text-sm text-[hsl(var(--muted))]">
                  Загружаем справочники услуг и материалов...
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!isLoading ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Операционная сводка</CardTitle>
                  <CardDescription>
                    Общая картина по справочникам, которые влияют на заказ,
                    pricing и материалы.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Услуг
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {services.length}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Материалов
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {materials.length}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
                        Брендов
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {materialBrands.length}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[rgb(45_212_191_/_0.22)] bg-[rgb(45_212_191_/_0.08)] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-[rgb(94_234_212)]">
                        Активных записей
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {totalActiveItems}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 xl:grid-cols-2">
                <ManagementCard
                  title="Услуги"
                  description="PDR, полировка, химчистка, шумоизоляция, оклейка и другие услуги."
                  totalCount={services.length}
                  activeCount={getActiveCount(services)}
                  inactiveCount={getInactiveCount(services)}
                  href="/services/catalog"
                />

                <ManagementCard
                  title="Материалы"
                  description="Расходники, единицы измерения и будущий складской учет."
                  totalCount={materials.length}
                  activeCount={getActiveCount(materials)}
                  inactiveCount={getInactiveCount(materials)}
                  href="/materials"
                />

                <ManagementCard
                  title="Бренды материалов"
                  description="Koch, CarPro, Gyeon, Llumar и другие бренды для услуг."
                  totalCount={materialBrands.length}
                  activeCount={getActiveCount(materialBrands)}
                  inactiveCount={getInactiveCount(materialBrands)}
                  href="/material-brands"
                />

                <ManagementCard
                  title="Пакеты услуг"
                  description="Basic, Premium, комплексные варианты и будущие bundle-предложения."
                  totalCount={servicePackages.length}
                  activeCount={getActiveCount(servicePackages)}
                  inactiveCount={getInactiveCount(servicePackages)}
                  href="/service-packages"
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <RecentItemsCard
                  title="Последние услуги"
                  description="Быстрый обзор доступных услуг."
                  items={services}
                />

                <RecentItemsCard
                  title="Последние материалы"
                  description="Быстрый обзор активных материалов."
                  items={materials}
                />

                <RecentItemsCard
                  title="Бренды материалов"
                  description="Бренды, которые используются в позициях заказа."
                  items={materialBrands}
                />

                <RecentItemsCard
                  title="Пакеты услуг"
                  description="Пакеты, которые могут участвовать в pricing."
                  items={servicePackages}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
}