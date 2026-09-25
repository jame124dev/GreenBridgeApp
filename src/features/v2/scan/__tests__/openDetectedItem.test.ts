/**
 * A detected row must open as a PUBLISHABLE item.
 *
 * Task: `todo/SCANV2_V2UI_14_ITEM_ROUTE.md` — the link the conditional spine
 * sits behind. `wizardState.ts:84-87` states the dependency in the code: a
 * batch spine "would number a journey nobody can walk" until this exists.
 *
 * ── WHAT THIS GATE IS REALLY PROTECTING ───────────────────────────────────
 *
 * Not "does the mapper copy fields". It is protecting against handing a seller
 * a review flow they can walk to the end and never submit. Publish requires
 * photos twice over — `requiredStatus.ts` (`allComplete = rows.photos && …`)
 * and `usePublishDraft` (`photos.length > 0`) — and the LIST row carries only a
 * single `thumbnail_object`. That is why the mapper reads the DETAIL row's
 * `image_objects_json`, and why the photo assertions here are the load-bearing
 * ones.
 *
 * ⚠️ Two types share the name `DraftItem`. The fixture is the SERVER one
 * (`@/services/drafts/draftItemsApi`); the output is the LOCAL store one. Using
 * the wrong one compiles cleanly — it already shipped a bug once, in
 * `valuationView.ts`.
 */
import { describe, it, expect } from '@jest/globals';

import type { DraftItemFull } from '@/services/drafts/draftItemsApi';

import { draftItemFromServerRow, photosFromServerMedia, sessionFromServerRow } from '../openDetectedItem';

/** Only the fields the mapper reads; the rest of the DTO is noise here. */
function serverRow(over: Partial<DraftItemFull> = {}): DraftItemFull {
  return {
    id: 1,
    seq: 1,
    status: 'needs_review',
    title: 'Waters Alliance e2695',
    price: 14000,
    currency: 'USD',
    marketplace: '101lab',
    category_name: 'Liquid Chromatography',
    category_resolved: true,
    thumbnail_object: 'drafts/247/1/thumb.jpg',
    grade: 'A',
    fmv_used: '12000-16000',
    scrap_value: '900-1200',
    value_tier: 'high',
    heat_tier: null,
    needs_clearer_photo: false,
    lot_group_id: null,
    identification_confidence: 0.9,
    brand: 'Waters',
    model: 'e2695',
    year: '2019',
    condition: 'usedFunctional',
    location: 'Taipei, TW',
    qty: 3,
    demand_score: null,
    sell_weeks: null,
    ask: null,
    min_bid: null,
    row_version: 4,
    draft_id: 247,
    form_json: null,
    image_indexes_json: null,
    image_objects_json: ['drafts/247/1/a.jpg', 'drafts/247/1/b.jpg'],
    created_at: null,
    updated_at: null,
    ...over,
  } as DraftItemFull;
}

describe('a detected row maps onto a publishable local item', () => {
  /**
   * THE one that matters. An item with no photos passes every other assertion
   * here and can still never be submitted.
   */
  it('carries the whole gallery, not just the thumbnail', () => {
    const item = draftItemFromServerRow(serverRow());

    expect(item.photos).toHaveLength(2);
    expect(item.photos.every((p) => typeof p.uri === 'string' && p.uri.length > 0)).toBe(true);
  });

  it('fills every field the local item requires', () => {
    const item = draftItemFromServerRow(serverRow());

    // Built through the store's own factory, so the defaults are the real ones.
    expect(item.id).toBeTruthy();
    expect(item.title).toBe('Waters Alliance e2695');
    expect(item.brand).toBe('Waters');
    expect(item.model).toBe('e2695');
    expect(item.categoryName).toBe('Liquid Chromatography');
    expect(item.pricePerUnit).toBe('14000');
    expect(item.locations).toEqual(['Taipei, TW']);
    expect(Array.isArray(item.condition)).toBe(true);
    expect(item.allowedSites.length).toBeGreaterThan(0);
  });

  /** `null` means "none recorded", which renders as 1 — never 0, never blank. */
  it('reads a null quantity as one', () => {
    expect(draftItemFromServerRow(serverRow({ qty: null })).quantity).toBe(1);
    expect(draftItemFromServerRow(serverRow({ qty: 3 })).quantity).toBe(3);
  });

  /**
   * `year` arrives as a JSON string on some rows and a number on others from
   * the SAME extractor run. It stays text so the list and the detail cannot
   * disagree ("2019" vs 2019).
   */
  it('keeps year as text whichever way it arrives', () => {
    expect(draftItemFromServerRow(serverRow({ year: '2019' })).year).toBe('2019');
    expect(draftItemFromServerRow(serverRow({ year: 2019 as unknown as string })).year).toBe('2019');
  });

  /**
   * The AI chose the marketplace; the seller has not confirmed it. Setting the
   * flag here would let a guess publish unreviewed — `isRoutingResolved` is
   * what keeps the question in front of them.
   */
  it('does not pre-confirm the marketplace the AI picked', () => {
    expect(draftItemFromServerRow(serverRow()).marketplaceConfirmed).not.toBe(true);
  });

  /** No category id exists on the row — only a name. */
  it('leaves the category id unset', () => {
    expect(draftItemFromServerRow(serverRow()).categoryId).toBeNull();
  });

  it('survives a row with nothing on it', () => {
    const bare = draftItemFromServerRow(
      serverRow({
        title: null,
        brand: null,
        model: null,
        year: null,
        price: null,
        location: null,
        condition: null,
        category_name: null,
        image_objects_json: null,
      }),
    );

    expect(bare.title).toBe('');
    expect(bare.pricePerUnit).toBe('');
    expect(bare.photos).toEqual([]);
    expect(bare.locations).toEqual([]);
    expect(bare.condition).toEqual([]);
  });
});

describe('server media entries become photos', () => {
  it('accepts a raw url unchanged', () => {
    const [p] = photosFromServerMedia(['https://storage.googleapis.com/b/a.jpg']);
    expect(p.uri).toBe('https://storage.googleapis.com/b/a.jpg');
  });

  /**
   * A bare key goes through the `/gcs/serve` proxy. The assertion is on the
   * PATH, not on an absolute URL: `gcsUrlForAnalyze` prefixes
   * `Constants.expoConfig.extra.GREENBIDZ_API_URL`, which is set in
   * `app.config.ts:272` at runtime but empty under jest — asserting `https://`
   * here would be testing the test environment, not the mapper.
   */
  it('resolves a bare object key through the media proxy', () => {
    const [p] = photosFromServerMedia(['drafts/247/1/a.jpg']);

    expect(p.uri).toContain('/gcs/serve');
    expect(p.uri).toContain(encodeURIComponent('drafts/247/1/a.jpg'));
  });

  it('accepts the object form and prefers its url', () => {
    const [p] = photosFromServerMedia([
      { objectName: 'drafts/247/1/a.jpg', url: 'https://cdn.example/a.jpg' },
    ]);
    expect(p.uri).toBe('https://cdn.example/a.jpg');
  });

  /** A broken entry must not become a broken <Image>. */
  it('drops entries it cannot resolve', () => {
    expect(photosFromServerMedia([null, 42, {}, '', '   '])).toEqual([]);
    expect(photosFromServerMedia(null)).toEqual([]);
    expect(photosFromServerMedia('not-an-array')).toEqual([]);
  });
});

describe('the row becomes a single-item session', () => {
  /**
   * The single path reads `current`; the grouped path reads `queuedItems`. One
   * row is always the single path — same shape as
   * `persistedScanFromValuation`, which is how the other server draft shape
   * enters the store.
   */
  it('puts the item on current, not in the queue', () => {
    const session = sessionFromServerRow(serverRow());

    expect(session.mode).toBe('single');
    expect(session.current).not.toBeNull();
    expect(session.current?.title).toBe('Waters Alliance e2695');
    expect(session.queuedItems).toEqual([]);
  });
});
