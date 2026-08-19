import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// In-memory MMKV, same shape the store suites use (scanDraftStore.test.ts:23-33).
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
  fallbackMarketplaces,
  normalizeSupported,
  readCachedSupported,
  supportedNow,
  writeCachedSupported,
  SUPPORTED_CACHE_KEY,
} from '../supportedMarketplacesCache';

beforeEach(() => {
  (mmkv as unknown as { __store: Map<string, string> }).__store.clear();
});

describe('normalizeSupported', () => {
  it('keeps the app render order regardless of server order', () => {
    expect(normalizeSupported(['101recycle', '101it', '101lab'])).toEqual([
      '101lab',
      '101it',
      '101recycle',
    ]);
  });
  it('drops unknown entries and non-strings', () => {
    expect(normalizeSupported(['101lab', '101tractor', 7, null])).toEqual(['101lab']);
  });
  it('tolerates whitespace and case', () => {
    expect(normalizeSupported([' 101LAB ', '101Machine'])).toEqual(['101lab', '101machine']);
  });
  it('returns [] for a non-array so the caller can fall back', () => {
    expect(normalizeSupported(undefined)).toEqual([]);
    expect(normalizeSupported('101lab')).toEqual([]);
    expect(normalizeSupported({})).toEqual([]);
  });
});

describe('the MMKV cache', () => {
  it('round-trips a written list', () => {
    writeCachedSupported(['101lab', '101machine']);
    expect(readCachedSupported()).toEqual(['101lab', '101machine']);
  });
  it('reads null when nothing was ever written', () => {
    expect(readCachedSupported()).toBeNull();
  });
  it('reads null on malformed JSON instead of throwing', () => {
    mmkv.set(SUPPORTED_CACHE_KEY, '{not json');
    expect(readCachedSupported()).toBeNull();
  });
  it('reads null when the cached list normalises to empty', () => {
    mmkv.set(SUPPORTED_CACHE_KEY, JSON.stringify(['101tractor']));
    expect(readCachedSupported()).toBeNull();
  });
  it('refuses to cache an empty list over a good one', () => {
    writeCachedSupported(['101lab', '101it']);
    writeCachedSupported([]);
    expect(readCachedSupported()).toEqual(['101lab', '101it']);
  });
});

describe('fail-closed', () => {
  // The test env has no expoConfig.extra.SITE_TYPE, so getSiteType() returns
  // its own default 'LabGreenbidz' (buildFormData.ts:290-293).
  it('falls back to exactly one marketplace', () => {
    expect(fallbackMarketplaces()).toEqual(['101lab']);
  });

  // ⛔ blocker (a) — this is the COLD-CACHE state, and it is the reason the
  // `_layout.tsx` prefetch exists. If this returns more than one entry, the
  // prefetch has leaked into a unit test and V-0 will not mean anything.
  it('supportedNow() is one marketplace on a cold cache', () => {
    expect(supportedNow()).toEqual(['101lab']);
  });

  it('supportedNow() prefers the cache once it is warm', () => {
    writeCachedSupported(['101lab', '101machine', '101it']);
    expect(supportedNow()).toEqual(['101lab', '101machine', '101it']);
  });
});
