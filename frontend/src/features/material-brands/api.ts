import { apiRequest } from "@/src/lib/api/client";
import type {
  MaterialBrand,
  MaterialBrandCreatePayload,
  MaterialBrandOption,
  MaterialBrandUpdatePayload,
} from "@/src/features/material-brands/types";

export async function getMaterialBrands(): Promise<MaterialBrand[]> {
  return apiRequest<MaterialBrand[]>("/material-brands/", {
    method: "GET",
  });
}

export async function getMaterialBrandById(
  brandId: number,
): Promise<MaterialBrand> {
  return apiRequest<MaterialBrand>(`/material-brands/${brandId}`, {
    method: "GET",
  });
}

export async function createMaterialBrand(
  payload: MaterialBrandCreatePayload,
): Promise<MaterialBrand> {
  return apiRequest<MaterialBrand>("/material-brands/", {
    method: "POST",
    body: payload,
  });
}

export async function updateMaterialBrand(
  brandId: number,
  payload: MaterialBrandUpdatePayload,
): Promise<MaterialBrand> {
  return apiRequest<MaterialBrand>(`/material-brands/${brandId}`, {
    method: "PUT",
    body: payload,
  });
}

export function filterMaterialBrandsBySearch(
  brands: MaterialBrand[],
  searchValue: string,
): MaterialBrandOption[] {
  const query = searchValue.trim().toLowerCase();

  const filteredBrands = query
    ? brands.filter((brand) => {
        const name = brand.name.toLowerCase();
        const category = brand.category?.toLowerCase() ?? "";

        return name.includes(query) || category.includes(query);
      })
    : brands;

  return filteredBrands.map((brand) => ({
    id: brand.id,
    label: brand.name,
    description: brand.category || "Бренд материала",
  }));
}

export async function deleteMaterialBrand(
  brandId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/material-brands/${brandId}`, {
    method: "DELETE",
  });
}