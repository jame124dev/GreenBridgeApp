import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, fireEvent } from '@testing-library/react-native';

// Same native-module stubs as `CategoryPickerSheet.test.tsx` — see the comments
// there for why each one is needed.
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
  };
});
jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));

import '@/i18n';

import { greenbidz } from '@/api/greenbidzClient';
import { fetchLabCategories, type LabCategory } from '@/services/scanner/fetchCategories';

import { CategoryPickerSheet } from '../CategoryPickerSheet';

/**
 * M-1 + M-2 over the REAL dev trees, end to end through the real code path.
 *
 * WHAT THIS SUITE IS, AND WHAT IT IS NOT.
 *
 * The other two M-2 suites render hand-built 1-2 row trees. Small fixtures prove
 * the branches but they cannot fail the way production fails: they have no
 * HTML-escaped names, no `term_id`-only rows, no `subcategories`-less rows, no
 * 38-children-under-one-parent parent, and no untranslated-Chinese EN row. Every
 * one of those is real on dev today, and each one is a way the picker can be
 * shipped broken with a green suite.
 *
 * So this suite drives `fetchLabCategories` — the real routing, the real
 * `?lang=` vs `?language=` choice, the real `enOnly` pin, the real normalisers
 * and the real EN fixups — over VERBATIM dev responses captured on 2026-08-19,
 * and renders `CategoryPickerSheet` on the result. The fixture is
 * `__tests__/fixtures/devCategoryTrees.json`; regenerate it by re-requesting the
 * seven URLs recorded in its `url` fields.
 *
 * It is NOT a device check. It cannot see layout, truncation, safe-area insets,
 * or the touch-responder chain — so it cannot prove Phase 3's on-device criterion
 * #1 (first tap on a search result with the keyboard still up), which depends on
 * `keyboardShouldPersistTaps` and which `fireEvent.press` bypasses by
 * construction. That one needs a device. What this suite does cover is every
 * on-device criterion that is really an assertion about the TREE: #2, #4, #5, #6,
 * #7 and #10.
 *
 * The parent/leaf counts below are WordPress CONTENT and may legitimately move.
 * Where a count is incidental the assertion is a range or a property; the exact
 * numbers are pinned only where the number IS the measured claim M-1 rests on
 * (37 recycle rows, 0 escaped, 0 overlap with lab).
 */
const TREES = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'services', 'scanner', '__tests__', 'fixtures', 'devCategoryTrees.json'), 'utf8'),
) as Record<string, { url: string; status: number; data: unknown[] }>;

/** Serve the captured payload for whichever URL the real code decides to call. */
const byUrl: Record<string, unknown[]> = {
  '/product/lab/category?language=en': TREES.lab_en.data,
  '/product/machines/category?language=en': TREES.machines_en.data,
  '/product/it/category?language=en': TREES.it_en.data,
  '/product/category?lang=en': TREES.recycle_en.data,
  '/product/lab/category?language=zh-hant': TREES.lab_zhhant.data,
  '/product/machines/category?language=zh-hant': TREES.machines_zhhant.data,
  '/product/it/category?language=zh-hant': TREES.it_zhhant.data,
};

type AxiosLikeMock = jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
const mockGet = greenbidz.get as AxiosLikeMock;

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation((...args: unknown[]) => {
    const url = String(args[0]);
    const rows = byUrl[url];
    if (!rows) {
      // A miss means the routing changed and the test would otherwise silently
      // assert against an empty tree — which passes a surprising number of
      // "nothing is escaped / nothing is blank" checks.
      return Promise.reject(new Error(`no captured dev fixture for ${url}`));
    }
    return Promise.resolve({ data: { data: rows } });
  });
});

const base = {
  visible: true,
  loading: false,
  error: false,
  onRetry: () => {},
  value: '',
  parentId: '',
  onClose: () => {},
  onSelect: () => {},
};

const renderTree = (categories: LabCategory[], marketplaceLabel: string) =>
  render(
    <CategoryPickerSheet {...base} categories={categories} marketplaceLabel={marketplaceLabel} />,
  );

describe('M-1 — the four dev trees through the real fetch path', () => {
  it('101recycle returns 37 flat, English, entity-decoded rows (18 were escaped on the wire)', async () => {
    const escapedOnTheWire = (TREES.recycle_en.data as { name: string }[]).filter((r) =>
      /&[a-z#0-9]+;/i.test(r.name),
    ).length;
    expect(escapedOnTheWire).toBe(18);

    const tree = await fetchLabCategories('en', '101recycle');

    expect(tree).toHaveLength(37);
    expect(tree.filter((c) => /&[a-z#0-9]+;/i.test(c.name))).toHaveLength(0);
    // Flat BY CONSTRUCTION (the endpoint's SQL filters `tt.parent = 0`), so every
    // parent is its own leaf.
    expect(tree.every((c) => Array.isArray(c.subcategories) && c.subcategories.length === 0)).toBe(
      true,
    );
    expect(tree.every((c) => Number.isFinite(c.id) && c.id > 0 && c.name.trim().length > 0)).toBe(
      true,
    );
  });

  it('the two recycle ids the backend actually picks survive the whole path', async () => {
    const tree = await fetchLabCategories('en', '101recycle');
    const byId = new Map(tree.map((c) => [c.id, c.name]));
    // Both named in the brief; both absent from the lab tree (asserted below).
    expect(byId.get(1281)).toBe('Surplus & Scrap Materials');
    expect(byId.get(2019)).toBe('Metalworking Equipment');
  });

  it('recycle ids do not overlap the lab tree — the reason the old routing was a hard blocker', async () => {
    const recycle = await fetchLabCategories('en', '101recycle');
    const lab = await fetchLabCategories('en', '101lab');
    const labIds = new Set<number>();
    for (const c of lab) {
      labIds.add(c.id);
      for (const s of c.subcategories) labIds.add(s.id);
    }
    expect(recycle.filter((c) => labIds.has(c.id))).toHaveLength(0);
  });

  it('the EN fixup repairs recycle term 5334, which the EN endpoint returns in Chinese', async () => {
    expect((TREES.recycle_en.data as { term_id: number; name: string }[]).find((r) => r.term_id === 5334)?.name).toBe(
      '車床 (CNC 與傳統)',
    );
    const tree = await fetchLabCategories('en', '101recycle');
    expect(tree.find((c) => c.id === 5334)?.name).toBe('Lathes (CNC & Conventional)');
  });

  it('101machine rows omit `subcategories` on the wire and still get the array guaranteed', async () => {
    expect((TREES.machines_en.data as Record<string, unknown>[]).some((r) => 'subcategories' in r)).toBe(
      false,
    );
    const tree = await fetchLabCategories('en', '101machine');
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.every((c) => Array.isArray(c.subcategories))).toBe(true);
  });

  it('101recycle is pinned to the EN tree in Chinese too — same URL, byte-identical result', async () => {
    const en = await fetchLabCategories('en', '101recycle');
    const zh = await fetchLabCategories('zh-Hant', '101recycle');
    expect(JSON.stringify(zh)).toBe(JSON.stringify(en));
    const urls = mockGet.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(['/product/category?lang=en', '/product/category?lang=en']);
  });

  it('the three WP-backed trees DO follow the locale, so the recycle pin is a deliberate exception', async () => {
    const labZh = await fetchLabCategories('zh-Hant', '101lab');
    expect(String(mockGet.mock.calls[0][0])).toBe('/product/lab/category?language=zh-hant');
    // At least one label is non-ASCII — i.e. the locale really was honoured.
    expect(labZh.some((c) => /[^\u0000-\u007f]/.test(c.name))).toBe(true);
  });
});

describe('M-2 — the picker rendered on the real trees (on-device criteria #2/#4/#5/#6/#7/#10)', () => {
  it('#6 101RECYCLE: 37 plain rows, all English, no `&amp;` anywhere on screen', async () => {
    const tree = await fetchLabCategories('en', '101recycle');
    const { getByText, queryByText, toJSON } = renderTree(tree, '101RECYCLE');

    // The escaped form must not survive to the screen...
    expect(queryByText('Surplus &amp; Scrap Materials')).toBeNull();
    // ...and the decoded form must be what renders.
    expect(getByText('Surplus & Scrap Materials')).toBeTruthy();
    expect(getByText('Metalworking Equipment')).toBeTruthy();
    // Nothing anywhere in the rendered tree still carries an entity.
    expect(/&[a-z#0-9]+;/i.test(JSON.stringify(toJSON()))).toBe(false);
    // Flat tree: no accordion, so no "Other (type brand)" to file under a parent.
    expect(queryByText('Other (type brand)')).toBeNull();
  });

  it('#7 101RECYCLE search `scrap` finds both rows, with no parent description line', async () => {
    const tree = await fetchLabCategories('en', '101recycle');
    const { getByPlaceholderText, getAllByText, getByText } = renderTree(tree, '101RECYCLE');

    fireEvent.changeText(getByPlaceholderText('Search categories…'), 'scrap');

    expect(getByText('Surplus & Scrap Materials')).toBeTruthy();
    expect(getByText('Scrap')).toBeTruthy();
    // On a FLAT tree parentName === name, so the guard suppresses the second
    // line — otherwise every recycle search hit renders its own name twice.
    expect(getAllByText('Surplus & Scrap Materials')).toHaveLength(1);
    expect(getAllByText('Scrap')).toHaveLength(1);
  });

  it('#4 101MACHINE: plain rows only — no group headers, no Other', async () => {
    const tree = await fetchLabCategories('en', '101machine');
    const { queryByText, getByText } = renderTree(tree, '101MACHINE');

    expect(getByText('Boring & Drilling Machines')).toBeTruthy();
    expect(queryByText('Other (type brand)')).toBeNull();
  });

  it('#2 101LAB browse is an ACCORDION: parents only until one is tapped (owner decision 6)', async () => {
    const tree = await fetchLabCategories('en', '101lab');
    const parentNames = tree.map((c) => c.name);
    const childCount = tree.reduce((n, c) => n + c.subcategories.length, 0);
    // The shape this criterion is about: a handful of parents over many children.
    expect(parentNames.length).toBeGreaterThanOrEqual(3);
    expect(childCount).toBeGreaterThan(40);

    const { getByText, queryByText } = renderTree(tree, '101LAB');

    // Every parent is offered...
    for (const name of parentNames) expect(getByText(name)).toBeTruthy();
    // ...and NO child is, which is the whole point of the accordion: rendering
    // all of them would put `childCount + parentNames.length` rows on screen in
    // the DEFAULT state, which is the "can scrolling be reduced?" problem again.
    const biggest = [...tree].sort((a, b) => b.subcategories.length - a.subcategories.length)[0];
    for (const sub of biggest.subcategories) expect(queryByText(sub.name)).toBeNull();
    expect(queryByText('Other (type brand)')).toBeNull();

    // Tapping the parent expands exactly that parent, children + its own Other.
    fireEvent.press(getByText(biggest.name));
    for (const sub of biggest.subcategories) expect(getByText(sub.name)).toBeTruthy();
    expect(getByText('Other (type brand)')).toBeTruthy();

    // And a second tap collapses it again — an accordion, not a one-way reveal.
    fireEvent.press(getByText(biggest.name));
    for (const sub of biggest.subcategories) expect(queryByText(sub.name)).toBeNull();
  });

  it('#2 tapping a second 101LAB parent closes the first — one open at a time', async () => {
    const tree = await fetchLabCategories('en', '101lab');
    const nested = tree.filter((c) => c.subcategories.length > 0);
    expect(nested.length).toBeGreaterThanOrEqual(2);
    const [a, b] = nested;

    const { getByText, queryByText } = renderTree(tree, '101LAB');

    fireEvent.press(getByText(a.name));
    expect(getByText(a.subcategories[0].name)).toBeTruthy();

    fireEvent.press(getByText(b.name));
    expect(getByText(b.subcategories[0].name)).toBeTruthy();
    expect(queryByText(a.subcategories[0].name)).toBeNull();
  });

  it('#5 101IT: every parent is offered, and one expands to its own children', async () => {
    const tree = await fetchLabCategories('en', '101it');
    const nested = tree.filter((c) => c.subcategories.length > 0);
    expect(nested.length).toBeGreaterThan(0);

    const { getByText, queryByText } = renderTree(tree, '101IT');
    for (const c of tree) expect(getByText(c.name)).toBeTruthy();
    expect(queryByText(nested[0].subcategories[0].name)).toBeNull();

    fireEvent.press(getByText(nested[0].name));
    for (const sub of nested[0].subcategories) expect(getByText(sub.name)).toBeTruthy();
  });

  it('#1 search on the real 101LAB tree labels the LEAF and puts the parent underneath', async () => {
    const tree = await fetchLabCategories('en', '101lab');
    const { getByPlaceholderText, getByText, queryByText } = renderTree(tree, '101LAB');

    fireEvent.changeText(getByPlaceholderText('Search categories…'), 'centrif');

    // The leaf's own name is the row label — NOT `Parent › Leaf`, which would
    // truncate inside the shared prefix at numberOfLines={1} in ~380 px.
    const hit = tree
      .flatMap((c) => c.subcategories.map((s) => ({ parent: c.name, leaf: s.name })))
      .find((o) => o.leaf.toLowerCase().includes('centrif') || o.parent.toLowerCase().includes('centrif'));
    expect(hit).toBeDefined();
    expect(getByText(hit!.leaf)).toBeTruthy();
    // The parent renders as the row's description...
    expect(getByText(hit!.parent)).toBeTruthy();
    // ...and the combined label form is NOT used.
    expect(queryByText(`${hit!.parent} › ${hit!.leaf}`)).toBeNull();
  });

  /**
   * #10, and a correction to the criterion as written.
   *
   * Phase 3's on-device row #10 expects "lab / machines / 101it labels are
   * Chinese; recycle stays English by design". Measured on dev 2026-08-19 that is
   * wrong about 101it: `?language=zh-hant` returns the 101it tree with ALL 6
   * parents and ALL 25 children in English. 101lab is only partly translated too
   * (4/4 parents but 29/62 children). Only /machines comes back fully Chinese.
   *
   * So English labels under a Chinese app locale have TWO different causes, and
   * the difference is what is worth locking, because a future reader will
   * otherwise "fix" the wrong one:
   *
   *   - 101recycle is English because the APP PINS IT (`enOnly`, owner decision
   *     5): the zh-Hant request is never made. That is code, it is deliberate,
   *     and it exists because the positional locale bridge mis-maps 8 of the 37
   *     recycle categories with no null and no error.
   *   - 101it is English because the CONTENT is untranslated: the zh-Hant request
   *     IS made and comes back English. That is a WPML content gap on dev,
   *     nothing to do with this phase, and setting `enOnly` for 101it would
   *     hard-code the bug instead of fixing it.
   *
   * The assertions therefore pin the requested URL (code) and only assert the
   * translation state where it distinguishes the two causes.
   */
  it('#10 zh-Hant: recycle is English because the APP pins it, not because content is missing', async () => {
    const nonAscii = (s: string) => /[^ -]/.test(s);

    // /machines is the one fully-translated tree on dev, so it is the proof that
    // the locale really does reach the WP-backed endpoints.
    const machines = await fetchLabCategories('zh-Hant', '101machine');
    expect(String(mockGet.mock.calls[0][0])).toBe('/product/machines/category?language=zh-hant');
    expect(machines.every((c) => nonAscii(c.name))).toBe(true);

    // 101lab: locale honoured, content only partly translated. Assert the code
    // behaviour (the zh-hant URL was requested), not the content.
    mockGet.mockClear();
    await fetchLabCategories('zh-Hant', '101lab');
    expect(String(mockGet.mock.calls[0][0])).toBe('/product/lab/category?language=zh-hant');

    // 101it: locale honoured, content NOT translated at all. The test says so
    // rather than pretending the tree comes back Chinese.
    mockGet.mockClear();
    const it = await fetchLabCategories('zh-Hant', '101it');
    expect(String(mockGet.mock.calls[0][0])).toBe('/product/it/category?language=zh-hant');
    expect(it.some((c) => nonAscii(c.name))).toBe(false);

    // 101recycle: the zh-Hant request is NEVER made. That is the pin, and it is
    // what separates this case from 101it's.
    mockGet.mockClear();
    const recycle = await fetchLabCategories('zh-Hant', '101recycle');
    expect(mockGet.mock.calls.map((c) => String(c[0]))).toEqual(['/product/category?lang=en']);
    expect(recycle.some((c) => nonAscii(c.name))).toBe(false);
    const { getByText } = renderTree(recycle, '101RECYCLE');
    expect(getByText('Surplus & Scrap Materials')).toBeTruthy();
  });
});
