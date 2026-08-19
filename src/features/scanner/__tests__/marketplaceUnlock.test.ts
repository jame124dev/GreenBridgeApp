import { describe, it, expect } from '@jest/globals';

import { mapProductData, mapSmartDetection } from '../mapSmartDetection';
import type { SmartDetectionResponse, SmartProductData } from '../smartDetectionTypes';

const IT_ITEM: SmartProductData = {
  name: 'ASUS ProArt Display PA279CV',
  brand: 'ASUS',
  model: 'PA279CV',
  equipment_description: '27-inch professional monitor.',
  currency: 'USD',
  price: 450,
  site_type: '101it',
  product_cat: { id: 5501, name: 'Monitors' },
  subcategory: { id: '', name: '' },
};

const LAB_ITEM: SmartProductData = {
  name: 'Hsiangtai CN-1050 Centrifuge',
  brand: 'Hsiangtai',
  model: 'CN-1050',
  equipment_description: 'Benchtop centrifuge.',
  currency: 'USD',
  price: 1200,
  site_type: 'LabGreenbidz',
  product_cat: { id: 5375, name: 'Lab Infrastructure & Essentials' },
  subcategory: { id: '', name: '' },
};

/** A genuinely mixed batch: product 0 is 101it, product 1 is lab. */
const MIXED: SmartDetectionResponse = {
  success: true,
  language: 'en',
  detection: { suggested_mode: 'multiple', confidence: 0.9, summary: '2 items' },
  // The backend sets merged_single = the FIRST product with data
  // (controller/wordPressSmart.js:3451), so it carries product 0's site_type.
  merged_single: IT_ITEM,
  products: [
    { id: 'p-0', image_indexes: [0], document_indexes: [], data: IT_ITEM },
    { id: 'p-1', image_indexes: [1], document_indexes: [], data: LAB_ITEM },
  ],
  suggested_terms: {},
};

describe('M-4 — the detected marketplace reaches the draft', () => {
  it('mergedSingleFields does NOT carry a mixed batch’s first marketplace', () => {
    // §6.4: merged_single.site_type is product 0's marketplace. Any path that
    // falls back to mergedSingleFields on a MIXED batch must not inherit it.
    const m = mapSmartDetection(MIXED, 'LabGreenbidz');
    expect(m.products[0].fields.suggestedMarketplace).toBe('101it');
    expect(m.products[1].fields.suggestedMarketplace).toBe('101lab');
    expect(m.mergedSingleFields.suggestedMarketplace).toBeNull();
  });

  it('AI price currency stays USD regardless of the detected marketplace (§6.4)', () => {
    const f = mapProductData(IT_ITEM, 'LabGreenbidz');
    expect(f.priceCurrency).toBe('USD');
    expect(f.ai.currency).toBe('USD');
    expect(f.pricePerUnit).toBe('450');
  });
});

describe('M-6 — routing signal is carried, not interpreted', () => {
  it('carries needs_clearer_photo / confidence / sources verbatim', () => {
    const f = mapProductData(
      {
        ...LAB_ITEM,
        needs_clearer_photo: true,
        site_type_confidence: 0.31,
        site_type_source: 'low_confidence_fallback',
        category_source: 'unresolved',
      },
      'LabGreenbidz',
    );
    expect(f.needsClearerPhoto).toBe(true);
    expect(f.siteTypeConfidence).toBe(0.31);
    expect(f.siteTypeSource).toBe('low_confidence_fallback');
    expect(f.categorySource).toBe('unresolved');
  });

  it('defaults every absent field instead of guessing (today’s wire)', () => {
    const f = mapProductData(LAB_ITEM, 'LabGreenbidz');
    expect(f.needsClearerPhoto).toBe(false);
    expect(f.siteTypeConfidence).toBeNull();
    expect(f.siteTypeSource).toBeNull();
    expect(f.categorySource).toBeNull();
  });

  // ⛔ PLAN §2.1 — v1 ships "always confirm", no numeric threshold. If this
  // test ever fails, someone has made the confidence NUMBER change behaviour.
  it('a low confidence number alone does NOT change any mapped field', () => {
    const low = mapProductData({ ...LAB_ITEM, site_type_confidence: 0.05 }, 'LabGreenbidz');
    const high = mapProductData({ ...LAB_ITEM, site_type_confidence: 0.99 }, 'LabGreenbidz');
    // Strip the carried number from BOTH the top level and the `ai` mirror —
    // it is the one field that is ALLOWED to differ, because it is the display
    // value. Everything else must be byte-identical.
    const strip = (f: ReturnType<typeof mapProductData>) => {
      const { siteTypeConfidence: _c, ai, ...rest } = f;
      const { siteTypeConfidence: _aiC, ...aiRest } = ai;
      return { ...rest, ai: aiRest };
    };
    expect(strip(low)).toEqual(strip(high));
    // ...and prove the stripped field really was the only difference.
    expect(low.siteTypeConfidence).toBe(0.05);
    expect(high.siteTypeConfidence).toBe(0.99);
  });
});
