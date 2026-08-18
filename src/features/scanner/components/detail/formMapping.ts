import {
  DEFAULT_OPERATION_STATUS,
  marketplaceFromSiteType,
} from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { DraftItem } from '@/stores/scanDraftStore';

/**
 * Shared form↔draft mapping for the scan-detail RHF form.
 *
 * Used by both the single-product editor (`useDetailController` ->
 * `app/scan/detail.tsx`) and the multi-product wizard
 * (`app/scan/grouped-review.tsx`). Keeping the mapping in one place avoids
 * forks between the two surfaces (a class of bug the multi-product-wizard
 * plan's pre-coding note #1 specifically calls out).
 *
 * `buildDraftPatch` takes the categories option list as a parameter rather
 * than calling the React Query hook itself, so this module stays pure (no
 * hook calls) and is callable from any submit path.
 */

export function emptyDetailDefaults(): DetailFormInput {
  return {
    title: '',
    description: '',
    categoryId: '',
    customSubcategory: '',
    parentCategoryId: '',
    parentCategoryName: '',
    condition: [],
    operationStatus: [...DEFAULT_OPERATION_STATUS],
    priceFormat: 'buyNow',
    pricePerUnit: '',
    priceCurrency: 'USD',
    quantity: 1,
    locations: [],
    locationCountries: [],
    brand: '',
    model: '',
    year: '',
    weight: '',
    dimensions: '',
    co2Emissions: '',
    grade: 'A',
    serialNumber: '',
    marketplace: '101lab',
    installation: 'deinstalled',
    listingDurationDays: 90,
  };
}

const GRADES: readonly string[] = ['A', 'B', 'C', 'D'];

/**
 * DraftItem -> RHF values, and the ONE place a persisted draft is made
 * schema-valid.
 *
 * Why the coercion lives here: `detailSchema` gates Submit on 14 fields
 * (schema.ts:20-61) but the checklist shows 7 rows and `rowForPath`
 * (requiredStatus.ts:42-61) maps 6 of them, so a draft that fails on
 * `operationStatus` — which has NO control anywhere in the editor — renders with
 * every visible row green, Submit dead, and no explanation. That is reachable,
 * not theoretical: `hydrateScanDraftFromPayload` CASTS the server-stored blob
 * without validating it (services/drafts/draftPayload.ts:41-45) and
 * `migrateDraft` (stores/scanDraftStore.ts:293-353) backfills grade / marketplace
 * / installation / listingDurationDays but not `operationStatus`, `quantity`,
 * `priceFormat` or `condition`.
 *
 * Fields WITH a checklist row are deliberately NOT repaired here — an empty title
 * must stay empty so the seller is asked for it.
 */
export function draftToFormValues(draft: DraftItem): DetailFormInput {
  const locations = Array.isArray(draft.locations) ? draft.locations : [];
  const countriesRaw = Array.isArray(draft.locationCountries) ? draft.locationCountries : [];
  return {
    title: draft.title ?? '',
    description: draft.description ?? '',
    categoryId: draft.categoryId ?? '',
    customSubcategory: draft.customSubcategory ?? '',
    parentCategoryId: draft.parentCategoryId ?? '',
    parentCategoryName: draft.parentCategoryName ?? '',
    condition: Array.isArray(draft.condition) ? draft.condition : [],
    // No UI in the editor, and never submitted — buildFormData derives
    // operation_status[] from `installation` instead (buildFormData.ts:185-187, :263).
    operationStatus: draft.operationStatus?.length
      ? draft.operationStatus
      : [...DEFAULT_OPERATION_STATUS],
    priceFormat: draft.priceFormat === 'offer' ? 'offer' : 'buyNow',
    pricePerUnit: draft.pricePerUnit ?? '',
    // PricingCard offers exactly these two (CURRENCY_OPTIONS); legacy drafts may
    // still hold HKD/CNY/JPY/THB from before the list was narrowed.
    priceCurrency: draft.priceCurrency === 'TWD' ? 'TWD' : 'USD',
    // The stepper already clamps at 1 (PricingCard.tsx:98); this covers drafts
    // persisted before `quantity` existed.
    quantity:
      typeof draft.quantity === 'number' && Number.isFinite(draft.quantity) && draft.quantity >= 1
        ? Math.floor(draft.quantity)
        : 1,
    locations,
    // schema.ts:107-113 requires one country slot per location row.
    locationCountries: locations.map((_, i) => countriesRaw[i] ?? ''),
    brand: draft.brand ?? '',
    model: draft.model ?? '',
    year: draft.year ?? '',
    weight: draft.weight ?? '',
    dimensions: draft.dimensions ?? '',
    co2Emissions: draft.co2Emissions ?? '',
    grade: GRADES.includes(draft.grade) ? draft.grade : 'A',
    serialNumber: draft.serialNumber ?? '',
    // Accepts all four canonical values and repairs anything else. '101lab' is
    // this app's own legacy lenient fallback (scanDraftStore.ts:211-212).
    marketplace: marketplaceFromSiteType(draft.marketplace) ?? '101lab',
    installation: draft.installation === 'installed' ? 'installed' : 'deinstalled',
    listingDurationDays:
      Number.isInteger(draft.listingDurationDays) && draft.listingDurationDays > 0
        ? draft.listingDurationDays
        : 90,
  };
}

export type CategoryOption = { id: string; name: string };

/**
 * Layer RHF form values onto an existing DraftItem. Categories options come
 * from the caller (typically `useLabCategories(marketplace).data?.options`)
 * so this helper stays free of React Query coupling.
 */
export function buildDraftPatch(
  values: DetailFormInput,
  currentDraft: DraftItem,
  categoryOptions: CategoryOption[] | undefined,
): DraftItem {
  const cat = categoryOptions?.find((o) => o.id === values.categoryId);
  return {
    ...currentDraft,
    title: values.title,
    description: values.description,
    categoryId: values.categoryId,
    categoryName: cat?.name ?? null,
    // Round-trip the "Other" subcategory fields. When Other is chosen,
    // categoryId is the sentinel (not in `categoryOptions`, so categoryName
    // is null) and these carry the parent + typed brand to the submit builder.
    customSubcategory: values.customSubcategory ?? '',
    parentCategoryId: values.parentCategoryId ?? '',
    parentCategoryName: values.parentCategoryName ?? '',
    condition: values.condition,
    operationStatus: values.operationStatus,
    priceFormat: values.priceFormat,
    pricePerUnit: values.pricePerUnit ?? '',
    priceCurrency: values.priceCurrency,
    quantity: values.quantity,
    locations: values.locations,
    locationCountries: values.locationCountries,
    brand: values.brand ?? '',
    model: values.model ?? '',
    year: values.year ?? '',
    weight: values.weight ?? '',
    dimensions: values.dimensions ?? '',
    co2Emissions: values.co2Emissions ?? '',
    grade: values.grade,
    serialNumber: values.serialNumber ?? '',
    marketplace: values.marketplace,
    installation: values.installation,
    listingDurationDays: values.listingDurationDays,
    lastStep: 'detail' as const,
  };
}
