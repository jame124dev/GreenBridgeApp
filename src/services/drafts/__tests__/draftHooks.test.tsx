/**
 * Task 3 — Draft React Query hooks.
 *
 * This repo's babel/jest setup hoists `jest.mock` factories above the
 * imports, so a bare module-scope `const listDrafts = jest.fn()` closed over
 * by the factory throws an out-of-scope reference error at hoist time. The
 * fix (matching `src/stores/__tests__/scanDraftStore.test.ts`) is to define
 * the `jest.fn()` INSIDE the factory and reach it afterwards via the mocked
 * module namespace (`api.listDrafts as jest.Mock`).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/services/drafts/draftApi', () => ({
  listDrafts: jest.fn(),
}));

import * as api from '@/services/drafts/draftApi';
import { useListDrafts, draftKeys } from '@/services/drafts/draftHooks';

// Explicit generic — same pitfall documented in draftApi.test.ts: the default
// `jest.Mock` (T = UnknownFunction, returning `unknown`) makes
// `mockResolvedValue`'s parameter type `never`. Typing the mock as a function
// returning the shape this test cares about (loosely — `unknown[]` drafts,
// matching the test fixture's partial objects) fixes that.
type ListDraftsMock = jest.Mock<() => Promise<{ drafts: unknown[]; next_cursor: string | null }>>;
const mockListDrafts = api.listDrafts as unknown as ListDraftsMock;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockListDrafts.mockReset();
});

describe('draftHooks', () => {
  it('draftKeys.detail is stable', () => {
    expect(draftKeys.detail('a')).toEqual(['drafts', 'detail', 'a']);
  });

  it('useListDrafts fetches the first page', async () => {
    mockListDrafts.mockResolvedValue({
      drafts: [{ id: 'd1' }],
      next_cursor: null,
    });
    const { result } = renderHook(() => useListDrafts(), { wrapper });
    await waitFor(() => expect(result.current.data?.drafts).toHaveLength(1));
  });
});
