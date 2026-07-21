/**
 * Task 7: hydrateFromServer action.
 *
 * Loads a server-fetched draft blob (PersistedScan) into live store state so
 * a saved draft can be resumed (Task 9 drafts list will call this).
 *
 * Mirrors the mock setup in scanDraftStore.test.ts: MMKV + persistPhotos are
 * mocked in-memory so persistSession/migrateDraft are safe to exercise.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/services/upload/persistPhotos', () => ({
  persistPhotosForDraft: jest.fn(async (p: unknown) => p),
}));

jest.mock('@/lib/mmkv', () => {
  const s = new Map<string, string>();
  return {
    mmkv: {
      set: (k: string, v: string) => s.set(k, v),
      getString: (k: string) => s.get(k),
      remove: (k: string) => s.delete(k),
    },
  };
});

import { useScanDraft } from '@/stores/scanDraftStore';

beforeEach(() => useScanDraft.getState().reset());

describe('hydrateFromServer', () => {
  it('loads a persisted single-item draft into live state', async () => {
    const blob: any = {
      mode: 'single',
      queuedItems: [],
      current: { id: 'i1', title: 'Centrifuge', photos: [], productIds: [] },
      sessionVisibility: 'public',
      networkSellers: [],
    };
    await useScanDraft.getState().hydrateFromServer(blob);
    expect(useScanDraft.getState().current?.title).toBe('Centrifuge');
    expect(useScanDraft.getState().mode).toBe('single');
  });

  it('resets a stale editingGroupedItem flag from a prior grouped-edit session', async () => {
    // Put the store into a grouped-edit state first.
    const groupedBlob: any = {
      mode: 'grouped',
      queuedItems: [],
      current: { id: 'i0', title: 'Old Grouped Item', photos: [], productIds: [] },
      sessionVisibility: 'public',
      networkSellers: [],
      editingGroupedItem: true,
    };
    await useScanDraft.getState().hydrateFromServer(groupedBlob);
    expect(useScanDraft.getState().editingGroupedItem).toBe(true);

    // Now hydrate a fresh (non-grouped-edit) blob — the stale flag must not survive.
    const blob: any = {
      mode: 'single',
      queuedItems: [],
      current: { id: 'i1', title: 'Centrifuge', photos: [], productIds: [] },
      sessionVisibility: 'public',
      networkSellers: [],
    };
    await useScanDraft.getState().hydrateFromServer(blob);
    expect(useScanDraft.getState().editingGroupedItem).toBe(false);
  });
});
