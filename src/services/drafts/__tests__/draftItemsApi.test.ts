/**
 * Draft-items client — the things that are silently wrong if guessed.
 *
 * ── WHAT THIS FILE LEARNED THE HARD WAY ────────────────────────────────────
 *
 * An earlier version of these tests passed while pinning a contract the server
 * has never accepted: `items:bulkAction` as the callable path, `{ids, status}`
 * as the body, `PATCH` as the way to accept an item, and `limit`/`offset` as
 * the paging params. Every one of those was asserted confidently against a mock
 * that agreed with me. A test that mocks the server cannot discover the server
 * is different — so each case below cites the backend file and line it was read
 * from, and the citation is the actual evidence.
 *
 * Read from `101recycle-greenbidz-backend` on 2026-09-17.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

import { greenbidz } from '@/api/greenbidzClient';
import {
  getDraftItemCounts,
  listAllDraftItems,
  listDraftItems,
  setDraftItemsStatus,
} from '../draftItemsApi';

/**
 * A deliberately loose mock shape.
 *
 * `jest.Mock` from `@jest/globals` infers its argument type from the mocked
 * signature, and axios' overloads collapse that to `never` — so
 * `mockResolvedValue({ data: … })` fails to compile against a perfectly valid
 * payload.
 */
interface LooseMock {
  mockReset: () => void;
  mockResolvedValue: (value: unknown) => void;
  mockResolvedValueOnce: (value: unknown) => void;
  mock: { calls: unknown[][] };
}

const api = greenbidz as unknown as { get: LooseMock; post: LooseMock; patch: LooseMock };

/** Shaped by the list DTO — `helper/draftItemsQuery.js:980-1053`. */
const REAL_ITEM = {
  id: 2189,
  seq: 0,
  status: 'needs_review',
  title: 'KS Orbital Shaking Incubator OSI 500',
  price: 1800,
  currency: 'USD',
  marketplace: 'LabGreenbidz',
  category_name: 'Incubators',
  category_resolved: false,
  grade: 'C',
  fmv_used: '1500-2500',
  scrap_value: '100-200',
  needs_clearer_photo: false,
  row_version: 3,
};

const ok = (data: unknown, extra: Record<string, unknown> = {}) => ({
  status: 200,
  data: { success: true, data, ...extra },
});

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
});

describe('listDraftItems', () => {
  it('reads items from `data`, not `data.items`', async () => {
    api.get.mockResolvedValue(ok([REAL_ITEM]));

    const page = await listDraftItems(247);

    expect(page.items).toHaveLength(1);
    expect(page.items[0].title).toBe('KS Orbital Shaking Incubator OSI 500');
    expect(page.items[0].fmv_used).toBe('1500-2500');
  });

  /**
   * THE BUG THIS EXISTS FOR. `normalizeFilter` defaults to `needs_review`
   * (`draftItemsQuery.js:35`), so omitting `filter` returns only the unreviewed
   * rows — a short list and a valuation total missing everything already
   * accepted, with nothing on screen to suggest either.
   */
  it('asks for `all`, because the server default is `needs_review`', async () => {
    api.get.mockResolvedValue(ok([]));
    await listDraftItems(247);

    const [, config] = api.get.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.filter).toBe('all');
  });

  /**
   * Paging is `pageSize` + `cursor` (`draftItemsController.js:152-153`).
   * `limit`/`offset` are not read at all — a request using them is silently
   * capped at the default 50 with no way to reach page two.
   */
  it('pages with pageSize/cursor and never limit/offset', async () => {
    api.get.mockResolvedValue(ok([]));
    await listDraftItems(247, { pageSize: 100, cursor: 'abc' });

    const [, config] = api.get.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.pageSize).toBe(100);
    expect(config.params.cursor).toBe('abc');
    expect(config.params.limit).toBeUndefined();
    expect(config.params.offset).toBeUndefined();
  });

  it('caps pageSize at the server ceiling of 100', async () => {
    api.get.mockResolvedValue(ok([]));
    await listDraftItems(247, { pageSize: 500 });

    const [, config] = api.get.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.pageSize).toBe(100);
  });

  it('returns [] rather than throwing when the body is not a list', async () => {
    api.get.mockResolvedValue(ok(null));
    await expect(listDraftItems(247)).resolves.toEqual({ items: [], nextCursor: null });
  });
});

describe('listAllDraftItems', () => {
  it('follows the cursor so a total is not computed over page one', async () => {
    api.get.mockResolvedValueOnce(ok([REAL_ITEM], { next_cursor: 'c1' }));
    api.get.mockResolvedValueOnce(ok([{ ...REAL_ITEM, id: 2190 }], { next_cursor: null }));

    const items = await listAllDraftItems(247);

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual([2189, 2190]);
  });

  it('stops rather than spinning when the server always returns a cursor', async () => {
    api.get.mockResolvedValue(ok([REAL_ITEM], { next_cursor: 'forever' }));

    const items = await listAllDraftItems(247, { maxPages: 3 });

    expect(items).toHaveLength(3);
    expect(api.get.mock.calls).toHaveLength(3);
  });
});

describe('getDraftItemCounts', () => {
  it('returns the three statuses, both tiers and the total, as numbers', async () => {
    api.get.mockResolvedValue(
      ok({ total: 18, needs_review: 18, accepted: 0, discarded: 0, high_value: 0, scrap: 0 }),
    );

    await expect(getDraftItemCounts(246)).resolves.toEqual({
      total: 18,
      needs_review: 18,
      accepted: 0,
      discarded: 0,
      high_value: 0,
      scrap: 0,
    });
  });

  it('coerces a missing field to 0 instead of NaN', async () => {
    api.get.mockResolvedValue({ status: 200, data: { data: { total: 3 } } });
    const c = await getDraftItemCounts(1);
    expect(c.total).toBe(3);
    expect(c.accepted).toBe(0);
    expect(Number.isNaN(c.scrap)).toBe(false);
  });
});

describe('setDraftItemsStatus', () => {
  /**
   * The registered route is `items:bulkAction`, but the controller's first line
   * rejects any path not ending in the literal `/items:bulk`
   * (`draftItemsController.js:375`). Calling the registered name 404s — which
   * is exactly what this client did until today.
   */
  it('posts to `items:bulk`, the literal the controller enforces', async () => {
    api.post.mockResolvedValue({ status: 200, data: { success: true, updated: 3 } });
    await setDraftItemsStatus(247, [1, 2, 3], 'discard');

    const [url] = api.post.mock.calls[0] as [string, unknown];
    expect(url).toBe('/drafts/247/items:bulk');
    expect(url).not.toContain('bulkAction');
    expect(url).not.toContain('/bulk');
  });

  it('sends the op/select body the bulk planner expects', async () => {
    api.post.mockResolvedValue({ status: 200, data: { success: true, updated: 1 } });
    await setDraftItemsStatus(247, [2189], 'accept');

    const [, body] = api.post.mock.calls[0] as [string, unknown];
    expect(body).toEqual({ op: 'accept', select: { item_ids: [2189] } });
  });

  it('reports how many rows changed', async () => {
    api.post.mockResolvedValue({ status: 200, data: { success: true, updated: 3 } });
    await expect(setDraftItemsStatus(247, [1, 2, 3], 'accept')).resolves.toBe(3);
  });

  /**
   * A large selection is drained off-thread: 202 + `job_id`, nothing applied
   * yet. Returning 0 here would read as "nothing changed" and returning a count
   * would be a lie, so it is `null` — "accepted, go and refetch".
   */
  it('returns null for the 202 background-job answer', async () => {
    api.post.mockResolvedValue({ status: 202, data: { success: true, job_id: 'j-1' } });
    await expect(setDraftItemsStatus(247, [1], 'accept')).resolves.toBeNull();
  });
});
