import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// babel-plugin-jest-hoist workaround used throughout this repo (see
// enCategoryFixups.test.ts:6): create the jest.fn() INSIDE the factory, then
// grab a reference through the already-mocked import.
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn() },
}));

import { greenbidz } from '@/api/greenbidzClient';
import { fetchLabCategories } from '@/services/scanner/fetchCategories';

type AxiosLikeMock = jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
const mockGet = greenbidz.get as unknown as AxiosLikeMock;

const urlOf = () => String(mockGet.mock.calls[0]?.[0] ?? '');

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: { data: [] } });
});

describe('fetchLabCategories — endpoint per marketplace', () => {
  it('101lab uses the lab taxonomy with the `language` param', async () => {
    await fetchLabCategories('en', '101lab');
    expect(urlOf()).toBe('/product/lab/category?language=en');
  });

  it('101machine uses the machines taxonomy', async () => {
    await fetchLabCategories('en', '101machine');
    expect(urlOf()).toBe('/product/machines/category?language=en');
  });

  it('101it uses the 101it taxonomy', async () => {
    await fetchLabCategories('en', '101it');
    expect(urlOf()).toBe('/product/it/category?language=en');
  });

  // THE BLOCKER: 101recycle must not be served the lab tree, and the recycle
  // endpoint reads `lang`, not `language`
  // (backend controller/productController.js:244-257).
  it('101recycle uses the recycle taxonomy with the `lang` param', async () => {
    await fetchLabCategories('en', '101recycle');
    expect(urlOf()).toBe('/product/category?lang=en');
  });

  // The backend's recycle cache is EN-only (utils/categoryCache.js:167
  // hard-codes `?lang=en`), so every AI-returned recycle id is an EN-tree id.
  // Pin the app to EN too: the sorted-position bridge mis-maps 8 of the 37
  // recycle categories — see recycleCategoryShape.test.ts.
  it('101recycle stays on the EN tree even when the app is in Chinese', async () => {
    await fetchLabCategories('zh-Hant', '101recycle');
    expect(urlOf()).toBe('/product/category?lang=en');
  });

  it('the three WP-backed trees still follow the app locale', async () => {
    await fetchLabCategories('zh-Hant', '101lab');
    expect(urlOf()).toBe('/product/lab/category?language=zh-hant');
  });

  it('an unset marketplace falls through to the lab tree (unchanged)', async () => {
    await fetchLabCategories('en', undefined);
    expect(urlOf()).toBe('/product/lab/category?language=en');
  });
});

// The URL is only half of M-1. The recycle payload carries `term_id` and NO
// `id`, so if `fetchLabCategories` sends it through the WP normaliser instead of
// the recycle one, every row is dropped for having no usable id and the seller
// gets an EMPTY tree from a 200 response — the same submit-blocker in a new
// costume, and invisible to a URL-only assertion.
describe('fetchLabCategories — the recycle payload is normalised, not just routed', () => {
  // Verbatim dev rows (GET /product/category?lang=en, 2026-08-19).
  const RECYCLE_PAYLOAD = {
    data: {
      data: [
        { term_id: 1281, name: 'Surplus &amp; Scrap Materials', slug: 'surplus-scrap-materials' },
        { term_id: 2019, name: 'Metalworking Equipment', slug: 'metalworking-equipment' },
        { term_id: 5334, name: '車床 (CNC 與傳統)', slug: 'lathes-cnc-conventional-2' },
      ],
    },
  };

  it('keeps every recycle row, with term_id as the id and the name unescaped', async () => {
    mockGet.mockResolvedValue(RECYCLE_PAYLOAD);
    const tree = await fetchLabCategories('en', '101recycle');
    expect(tree.map((c) => c.id)).toEqual([1281, 2019, 5334]);
    expect(tree[0].name).toBe('Surplus & Scrap Materials');
    expect(tree.every((c) => Array.isArray(c.subcategories))).toBe(true);
  });

  it('applies the EN name fixup for recycle term 5334 even in a zh-Hant app', async () => {
    // `enOnly` resolves the language to `en`, and the fixup gate reads the
    // RESOLVED language — so a Taiwanese seller must still see the repaired
    // English name rather than the untranslated Chinese one WP stores.
    mockGet.mockResolvedValue(RECYCLE_PAYLOAD);
    const tree = await fetchLabCategories('zh-Hant', '101recycle');
    expect(tree.find((c) => c.id === 5334)?.name).toBe('Lathes (CNC & Conventional)');
  });

  it('guarantees a subcategories array on the machines shape, which omits the key', async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ id: 5300, name: 'Boring & Drilling Machines', slug: 'boring' }] },
    });
    const tree = await fetchLabCategories('en', '101machine');
    expect(tree[0].subcategories).toEqual([]);
  });
});
