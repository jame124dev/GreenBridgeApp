/**
 * The Matches tab used to render a hardcoded `STATIC_BADGES.matches = 3`
 * (tabConfig.ts), so a brand-new reviewer account with zero wants still showed
 * an orange "3". These lock in the two properties that made it a P1: the count
 * comes from the signed-in buyer's own data, and an empty account shows nothing.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// MMKV is a Nitro native module and cannot load under Jest (authStore imports it).
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, unknown>();
  return {
    mmkv: {
      set: (k: string, v: unknown) => store.set(k, v),
      getString: (k: string) => store.get(k) as string | undefined,
      getBoolean: (k: string) => store.get(k) as boolean | undefined,
      getNumber: (k: string) => store.get(k) as number | undefined,
      remove: (k: string) => store.delete(k),
    },
  };
});
// WTB is ON in every shipping profile (eas.json); the flag is build-time so it
// has to be forced here rather than set from a test.
jest.mock('@/lib/flags', () => ({ ...jest.requireActual('@/lib/flags'), WTB_ENABLED: true }));
jest.mock('@/features/lab/data/wtbApi', () => ({
  listWants: jest.fn(),
  listWantMatches: jest.fn(),
}));

import { listWants, listWantMatches } from '@/features/lab/data/wtbApi';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { useAuth } from '@/stores/authStore';
import { useMatchesBadgeCount } from '../useMatchesBadge';

const mockListWants = listWants as jest.MockedFunction<typeof listWants>;
const mockListWantMatches = listWantMatches as jest.MockedFunction<typeof listWantMatches>;

/** A want row — only `id`/`status` matter to the badge. */
const want = (id: number, status?: string) => ({ id, title: `want ${id}`, status }) as never;
/** `n` match rows for a want; only the row COUNT matters to the badge. */
const matches = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i })) as never;

// One client per test (built in beforeEach, NOT inside the wrapper — a client
// constructed during render would be thrown away on every re-render).
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client }, children);

const signIn = () =>
  useAuth.getState().setProfile({ id: 7, email: 'a@b.com', name: 'A', role: 'buyer', company: null });

describe('useMatchesBadgeCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.getState().reset();
    // gcTime 0 so no settled query holds Jest open.
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  afterEach(() => {
    client.clear();
  });

  it('is 0 for a fresh account with no wants — and never fetches per-want matches', async () => {
    signIn();
    mockListWants.mockResolvedValue([]);

    const { result } = renderHook(() => useMatchesBadgeCount(), { wrapper });

    // Nothing optimistic on the first frame either: the badge must not flash.
    expect(result.current).toBe(0);
    await waitFor(() => expect(client.getQueryData(labKeys.wants())).toEqual([]));
    expect(result.current).toBe(0);
    expect(mockListWantMatches).not.toHaveBeenCalled();
  });

  it('sums matches across ACTIVE wants and ignores paused ones', async () => {
    signIn();
    mockListWants.mockResolvedValue([want(1, 'active'), want(2), want(3, 'paused')]);
    mockListWantMatches.mockImplementation(async (id: number) =>
      id === 1 ? matches(2) : id === 2 ? matches(1) : matches(5),
    );

    const { result } = renderHook(() => useMatchesBadgeCount(), { wrapper });

    // 2 + 1; want 3 is paused ("stop alerting me") so its 5 must not appear.
    await waitFor(() => expect(result.current).toBe(3));
    expect(mockListWantMatches).not.toHaveBeenCalledWith(3);
  });

  it('is 0 when signed out, so no account inherits another account’s number', async () => {
    mockListWants.mockResolvedValue([want(1, 'active')]);
    mockListWantMatches.mockResolvedValue(matches(4));

    const { result } = renderHook(() => useMatchesBadgeCount(), { wrapper });

    await waitFor(() => expect(client.getQueryData(labKeys.wants())).toHaveLength(1));
    expect(result.current).toBe(0);
    expect(mockListWantMatches).not.toHaveBeenCalled();
  });
});
