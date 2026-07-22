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

/**
 * Client-side stopgap for untranslated category names in the EN tree.
 *
 * WordPress (WPML/Polylang) keeps a separate term row per language; the
 * ENGLISH translation of a term can be left holding its Chinese source name.
 * As of 2026-07-22 the lab tree's "Testing & Measurement" parent (EN term id
 * 5373) still returns `測試與測量` from `/product/lab/category?language=en`
 * (its 8 children ARE translated — only the parent is missing), so the
 * category picker showed one Chinese entry among English ones.
 *
 * Keyed by the EN-tree term id (stable; WPML gives the zh tree a DIFFERENT id
 * for the same category, so this can never touch a legitimately-Chinese
 * label) and applied ONLY to the `en` fetch. This is a band-aid over backend
 * content — the real fix is renaming the EN term in WP admin; remove this map
 * once that's done.
 */
const EN_CATEGORY_NAME_FIXUPS: Record<number, string> = {
  5373: 'Testing & Measurement',
};

export function applyEnCategoryFixups(categories: LabCategory[]): LabCategory[] {
  return categories.map((cat) => ({
    ...cat,
    name: EN_CATEGORY_NAME_FIXUPS[cat.id] ?? cat.name,
    subcategories: (cat.subcategories ?? []).map((sub) => ({
      ...sub,
      name: EN_CATEGORY_NAME_FIXUPS[sub.id] ?? sub.name,
    })),
  }));
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
  const data = (res.data?.data ?? []) as LabCategory[];
  return lang === 'en' ? applyEnCategoryFixups(data) : data;
}

/**
 * Bridge an English-tree category id over to the user's locale-tree id.
 *
 * Background — WordPress creates a separate term row per language (WPML /
 * Polylang behaviour), so the same category has different ids across
 * locales: "Boring & Drilling Machines" is id 5300 in `/machines?language=en`
 * but id 5308 in `/machines?language=zh-hant`. The smart-detect AI returns
 * ids from the EN tree even when the seller's app is set to Chinese, so
 * `CategoryConditionCard` thinks the id is invalid and clears it.
 *
 * Mitigation — sort BOTH trees by id; the position in each tree corresponds
 * to the same logical category (verified across en/zh-hant for /machines).
 * Match the EN-tree position over to the locale tree by index, both at the
 * parent and subcategory level. Returns null if no match (e.g. the EN tree
 * is missing or the position is out of bounds) so the caller can fall back
 * to clearing the field.
 *
 * This is a workaround for a backend issue — the right long-term fix is
 * stable cross-locale ids (or a `term_translation_id` field on the API).
 */
export function bridgeCategoryId(
  enCategoryId: string,
  enTree: LabCategory[],
  localeTree: LabCategory[],
): string | null {
  if (!enTree.length || !localeTree.length) return null;

  const enSorted = [...enTree].sort((a, b) => a.id - b.id);
  const localeSorted = [...localeTree].sort((a, b) => a.id - b.id);

  // Parent-level match
  const parentIdx = enSorted.findIndex((c) => String(c.id) === enCategoryId);
  if (parentIdx !== -1) {
    const localeMatch = localeSorted[parentIdx];
    if (localeMatch) return String(localeMatch.id);
  }

  // Subcategory-level match: find the parent that owns the EN sub id, then
  // find the same sub position inside the locale parent at the same index.
  for (let i = 0; i < enSorted.length; i++) {
    const enParent = enSorted[i];
    const enSubs = [...(enParent.subcategories ?? [])].sort(
      (a, b) => a.id - b.id,
    );
    const subIdx = enSubs.findIndex((s) => String(s.id) === enCategoryId);
    if (subIdx === -1) continue;
    const localeParent = localeSorted[i];
    if (!localeParent) return null;
    const localeSubs = [...(localeParent.subcategories ?? [])].sort(
      (a, b) => a.id - b.id,
    );
    const localeSub = localeSubs[subIdx];
    return localeSub ? String(localeSub.id) : null;
  }

  return null;
}

/**
 * Flatten the category tree to the set of selectable leaves. A leaf is:
 *   - a subcategory (nested marketplaces, e.g. /lab), OR
 *   - a parent that has NO subcategories (flat marketplaces, e.g. /machines).
 *
 * The "no children → parent is the leaf" branch is critical: without it, an
 * AI-supplied category id pointing at a flat-leaf parent was treated as
 * invalid on hydrate by CategoryConditionCard's stillValid check, which then
 * cleared the field — so the seller saw an empty Category after AI fill even
 * though the AI's pick was perfectly valid.
 */
export function flattenCategoryOptions(categories: LabCategory[]) {
  const options: { id: string; name: string; label: string }[] = [];
  for (const cat of categories) {
    const subs = cat.subcategories ?? [];
    if (subs.length === 0) {
      options.push({
        id: String(cat.id),
        name: cat.name,
        label: cat.name,
      });
      continue;
    }
    for (const sub of subs) {
      options.push({
        id: String(sub.id),
        name: sub.name,
        label: `${cat.name} › ${sub.name}`,
      });
    }
  }
  return options;
}
