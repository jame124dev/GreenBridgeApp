import { greenbidz } from '@/api/greenbidzClient';
import { toAnalyzeLanguage } from '@/features/scanner/constants';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

export type LabSubcategory = { id: number; name: string; slug: string };
export type LabCategory = {
  id: number;
  name: string;
  slug: string;
  subcategories: LabSubcategory[];
};

/**
 * Marketplace → category endpoint. Mirrors web's `useGetPlatformCategoriesQuery`
 * mapping at `GreenBridgeSeller/.../rtk/slices/apiSlice.ts:314-325`:
 *   - LabGreenbidz (`101lab`) / Recycle (`101recycle`) → /product/lab/category
 *     (lab + recycle share a tree per web)
 *   - 101 Machines (`101machine`)                       → /product/machines/category
 *   - 101 IT (`101it`)                                  → /product/it/category
 *
 * W3 (scan_v3): added the `101it` branch — previously 101IT fell through to
 * the machines endpoint, surfacing the wrong category tree.
 */
function endpointForMarketplace(marketplace: MarketplaceKey | undefined): string {
  if (marketplace === '101machine') return '/product/machines/category';
  if (marketplace === '101it') return '/product/it/category';
  // 101lab + 101recycle (and the fall-through default) share the lab tree.
  return '/product/lab/category';
}

export async function fetchLabCategories(
  language: string,
  marketplace?: MarketplaceKey,
): Promise<LabCategory[]> {
  const lang = toAnalyzeLanguage(language);
  const endpoint = endpointForMarketplace(marketplace);
  const res = await greenbidz.get(`${endpoint}?language=${encodeURIComponent(lang)}`, {
    timeout: 60_000,
  });
  return (res.data?.data ?? []) as LabCategory[];
}

export function flattenCategoryOptions(categories: LabCategory[]) {
  const options: { id: string; name: string; label: string }[] = [];
  for (const cat of categories) {
    for (const sub of cat.subcategories ?? []) {
      options.push({
        id: String(sub.id),
        name: sub.name,
        label: `${cat.name} › ${sub.name}`,
      });
    }
  }
  return options;
}
