/**
 * The local draft source — the six calls, and the three places a port drifts.
 *
 * ── WHAT THESE ARE ACTUALLY GUARDING ───────────────────────────────────────
 *
 * Not "does the mapper copy fields". This module exists so that ONE screen
 * (`app/v2/scan/items.tsx`) can serve a fresh scan and a resumed server draft
 * without knowing which it holds. Every assertion below is therefore about a
 * place where the two sources could disagree and the screen would not notice:
 *
 *   · `filter: 'all'` must mean what the SERVER means by it (discarded rows
 *     INCLUDED), because `items.tsx:413` does arithmetic that depends on it —
 *     and the web module this was ported from means the opposite;
 *   · a stale `expected_row_version` must fail the way an axios error fails,
 *     because `items.tsx`'s retry predicate reads `error.response.status` and
 *     would otherwise retry a refusal three times;
 *   · `seq` is ZERO-based, because the screen's title fallback renders
 *     `Item ${seq + 1}`;
 *   · `commitAcceptedRows` must REMOVE rather than rebuild, or the session
 *     loses `mergedSingle` — the app's only "these are actually one product"
 *     path, whose other entry point Phase 6 deletes.
 *
 * ⚠️ Two types share the name `DraftItem`: the SERVER row
 * (`services/drafts/draftItemsApi`) and the LOCAL store item
 * (`stores/scanDraftStore`). Using the wrong one compiles cleanly and has
 * already shipped a bug once (`valuationView.ts`), so the store one is aliased.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the on-disk photo persistence so we don't touch the filesystem.
jest.mock('@/services/upload/persistPhotos', () => ({
  persistPhotosForDraft: jest.fn(async (photos: unknown[]) => photos),
  persistDocumentsForDraft: jest.fn(async (docs: unknown[]) => docs),
  verifyDraftPhotos: jest.fn(async () => true),
  verifyDraftDocuments: jest.fn(async () => true),
  verifyScanSessionFiles: jest.fn(async () => true),
}));

// Minimal in-memory MMKV so `persistSession` is safe to call.
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      set: (k: string, v: string) => store.set(k, v),
      getString: (k: string) => store.get(k),
      remove: (k: string) => store.delete(k),
      __store: store,
    },
  };
});

import { mmkv } from '@/lib/mmkv';
import {
  draftItemFrom,
  useScanDraft,
  type DraftItem as ScanDraftItem,
} from '@/stores/scanDraftStore';
import {
  bulk,
  commitAcceptedRows,
  currentLocalDraftId,
  isLocalDraftId,
  itemCounts,
  getItem,
  listItems,
  LocalDraftError,
  patchItem,
  resetLocalDraft,
  reviewIndexForItem,
  seedLocalDraftFromScanStore,
} from '../localDraftSource';

const photo = (n: number) => ({ uri: `file://${n}.jpg`, width: 1, height: 1 });

function item(title: string, over: Partial<ScanDraftItem> = {}): ScanDraftItem {
  return draftItemFrom([photo(1)], {
    title,
    priceCurrency: 'USD',
    pricePerUnit: '1800',
    ...over,
  });
}

/** Load a grouped session, then project it. Returns the local draft id. */
async function seedQueue(items: ScanDraftItem[], mergedSingle?: ScanDraftItem): Promise<string> {
  await useScanDraft.getState().hydrateFromServer({
    mode: 'grouped',
    current: null,
    queuedItems: items,
    sessionVisibility: 'PUBLIC',
    networkSellers: [],
    ...(mergedSingle ? { mergedSingle } : {}),
  });
  return seedLocalDraftFromScanStore();
}

beforeEach(() => {
  (mmkv as unknown as { __store: Map<string, string> }).__store.clear();
  useScanDraft.getState().reset();
  resetLocalDraft();
});

describe('local draft ids', () => {
  it('are prefixed, and a server id is never mistaken for one', async () => {
    const id = await seedQueue([item('A')]);

    expect(isLocalDraftId(id)).toBe(true);
    expect(currentLocalDraftId()).toBe(id);

    // The three shapes a server draft id actually arrives in.
    expect(isLocalDraftId(247)).toBe(false);
    expect(isLocalDraftId('247')).toBe(false);
    expect(isLocalDraftId(undefined)).toBe(false);
  });
});

describe('listItems', () => {
  it('projects the store queue in document order, with a ZERO-based seq', async () => {
    await seedQueue([item('First'), item('Second'), item('Third')]);

    const page = listItems();

    expect(page.items.map((r) => r.id)).toEqual([1, 2, 3]);
    // `items.tsx` renders `Item ${seq + 1}` as its title fallback — a 1-based
    // seq here would number a three-row draft "Item 2, 3, 4".
    expect(page.items.map((r) => r.seq)).toEqual([0, 1, 2]);
    expect(page.items.map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
    expect(page.nextCursor).toBeNull();
  });

  it('carries the AI bands as RANGE STRINGS, in the row currency', async () => {
    await seedQueue([
      item('Priced', {
        aiPrices: { used: { min: 1500, max: 2500 }, scrap: { min: 200, max: 200 }, currency: 'USD' },
      }),
    ]);

    const [row] = listItems().items;

    // `valuationSummary.parseBand` reads exactly this shape; a point estimate
    // collapses to a bare number rather than "200-200".
    expect(row.fmv_used).toBe('1500-2500');
    expect(row.scrap_value).toBe('200');
    expect(row.price).toBe(1800);
    expect(row.currency).toBe('USD');
  });

  it('leaves an unpriced row null rather than 0', async () => {
    await seedQueue([item('No price', { pricePerUnit: '' })]);

    expect(listItems().items[0].price).toBeNull();
  });

  /**
   * ⚑ THE DEVIATION FROM THE WEB, PINNED.
   *
   * `guestDraftStore.matchesFilter` excludes discarded rows from `all`. The
   * SERVER does not, and `items.tsx:413` is built on the server's meaning —
   * its own comment records the bug that proved it ("discarding two of
   * eighteen with nothing accepted rendered TOTALS · 16 ACCEPTED"). If this
   * ever starts matching the web, that screen's arithmetic silently breaks on
   * the local lane only.
   */
  it('includes discarded rows in `all`, as the server does', async () => {
    await seedQueue([item('A'), item('B')]);
    bulk({ op: 'discard', select: { item_ids: [2] } });

    expect(listItems({ filter: 'all' }).items.map((r) => r.status)).toEqual([
      'needs_review',
      'discarded',
    ]);
    expect(listItems({ filter: 'discarded' }).items.map((r) => r.id)).toEqual([2]);
    expect(listItems({ filter: 'needs_review' }).items.map((r) => r.id)).toEqual([1]);
  });

  it('pages with a cursor, so a screen written against the API pages the same', async () => {
    await seedQueue([item('A'), item('B'), item('C')]);

    const first = listItems({ pageSize: 2 });
    expect(first.items.map((r) => r.id)).toEqual([1, 2]);
    expect(first.nextCursor).toBe('2');

    const second = listItems({ pageSize: 2, cursor: first.nextCursor });
    expect(second.items.map((r) => r.id)).toEqual([3]);
    expect(second.nextCursor).toBeNull();
  });

  /**
   * The title used to say "…and category", and nothing here ever asserted it.
   * Category is now deliberately OUT, because the server searches `title` plus
   * `Q_SEARCH_JSON_ALIASES = ["brand", "model"]` and nothing else — see
   * `matchesQuery`. The last expectation is what pins the exclusion; without
   * it, putting `category_name` back would go unnoticed exactly as its removal
   * did.
   */
  it('searches title, brand and model — and NOT category, as the server does not', async () => {
    await seedQueue([
      item('Shaking incubator', { brand: 'Waters', categoryName: 'Centrifuges' }),
      item('Chiller'),
    ]);

    expect(listItems({ q: 'waters' }).items.map((r) => r.id)).toEqual([1]);
    expect(listItems({ q: 'chill' }).items.map((r) => r.id)).toEqual([2]);
    expect(listItems({ q: 'nothing here' }).items).toEqual([]);

    // The probe is proved before it is trusted: the category IS on the row…
    expect(listItems().items[0]?.category_name).toBe('Centrifuges');
    // …and searching for it still matches nothing.
    expect(listItems({ q: 'Centrifuges' }).items).toEqual([]);
  });

  it('sorts by a named column, blanks last in both directions', async () => {
    await seedQueue([item('B item'), item(''), item('A item')]);

    expect(listItems({ sort: 'title_asc' }).items.map((r) => r.id)).toEqual([3, 1, 2]);
    expect(listItems({ sort: 'title_desc' }).items.map((r) => r.id)).toEqual([1, 3, 2]);
  });
});

describe('itemCounts', () => {
  it('reports the three statuses over everything and `total` over what is left', async () => {
    await seedQueue([item('A'), item('B'), item('C')]);
    bulk({ op: 'accept', select: { item_ids: [1] } });
    bulk({ op: 'discard', select: { item_ids: [3] } });

    expect(itemCounts()).toEqual({
      // "Found N" that keeps saying 3 after a discard is reporting on a list
      // nobody can see.
      total: 2,
      needs_review: 1,
      accepted: 1,
      discarded: 1,
      high_value: 0,
      scrap: 0,
    });
  });

  it('counts a high-value row by price, the tier column being absent on mobile', async () => {
    await seedQueue([item('Big', { pricePerUnit: '14000' }), item('Small')]);

    expect(itemCounts().high_value).toBe(1);
  });
});

describe('bulk', () => {
  it('returns { updated: n }', async () => {
    await seedQueue([item('A'), item('B')]);

    expect(bulk({ op: 'accept', select: { item_ids: [1, 2] } })).toEqual({ updated: 2 });
  });

  /** The server treats them as ONE op: a soft status change, never a removal. */
  it('treats `delete` as `discard` — the row stays, with a status', async () => {
    await seedQueue([item('A')]);

    bulk({ op: 'delete', select: { item_ids: [1] } });

    const rows = listItems({ filter: 'all' }).items;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('discarded');
  });

  it('refuses an empty selection with the API\'s own code', async () => {
    await seedQueue([item('A')]);

    try {
      bulk({ op: 'accept', select: { item_ids: [] } });
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(LocalDraftError);
      expect((err as LocalDraftError).response.status).toBe(400);
      expect((err as LocalDraftError).response.data).toMatchObject({ code: 'EMPTY_SELECTION' });
    }
  });

  it('refuses an op it does not implement instead of silently succeeding', async () => {
    await seedQueue([item('A')]);

    expect(() => bulk({ op: 'teleport', select: { item_ids: [1] } })).toThrow(LocalDraftError);
  });

  it('mirrors a field op into the store that publishes it', async () => {
    await seedQueue([item('A'), item('B')]);

    bulk({
      op: 'set_condition',
      select: { item_ids: [1, 2] },
      patch: { condition: ['usedFunctional'] },
    });

    expect(listItems().items.map((r) => r.condition)).toEqual([
      'usedFunctional',
      'usedFunctional',
    ]);
    expect(useScanDraft.getState().queuedItems.map((i) => i.condition)).toEqual([
      ['usedFunctional'],
      ['usedFunctional'],
    ]);
  });
});

describe('patchItem', () => {
  it('bumps row_version and re-derives the projected columns', async () => {
    await seedQueue([item('Old name')]);

    const patched = patchItem({
      itemId: 1,
      form_json_patch: { data: { name: 'New name', brand: 'Waters' } },
      expected_row_version: 1,
    });

    expect(patched.title).toBe('New name');
    expect(patched.brand).toBe('Waters');
    expect(patched.row_version).toBe(2);
  });

  it('writes the edit through to the store, which is what publish reads', async () => {
    await seedQueue([item('Old name')]);

    patchItem({ itemId: 1, form_json_patch: { data: { name: 'New name' } } });

    // `usePublishDraft.itemsToPublish()` reads the store, not these rows — an
    // edit that stops here would show on screen and publish the old value.
    expect(useScanDraft.getState().queuedItems[0].title).toBe('New name');
  });

  /**
   * ⚑ AXIOS-SHAPED, not a plain Error. `items.tsx:89` (`retryUnlessClientError`)
   * reads `error.response.status` and returns false for a 4xx; a bare Error
   * would be retried three times against a store that cannot change its mind.
   */
  it('rejects a stale expected_row_version with the backend\'s own 409 body', async () => {
    await seedQueue([item('A')]);
    patchItem({ itemId: 1, form_json_patch: { data: { name: 'Bumped' } } });

    try {
      patchItem({ itemId: 1, form_json_patch: { data: { name: 'Stale' } }, expected_row_version: 1 });
      throw new Error('expected a 409');
    } catch (err) {
      const e = err as LocalDraftError;
      expect(e.response.status).toBe(409);
      expect(e.response.data).toEqual({
        success: false,
        code: 'STALE',
        current_row_version: 2,
      });
    }

    // …and the stale write did NOT land.
    expect(listItems().items[0].title).toBe('Bumped');
  });

  it('404s an item that is not in the draft', async () => {
    await seedQueue([item('A')]);

    try {
      patchItem({ itemId: 99 });
      throw new Error('expected a 404');
    } catch (err) {
      expect((err as LocalDraftError).response.status).toBe(404);
    }
  });
});

describe('getItem', () => {
  it('returns the full shape, media list included', async () => {
    await seedQueue([item('A')]);

    const full = getItem(1);

    expect(full.title).toBe('A');
    expect(full.image_objects_json).toEqual(['file://1.jpg']);
    expect(full.form_json).toMatchObject({ data: { name: 'A' } });
  });
});

describe('reviewIndexForItem', () => {
  it('gives the queue index for a grouped row', async () => {
    await seedQueue([item('A'), item('B')]);

    expect(reviewIndexForItem(1)).toBe(0);
    expect(reviewIndexForItem(2)).toBe(1);
    expect(reviewIndexForItem(99)).toBeNull();
  });

  it('gives -1 for the single `current`, which is useReviewItem\'s convention', async () => {
    await useScanDraft.getState().hydrateFromServer({
      mode: 'single',
      current: item('Only one'),
      queuedItems: [],
      sessionVisibility: 'PUBLIC',
      networkSellers: [],
    });
    seedLocalDraftFromScanStore();

    expect(listItems().items).toHaveLength(1);
    expect(reviewIndexForItem(1)).toBe(-1);
  });
});

describe('commitAcceptedRows', () => {
  /**
   * ⚑ THE REGRESSION THIS PREVENTS. Rebuilding the session from the projected
   * rows — the obvious implementation, and what `items.tsx` used to do for
   * every draft — drops `mergedSingle`, the app's only "these are actually one
   * product" draft. Phase 6 removes its other entry point
   * (`app/scan/detection.tsx`), so losing it here loses it entirely.
   */
  it('keeps the accepted items, drops the rest, and preserves mergedSingle', async () => {
    const merged = item('All of it, as one product');
    await seedQueue([item('A'), item('B'), item('C')], merged);

    bulk({ op: 'accept', select: { item_ids: [1, 3] } });
    bulk({ op: 'discard', select: { item_ids: [2] } });

    commitAcceptedRows();

    expect(useScanDraft.getState().queuedItems.map((i) => i.title)).toEqual(['A', 'C']);
    expect(useScanDraft.getState().mergedSingle?.title).toBe('All of it, as one product');
  });

  it('keeps the photos and AI facts a projection cannot carry', async () => {
    const withExtras = item('Rich', {
      photos: [photo(1), photo(2), photo(3)],
      aiPrices: { used: { min: 100, max: 200 }, currency: 'USD' },
    });
    await seedQueue([withExtras]);
    bulk({ op: 'accept', select: { item_ids: [1] } });

    commitAcceptedRows();

    const kept = useScanDraft.getState().queuedItems[0];
    // The row carries ONE thumbnail; the draft still has all three photos, and
    // publish requires photos twice over (`requiredStatus` + `usePublishDraft`).
    expect(kept.photos).toHaveLength(3);
    expect(kept.aiPrices).toEqual({ used: { min: 100, max: 200 }, currency: 'USD' });
  });

  it('drops an undecided row — not choosing is not accepting', async () => {
    await seedQueue([item('A'), item('B')]);
    bulk({ op: 'accept', select: { item_ids: [1] } });

    commitAcceptedRows();

    expect(useScanDraft.getState().queuedItems.map((i) => i.title)).toEqual(['A']);
  });
});
