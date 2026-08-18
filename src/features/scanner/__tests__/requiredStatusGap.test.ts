import { describe, it, expect } from '@jest/globals';

import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import {
  buildDraftPatch,
  coerceDraftDefaults,
  draftToFormValues,
  emptyDetailDefaults,
} from '@/features/scanner/components/detail/formMapping';
import {
  REQUIRED_ROWS,
  getDraftRequiredStatus,
  getRequiredStatus,
  rowForPath,
} from '@/features/scanner/requiredStatus';
import { detailSchema } from '@/features/scanner/schema';
import type { DraftItem } from '@/stores/scanDraftStore';

// Every field `detailSchema` can require, split by HOW the seller is told.
//   ROW_MAPPED — `rowForPath` turns a zod issue on this path into a visible
//                checklist row, so the seller can see it.
//   DEFAULTED  — no row, and (operationStatus / listingDurationDays) no UI at
//                all, so the value must be guaranteed valid before the form is
//                ever mounted. See PHASE_5 §5.2.
// A required field that is in NEITHER list is an invisible Submit blocker.
const ROW_MAPPED = [
  'title',
  'description',
  'categoryId',
  'condition',
  'pricePerUnit',
  'locations',
  'locationCountries',
  'parentCategoryId',
  'customSubcategory',
];
const DEFAULTED = [
  'operationStatus',
  'priceFormat',
  'priceCurrency',
  'quantity',
  'grade',
  'marketplace',
  'installation',
  'listingDurationDays',
];

/** A complete, submittable draft. */
function validDraft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    photos: [{ uri: 'file:///a.jpg', width: 10, height: 10 }],
    ai: null,
    productIds: [],
    title: 'Benchtop centrifuge',
    description: 'Working, single owner',
    categoryId: '5371',
    categoryName: 'Lab Infrastructure & Essentials',
    customSubcategory: '',
    parentCategoryId: '',
    parentCategoryName: '',
    condition: ['usedFunctional'],
    operationStatus: ['working'],
    pricePerUnit: '4500',
    priceCurrency: 'USD',
    priceFormat: 'buyNow',
    quantity: 1,
    locations: ['Taipei'],
    locationCountries: ['Taiwan'],
    documents: [],
    allowedSites: [],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
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
    aiPrices: null,
    ...overrides,
  } as DraftItem;
}

/**
 * UNDOCUMENTED CHANGE, written down here (2026-08-18).
 *
 * `getDraftRequiredStatus` no longer projects `categoryName`. The deleted
 * `draftToFormInput` used to pass `categoryName: draft.categoryName ?? ''`; its
 * replacement `draftToFormValues` (formMapping.ts) omits the field — dropped in
 * c490428 ("M-7 — no schema-required field can block Submit invisibly") without a
 * word about it in the commit message.
 *
 * Validation is unaffected: `categoryName` is `.optional()` in `detailSchema`
 * (schema.ts:26) and the `superRefine` never reads it, so an absent value cannot
 * produce an issue and cannot change any row or `allComplete`. It is recorded
 * because it was a silent behaviour change, not because it is a bug — if anything
 * ever starts requiring `categoryName`, this is the line that explains why the
 * form values do not carry it.
 */
describe('required-status: no invisible Submit blockers', () => {
  it('sanity: a complete draft is submittable', () => {
    expect(getDraftRequiredStatus(validDraft()).allComplete).toBe(true);
  });

  // THE BUG. A draft written by an older build — or resumed from the server,
  // where `hydrateScanDraftFromPayload` CASTS the stored blob without validating
  // it (services/drafts/draftPayload.ts:41-45) and `migrateDraft`
  // (stores/scanDraftStore.ts:293-353) backfills grade/marketplace/installation/
  // listingDurationDays but NOT operationStatus, quantity, priceFormat or
  // condition — fails `detailSchema` on a field with no row and no UI. Result:
  // every visible row reads green and Submit is dead with no explanation.
  it.each([
    ['operationStatus', { operationStatus: [] }],
    ['quantity', { quantity: undefined as unknown as number }],
    ['grade', { grade: 'Z' as unknown as DraftItem['grade'] }],
    ['marketplace', { marketplace: 'shopify' as unknown as DraftItem['marketplace'] }],
    ['installation', { installation: undefined as unknown as DraftItem['installation'] }],
    ['listingDurationDays', { listingDurationDays: 0 }],
    ['priceCurrency', { priceCurrency: 'JPY' as unknown as DraftItem['priceCurrency'] }],
    ['locationCountries parity', { locationCountries: [] }],
  ])('a legacy draft broken on %s never reads "all rows done, Submit dead"', (_label, patch) => {
    const status = getDraftRequiredStatus(validDraft(patch as Partial<DraftItem>));
    const anyRowFalse = REQUIRED_ROWS.some((k) => !status.rows[k]);
    // Either it is submittable (the value was repaired) or the seller can SEE
    // which row is blocking. Never both false.
    expect(status.allComplete || anyRowFalse).toBe(true);
  });

  it('"Other" with no typed brand blocks Submit AND fails the Category row', () => {
    const values = {
      ...emptyDetailDefaults(),
      title: 'Laptop',
      description: 'desc',
      condition: ['usedFunctional'],
      locations: ['Taipei'],
      locationCountries: ['Taiwan'],
      pricePerUnit: '500',
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5371',
      customSubcategory: '',
    };
    const status = getRequiredStatus(values, 1);
    expect(status.allComplete).toBe(false);
    expect(status.rows.category).toBe(false);
  });

  /**
   * KNOWN LIMIT — do not over-trust this guard.
   *
   * It enumerates the issue paths of `detailSchema.safeParse({})`, which returns
   * only the 14 BASE-OBJECT fields. Zod does not run `superRefine` when the base
   * parse fails, so the three paths that are required CONDITIONALLY —
   * `pricePerUnit` (required only when priceFormat === 'buyNow'),
   * `parentCategoryId` and `customSubcategory` (required only when categoryId is
   * the OTHER sentinel) — never appear in `paths` at all. They are in ROW_MAPPED
   * above because a human put them there, not because this case proved it.
   *
   * So: a field made conditionally required via a NEW `superRefine` branch will
   * NOT trip this guard. It needs its own `rowForPath` mapping plus its own
   * explicit case — the way "Other with no typed brand" (above) covers the
   * customSubcategory branch. If you add a superRefine rule, add a test with it.
   */
  it('every path detailSchema can require is either a row or a defaulted field', () => {
    const parsed = detailSchema.safeParse({});
    expect(parsed.success).toBe(false);
    const paths = parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect([...ROW_MAPPED, ...DEFAULTED]).toContain(p);
    }
  });

  it('rowForPath maps every ROW_MAPPED path to a visible row', () => {
    for (const p of ROW_MAPPED) {
      expect(rowForPath([p])).not.toBeNull();
    }
  });

  it('emptyDetailDefaults() is already valid for every DEFAULTED field', () => {
    const parsed = detailSchema.safeParse(emptyDetailDefaults());
    const failing = parsed.success
      ? new Set<string>()
      : new Set(parsed.error.issues.map((i) => String(i.path[0])));
    for (const f of DEFAULTED) expect(failing.has(f)).toBe(false);
  });

  it('draftToFormValues repairs junk in every DEFAULTED field', () => {
    const junk = validDraft({
      operationStatus: [],
      quantity: undefined as unknown as number,
      grade: 'Z' as unknown as DraftItem['grade'],
      marketplace: 'shopify' as unknown as DraftItem['marketplace'],
      installation: undefined as unknown as DraftItem['installation'],
      listingDurationDays: 0,
      priceCurrency: 'JPY' as unknown as DraftItem['priceCurrency'],
      priceFormat: undefined as unknown as DraftItem['priceFormat'],
      locationCountries: [],
    });
    const parsed = detailSchema.safeParse(draftToFormValues(junk));
    const failing = parsed.success
      ? new Set<string>()
      : new Set(parsed.error.issues.map((i) => String(i.path[0])));
    for (const f of DEFAULTED) expect(failing.has(f)).toBe(false);
    expect(parsed.success).toBe(true);
  });

  /**
   * The repair must reach the WIRE, not just the form — validating one shape and
   * submitting another is worse than blocking. The grouped path is covered by
   * `src/services/scanner/__tests__/groupedSubmitCoercion.test.ts` (it calls
   * `coerceDraftDefaults` at the submission seam); the single-item path is
   * covered by this test, because `submitSingleValidated` publishes the draft it
   * has just patched with the validated form values
   * (useDetailController.ts: `patch(buildUpdated(values))` then
   * `createListing.mutate(useScanDraft.getState().current …)`).
   */
  it('buildDraftPatch carries the repaired values back onto the draft', () => {
    const junk = validDraft({
      operationStatus: [],
      quantity: undefined as unknown as number,
      grade: 'Z' as unknown as DraftItem['grade'],
      marketplace: 'shopify' as unknown as DraftItem['marketplace'],
      installation: undefined as unknown as DraftItem['installation'],
      listingDurationDays: 0,
      priceCurrency: 'JPY' as unknown as DraftItem['priceCurrency'],
      priceFormat: undefined as unknown as DraftItem['priceFormat'],
      locationCountries: [],
    });
    // What the form holds after `reset(draftToFormValues(draft))` and what
    // `handleSubmit` therefore hands to the valid path.
    const patched = buildDraftPatch(draftToFormValues(junk), junk, undefined);
    expect(patched.grade).toBe('A');
    expect(patched.quantity).toBe(1);
    expect(patched.marketplace).toBe('101lab');
    expect(patched.priceCurrency).toBe('USD');
    expect(patched.priceFormat).toBe('buyNow');
    expect(patched.installation).toBe('deinstalled');
    expect(patched.listingDurationDays).toBe(90);
    expect(patched.locationCountries).toHaveLength(patched.locations.length);
    // The seller's own values survive untouched.
    expect(patched.title).toBe(junk.title);
    expect(patched.pricePerUnit).toBe(junk.pricePerUnit);
  });

  /**
   * S5.2 location/country parity, decided deliberately (2026-08-18). The two
   * directions are NOT symmetric:
   *   SHORT countries -> padded. Adding an empty slot invents nothing and is what
   *     schema.ts:107-113 needs, so the repair is safe and silent.
   *   LONG countries  -> kept. Truncating silently destroyed a country the seller
   *     had typed and left the draft green; `locationCountries` is row-mapped, and
   *     row-mapped fields are never silently rewritten here. See the reasoning
   *     block at the `locationCountries` line in `formMapping.ts`.
   */
  it('pads a SHORT locationCountries array up to one slot per location row', () => {
    const padded = coerceDraftDefaults(
      validDraft({ locations: ['Taipei', 'Osaka'], locationCountries: ['Taiwan'] }),
    );
    expect(padded.locationCountries).toEqual(['Taiwan', '']);
    // A missing country is optional per row, so padding leaves the draft valid.
    expect(getDraftRequiredStatus(padded).allComplete).toBe(true);
  });

  it('keeps SURPLUS countries and turns the Location row red instead', () => {
    // How this happens: a location row was dropped without its country — a
    // resumed server draft (hydrateScanDraftFromPayload casts the blob unchecked)
    // or an older build.
    const surplus = coerceDraftDefaults(
      validDraft({ locations: ['Taipei'], locationCountries: ['Taiwan', 'Japan'] }),
    );
    // Not dropped: 'Japan' is the seller's own typing, not ours to delete.
    expect(surplus.locationCountries).toEqual(['Taiwan', 'Japan']);
    // ...and not silent either — parity fails, and it fails onto a VISIBLE row,
    // which LocationCard renders (max(locations, countries) rows) so the seller
    // can fill the empty address or remove the row.
    const status = getDraftRequiredStatus(surplus);
    expect(status.rows.location).toBe(false);
    expect(status.allComplete).toBe(false);
    // The surplus must neither grow nor shrink on a second pass.
    expect(coerceDraftDefaults(surplus)).toEqual(surplus);
  });

  it('coerceDraftDefaults is idempotent and never rewrites a seller field', () => {
    const junk = validDraft({
      grade: 'Z' as unknown as DraftItem['grade'],
      quantity: 0,
      title: '',
      pricePerUnit: '',
      condition: [] as unknown as DraftItem['condition'],
    });
    const once = coerceDraftDefaults(junk);
    expect(coerceDraftDefaults(once)).toEqual(once);
    // Empty title / price / condition must STAY empty — they own visible rows,
    // and the seller has to be asked for them.
    expect(once.title).toBe('');
    expect(once.pricePerUnit).toBe('');
    expect(once.condition).toEqual([]);
    expect(getDraftRequiredStatus(once).allComplete).toBe(false);
  });
});
