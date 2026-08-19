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
 * Marketplace → category endpoint descriptor.
 *
 * Each marketplace has its OWN WordPress taxonomy; the backend makes the same
 * split (`utils/categoryCache.js#TAXONOMY_BY_SITE`). Getting this wrong does not
 * fail loudly — it returns a valid-looking tree whose ids simply do not exist
 * for that marketplace, which `CategoryConditionCard`'s validity check then
 * clears (`CategoryConditionCard.tsx` `stillValid`), and because `categoryId` is
 * schema-required (`schema.ts:23`) the listing cannot be submitted at all.
 *
 * W3  (scan_v3): added the `101it` branch — 101IT used to fall through to the
 *                machines endpoint.
 * M-1 (multi-marketplace): added the `101recycle` branch. Measured on dev
 *                2026-08-18/19: recycle ids run 1147-5366, the lab tree's
 *                5371-5849 — overlap ZERO, so `101recycle` on the lab endpoint
 *                is a hard submit-blocker, not a cosmetic mismatch.
 *
 * Two per-endpoint quirks are encoded here rather than at the call site:
 *
 * - `langParam` — the three WP-backed endpoints read `?language=`; the recycle
 *   endpoint reads `?lang=` (`controller/productController.js:247`) and IGNORES
 *   `language` entirely, silently serving the zh-hant tree. Verified on dev.
 *
 * - `enOnly` — the recycle endpoint has only `en` and `zh-hant` trees
 *   (`productController.js:251-257`; `?lang=ja|th` both return zh-hant), and the
 *   BACKEND's recycle cache is EN-only (`utils/categoryCache.js:167` hard-codes
 *   `?lang=en`), so every AI-returned recycle id is an EN id. Pinning the app to
 *   EN means the validity check matches with no cross-locale bridge — which
 *   matters because `bridgeCategoryId`'s sorted-position heuristic MIS-MAPS 8 of
 *   the 37 recycle categories (positions 14-21; EN 2019 "Metalworking Equipment"
 *   resolves to zh 2312 "回收技術"/Recycling Technology). Untranslated labels beat
 *   silently-wrong data. Drop `enOnly` the day the API exposes a stable
 *   cross-locale key.
 */
export type CategoryEndpoint = {
  path: string;
  langParam: 'language' | 'lang';
  /** Response row shape: WP `{id,…,subcategories}` vs recycle `{term_id,…}`. */
  shape: 'lab' | 'recycleFlat';
  /** Always request the EN tree, whatever the app locale. */
  enOnly: boolean;
};

export function endpointForMarketplace(
  marketplace: MarketplaceKey | undefined,
): CategoryEndpoint {
  if (marketplace === '101machine') {
    return { path: '/product/machines/category', langParam: 'language', shape: 'lab', enOnly: false };
  }
  if (marketplace === '101it') {
    return { path: '/product/it/category', langParam: 'language', shape: 'lab', enOnly: false };
  }
  if (marketplace === '101recycle') {
    return { path: '/product/category', langParam: 'lang', shape: 'recycleFlat', enOnly: true };
  }
  // 101lab (and the fall-through default).
  return { path: '/product/lab/category', langParam: 'language', shape: 'lab', enOnly: false };
}

/**
 * Minimal HTML-entity decoder for category names.
 *
 * The recycle endpoint selects `jos_terms.name` raw
 * (`controller/productController.js:259-277`), so WordPress's stored entities
 * come through literally: 18 of the 37 EN recycle names are affected, e.g.
 * `Construction &amp; Earthmoving Equipment` (measured on dev). Unfixed they
 * render with a visible `&amp;`.
 *
 * Deliberately not a general HTML parser: it decodes the five XML entities plus
 * `&nbsp;` and numeric references, and leaves anything it does not recognise
 * EXACTLY as-is (so an unknown entity degrades to today's behaviour rather than
 * to an empty label). It is IDEMPOTENT on already-clean text, which is what
 * makes it safe to keep once the server-side unescape (plan task S0-4) lands:
 * running it on `Construction & Earthmoving Equipment` is a no-op.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.charAt(0) === '#') {
      const isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/**
 * Normalise a WP-shaped tree (`/product/lab|machines|it/category`) to
 * `LabCategory[]`.
 *
 * The response used to be cast straight to `LabCategory[]`. Two reasons to
 * normalise instead:
 *   1. `subcategories` is ABSENT (not empty) on all 13 machines rows — measured
 *      on dev. Guaranteeing the array here lets every consumer stop writing
 *      `?? []`; `LabListingEditSheet.tsx` already does a bare
 *      `parent.subcategories.map(...)` and would throw on such a tree.
 *   2. Names are entity-decoded defensively. Escaped names measured in these
 *      three trees today: ZERO — this is a guard, not a fix, and it is
 *      idempotent (see decodeHtmlEntities).
 *
 * Rows with a non-numeric/absent id or a blank name are DROPPED: an unnamed row
 * renders as a blank tappable option, which is worse than not offering it.
 */
export function normalizeLabCategories(rows: unknown): LabCategory[] {
  if (!Array.isArray(rows)) return [];
  const out: LabCategory[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const id = Number(raw?.id);
    const name = decodeHtmlEntities(String(raw?.name ?? '')).trim();
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    const rawSubs = Array.isArray(raw?.subcategories)
      ? (raw.subcategories as Record<string, unknown>[])
      : [];
    const subcategories: LabSubcategory[] = [];
    for (const rawSub of rawSubs) {
      const subId = Number(rawSub?.id);
      const subName = decodeHtmlEntities(String(rawSub?.name ?? '')).trim();
      if (!Number.isFinite(subId) || subId <= 0 || !subName) continue;
      subcategories.push({ id: subId, name: subName, slug: String(rawSub?.slug ?? '') });
    }
    out.push({ id, name, slug: String(raw?.slug ?? ''), subcategories });
  }
  return out;
}

/**
 * Normalise the recycle tree (`/product/category?lang=en`) to `LabCategory[]`.
 *
 * Shape differences from the WP trees, measured on dev:
 *   - the id lives in `term_id`; there is NO `id` key;
 *   - there is NO `subcategories` key — the SQL filters `tt.parent = 0`
 *     (`controller/productController.js:275`), so the tree is flat BY
 *     CONSTRUCTION, not by accident. It cannot grow children without a backend
 *     change, so `subcategories: []` is correct rather than a stopgap;
 *   - names are HTML-escaped (18 of 37).
 *
 * This mirrors, field for field, what the BACKEND already does with the same
 * endpoint at `utils/categoryCache.js` — so the app's tree and the tree the AI
 * picks from are the same objects with the same ids.
 */
export function normalizeRecycleCategories(rows: unknown): LabCategory[] {
  if (!Array.isArray(rows)) return [];
  const out: LabCategory[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const id = Number(raw?.term_id ?? raw?.id);
    const name = decodeHtmlEntities(String(raw?.name ?? '')).trim();
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    out.push({ id, name, slug: String(raw?.slug ?? ''), subcategories: [] });
  }
  return out;
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
  // lab tree: EN term 5373 still returns its Chinese source name.
  5373: 'Testing & Measurement',
  // recycle tree: EN term 5334 returns `車床 (CNC 與傳統)` from ?lang=en
  // (measured on dev 2026-08-19) — the same WPML content bug as 5373. Safe to
  // key by id: recycle ids (1147-5366) do not overlap lab (5371-5849), machines
  // (5296-5862) or 101it (5419-5524) — measured, overlap 0 against all three.
  // NOTE for the owner's taxonomy list: term 5341 is the properly-translated
  // duplicate of the same category, and 5366 is a junk row named "test".
  // Neither is filtered here on purpose — the AI can return either id, and
  // dropping a returned id would clear the seller's category and re-create the
  // submit blocker.
  5334: 'Lathes (CNC & Conventional)',
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
  const endpoint = endpointForMarketplace(marketplace);
  // `enOnly` endpoints ignore the app locale on purpose — see the descriptor doc.
  const lang = endpoint.enOnly ? 'en' : toAnalyzeLanguage(language);
  const res = await greenbidz.get(
    `${endpoint.path}?${endpoint.langParam}=${encodeURIComponent(lang)}`,
    { timeout: 60_000 },
  );
  const raw = res.data?.data ?? [];
  const data =
    endpoint.shape === 'recycleFlat'
      ? normalizeRecycleCategories(raw)
      : normalizeLabCategories(raw);
  // Fixups are keyed by EN-tree term id, so gate on the RESOLVED language.
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

export type CategoryLeafOption = {
  /** The leaf id the form stores in `categoryId`. */
  id: string;
  /** The leaf's own name (what `buildDraftPatch` writes to `categoryName`). */
  name: string;
  /** Display label: `Parent › Sub` when nested, the parent's name when flat. */
  label: string;
  /** Owning parent — the form's `parentCategoryId`. Equals `id` for flat trees. */
  parentId: string;
  /** Owning parent's name — the form's `parentCategoryName`. */
  parentName: string;
};

/**
 * Flatten the category tree to the set of selectable leaves. A leaf is:
 *   - a subcategory (nested marketplaces: /lab, /101it), OR
 *   - a parent with NO subcategories (flat marketplaces: /machines, /recycle).
 *
 * The "no children → parent is the leaf" branch is critical: without it, an
 * AI-supplied id pointing at a flat-leaf parent was judged invalid on hydrate by
 * CategoryConditionCard's stillValid check, which then cleared the field — so
 * the seller saw an empty Category after AI fill even though the AI's pick was
 * valid. That branch already shipped for /machines; the M-1 recycle tree
 * (37 flat parents, 0 children by construction) reuses it unchanged.
 *
 * M-2 addition: `parentId` / `parentName` are emitted so the category sheet can
 * commit `parentCategoryId` / `parentCategoryName` from a single search hit
 * without re-walking the tree.
 */
export function flattenCategoryOptions(categories: LabCategory[]): CategoryLeafOption[] {
  const options: CategoryLeafOption[] = [];
  for (const cat of categories) {
    const parentId = String(cat.id);
    const subs = cat.subcategories ?? [];
    if (subs.length === 0) {
      options.push({
        id: parentId,
        name: cat.name,
        label: cat.name,
        parentId,
        parentName: cat.name,
      });
      continue;
    }
    for (const sub of subs) {
      options.push({
        id: String(sub.id),
        name: sub.name,
        label: `${cat.name} › ${sub.name}`,
        parentId,
        parentName: cat.name,
      });
    }
  }
  return options;
}
