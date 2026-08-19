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
    // Carried on the form since the 2026-08-19 offline fix: it is what the
    // collapsed category row falls back on when the category TREE cannot be
    // fetched. `buildDraftPatch` still derives the submitted `categoryName` from
    // the tree options, so this is a display value, never the submit source.
    categoryName: '',
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
 * The ONE place a persisted draft is made schema-valid — every `detailSchema`
 * field that has no checklist row and no control in the editor gets a
 * guaranteed-valid value here.
 *
 * Applied at BOTH seams, which is the whole point of it being a DraftItem ->
 * DraftItem function rather than living inside `draftToFormValues`:
 *
 *   VALIDATION  `draftToFormValues` (below) -> the RHF form, `getRequiredStatus`
 *               and `getDraftRequiredStatus` (requiredStatus.ts) — so a legacy
 *               draft never renders "every row green, Submit dead".
 *   SUBMISSION  `services/scanner/submitGroupedListings.ts` — the grouped submit
 *               reads the queued DraftItems STRAIGHT from the store, never
 *               through the form. Repairing only the validation seam would turn
 *               "invisibly blocked" into "silently submitted junk": the review
 *               hub's ready gate is `getDraftRequiredStatus(item).allComplete`
 *               (grouped-review.tsx:99, :159), so a resumed draft holding
 *               `grade: 'Z'` / `quantity: undefined` / `marketplace: 'shopify'`
 *               would read READY and then be serialised raw by
 *               `productMetaFromItem` (item_grade 'Z', quantity "undefined",
 *               allowed_sites ['LabGreenbidz'] for a marketplace that is not
 *               101lab). Enforced by
 *               `services/scanner/__tests__/groupedSubmitCoercion.test.ts`.
 *
 * The single-item submit path needs no call: `submitSingleValidated` patches the
 * draft with `buildDraftPatch(validated form values, …)` before it hands the
 * draft to `createListing.mutate`, and those values came through
 * `draftToFormValues` — i.e. through here. `__tests__/requiredStatusGap.test.ts`
 * ("buildDraftPatch carries the repaired values") locks that reasoning down.
 *
 * Fields WITH a checklist row are deliberately NOT repaired — an empty title
 * must stay empty so the seller is asked for it. `condition` / `locations` are
 * only normalised to arrays (an absent array would crash the submit builders);
 * their emptiness, which the seller can see and fix, is preserved.
 */
export function coerceDraftDefaults(draft: DraftItem): DraftItem {
  const locations = Array.isArray(draft.locations) ? draft.locations : [];
  const countriesRaw = Array.isArray(draft.locationCountries) ? draft.locationCountries : [];
  return {
    ...draft,
    condition: Array.isArray(draft.condition) ? draft.condition : [],
    // No UI in the editor, and never submitted — buildFormData derives
    // operation_status[] from `installation` instead (buildFormData.ts:185-187, :263).
    operationStatus: draft.operationStatus?.length
      ? draft.operationStatus
      : [...DEFAULT_OPERATION_STATUS],
    priceFormat: draft.priceFormat === 'offer' ? 'offer' : 'buyNow',
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
    // schema.ts:107-113 requires one country slot per location row, so a SHORT
    // countries array is PADDED — a pure repair that invents nothing.
    //
    // A LONG one is deliberately NOT truncated (2026-08-18). The old
    // `locations.map(...)` did truncate, which silently destroyed a country the
    // seller had typed AND left the draft reading green. `locationCountries` is
    // row-mapped (requiredStatus.rowForPath -> 'location'), and this function's
    // contract for row-mapped fields is that they are never silently rewritten —
    // an empty title stays empty so the seller is asked for it. Surplus countries
    // get the same treatment: they survive, the parity check fails, and the
    // Location row goes red so the seller is TOLD. It is also fixable, not a dead
    // end: LocationCard's draft variant renders
    // `max(locations.length, locationCountries.length, 1)` rows
    // (LocationCard.tsx:173), so the orphaned country appears as a row with an
    // empty address the seller can fill or remove (removeRow splices both
    // arrays). Nothing downstream widens either — every submit consumer reads
    // `locationCountries[0]` only (buildFormData.ts:196/:283,
    // useCreateListing.ts:47, submitGroupedListings.ts:119).
    locationCountries:
      countriesRaw.length > locations.length
        ? [...countriesRaw]
        : locations.map((_, i) => countriesRaw[i] ?? ''),
    grade: GRADES.includes(draft.grade) ? draft.grade : 'A',
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

/**
 * DraftItem -> RHF values. The repairs live in `coerceDraftDefaults` (above);
 * this is the projection onto `DetailFormInput`.
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
  const d = coerceDraftDefaults(draft);
  return {
    title: d.title ?? '',
    description: d.description ?? '',
    categoryId: d.categoryId ?? '',
    // The draft already knows the leaf's name (processing.tsx patches
    // categoryId + categoryName together from the AI, and buildDraftPatch writes
    // it on every save), so an OFFLINE form can name the seller's pick without
    // the category tree. See CategoryConditionCard's selectedLabel.
    categoryName: d.categoryName ?? '',
    customSubcategory: d.customSubcategory ?? '',
    parentCategoryId: d.parentCategoryId ?? '',
    parentCategoryName: d.parentCategoryName ?? '',
    condition: d.condition,
    operationStatus: d.operationStatus,
    priceFormat: d.priceFormat,
    pricePerUnit: d.pricePerUnit ?? '',
    priceCurrency: d.priceCurrency,
    quantity: d.quantity,
    locations: d.locations,
    locationCountries: d.locationCountries,
    brand: d.brand ?? '',
    model: d.model ?? '',
    year: d.year ?? '',
    weight: d.weight ?? '',
    dimensions: d.dimensions ?? '',
    co2Emissions: d.co2Emissions ?? '',
    grade: d.grade,
    serialNumber: d.serialNumber ?? '',
    marketplace: d.marketplace,
    installation: d.installation,
    listingDurationDays: d.listingDurationDays,
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
