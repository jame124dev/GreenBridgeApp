import { describe, it, expect, jest } from '@jest/globals';

// The module imports the greenbidz axios client, which transitively pulls in
// MMKV (a native module with no jest binary). Same stub as
// enCategoryFixups.test.ts:6.
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));

import {
  bridgeCategoryId,
  decodeHtmlEntities,
  endpointForMarketplace,
  flattenCategoryOptions,
  normalizeLabCategories,
  normalizeRecycleCategories,
  type LabCategory,
} from '@/services/scanner/fetchCategories';

// Verbatim rows from GET https://testapi.greenbidz.com/api/v1/product/category?lang=en
// (dev, 2026-08-19). Includes two of the 18 HTML-escaped names, both ids the
// backend is known to pick (1281, 2019), and the untranslated-Chinese EN row
// (5334).
const RECYCLE_ROWS = [
  { term_id: 1147, term_taxonomy_id: 1147, name: 'Material Handling Equipment', slug: 'material-handling-equipment', description: '', thumbnail_id: '0' },
  { term_id: 1148, term_taxonomy_id: 1148, name: 'Construction &amp; Earthmoving Equipment', slug: 'construction-earthmoving-equipment', description: '', thumbnail_id: '0' },
  { term_id: 1281, term_taxonomy_id: 1281, name: 'Surplus &amp; Scrap Materials', slug: 'surplus-scrap-materials', description: '', thumbnail_id: '0' },
  { term_id: 2019, term_taxonomy_id: 2019, name: 'Metalworking Equipment', slug: 'metalworking-equipment', description: '', thumbnail_id: '0' },
  { term_id: 5334, term_taxonomy_id: 5334, name: '車床 (CNC 與傳統)', slug: 'lathes-cnc-conventional-2', description: '', thumbnail_id: '0' },
];

describe('endpointForMarketplace', () => {
  it('gives recycle its own path, the `lang` param and EN pinning', () => {
    expect(endpointForMarketplace('101recycle')).toEqual({
      path: '/product/category',
      langParam: 'lang',
      shape: 'recycleFlat',
      enOnly: true,
    });
  });

  it('leaves the three WP-backed trees on `language` and locale-following', () => {
    for (const mk of ['101lab', '101machine', '101it', undefined] as const) {
      const ep = endpointForMarketplace(mk);
      expect(ep.langParam).toBe('language');
      expect(ep.shape).toBe('lab');
      expect(ep.enOnly).toBe(false);
    }
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes the entity the recycle endpoint actually emits', () => {
    expect(decodeHtmlEntities('Construction &amp; Earthmoving Equipment')).toBe(
      'Construction & Earthmoving Equipment',
    );
  });

  it('decodes numeric and hex references', () => {
    expect(decodeHtmlEntities('A&#38;B')).toBe('A&B');
    expect(decodeHtmlEntities('A&#x26;B')).toBe('A&B');
  });

  it('is idempotent, so it stays safe once the server unescapes (task S0-4)', () => {
    const clean = 'Construction & Earthmoving Equipment';
    expect(decodeHtmlEntities(clean)).toBe(clean);
    expect(
      decodeHtmlEntities(decodeHtmlEntities('Construction &amp; Earthmoving Equipment')),
    ).toBe(clean);
  });

  it('leaves an unrecognised entity exactly as-is rather than blanking it', () => {
    expect(decodeHtmlEntities('R&sup2; Widgets')).toBe('R&sup2; Widgets');
  });
});

describe('normalizeRecycleCategories', () => {
  it('maps term_id to id, unescapes the name and marks the tree flat', () => {
    const tree = normalizeRecycleCategories(RECYCLE_ROWS);
    expect(tree).toHaveLength(5);
    expect(tree[1]).toEqual({
      id: 1148,
      name: 'Construction & Earthmoving Equipment',
      slug: 'construction-earthmoving-equipment',
      subcategories: [],
    });
    expect(tree.every((c) => Array.isArray(c.subcategories) && c.subcategories.length === 0)).toBe(true);
  });

  it('keeps the ids the backend picks (1281, 2019) — the whole point of M-1', () => {
    const ids = normalizeRecycleCategories(RECYCLE_ROWS).map((c) => c.id);
    expect(ids).toContain(1281);
    expect(ids).toContain(2019);
  });

  it('drops rows with no usable id or a blank name instead of rendering blanks', () => {
    const tree = normalizeRecycleCategories([
      { term_id: 'nope', name: 'Bad id' },
      { term_id: 99, name: '   ' },
      { term_id: 100, name: 'Good' },
    ]);
    expect(tree.map((c) => c.id)).toEqual([100]);
  });

  it('survives a non-array payload', () => {
    expect(normalizeRecycleCategories(undefined)).toEqual([]);
    expect(normalizeRecycleCategories({ nope: true })).toEqual([]);
  });
});

describe('normalizeLabCategories', () => {
  it('guarantees a subcategories array for the machines shape (13/13 rows omit it)', () => {
    const tree = normalizeLabCategories([
      { id: 5300, name: 'Boring & Drilling Machines', slug: 'boring-drilling-machines' },
    ]);
    expect(tree[0].subcategories).toEqual([]);
  });

  it('keeps nested subcategories and drops unusable ones', () => {
    const tree = normalizeLabCategories([
      {
        id: 5375,
        name: 'Lab Infrastructure & Essentials',
        slug: 'lab-infra',
        subcategories: [
          { id: 5573, name: 'Autoclaves and Sterilisation', slug: 'autoclaves' },
          { id: 0, name: 'Broken', slug: 'broken' },
        ],
      },
    ]);
    expect(tree[0].subcategories.map((s) => s.id)).toEqual([5573]);
  });
});

describe('flattenCategoryOptions', () => {
  it('treats every recycle parent as a selectable leaf, with itself as parent', () => {
    const options = flattenCategoryOptions(normalizeRecycleCategories(RECYCLE_ROWS));
    expect(options).toHaveLength(5);
    expect(options[0]).toEqual({
      id: '1147',
      name: 'Material Handling Equipment',
      label: 'Material Handling Equipment',
      parentId: '1147',
      parentName: 'Material Handling Equipment',
    });
  });

  it('labels a nested leaf `Parent › Sub` and carries the parent through', () => {
    const nested: LabCategory[] = [
      {
        id: 5375,
        name: 'Lab Infrastructure & Essentials',
        slug: 'lab-infra',
        subcategories: [{ id: 5578, name: 'Centrifugation', slug: 'centrifugation' }],
      },
    ];
    expect(flattenCategoryOptions(nested)).toEqual([
      {
        id: '5578',
        name: 'Centrifugation',
        label: 'Lab Infrastructure & Essentials › Centrifugation',
        parentId: '5375',
        parentName: 'Lab Infrastructure & Essentials',
      },
    ]);
  });
});

// Why `enOnly` exists. `bridgeCategoryId` assumes position-in-sorted-id-order
// identifies the same logical category in both locales (verified for /machines).
// The recycle taxonomy breaks that: EN and zh-hant terms were created in
// different orders, so 8 of 37 positions disagree on dev. This reproduces the
// class of failure with the smallest possible tree, so nobody "simplifies"
// `enOnly` away later.
describe('bridgeCategoryId — why 101recycle must not be bridged', () => {
  const EN: LabCategory[] = [
    { id: 1339, name: 'Packaging Equipment', slug: 'packaging', subcategories: [] },
    { id: 1352, name: 'Semiconductor & Electronics Manufacturing', slug: 'semi', subcategories: [] },
  ];
  // Live zh-hant ids at the same two positions (1373 / 1399 on dev): the
  // SEMICONDUCTOR row sorts first, so position 0 is not "Packaging".
  const ZH: LabCategory[] = [
    { id: 1373, name: '半導體與電子製造', slug: 'semi-zh', subcategories: [] },
    { id: 1399, name: '包裝設備', slug: 'packaging-zh', subcategories: [] },
  ];

  it('silently resolves an EN recycle id to the WRONG locale category', () => {
    // "Packaging Equipment" bridges to the Semiconductor row. No error, no null.
    expect(bridgeCategoryId('1339', EN, ZH)).toBe('1373');
  });

  it('so the recycle endpoint is pinned to EN and the bridge never runs for it', () => {
    expect(endpointForMarketplace('101recycle').enOnly).toBe(true);
  });
});
