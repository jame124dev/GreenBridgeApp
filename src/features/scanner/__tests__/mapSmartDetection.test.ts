import { describe, it, expect } from '@jest/globals';

import {
  buildPhotoSlices,
  SmartDetectionApplyError,
  slicePhotosByIndexes,
  validateMappedDetection,
} from '../applySmartDetection';
import { mapProductData, mapSmartDetection, pickPrice } from '../mapSmartDetection';
import type { Photo } from '@/stores/scanDraftStore';
import type { SmartDetectionResponse } from '../smartDetectionTypes';

const photos = (n: number): Photo[] =>
  Array.from({ length: n }, (_, i) => ({
    uri: `file://${i}`,
    width: 100,
    height: 100,
  }));

// Fixtures mirror real /analyze-smart-detection payloads (backend
// controller/wordPressSmart.js). One single-product, one multi-product.

const SINGLE: SmartDetectionResponse = {
  success: true,
  language: 'en',
  detection: { suggested_mode: 'single', confidence: 0.92, summary: '1 item detected' },
  merged_single: {
    name: 'Centrifuge X100',
    equipment_description: 'A benchtop centrifuge in good condition.',
    condition: 'used',
    operation_status: '',
    currency: 'USD',
    price: { reselling_price: 1499.6 },
    product_cat: { id: 42, name: 'Centrifuges' },
    subcategory: { id: '', name: '' },
    'auc-location': { id: 7, name: 'Taipei' },
    auction_group: { id: '', name: '' },
  },
  products: [
    {
      id: 'p-1',
      image_indexes: [0, 1, 2],
      document_indexes: [],
      data: {
        name: 'Centrifuge X100',
        equipment_description: 'A benchtop centrifuge in good condition.',
        condition: 'used',
        operation_status: '',
        currency: 'USD',
        price: { reselling_price: 1499.6 },
        product_cat: { id: 42, name: 'Centrifuges' },
        subcategory: { id: '', name: '' },
        'auc-location': { id: 7, name: 'Taipei' },
        auction_group: { id: '', name: '' },
      },
    },
  ],
  suggested_terms: {},
};

const MULTIPLE: SmartDetectionResponse = {
  success: true,
  language: 'en',
  detection: { suggested_mode: 'multiple', confidence: 0.55, summary: '2 items detected' },
  merged_single: {
    name: 'Mixed lab equipment lot',
    equipment_description: 'Two distinct items.',
    condition: 'used',
    price: 2000,
    product_cat: { id: '', name: '' },
  },
  products: [
    {
      id: 'p-1',
      image_indexes: [0, 1],
      document_indexes: [],
      data: {
        name: 'Microscope M9',
        equipment_description: 'Optical microscope.',
        condition: 'new',
        price: '800',
        product_cat: { id: 11, name: 'Microscopes' },
      },
    },
    {
      id: 'p-2',
      image_indexes: [2],
      document_indexes: [],
      data: {
        name: 'Hot Plate HP2',
        equipment_description: 'Lab hot plate, used for parts.',
        condition: 'forParts',
        price: null, // no price → make-offer
        product_cat: { id: '', name: '' }, // no match → uncategorized
      },
    },
  ],
  suggested_terms: { product_cat: ['Hot Plates'] },
};

describe('pickPrice', () => {
  it('handles number, string, and nested-object prices', () => {
    expect(pickPrice(1499.6)).toBe('1500');
    expect(pickPrice('800')).toBe('800');
    expect(pickPrice({ reselling_price: 1200.2 })).toBe('1200');
    expect(pickPrice({ buy_now: '999' })).toBe('999');
  });
  it('returns null for absent / empty / unusable prices', () => {
    expect(pickPrice(null)).toBeNull();
    expect(pickPrice(undefined)).toBeNull();
    expect(pickPrice('')).toBeNull();
    expect(pickPrice({})).toBeNull();
    expect(pickPrice(NaN)).toBeNull();
  });
});

describe('mapProductData', () => {
  it('overrides server USD with the site default (101it → TWD)', () => {
    const f = mapProductData(SINGLE.products[0].data, '101it');
    expect(f.priceCurrency).toBe('TWD');
    expect(f.ai.currency).toBe('TWD');
  });
  it('maps matched taxonomy and leaves unmatched category null', () => {
    const matched = mapProductData(SINGLE.products[0].data, 'LabGreenbidz');
    expect(matched.categoryId).toBe('42');
    expect(matched.categoryName).toBe('Centrifuges');

    const unmatched = mapProductData(MULTIPLE.products[1].data, 'LabGreenbidz');
    expect(unmatched.categoryId).toBeNull();
    expect(unmatched.categoryName).toBeNull();
  });
  it('derives priceFormat from presence of a price', () => {
    expect(mapProductData(MULTIPLE.products[0].data, 'LabGreenbidz').priceFormat).toBe('buyNow');
    expect(mapProductData(MULTIPLE.products[1].data, 'LabGreenbidz').priceFormat).toBe('offer');
  });
});

describe('mapSmartDetection', () => {
  it('single mode → one product, mode single', () => {
    const m = mapSmartDetection(SINGLE, 'LabGreenbidz');
    expect(m.mode).toBe('single');
    expect(m.products).toHaveLength(1);
    expect(m.products[0].imageIndexes).toEqual([0, 1, 2]);
    expect(m.products[0].fields.title).toBe('Centrifuge X100');
    expect(m.meta.confidence).toBeCloseTo(0.92);
  });

  it('multiple mode → grouped, all products, merged fallback present', () => {
    const m = mapSmartDetection(MULTIPLE, 'LabGreenbidz');
    expect(m.mode).toBe('grouped');
    expect(m.products).toHaveLength(2);
    expect(m.products[0].imageIndexes).toEqual([0, 1]);
    expect(m.products[1].imageIndexes).toEqual([2]);
    expect(m.products[1].fields.priceFormat).toBe('offer');
    expect(m.mergedSingleFields.title).toBe('Mixed lab equipment lot');
    expect(m.meta.confidence).toBeCloseTo(0.55);
  });

  it('"multiple" verdict with a single product collapses to single', () => {
    const oneProductMultiple: SmartDetectionResponse = {
      ...MULTIPLE,
      detection: { ...MULTIPLE.detection, suggested_mode: 'multiple' },
      products: [MULTIPLE.products[0]],
    };
    expect(mapSmartDetection(oneProductMultiple, 'LabGreenbidz').mode).toBe('single');
  });

  it('clamps out-of-range image indexes defensively', () => {
    const bad: SmartDetectionResponse = {
      ...SINGLE,
      products: [
        {
          ...SINGLE.products[0],
          image_indexes: [0, -1, 2.5 as unknown as number, 3],
        },
      ],
    };
    expect(mapSmartDetection(bad, 'LabGreenbidz').products[0].imageIndexes).toEqual([0, 3]);
  });

  it('clamps more than MAX_PRODUCTS (10) server products', () => {
    const many: SmartDetectionResponse = {
      ...MULTIPLE,
      detection: { suggested_mode: 'multiple', confidence: 0.8, summary: '11 items' },
      products: Array.from({ length: 11 }, (_, i) => ({
        id: `p-${i}`,
        image_indexes: [i],
        document_indexes: [],
        data: { name: `Item ${i}`, equipment_description: 'x', condition: 'new' },
      })),
    };
    expect(mapSmartDetection(many, 'LabGreenbidz').products).toHaveLength(10);
  });

  it('empty products array → mode single with zero products (apply must reject)', () => {
    const empty: SmartDetectionResponse = {
      ...SINGLE,
      products: [],
    };
    const m = mapSmartDetection(empty, 'LabGreenbidz');
    expect(m.mode).toBe('single');
    expect(m.products).toHaveLength(0);
    expect(() => validateMappedDetection(m, 3)).toThrow(SmartDetectionApplyError);
  });
});

describe('slicePhotosByIndexes', () => {
  it('dedupes and drops out-of-range indexes', () => {
    const src = photos(4);
    expect(slicePhotosByIndexes(src, [0, 0, 3, 99, -1])).toEqual([src[0], src[3]]);
  });
});

describe('buildPhotoSlices', () => {
  it('attaches orphan photos to the first group', () => {
    const src = photos(4);
    const { slices, orphanCount } = buildPhotoSlices(src, [[2], [1]]);
    expect(orphanCount).toBe(2);
    expect(slices[0].map((p) => p.uri)).toEqual(['file://2', 'file://0', 'file://3']);
    expect(slices[1].map((p) => p.uri)).toEqual(['file://1']);
  });
});

describe('validateMappedDetection', () => {
  it('rejects zero source photos and zero mapped products', () => {
    const m = mapSmartDetection(SINGLE, 'LabGreenbidz');
    expect(() => validateMappedDetection(m, 0)).toThrow(SmartDetectionApplyError);
    expect(() =>
      validateMappedDetection(
        { ...m, products: [] },
        3,
      ),
    ).toThrow(SmartDetectionApplyError);
  });
});
