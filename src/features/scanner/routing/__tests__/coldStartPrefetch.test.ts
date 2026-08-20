import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * ⛔ blocker (a) — THE COLD-CACHE HOLE, the release-day silent failure, as a
 * unit test.
 *
 * The bug: `supportedNow()` reads the MMKV cache SYNCHRONOUSLY, and the cache
 * used to be written only by `fetchSupportedMarketplaces()`, which only ran
 * inside `useSupportedMarketplaces()`, which was mounted only by `RoutingChip`
 * on `app/scan/detail.tsx`. But `applySmartDetection` builds every draft from
 * `processing-v2.tsx`, i.e. BEFORE detail.tsx exists. So on a fresh install the
 * FIRST scan ran with `supported = ['101lab']`: the AI's verdict was discarded,
 * `routingNeedsAsk` returned false at its `supported.length <= 1` line, and the
 * draft was stamped `marketplaceConfirmed: true`. Every user, every install —
 * and indistinguishable from the intended fail-closed behaviour.
 *
 * The fix is the launch prefetch in `app/_layout.tsx`. This file pins BOTH
 * halves of it:
 *   1. the MECHANISM — fetching really does warm the cache the store reads, so
 *      a draft built after the prefetch adopts-or-asks instead of silently
 *      keeping the build's own marketplace;
 *   2. the WIRING — the prefetch exists, in the mount-once effect, on the same
 *      queryKey and queryFn and staleTime as the hook. Delete it and this suite
 *      goes red. (1) alone cannot see the deletion, because the mechanism still
 *      works — nothing just calls it.
 */

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

// Mock ONLY the axios instance, so the real fetchSupportedMarketplaces (cache
// write included) is exercised end to end.
const mockGet = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({}));
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: (...a: unknown[]) => mockGet(...a) },
}));

import { mmkv } from '@/lib/mmkv';
import { fetchSupportedMarketplaces, SUPPORTED_QUERY_KEY } from '../supportedMarketplaces';
import { supportedNow } from '../supportedMarketplacesCache';
import { routingNeedsAsk } from '../routingState';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const LAYOUT = path.join(ROOT, 'app', '_layout.tsx');
const HOOK = path.join(ROOT, 'src', 'features', 'scanner', 'routing', 'useSupportedMarketplaces.ts');

beforeEach(() => {
  (mmkv as unknown as { __store: Map<string, string> }).__store.clear();
  mockGet.mockReset();
});

describe('blocker (a) — the first scan on a cleared install', () => {
  it('COLD: one marketplace, so nothing is asked and the AI verdict is dropped', () => {
    // This is the state the release-day bug shipped in. Pinned so the contrast
    // with the warm case below is explicit and cannot silently collapse.
    expect(supportedNow()).toEqual(['101lab']);
    expect(
      routingNeedsAsk({
        signal: {
          suggestedMarketplace: '101it',
          needsClearerPhoto: true,
          siteTypeConfidence: null,
          siteTypeSource: null,
          categorySource: null,
        },
        supported: supportedNow(),
      }),
    ).toBe(false);
  });

  it('WARM: one prefetch call is enough to make the store adopt-or-ask', async () => {
    mockGet.mockResolvedValue({
      data: { data: { supported_marketplaces: ['101lab', '101machine', '101it'] } },
    });

    // Exactly what `app/_layout.tsx`'s prefetch runs.
    await fetchSupportedMarketplaces();

    // The SYNCHRONOUS read the store's lock 2 does is now the server's list.
    expect(supportedNow()).toEqual(['101lab', '101machine', '101it']);

    // ADOPT: 101it is on the warmed list, so the verdict is usable and there is
    // nothing to ask — even with an unreadable nameplate (FIX 1: a photo the
    // server could not read says nothing about the marketplace).
    expect(
      routingNeedsAsk({
        signal: {
          suggestedMarketplace: '101it',
          needsClearerPhoto: true,
          siteTypeConfidence: null,
          siteTypeSource: null,
          categorySource: null,
        },
        supported: supportedNow(),
      }),
    ).toBe(false);

    // ASK: the warmed list now actually GATES the verdict — 101recycle is not on
    // it, so the AI's answer is unusable and the seller is asked. Before the
    // prefetch this same signal could not be distinguished from the cold case.
    expect(
      routingNeedsAsk({
        signal: {
          suggestedMarketplace: '101recycle',
          needsClearerPhoto: false,
          siteTypeConfidence: null,
          siteTypeSource: null,
          categorySource: null,
        },
        supported: supportedNow(),
      }),
    ).toBe(true);
  });

  it('a 404 leaves the cache cold and the app fail-closed (V-8 / G15)', async () => {
    mockGet.mockRejectedValue(Object.assign(new Error('Request failed'), { status: 404 }));
    const list = await fetchSupportedMarketplaces();
    expect(list).toEqual(['101lab']);
    expect(supportedNow()).toEqual(['101lab']);
  });

  it('never rejects, so the fire-and-forget prefetch cannot crash launch', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    await expect(fetchSupportedMarketplaces()).resolves.toBeDefined();
  });
});

describe('blocker (a) — the prefetch is actually wired at launch', () => {
  const layout = () => fs.readFileSync(LAYOUT, 'utf8');

  it('_layout.tsx prefetches the supported list', () => {
    const src = layout();
    expect(src).toContain('queryClient.prefetchQuery');
    expect(src).toContain('queryKey: SUPPORTED_QUERY_KEY');
    expect(src).toContain('queryFn: fetchSupportedMarketplaces');
  });

  it('the prefetch sits in the mount-once effect, before any scan can run', () => {
    const src = layout();
    const effect = src.indexOf('    hydrate();');
    const prefetch = src.indexOf('queryClient.prefetchQuery');
    const effectEnd = src.indexOf('}, [hydrate, reset, router]);');
    expect(effect).toBeGreaterThan(-1);
    expect(prefetch).toBeGreaterThan(effect);
    expect(prefetch).toBeLessThan(effectEnd);
  });

  it('shares ONE query key with the hook', () => {
    expect(SUPPORTED_QUERY_KEY).toEqual(['supportedMarketplaces']);
    expect(layout()).toContain("from '@/features/scanner/routing/supportedMarketplaces'");
  });

  // A staleTime mismatch means RoutingChip's mount immediately refetches what
  // launch just fetched — harmless but wasteful, and a sign the two have drifted.
  it('uses the same staleTime as the hook', () => {
    const staleOf = (src: string) => {
      const m = src.match(/staleTime:\s*30\s*\*\s*60_000/g);
      return m?.length ?? 0;
    };
    expect(staleOf(layout())).toBeGreaterThanOrEqual(1);
    expect(staleOf(fs.readFileSync(HOOK, 'utf8'))).toBeGreaterThanOrEqual(1);
  });
});
