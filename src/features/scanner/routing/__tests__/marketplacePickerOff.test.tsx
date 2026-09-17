/**
 * The picker OFF — this build lists to 101lab and never asks.
 *
 * Sibling suite to `useSupportedMarketplaces.test.tsx`, which forces the flag
 * ON to protect the fetch path. This one covers the default, and the two must
 * stay separate: a module-level flag cannot be flipped between tests in one
 * file, and mocking it per-test would test the mock rather than the hook.
 *
 * What matters here is not "the hook returns one item" but the CONSEQUENCE:
 * with one marketplace on offer the shipped routing rule already collapses to
 * "there is no question", so the scan flow shows a settled row instead of a
 * picker. That chain is the actual product behaviour, so it is what is
 * asserted.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';

jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      set: (k: string, v: string) => store.set(k, v),
      getString: (k: string) => store.get(k),
      remove: (k: string) => store.delete(k),
    },
  };
});

/** If the gate leaks, this spy fires and the first test fails loudly. */
const mockFetchSpy = jest.fn(async () => ['101lab', '101machine', '101it']);
jest.mock('../supportedMarketplaces', () => ({
  SUPPORTED_QUERY_KEY: ['supportedMarketplaces'] as const,
  fetchSupportedMarketplaces: () => mockFetchSpy(),
}));

import { useSupportedMarketplaces } from '../useSupportedMarketplaces';
import { routingNeedsAsk } from '../routingState';

const wrap = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

describe('marketplace picker OFF (this build)', () => {
  it('offers only this deployment and never calls the server', () => {
    const { result } = renderHook(() => useSupportedMarketplaces(), { wrapper: wrap() });
    expect(result.current).toEqual(['101lab']);
    // The dev API really does advertise three, so a leaked gate would show up
    // here as a call — this is the assertion that makes the flag meaningful.
    expect(mockFetchSpy).not.toHaveBeenCalled();
  });

  it('collapses the scan flow to NO marketplace question', () => {
    // The consequence that matters. `routingNeedsAsk` is the shipped trigger
    // both the old UI and v2's 7b read; one marketplace means no question,
    // even when the AI suggested a different one.
    expect(
      routingNeedsAsk({
        signal: {
          suggestedMarketplace: '101machine',
          needsClearerPhoto: false,
          siteTypeConfidence: null,
          siteTypeSource: null,
          categorySource: null,
        },
        supported: ['101lab'],
      }),
    ).toBe(false);
  });
});
