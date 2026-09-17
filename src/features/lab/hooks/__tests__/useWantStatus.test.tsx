import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';

jest.mock('@/features/lab/data/wtbApi', () => ({
  updateWant: jest.fn(),
}));

import { labKeys } from '@/features/lab/data/labQueryKeys';
import { updateWant } from '@/features/lab/data/wtbApi';
import { queryClient } from '@/lib/queryClient';

import { useWantStatus } from '../useWantStatus';

/** Loosely typed on purpose: `@jest/globals` infers a bare `jest.Mock` as
 *  `never`-argumented, so `mockResolvedValue`/`mockRejectedValue` will not
 *  accept a stub without this. */
const mockUpdate = updateWant as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>;

/**
 * Pause/resume is optimistic, and the ROLLBACK is the half that matters.
 *
 * A want that says "active" while the server still has it paused is worse than
 * one that visibly failed: the person believes the market is being watched for
 * them and it is not. So the test that earns its place is the failure path.
 */

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const WANTS = [
  { id: 11, title: 'Waters HPLC', status: 'paused' },
  { id: 22, title: 'CNC mill', status: 'active' },
];

describe('useWantStatus', () => {
  beforeEach(() => {
    queryClient.clear();
    queryClient.setQueryData(labKeys.wants(), WANTS);
    mockUpdate.mockReset();
  });

  it('flips the row under the finger before the server answers', async () => {
    let release: (v: unknown) => void = () => {};
    mockUpdate.mockImplementation(() => new Promise((r) => (release = r)));

    const { result } = renderHook(() => useWantStatus(), { wrapper });
    act(() => result.current.mutate({ id: 11, status: 'active' }));

    await waitFor(() => {
      const rows = queryClient.getQueryData(labKeys.wants()) as typeof WANTS;
      expect(rows.find((w) => w.id === 11)?.status).toBe('active');
    });
    // Untouched rows stay untouched — the patch is one field on one want.
    const rows = queryClient.getQueryData(labKeys.wants()) as typeof WANTS;
    expect(rows.find((w) => w.id === 22)?.status).toBe('active');

    act(() => release({ id: 11, status: 'active' }));
  });

  it('puts the old list back when the request fails', async () => {
    mockUpdate.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useWantStatus(), { wrapper });
    act(() => result.current.mutate({ id: 11, status: 'active' }));

    await waitFor(() => expect(result.current.isError).toBe(true));

    const rows = queryClient.getQueryData(labKeys.wants()) as typeof WANTS;
    // Back to 'paused'. If this ever reads 'active', the UI is claiming the
    // want is watching when the server says otherwise.
    expect(rows.find((w) => w.id === 11)?.status).toBe('paused');
  });

  it('leaves a non-array cache alone rather than throwing', async () => {
    /*
      The cache is not always the list. A cold open has nothing there, and a
      paginated or wrapped shape would arrive as an object — the optimistic
      updater has to hand back whatever it does not understand instead of
      calling `.map` on it.

      NOTE: `setQueryData(key, undefined)` cannot express "empty" here — in
      React Query v5 an undefined value means "no update", so the previous
      array survives. An object is the honest stand-in for "not a list".
    */
    const notAList = { page: 1, items: [] };
    queryClient.setQueryData(labKeys.wants(), notAList);
    mockUpdate.mockResolvedValue({ id: 11, status: 'active' });

    const { result } = renderHook(() => useWantStatus(), { wrapper });
    act(() => result.current.mutate({ id: 11, status: 'active' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(labKeys.wants())).toEqual(notAList);
  });
});
