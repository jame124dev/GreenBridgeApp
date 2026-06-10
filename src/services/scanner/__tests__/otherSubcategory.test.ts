import { describe, it, expect } from '@jest/globals';

import {
  getSubmittedCategory,
  getSuggestedSubcategory,
  productMetaFromItem,
} from '../buildFormData';
import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import type { DraftItem } from '@/stores/scanDraftStore';

// "Other (type brand)" submit wiring (web parity). When the seller picks the
// Other subcategory, categoryId holds the sentinel, the product must file under
// the chosen PARENT (parentCategoryId/parentCategoryName), and the typed brand
// is sent as `suggested_subcategory`. A normal sub pick must NOT emit
// suggested_subcategory. We assert via both the small resolver helpers and the
// exported productMetaFromItem (covers the grouped-submit path).

function fakeDraft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    photos: [],
    ai: null,
    productIds: [],
    title: 'Test product',
    description: 'desc',
    categoryId: null,
    categoryName: null,
    customSubcategory: '',
    parentCategoryId: '',
    parentCategoryName: '',
    condition: ['usedFunctional'],
    operationStatus: ['deinstalled'],
    pricePerUnit: '100',
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
  };
}

const baseOpts = { sellerId: 574, sellerName: 'Akash Seller' };

describe('"Other (type brand)" subcategory resolution', () => {
  it('Other → files under parent + sends suggested_subcategory (helpers)', () => {
    const draft = fakeDraft({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '123',
      parentCategoryName: 'Laptops',
      customSubcategory: 'Asus',
    });

    expect(getSubmittedCategory(draft)).toEqual({ id: '123', name: 'Laptops' });
    expect(getSuggestedSubcategory(draft)).toBe('Asus');
  });

  it('Other → productMetaFromItem yields parent ids/name + suggested_subcategory', () => {
    const draft = fakeDraft({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '123',
      parentCategoryName: 'Laptops',
      customSubcategory: 'Asus',
    });

    const meta = productMetaFromItem(draft, baseOpts);

    expect(meta.product_category_ids).toBe('123');
    expect(meta.category_name).toBe('Laptops');
    expect(meta.suggested_subcategory).toBe('Asus');
  });

  it('Other → trims surrounding whitespace from the typed brand', () => {
    const draft = fakeDraft({
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '123',
      parentCategoryName: 'Laptops',
      customSubcategory: '  Asus  ',
    });

    expect(getSuggestedSubcategory(draft)).toBe('Asus');
    expect(productMetaFromItem(draft, baseOpts).suggested_subcategory).toBe('Asus');
  });

  it('normal sub pick → real category, NO suggested_subcategory', () => {
    const draft = fakeDraft({
      categoryId: '456',
      categoryName: 'Servers',
      // Even if stale Other fields linger, a real categoryId must win.
      parentCategoryId: '123',
      parentCategoryName: 'Laptops',
      customSubcategory: 'Asus',
    });

    expect(getSubmittedCategory(draft)).toEqual({ id: '456', name: 'Servers' });
    expect(getSuggestedSubcategory(draft)).toBe('');

    const meta = productMetaFromItem(draft, baseOpts);
    expect(meta.product_category_ids).toBe('456');
    expect(meta.category_name).toBe('Servers');
    expect(meta.suggested_subcategory).toBeUndefined();
  });
});
