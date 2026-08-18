import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { getDraftRequiredStatus } from '@/features/scanner/requiredStatus';
import type { DraftItem } from '@/stores/scanDraftStore';

/**
 * M-7, submission seam. The validation seam alone is not enough — and half-doing
 * it is WORSE than not doing it.
 *
 * `getDraftRequiredStatus` runs `coerceDraftDefaults` (via `draftToFormValues`),
 * and the review hub's ready gate is exactly that predicate
 * (grouped-review.tsx:99, :159). But the grouped submit reads the queued
 * `DraftItem`s STRAIGHT from the store — it never passes through the detail form.
 * So with the repair applied only at the validation seam, a draft holding junk in
 * a field with no checklist row reads READY on screen and is then POSTed raw:
 * "invisibly blocked" becomes "silently submitted wrong". That is reachable:
 * `hydrateScanDraftFromPayload` casts the server-stored blob without validating
 * it (services/drafts/draftPayload.ts:41-45) and `migrateDraft` backfills only
 * some of these fields.
 *
 * The invariant: what the ready gate validated is what the wire carries.
 */
const mockPost = jest.fn<(url: string, body: FormData, config?: unknown) => Promise<unknown>>();
// Indirect on purpose: the factory is hoisted above `const mockPost`, so it must
// read the binding at CALL time, not at factory time.
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: {
    post: (url: string, body: FormData, config?: unknown) => mockPost(url, body, config),
  },
}));

import { submitGroupedListings } from '@/services/scanner/submitGroupedListings';

function junkDraft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    // No photos: `productMetaFromItem` does not read them and the multipart file
    // loop simply appends nothing, which keeps this a pure serialisation test.
    photos: [],
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
    operationStatus: [],
    pricePerUnit: '4500',
    // Every one of these is a field detailSchema requires, that has NO checklist
    // row, and that a legacy/resumed draft can really hold.
    priceCurrency: 'JPY' as unknown as DraftItem['priceCurrency'],
    priceFormat: undefined as unknown as DraftItem['priceFormat'],
    quantity: undefined as unknown as number,
    grade: 'Z' as unknown as DraftItem['grade'],
    marketplace: 'shopify' as unknown as DraftItem['marketplace'],
    installation: undefined as unknown as DraftItem['installation'],
    listingDurationDays: 0,
    locations: ['Taipei'],
    locationCountries: [],
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
    serialNumber: '',
    aiPrices: null,
    ...overrides,
  } as DraftItem;
}

/** FormData value read that works for both the RN polyfill and undici. */
function valueOf(fd: FormData, key: string): string {
  const std = (fd as unknown as { get?: (k: string) => unknown }).get?.(key);
  if (typeof std === 'string') return std;
  const parts: unknown[] = (fd as unknown as { _parts?: unknown[] })._parts ?? [];
  for (const p of parts) {
    if (Array.isArray(p) && p[0] === key) return String(p[1]);
  }
  return '';
}

const okResponse = {
  data: {
    success: true,
    data: {
      product_ids: [11],
      batch_ids: [22],
      auction_group: { group_id: 33 },
      products: [],
    },
  },
};

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue(okResponse);
});

describe('grouped submit sends what the ready gate validated', () => {
  it('the ready gate says this junk draft is submittable (the premise)', () => {
    // If this ever flips to false the draft is being BLOCKED again and the rest
    // of this file is testing a state the seller cannot reach.
    expect(getDraftRequiredStatus(junkDraft({ photos: [{ uri: 'file:///a.jpg', width: 1, height: 1 }] })).allComplete)
      .toBe(true);
  });

  it('every unmapped required field is repaired before it reaches the wire', async () => {
    await submitGroupedListings({
      items: [junkDraft()],
      sellerId: 7,
      sellerName: 'Seller',
      language: 'en',
      visibility: 'PUBLIC',
    });

    expect(mockPost).toHaveBeenCalled();
    const fd = mockPost.mock.calls[0][1];
    const meta = JSON.parse(valueOf(fd, 'products_json'))[0];

    expect(meta.item_grade).toBe('A'); // was 'Z'
    expect(meta.quantity).toBe('1'); // was the string "undefined"
    expect(meta.price_currency).toBe('USD'); // was 'JPY'
    expect(meta.price_format).toBe('buyNow'); // was undefined
    expect(meta.price_now_enabled).toBe('1');
    // 'shopify' is not a marketplace: raw, marketplaceToAllowedSite would have
    // silently filed this listing under the LAB marketplace.
    expect(meta.allowed_sites).toEqual(['LabGreenbidz']);
    // installation undefined → 'deinstalled' → operation_status ['deinstalled'].
    expect(meta.operation_status).toEqual(['deinstalled']);
  });

  it("the ?type= route param follows the repaired marketplace, not the junk one", async () => {
    await submitGroupedListings({
      items: [junkDraft({ marketplace: 'machines' as unknown as DraftItem['marketplace'] })],
      sellerId: 7,
      sellerName: 'Seller',
      language: 'en',
      visibility: 'PUBLIC',
    });
    // 'machines' is the ALLOWED-SITE spelling, not a marketplace key, so
    // marketplaceToPlatform() returns null for it and the raw path silently fell
    // back to the env site type. Coerced, it is '101machine' → 'machines'.
    expect(String(mockPost.mock.calls[0][0])).toContain('type=machines');
  });

  it('nothing the seller typed is rewritten', async () => {
    await submitGroupedListings({
      items: [junkDraft()],
      sellerId: 7,
      sellerName: 'Seller',
      language: 'en',
      visibility: 'PUBLIC',
    });
    const fd = mockPost.mock.calls[0][1];
    const meta = JSON.parse(valueOf(fd, 'products_json'))[0];
    expect(meta.product_title).toBe('Benchtop centrifuge');
    expect(meta.price_per_unit).toBe('4500');
    expect(meta.item_condition).toEqual(['usedFunctional']);
    expect(meta.location).toEqual(['Taipei']);
    // locationCountries was [] against one location row: the parity repair pads
    // it with an EMPTY string, it does not invent a country.
    expect(meta.country).toBeUndefined();
  });
});
