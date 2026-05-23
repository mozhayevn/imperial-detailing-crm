import { apiRequest } from "@/src/lib/api/client";
import type {
  Material,
  MaterialCreatePayload,
  MaterialFilters,
  MaterialOption,
  MaterialUpdatePayload,
} from "@/src/features/materials/types";
import type { MaterialBrand } from "@/src/features/material-brands/types";

function buildMaterialsQuery(filters?: MaterialFilters) {
  const searchParams = new URLSearchParams();

  if (filters?.category) {
    searchParams.set("category", filters.category);
  }

  if (filters?.brand_id) {
    searchParams.set("brand_id", String(filters.brand_id));
  }

  if (filters?.is_active !== null && filters?.is_active !== undefined) {
    searchParams.set("is_active", String(filters.is_active));
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function getMaterials(
  filters?: MaterialFilters,
): Promise<Material[]> {
  return apiRequest<Material[]>(`/materials/${buildMaterialsQuery(filters)}`, {
    method: "GET",
  });
}

export async function getMaterialById(materialId: number): Promise<Material> {
  return apiRequest<Material>(`/materials/${materialId}`, {
    method: "GET",
  });
}

export async function createMaterial(
  payload: MaterialCreatePayload,
): Promise<Material> {
  return apiRequest<Material>("/materials/", {
    method: "POST",
    body: payload,
  });
}

export async function updateMaterial(
  materialId: number,
  payload: MaterialUpdatePayload,
): Promise<Material> {
  return apiRequest<Material>(`/materials/${materialId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteMaterial(
  materialId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/materials/${materialId}`, {
    method: "DELETE",
  });
}

export function filterMaterialsBySearch(
  materials: Material[],
  searchValue: string,
  brands: MaterialBrand[] = [],
): MaterialOption[] {
  const query = searchValue.trim().toLowerCase();

  const filteredMaterials = query
    ? materials.filter((material) => {
        const brand = brands.find((item) => item.id === material.brand_id);

        const name = material.name.toLowerCase();
        const category = material.category?.toLowerCase() ?? "";
        const brandName = brand?.name.toLowerCase() ?? "";

        return (
          name.includes(query) ||
          category.includes(query) ||
          brandName.includes(query)
        );
      })
    : materials;

  return filteredMaterials.map((material) => {
    const brand = brands.find((item) => item.id === material.brand_id);

    const description = [
      brand?.name ?? null,
      material.category ?? null,
      `${material.cost_per_unit.toLocaleString("ru-RU")} ₸ / ед.`,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      id: material.id,
      label: material.name,
      description,
      cost_per_unit: material.cost_per_unit,
    };
  });
}