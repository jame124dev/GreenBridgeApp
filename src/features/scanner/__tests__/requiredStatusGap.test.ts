import { describe, it, expect } from '@jest/globals';

import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import {
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
});
