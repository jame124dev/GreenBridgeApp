import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/services/upload/persistPhotos', () => ({
  persistPhotosForDraft: jest.fn(async (p: unknown[]) => p),
  persistDocumentsForDraft: jest.fn(async (d: unknown[]) => d),
  verifyDraftPhotos: jest.fn(async () => true),
  verifyDraftDocuments: jest.fn(async () => true),
  verifyScanSessionFiles: jest.fn(async () => true),
}));
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
import { CLEARED_CATEGORY_DRAFT_FIELDS } from '@/features/scanner/routing/routingState';
import { useScanDraft, type MarketplaceKey } from '@/stores/scanDraftStore';

/**
 * The EXACT patch both `onConfirm` call sites build (detail.tsx and
 * grouped-edit.tsx). Kept here as the shared shape so the test and the screens
 * cannot disagree; if you extract it to a helper, import that instead.
 */
const confirmPatch = (marketplace: MarketplaceKey) => ({
  marketplace,
  marketplaceConfirmed: true,
  ...CLEARED_CATEGORY_DRAFT_FIELDS,
});

beforeEach(() => {
  (mmkv as unknown as { __store: Map<string, string> }).__store.clear();
  useScanDraft.getState().reset();
});

describe('blocker (c) — changing the marketplace must not restore the old category', () => {
  it('clears all five category fields in the SAME patch as the marketplace', async () => {
    await useScanDraft.getState().start([{ uri: 'file://0.jpg', width: 1, height: 1 }]);
    useScanDraft.getState().patch({
      marketplace: '101lab',
      categoryId: '5375',
      categoryName: 'Lab Infrastructure & Essentials',
      parentCategoryId: '5371',
      parentCategoryName: 'Lab',
      customSubcategory: 'Acme',
      marketplaceConfirmed: false,
    });
    expect(useScanDraft.getState().current?.categoryId).toBe('5375');

    useScanDraft.getState().patch(confirmPatch('101machine'));

    const cur = useScanDraft.getState().current!;
    expect(cur.marketplace).toBe('101machine');
    expect(cur.marketplaceConfirmed).toBe(true);
    // ⛔ The whole point. A patch carrying only `marketplace` leaves these set,
    // and useDetailController's `reset(draftToFormValues(draft))` effect then
    // writes them back into the form — a lab category id submitted with
    // allowed_sites:['machines'].
    expect(cur.categoryId ?? '').toBe('');
    expect(cur.categoryName ?? '').toBe('');
    expect(cur.parentCategoryId ?? '').toBe('');
    expect(cur.parentCategoryName ?? '').toBe('');
    expect(cur.customSubcategory ?? '').toBe('');
  });

  it('the same patch shape works on the grouped queue (back-out safety)', async () => {
    await useScanDraft.getState().start([{ uri: 'file://0.jpg', width: 1, height: 1 }]);
    useScanDraft.getState().patch({ marketplace: '101lab', categoryId: '5375' });
    useScanDraft.getState().enqueueCurrentItem();

    useScanDraft.getState().patchQueuedItem(0, confirmPatch('101machine'));

    const item = useScanDraft.getState().queuedItems[0];
    expect(item.marketplace).toBe('101machine');
    expect(item.categoryId ?? '').toBe('');
  });

  // The draft-shaped constant must stay indistinguishable from a fresh draft's
  // category state, or "cleared" and "never set" diverge.
  it('the cleared draft shape matches a fresh draft', async () => {
    await useScanDraft.getState().start([{ uri: 'file://0.jpg', width: 1, height: 1 }]);
    const fresh = useScanDraft.getState().current!;
    expect(fresh.categoryId).toBe(CLEARED_CATEGORY_DRAFT_FIELDS.categoryId);
    expect(fresh.categoryName).toBe(CLEARED_CATEGORY_DRAFT_FIELDS.categoryName);
    expect(fresh.parentCategoryId).toBe(CLEARED_CATEGORY_DRAFT_FIELDS.parentCategoryId);
    expect(fresh.parentCategoryName).toBe(CLEARED_CATEGORY_DRAFT_FIELDS.parentCategoryName);
    expect(fresh.customSubcategory).toBe(CLEARED_CATEGORY_DRAFT_FIELDS.customSubcategory);
  });
});
