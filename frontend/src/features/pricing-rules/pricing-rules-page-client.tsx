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
import { Combobox } from "@/src/components/ui/combobox";
import { Input } from "@/src/components/ui/input";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { formatCurrency } from "@/src/lib/formatters";
import { canAccessByPermission } from "@/src/features/auth/permission-guards";
import { useAuth } from "@/src/features/auth/use-auth";

import {
  createServicePriceRule,
  deleteServicePriceRule,
  getServicePriceRules,
  updateServicePriceRule,
} from "@/src/features/pricing-rules/api";
import type { ServicePriceRule } from "@/src/features/pricing-rules/types";

import { getServices } from "@/src/features/services/api";
import type { Service } from "@/src/features/services/types";

import { getCarTypes } from "@/src/features/car-types/api";
import type { CarType } from "@/src/features/car-types/types";

import { getMaterialBrands } from "@/src/features/material-brands/api";
import type { MaterialBrand } from "@/src/features/material-brands/types";

import { getServicePackages } from "@/src/features/service-packages/api";
import type { ServicePackage } from "@/src/features/service-packages/types";

type RuleFormState = {
  service_id: number | null;
  car_type_id: number | null;
  material_brand_id: number | null;
  service_package_id: number | null;
  price: string;
};

const defaultForm: RuleFormState = {
  service_id: null,
  car_type_id: null,
  material_brand_id: null,
  service_package_id: null,
  price: "",
};

const ALL_FILTER_VALUE = "__all__";
const NONE_FILTER_VALUE = "__none__";

function parsePrice(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function getServiceName(services: Service[], serviceId: number) {
  return (
    services.find((service) => service.id === serviceId)?.name ??
    `Услуга #${serviceId}`
  );
}

function getCarTypeName(carTypes: CarType[], carTypeId: number) {
  return (
    carTypes.find((carType) => carType.id === carTypeId)?.name ??
    `Тип авто #${carTypeId}`
  );
}

function getBrandName(brands: MaterialBrand[], brandId: number | null) {
  if (!brandId) {
    return "Без бренда";
  }

  return (
    brands.find((brand) => brand.id === brandId)?.name ?? `Бренд #${brandId}`
  );
}

function getPackageName(packages: ServicePackage[], packageId: number | null) {
  if (!packageId) {
    return "Без пакета";
  }

  return (
    packages.find((item) => item.id === packageId)?.name ??
    `Пакет #${packageId}`
  );
}

function getRulePriorityLabel(rule: ServicePriceRule) {
  const hasBrand = rule.material_brand_id !== null;
  const hasPackage = rule.service_package_id !== null;

  if (hasBrand && hasPackage) {
    return "Exact override";
  }

  if (hasBrand) {
    return "Brand override";
  }

  if (hasPackage) {
    return "Package override";
  }

  return "Generic";
}

function getRulePriorityTone(rule: ServicePriceRule) {
  const hasBrand = rule.material_brand_id !== null;
  const hasPackage = rule.service_package_id !== null;

  if (hasBrand && hasPackage) {
    return "success";
  }

  if (hasBrand || hasPackage) {
    return "primary";
  }

  return "muted";
}

function ruleToForm(rule: ServicePriceRule): RuleFormState {
  return {
    service_id: rule.service_id,
    car_type_id: rule.car_type_id,
    material_brand_id: rule.material_brand_id,
    service_package_id: rule.service_package_id,
    price: String(rule.price),
  };
}

export function PricingRulesPageClient() {
  const { session } = useAuth();

  const [rules, setRules] = useState<ServicePriceRule[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [carTypes, setCarTypes] = useState<CarType[]>([]);
  const [materialBrands, setMaterialBrands] = useState<MaterialBrand[]>([]);
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);

  const [form, setForm] = useState<RuleFormState>(defaultForm);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<RuleFormState>(defaultForm);

  const [search, setSearch] = useState("");
  const [filterServiceId, setFilterServiceId] = useState<number | null>(null);
  const [filterCarTypeId, setFilterCarTypeId] = useState<number | null>(null);
  const [filterBrandId, setFilterBrandId] = useState<number | null>(null);
  const [filterPackageId, setFilterPackageId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [submittingEditRuleId, setSubmittingEditRuleId] = useState<
    number | null
  >(null);
  const [deleteConfirmRuleId, setDeleteConfirmRuleId] = useState<number | null>(
    null,
  );
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReadPricing = canAccessByPermission(session, "pricing.read");
  const canManagePricing = canAccessByPermission(session, "pricing.manage");

  const activeServices = useMemo(
    () => services.filter((service) => service.is_active !== false),
    [services],
  );

  const activeMaterialBrands = useMemo(
    () => materialBrands.filter((brand) => brand.is_active !== false),
    [materialBrands],
  );

  const activeServicePackages = useMemo(
    () => servicePackages.filter((item) => item.is_active !== false),
    [servicePackages],
  );

  const selectedCreateService = useMemo(
    () =>
      form.service_id
        ? (services.find((service) => service.id === form.service_id) ?? null)
        : null,
    [services, form.service_id],
  );

  const selectedEditService = useMemo(
    () =>
      editingForm.service_id
        ? (services.find((service) => service.id === editingForm.service_id) ??
          null)
        : null,
    [services, editingForm.service_id],
  );

  const serviceOptions = useMemo(
    () =>
      activeServices.map((service) => ({
        value: String(service.id),
        label: service.name,
        description: service.description || "Услуга",
      })),
    [activeServices],
  );

  const carTypeOptions = useMemo(
    () =>
      carTypes.map((carType) => ({
        value: String(carType.id),
        label: carType.name,
      })),
    [carTypes],
  );

  const brandOptions = useMemo(
    () => [
      {
        value: "",
        label: "Без бренда",
        description: "Для услуг, где бренд не требуется",
      },
      ...activeMaterialBrands.map((brand) => ({
        value: String(brand.id),
        label: brand.name,
        description: brand.category || "Бренд материала",
      })),
    ],
    [activeMaterialBrands],
  );

  const packageOptionsForCreate = useMemo(() => {
    const availablePackages = activeServicePackages.filter((item) =>
      form.service_id ? item.service_id === form.service_id : true,
    );

    return [
      {
        value: "",
        label: "Без пакета",
        description: "Для услуг, где пакет не требуется",
      },
      ...availablePackages.map((item) => ({
        value: String(item.id),
        label: item.name,
        description: item.description || `Пакет услуги #${item.service_id}`,
      })),
    ];
  }, [activeServicePackages, form.service_id]);

  const packageOptionsForEdit = useMemo(() => {
    const selectedPackageIds = new Set(
      rules
        .map((rule) => rule.service_package_id)
        .filter((packageId): packageId is number => Boolean(packageId)),
    );

    const availablePackages = servicePackages.filter((item) => {
      const belongsToService = editingForm.service_id
        ? item.service_id === editingForm.service_id
        : true;

      const isActiveOrSelected =
        item.is_active !== false || selectedPackageIds.has(item.id);

      return belongsToService && isActiveOrSelected;
    });

    return [
      {
        value: "",
        label: "Без пакета",
        description: "Для услуг, где пакет не требуется",
      },
      ...availablePackages.map((item) => ({
        value: String(item.id),
        label: item.name,
        description:
          item.description ||
          (item.is_active === false
            ? `Пакет услуги #${item.service_id} · архив`
            : `Пакет услуги #${item.service_id}`),
      })),
    ];
  }, [servicePackages, editingForm.service_id, rules]);

  const serviceFilterOptions = useMemo(
    () => [
      {
        value: ALL_FILTER_VALUE,
        label: "Все услуги",
      },
      ...services.map((service) => ({
        value: String(service.id),
        label: service.name,
        description: service.is_active === false ? "Архив" : "Активна",
      })),
    ],
    [services],
  );

  const carTypeFilterOptions = useMemo(
    () => [
      {
        value: ALL_FILTER_VALUE,
        label: "Все типы авто",
      },
      ...carTypes.map((carType) => ({
        value: String(carType.id),
        label: carType.name,
      })),
    ],
    [carTypes],
  );

  const brandFilterOptions = useMemo(
    () => [
      {
        value: ALL_FILTER_VALUE,
        label: "Все бренды",
      },
      {
        value: NONE_FILTER_VALUE,
        label: "Без бренда",
      },
      ...materialBrands.map((brand) => ({
        value: String(brand.id),
        label: brand.name,
        description:
          brand.is_active === false
            ? "Архив"
            : brand.category || "Бренд материала",
      })),
    ],
    [materialBrands],
  );

  const packageFilterOptions = useMemo(
    () => [
      {
        value: ALL_FILTER_VALUE,
        label: "Все пакеты",
      },
      {
        value: NONE_FILTER_VALUE,
        label: "Без пакета",
      },
      ...servicePackages.map((item) => ({
        value: String(item.id),
        label: item.name,
        description:
          item.is_active === false ? "Архив" : `Услуга #${item.service_id}`,
      })),
    ],
    [servicePackages],
  );

  const filteredRules = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rules.filter((rule) => {
      const serviceName = getServiceName(
        services,
        rule.service_id,
      ).toLowerCase();
      const carTypeName = getCarTypeName(
        carTypes,
        rule.car_type_id,
      ).toLowerCase();
      const brandName = getBrandName(
        materialBrands,
        rule.material_brand_id,
      ).toLowerCase();
      const packageName = getPackageName(
        servicePackages,
        rule.service_package_id,
      ).toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        serviceName.includes(normalizedSearch) ||
        carTypeName.includes(normalizedSearch) ||
        brandName.includes(normalizedSearch) ||
        packageName.includes(normalizedSearch);

      const matchesService =
        filterServiceId === null || rule.service_id === filterServiceId;

      const matchesCarType =
        filterCarTypeId === null || rule.car_type_id === filterCarTypeId;

      const matchesBrand =
        filterBrandId === null ||
        (filterBrandId === 0 && rule.material_brand_id === null) ||
        rule.material_brand_id === filterBrandId;

      const matchesPackage =
        filterPackageId === null ||
        (filterPackageId === 0 && rule.service_package_id === null) ||
        rule.service_package_id === filterPackageId;

      return (
        matchesSearch &&
        matchesService &&
        matchesCarType &&
        matchesBrand &&
        matchesPackage
      );
    });
  }, [
    rules,
    services,
    carTypes,
    materialBrands,
    servicePackages,
    search,
    filterServiceId,
    filterCarTypeId,
    filterBrandId,
    filterPackageId,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!canReadPricing) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [
          rulesResult,
          servicesResult,
          carTypesResult,
          brandsResult,
          packagesResult,
        ] = await Promise.allSettled([
          getServicePriceRules(),
          getServices(),
          getCarTypes(),
          getMaterialBrands(),
          getServicePackages(),
        ]);

        if (!isMounted) {
          return;
        }

        if (rulesResult.status === "fulfilled") {
          setRules(rulesResult.value);
        } else {
          setRules([]);
          setError(getApiErrorMessage(rulesResult.reason));
        }

        if (servicesResult.status === "fulfilled") {
          setServices(servicesResult.value);
        } else {
          setServices([]);
        }

        if (carTypesResult.status === "fulfilled") {
          setCarTypes(carTypesResult.value);
        } else {
          setCarTypes([]);
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
  }, [canReadPricing]);

  function updateForm(patch: Partial<RuleFormState>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function updateEditingForm(patch: Partial<RuleFormState>) {
    setEditingForm((current) => ({
      ...current,
      ...patch,
    }));
    setError(null);
  }

  function validateRuleForm(currentForm: RuleFormState) {
    if (!currentForm.service_id) {
      return {
        error: "Выберите услугу.",
        payload: null,
      };
    }

    if (!currentForm.car_type_id) {
      return {
        error: "Выберите тип авто.",
        payload: null,
      };
    }

    const selectedService = services.find(
      (service) => service.id === currentForm.service_id,
    );

    if (!selectedService) {
      return {
        error: "Выбранная услуга не найдена.",
        payload: null,
      };
    }

    if (!selectedService.requires_brand && currentForm.material_brand_id) {
      return {
        error: "Для выбранной услуги бренд материала не требуется.",
        payload: null,
      };
    }

    if (!selectedService.requires_package && currentForm.service_package_id) {
      return {
        error: "Для выбранной услуги пакет не требуется.",
        payload: null,
      };
    }

    if (currentForm.service_package_id) {
      const selectedPackage = servicePackages.find(
        (item) => item.id === currentForm.service_package_id,
      );

      if (!selectedPackage) {
        return {
          error: "Выбранный пакет не найден.",
          payload: null,
        };
      }

      if (selectedPackage.service_id !== selectedService.id) {
        return {
          error: "Выбранный пакет не относится к выбранной услуге.",
          payload: null,
        };
      }
    }

    const price = parsePrice(currentForm.price);

    if (price === null) {
      return {
        error: "Укажите корректную цену.",
        payload: null,
      };
    }

    return {
      error: null,
      payload: {
        service_id: currentForm.service_id,
        car_type_id: currentForm.car_type_id,
        material_brand_id: currentForm.material_brand_id,
        service_package_id: currentForm.service_package_id,
        price,
      },
    };
  }

  async function handleCreateRule() {
    const validation = validateRuleForm(form);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте правило цены.");
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);

    try {
      const createdRule = await createServicePriceRule(validation.payload);

      setRules((current) => [createdRule, ...current]);
      setForm(defaultForm);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  function startEditRule(rule: ServicePriceRule) {
    setEditingRuleId(rule.id);
    setEditingForm(ruleToForm(rule));
    setDeleteConfirmRuleId(null);
    setError(null);
  }

  function cancelEditRule() {
    setEditingRuleId(null);
    setEditingForm(defaultForm);
    setError(null);
  }

  async function handleUpdateRule(ruleId: number) {
    const validation = validateRuleForm(editingForm);

    if (validation.error || !validation.payload) {
      setError(validation.error ?? "Проверьте правило цены.");
      return;
    }

    setSubmittingEditRuleId(ruleId);
    setError(null);

    try {
      const updatedRule = await updateServicePriceRule(
        ruleId,
        validation.payload,
      );

      setRules((current) =>
        current.map((rule) =>
          rule.id === updatedRule.id ? updatedRule : rule,
        ),
      );

      setEditingRuleId(null);
      setEditingForm(defaultForm);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setSubmittingEditRuleId(null);
    }
  }

  async function handleDeleteRule(ruleId: number) {
    setDeletingRuleId(ruleId);
    setError(null);

    try {
      await deleteServicePriceRule(ruleId);

      setRules((current) => current.filter((rule) => rule.id !== ruleId));
      setDeleteConfirmRuleId(null);

      if (editingRuleId === ruleId) {
        setEditingRuleId(null);
        setEditingForm(defaultForm);
      }
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingRuleId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Ценообразование"
        title="Правила цены"
        description="Настройка цен по комбинации: услуга, тип авто, бренд материала и пакет услуги."
      />

      {!canReadPricing ? (
        <Card>
          <CardContent>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
              У вас нет доступа к правилам цены. Нужен permission{" "}
              <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                pricing.read
              </span>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadPricing ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4 text-sm leading-6 text-[rgb(252_165_165)]">
              {error}
            </div>
          ) : null}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Список правил цены</CardTitle>
                      <CardDescription>
                        Всего правил: {rules.length}. Найдено:{" "}
                        {filteredRules.length}.
                      </CardDescription>
                    </div>

                    <Badge tone={rules.length > 0 ? "primary" : "muted"}>
                      {rules.length}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Input
                    label="Поиск"
                    placeholder="Например: Полировка, SUV, Koch, Premium..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <Combobox
                      label="Фильтр по услуге"
                      placeholder="Все услуги"
                      value={
                        filterServiceId
                          ? String(filterServiceId)
                          : ALL_FILTER_VALUE
                      }
                      options={serviceFilterOptions}
                      onChange={(value) =>
                        setFilterServiceId(
                          value === ALL_FILTER_VALUE
                            ? null
                            : value
                              ? Number(value)
                              : null,
                        )
                      }
                    />

                    <Combobox
                      label="Фильтр по типу авто"
                      placeholder="Все типы авто"
                      value={
                        filterCarTypeId
                          ? String(filterCarTypeId)
                          : ALL_FILTER_VALUE
                      }
                      options={carTypeFilterOptions}
                      onChange={(value) =>
                        setFilterCarTypeId(
                          value === ALL_FILTER_VALUE
                            ? null
                            : value
                              ? Number(value)
                              : null,
                        )
                      }
                    />

                    <Combobox
                      label="Фильтр по бренду"
                      placeholder="Все бренды"
                      value={
                        filterBrandId === null
                          ? ALL_FILTER_VALUE
                          : filterBrandId === 0
                            ? NONE_FILTER_VALUE
                            : String(filterBrandId)
                      }
                      options={brandFilterOptions}
                      onChange={(value) =>
                        setFilterBrandId(
                          value === ALL_FILTER_VALUE
                            ? null
                            : value === NONE_FILTER_VALUE
                              ? 0
                              : value
                                ? Number(value)
                                : null,
                        )
                      }
                    />

                    <Combobox
                      label="Фильтр по пакету"
                      placeholder="Все пакеты"
                      value={
                        filterPackageId === null
                          ? ALL_FILTER_VALUE
                          : filterPackageId === 0
                            ? NONE_FILTER_VALUE
                            : String(filterPackageId)
                      }
                      options={packageFilterOptions}
                      onChange={(value) =>
                        setFilterPackageId(
                          value === ALL_FILTER_VALUE
                            ? null
                            : value === NONE_FILTER_VALUE
                              ? 0
                              : value
                                ? Number(value)
                                : null,
                        )
                      }
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setFilterServiceId(null);
                        setFilterCarTypeId(null);
                        setFilterBrandId(null);
                        setFilterPackageId(null);
                      }}
                    >
                      Сбросить фильтры
                    </Button>
                  </div>

                  {isLoading ? (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm text-[hsl(var(--muted))]">
                      Загружаем правила цены...
                    </div>
                  ) : null}

                  {!isLoading && filteredRules.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-2))] p-8 text-center text-sm leading-6 text-[hsl(var(--muted))]">
                      Правила цены не найдены.
                    </div>
                  ) : null}

                  {!isLoading && filteredRules.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {filteredRules.map((rule) => {
                        const isEditing = editingRuleId === rule.id;

                        return (
                          <div
                            key={rule.id}
                            className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4"
                          >
                            {!isEditing ? (
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate text-base font-semibold text-white">
                                      {getServiceName(
                                        services,
                                        rule.service_id,
                                      )}
                                    </div>

                                    <Badge tone="muted">
                                      Rule ID #{rule.id}
                                    </Badge>

                                    <Badge tone="primary">
                                      {formatCurrency(rule.price)}
                                    </Badge>

                                    <Badge tone={getRulePriorityTone(rule)}>
                                      {getRulePriorityLabel(rule)}
                                    </Badge>
                                  </div>

                                  <div className="mt-2 text-sm leading-6 text-[hsl(var(--muted))]">
                                    {getCarTypeName(carTypes, rule.car_type_id)}{" "}
                                    ·{" "}
                                    {getBrandName(
                                      materialBrands,
                                      rule.material_brand_id,
                                    )}{" "}
                                    ·{" "}
                                    {getPackageName(
                                      servicePackages,
                                      rule.service_package_id,
                                    )}
                                  </div>

                                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Услуга
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {getServiceName(
                                          services,
                                          rule.service_id,
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Тип авто
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {getCarTypeName(
                                          carTypes,
                                          rule.car_type_id,
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Бренд
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {getBrandName(
                                          materialBrands,
                                          rule.material_brand_id,
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2">
                                      <div className="text-xs text-[hsl(var(--muted))]">
                                        Пакет
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-white">
                                        {getPackageName(
                                          servicePackages,
                                          rule.service_package_id,
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {canManagePricing ? (
                                  <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => startEditRule(rule)}
                                    >
                                      Редактировать
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-[rgb(252_165_165)] hover:text-[rgb(254_202_202)]"
                                      disabled={deletingRuleId === rule.id}
                                      onClick={() =>
                                        setDeleteConfirmRuleId((current) =>
                                          current === rule.id ? null : rule.id,
                                        )
                                      }
                                    >
                                      Удалить
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <Combobox
                                  label="Услуга"
                                  placeholder="Выберите услугу"
                                  value={
                                    editingForm.service_id
                                      ? String(editingForm.service_id)
                                      : ""
                                  }
                                  options={serviceOptions}
                                  onChange={(value) =>
                                    updateEditingForm({
                                      service_id: value ? Number(value) : null,
                                      material_brand_id: null,
                                      service_package_id: null,
                                    })
                                  }
                                />

                                <Combobox
                                  label="Тип авто"
                                  placeholder="Выберите тип авто"
                                  value={
                                    editingForm.car_type_id
                                      ? String(editingForm.car_type_id)
                                      : ""
                                  }
                                  options={carTypeOptions}
                                  onChange={(value) =>
                                    updateEditingForm({
                                      car_type_id: value ? Number(value) : null,
                                    })
                                  }
                                />

                                <Combobox
                                  label="Бренд материала"
                                  placeholder={
                                    selectedEditService?.requires_brand
                                      ? "Выберите бренд"
                                      : "Не требуется"
                                  }
                                  value={
                                    editingForm.material_brand_id
                                      ? String(editingForm.material_brand_id)
                                      : ""
                                  }
                                  options={brandOptions}
                                  disabled={
                                    !selectedEditService?.requires_brand
                                  }
                                  onChange={(value) =>
                                    updateEditingForm({
                                      material_brand_id: value
                                        ? Number(value)
                                        : null,
                                    })
                                  }
                                />

                                <Combobox
                                  label="Пакет услуги"
                                  placeholder={
                                    selectedEditService?.requires_package
                                      ? "Выберите пакет"
                                      : "Не требуется"
                                  }
                                  value={
                                    editingForm.service_package_id
                                      ? String(editingForm.service_package_id)
                                      : ""
                                  }
                                  options={packageOptionsForEdit}
                                  disabled={
                                    !selectedEditService?.requires_package
                                  }
                                  onChange={(value) =>
                                    updateEditingForm({
                                      service_package_id: value
                                        ? Number(value)
                                        : null,
                                    })
                                  }
                                />

                                <Input
                                  label="Цена"
                                  placeholder="Например: 45000"
                                  inputMode="numeric"
                                  value={editingForm.price}
                                  onChange={(event) =>
                                    updateEditingForm({
                                      price: event.target.value
                                        .replace(/[^\d.,\s]/g, "")
                                        .slice(0, 12),
                                    })
                                  }
                                />

                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={submittingEditRuleId === rule.id}
                                    onClick={cancelEditRule}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={submittingEditRuleId === rule.id}
                                    onClick={() =>
                                      void handleUpdateRule(rule.id)
                                    }
                                  >
                                    {submittingEditRuleId === rule.id
                                      ? "Сохраняем..."
                                      : "Сохранить"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {deleteConfirmRuleId === rule.id ? (
                              <div className="mt-4 rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.06)] p-4">
                                <div className="text-sm font-semibold text-[rgb(252_165_165)]">
                                  Подтвердить удаление правила цены?
                                </div>

                                <div className="mt-2 text-sm leading-6 text-[rgb(252_165_165_/_0.78)]">
                                  Правило цены можно удалить. Если оно уже было
                                  применено к заказу, история заказа сохранится
                                  через pricing snapshot.
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={deletingRuleId === rule.id}
                                    onClick={() => setDeleteConfirmRuleId(null)}
                                  >
                                    Отмена
                                  </Button>

                                  <Button
                                    type="button"
                                    disabled={deletingRuleId === rule.id}
                                    onClick={() =>
                                      void handleDeleteRule(rule.id)
                                    }
                                  >
                                    {deletingRuleId === rule.id
                                      ? "Удаляем..."
                                      : "Да, удалить"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-24">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Создать правило</CardTitle>
                  <CardDescription>
                    Укажите комбинацию справочников и цену.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {!canManagePricing ? (
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-5 text-sm leading-6 text-[hsl(var(--muted))]">
                      Для управления правилами нужен permission{" "}
                      <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                        pricing.manage
                      </span>
                      .
                    </div>
                  ) : null}

                  {canManagePricing ? (
                    <div className="space-y-4">
                      <Combobox
                        label="Услуга"
                        placeholder="Выберите услугу"
                        value={form.service_id ? String(form.service_id) : ""}
                        options={serviceOptions}
                        onChange={(value) =>
                          updateForm({
                            service_id: value ? Number(value) : null,
                            material_brand_id: null,
                            service_package_id: null,
                          })
                        }
                      />

                      <Combobox
                        label="Тип авто"
                        placeholder="Выберите тип авто"
                        value={form.car_type_id ? String(form.car_type_id) : ""}
                        options={carTypeOptions}
                        onChange={(value) =>
                          updateForm({
                            car_type_id: value ? Number(value) : null,
                          })
                        }
                      />

                      <Combobox
                        label="Бренд материала"
                        placeholder={
                          selectedCreateService?.requires_brand
                            ? "Выберите бренд"
                            : "Не требуется"
                        }
                        value={
                          form.material_brand_id
                            ? String(form.material_brand_id)
                            : ""
                        }
                        options={brandOptions}
                        disabled={!selectedCreateService?.requires_brand}
                        onChange={(value) =>
                          updateForm({
                            material_brand_id: value ? Number(value) : null,
                          })
                        }
                      />

                      <Combobox
                        label="Пакет услуги"
                        placeholder={
                          selectedCreateService?.requires_package
                            ? "Выберите пакет"
                            : "Не требуется"
                        }
                        value={
                          form.service_package_id
                            ? String(form.service_package_id)
                            : ""
                        }
                        options={packageOptionsForCreate}
                        disabled={!selectedCreateService?.requires_package}
                        onChange={(value) =>
                          updateForm({
                            service_package_id: value ? Number(value) : null,
                          })
                        }
                      />

                      <Input
                        label="Цена"
                        placeholder="Например: 45000"
                        inputMode="numeric"
                        value={form.price}
                        onChange={(event) =>
                          updateForm({
                            price: event.target.value
                              .replace(/[^\d.,\s]/g, "")
                              .slice(0, 12),
                          })
                        }
                      />

                      <Button
                        type="button"
                        className="w-full"
                        disabled={isSubmittingCreate}
                        onClick={() => void handleCreateRule()}
                      >
                        {isSubmittingCreate ? "Создаем..." : "Создать правило"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Логика правила</CardTitle>
                  <CardDescription>
                    Правило должно быть уникальным.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3 text-sm leading-6 text-[hsl(var(--muted))]">
                    <p>
                      Уникальная комбинация: услуга + тип авто + бренд материала
                      + пакет услуги.
                    </p>

                    <p>
                      При расчете цены система ищет самое точное правило:
                      сначала бренд + пакет, затем бренд без пакета, затем пакет
                      без бренда, затем общее правило без бренда и пакета.
                    </p>

                    <p>
                      Если услуга требует бренд или пакет, backend не позволит
                      создать правило без этих значений.
                    </p>

                    <p>
                      Архивные услуги, бренды и пакеты нельзя использовать в
                      новых правилах, но старые правила остаются видимыми.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
