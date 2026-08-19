import { describe, it, expect, afterEach, beforeEach, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
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
      __store: store,
    },
  };
});

// Mock the TRANSPORT module, not axios: that keeps this suite off the
// greenbidzClient -> interceptors -> logout -> socket graph entirely.
const mockFetchSpy = jest.fn(async () => ['101lab', '101machine', '101it']);
jest.mock('../supportedMarketplaces', () => ({
  SUPPORTED_QUERY_KEY: ['supportedMarketplaces'] as const,
  fetchSupportedMarketplaces: () => mockFetchSpy(),
}));

import { useSupportedMarketplaces } from '../useSupportedMarketplaces';

/**
 * One client per test, torn down in `afterEach`. Without the teardown the
 * client's gc timers keep the jest worker alive and the suite never exits —
 * observed, not theorised.
 */
let client: QueryClient;

const wrap = () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  mockFetchSpy.mockClear();
});

afterEach(() => {
  client?.clear();
  client?.unmount();
});

describe('useSupportedMarketplaces', () => {
  // ⛔ blocker (b). With `initialData` + staleTime 30min this assertion FAILS:
  // React Query v5 stamps initialData `dataUpdatedAt = Date.now()`
  // (query-core query.js:434/:438), the query is fresh on mount and queryFn is
  // never called. If someone reverts to `initialData`, this test goes red.
  it('FETCHES on mount even though it has a synchronous first value', async () => {
    const { result, unmount } = renderHook(() => useSupportedMarketplaces(), {
      wrapper: wrap(),
    });
    // Synchronous first render: the fail-closed list, no loading state.
    expect(result.current).toEqual(['101lab']);
    // ...and the fetch really fires.
    await waitFor(() => expect(mockFetchSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual(['101lab', '101machine', '101it']));
    unmount();
  });

  it('never returns an empty list', async () => {
    mockFetchSpy.mockImplementationOnce(async () => []);
    const { result, unmount } = renderHook(() => useSupportedMarketplaces(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(mockFetchSpy).toHaveBeenCalled());
    expect(result.current.length).toBeGreaterThan(0);
    unmount();
  });
});
