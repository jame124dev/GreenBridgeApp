/**
 * Phase 0 store smoke tests:
 *  - patchSession no longer launders types through a fake `get` lambda
 *  - setPendingPhotos clears pendingDetection
 *  - start() clears pendingDetection
 *
 * MMKV is mocked in `jest.setup` (jest-expo preset). These tests assert
 * observable store state rather than persisted MMKV payloads.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the on-disk photo persistence so we don't touch the filesystem.
jest.mock('@/services/upload/persistPhotos', () => ({
  persistPhotosForDraft: jest.fn(async (photos: unknown[]) => photos),
  persistDocumentsForDraft: jest.fn(async (docs: unknown[]) => docs),
  verifyDraftPhotos: jest.fn(async () => true),
  verifyDraftDocuments: jest.fn(async () => true),
  verifyScanSessionFiles: jest.fn(async () => true),
}));

// Minimal MMKV in-memory mock so persistSession is safe to call.
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      set: (k: string, v: string) => store.set(k, v),
      getString: (k: string) => store.get(k),
      remove: (k: string) => store.delete(k),
      // M-4 Step 8-8 — exposed so the supported-marketplaces cache can be
      // cleared between tests. Without it the cold-cache test passes or fails
      // depending on file order, which is the worst kind of flake.
      __store: store,
    },
  };
});

import { mmkv } from '@/lib/mmkv';
import { writeCachedSupported } from '@/features/scanner/routing/supportedMarketplacesCache';
import { useScanDraft, type MarketplaceKey } from '../scanDraftStore';
import { mapSmartDetection } from '@/features/scanner/mapSmartDetection';
import type {
  MappedSmartDetection,
  SmartDetectionResponse,
} from '@/features/scanner/smartDetectionTypes';

const photo = (i: number) => ({ uri: `file://${i}.jpg`, width: 1, height: 1 });

beforeEach(() => {
  (mmkv as unknown as { __store: Map<string, string> }).__store.clear();
  useScanDraft.getState().reset();
});

describe('scanDraftStore Phase 0', () => {
  describe('patchSession', () => {
    it('applies the partial to live state', () => {
      useScanDraft.getState().patchSession({ sessionVisibility: 'PRIVATE' });
      expect(useScanDraft.getState().sessionVisibility).toBe('PRIVATE');
    });

    it('updates networkSellers when passed', () => {
      useScanDraft.getState().patchSession({ networkSellers: [1, 2, 3] });
      expect(useScanDraft.getState().networkSellers).toEqual([1, 2, 3]);
    });

    it('preserves unrelated fields', () => {
      useScanDraft.getState().setListingMode('grouped');
      useScanDraft.getState().patchSession({ sessionVisibility: 'PRIVATE' });
      expect(useScanDraft.getState().mode).toBe('grouped');
    });
  });

  describe('pendingDetection clearing', () => {
    const stubMapped = {} as MappedSmartDetection;

    it('clears pendingDetection when setPendingPhotos is called', async () => {
      useScanDraft.getState().setPendingDetection(stubMapped);
      expect(useScanDraft.getState().pendingDetection).toBe(stubMapped);

      await useScanDraft.getState().setPendingPhotos([photo(0)]);
      expect(useScanDraft.getState().pendingDetection).toBeNull();
    });

    it('clears pendingDetection when start() promotes pendingPhotos', async () => {
      useScanDraft.getState().setPendingDetection(stubMapped);
      await useScanDraft.getState().start([photo(0)]);
      expect(useScanDraft.getState().pendingDetection).toBeNull();
      expect(useScanDraft.getState().current).not.toBeNull();
    });

    it('clears pendingDetection when clearPendingPhotos is called', async () => {
      await useScanDraft.getState().setPendingPhotos([photo(0)]);
      useScanDraft.getState().setPendingDetection(stubMapped);
      useScanDraft.getState().clearPendingPhotos();
      expect(useScanDraft.getState().pendingDetection).toBeNull();
      expect(useScanDraft.getState().pendingPhotos).toBeNull();
    });
  });

  describe('debounced patch + sync action race', () => {
    // Reproduces the bug described in Phase 0 review:
    // detail.tsx#onReviewGroup → patch(updated) → prepareGroupedReview().
    // Without flushPendingPatch inside prepareGroupedReview, the debounced
    // write fires later and overwrites MMKV with a stale session.
    it('prepareGroupedReview observes the in-flight patch on current before promoting', async () => {
      await useScanDraft.getState().start([photo(0)]);
      // Pretend the user just typed a title — debounced patch is in flight.
      useScanDraft.getState().patch({ title: 'Final title' });
      useScanDraft.getState().prepareGroupedReview();

      const { queuedItems, current } = useScanDraft.getState();
      expect(current).toBeNull();
      expect(queuedItems).toHaveLength(1);
      // The promoted queue item must carry the latest patched title.
      expect(queuedItems[0].title).toBe('Final title');
    });

    it('enqueueCurrentItem observes the in-flight patch', async () => {
      await useScanDraft.getState().start([photo(0)]);
      useScanDraft.getState().patch({ title: 'Item one' });
      useScanDraft.getState().enqueueCurrentItem();

      const { queuedItems, current } = useScanDraft.getState();
      expect(current).toBeNull();
      expect(queuedItems[0].title).toBe('Item one');
    });

    it('removeQueuedItem after a patch on current does not lose the queue mutation', async () => {
      // Set up two items in the queue + a current with an in-flight patch.
      await useScanDraft.getState().start([photo(0)]);
      useScanDraft.getState().enqueueCurrentItem();
      await useScanDraft.getState().start([photo(1)]);
      useScanDraft.getState().enqueueCurrentItem();
      const [id0] = useScanDraft.getState().queuedItems.map((q) => q.id);

      await useScanDraft.getState().start([photo(2)]);
      useScanDraft.getState().patch({ title: 'still typing' });
      useScanDraft.getState().removeQueuedItem(id0);

      // The remove must persist a session whose queue is length 1; the
      // debounced patch must not later restore the removed entry.
      const queued = useScanDraft.getState().queuedItems;
      expect(queued.length).toBe(1);
      expect(queued.map((q) => q.id)).not.toContain(id0);
    });
  });

  describe('updatePhotos clears stale pendingDetection', () => {
    it('null pendingDetection when current.photos are replaced', async () => {
      await useScanDraft.getState().start([photo(0)]);
      useScanDraft.getState().setPendingDetection({} as MappedSmartDetection);
      await useScanDraft.getState().updatePhotos([photo(1), photo(2)]);
      expect(useScanDraft.getState().pendingDetection).toBeNull();
    });
  });

  describe('applySmartDetection forceMode override', () => {
    // Multi-product AI response; merged_single carries the pooled draft we
    // expect to land in `current` when the user picks Single on detection.
    const MULTI: SmartDetectionResponse = {
      success: true,
      language: 'en',
      detection: { suggested_mode: 'multiple', confidence: 0.5, summary: '2 items' },
      merged_single: {
        name: 'Combined lot',
        equipment_description: 'pooled single listing',
        condition: 'used',
        price: 1500,
      },
      products: [
        {
          id: 'p-1',
          image_indexes: [0],
          document_indexes: [],
          data: { name: 'Item A', equipment_description: 'first', condition: 'new', price: '100' },
        },
        {
          id: 'p-2',
          image_indexes: [1],
          document_indexes: [],
          data: { name: 'Item B', equipment_description: 'second', condition: 'used', price: '200' },
        },
      ],
      suggested_terms: {},
    };

    it('user picks "single" over AI multi → current is the merged-single draft', async () => {
      const mapped = mapSmartDetection(MULTI, 'LabGreenbidz');
      expect(mapped.mode).toBe('grouped');

      await useScanDraft.getState().applySmartDetection(
        mapped,
        [photo(0), photo(1)],
        'single',
      );

      const state = useScanDraft.getState();
      expect(state.mode).toBe('single');
      expect(state.queuedItems).toHaveLength(0);
      expect(state.current?.title).toBe('Combined lot');
      // Pooled photos — NOT just products[0]'s slice.
      expect(state.current?.photos).toHaveLength(2);
    });

    it('user picks "grouped" (matches AI) → queue carries one item per product', async () => {
      const mapped = mapSmartDetection(MULTI, 'LabGreenbidz');

      await useScanDraft.getState().applySmartDetection(
        mapped,
        [photo(0), photo(1)],
        'grouped',
      );

      const state = useScanDraft.getState();
      expect(state.mode).toBe('grouped');
      expect(state.queuedItems).toHaveLength(2);
      expect(state.queuedItems[0].title).toBe('Item A');
      expect(state.queuedItems[1].title).toBe('Item B');
      expect(state.current).toBeNull();
    });

    it('no forceMode → uses mapped.mode (existing behavior unchanged)', async () => {
      const mapped = mapSmartDetection(MULTI, 'LabGreenbidz');

      await useScanDraft.getState().applySmartDetection(
        mapped,
        [photo(0), photo(1)],
      );

      const state = useScanDraft.getState();
      expect(state.mode).toBe('grouped');
      expect(state.queuedItems).toHaveLength(2);
    });

    it('clears pendingDetection on apply', async () => {
      const mapped = mapSmartDetection(MULTI, 'LabGreenbidz');
      useScanDraft.getState().setPendingDetection(mapped);
      await useScanDraft.getState().applySmartDetection(
        mapped,
        [photo(0), photo(1)],
        'grouped',
      );
      expect(useScanDraft.getState().pendingDetection).toBeNull();
    });
  });

  describe('M-4 lock 2 — applySmartDetection adopts the AI marketplace', () => {
    // A minimal two-product response where product 0 is 101it and product 1 is
    // lab, so we can watch the queue take TWO different marketplaces.
    const MIXED: SmartDetectionResponse = {
      success: true,
      language: 'en',
      detection: { suggested_mode: 'multiple', confidence: 0.9, summary: '2 items' },
      merged_single: {
        name: 'ASUS PA279CV', equipment_description: 'monitor', condition: 'used',
        price: '450', site_type: '101it',
      },
      products: [
        {
          id: 'p-0', image_indexes: [0], document_indexes: [],
          data: {
            name: 'ASUS PA279CV', equipment_description: 'monitor', condition: 'used',
            price: '450', site_type: '101it',
            product_cat: { id: '5501', name: 'Monitors' },
          },
        },
        {
          id: 'p-1', image_indexes: [1], document_indexes: [],
          data: {
            name: 'Hsiangtai CN-1050', equipment_description: 'centrifuge', condition: 'used',
            price: '1200', site_type: 'LabGreenbidz',
            product_cat: { id: '5375', name: 'Lab Infrastructure & Essentials' },
          },
        },
      ],
      suggested_terms: {},
    } as unknown as SmartDetectionResponse;

    const machinesItem = (over: Record<string, unknown> = {}) =>
      ({
        success: true,
        language: 'en',
        detection: { suggested_mode: 'single', confidence: 0.9, summary: '1 item' },
        merged_single: {
          name: 'Lincoln welding fixture', equipment_description: 'fixture',
          condition: 'used', price: '900', site_type: 'machines',
          product_cat: { id: '5300', name: 'Boring & Drilling Machines' },
          ...over,
        },
        products: [
          {
            id: 'p-0', image_indexes: [0], document_indexes: [],
            data: {
              name: 'Lincoln welding fixture', equipment_description: 'fixture',
              condition: 'used', price: '900', site_type: 'machines',
              product_cat: { id: '5300', name: 'Boring & Drilling Machines' },
              ...over,
            },
          },
        ],
        suggested_terms: {},
      }) as unknown as SmartDetectionResponse;

    const warm = (list: MarketplaceKey[]) => writeCachedSupported(list);

    // ⛔ THE TEST THIS PHASE EXISTS FOR. Revert lock 2 to
    // `marketplace: marketplaceFromSiteType(getSiteType())` and this goes RED.
    it('takes the AI marketplace per product when the server list allows it', async () => {
      warm(['101lab', '101machine', '101it']);
      const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
      await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');

      const q = useScanDraft.getState().queuedItems;
      expect(q).toHaveLength(2);
      expect(q[0].marketplace).toBe('101it');
      expect(q[1].marketplace).toBe('101lab');
    });

    // ⛔ blocker (a) — the COLD-CACHE hole, as a unit test. With no cache warmed,
    // `supportedNow()` is ['101lab'], so the AI's 101it verdict is discarded AND
    // the draft is stamped confirmed. This PINS that as the fail-closed
    // contract, which is why V-0 (a warm first scan) has to be an on-device
    // check: this is what the release-day bug looks like, and from inside a unit
    // test it is indistinguishable from correct fail-closed behaviour.
    it('falls back to the deployment marketplace and does NOT ask when the cache is cold', async () => {
      const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
      await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');

      const q = useScanDraft.getState().queuedItems;
      expect(q[0].marketplace).toBe('101lab');       // 101it discarded
      expect(q[0].marketplaceConfirmed).toBe(true);  // 1.0.3 behaviour, no chip
    });

    it('keeps the deployment marketplace and ASKS when the AI names a withheld one', async () => {
      warm(['101lab', '101machine']);                // 101it withheld
      const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
      await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');

      const q = useScanDraft.getState().queuedItems;
      expect(q[0].marketplace).toBe('101lab');
      expect(q[0].marketplaceConfirmed).toBe(false); // the chip must ask
      expect(q[1].marketplaceConfirmed).toBe(true);  // lab item is fine
    });

    it('asks when needs_clearer_photo is true, and persists that on the draft', async () => {
      warm(['101lab', '101machine', '101it']);
      const mapped = mapSmartDetection(
        machinesItem({ needs_clearer_photo: true }),
        'LabGreenbidz',
      );
      await useScanDraft.getState().applySmartDetection(mapped, [photo(0)], 'single');

      const cur = useScanDraft.getState().current!;
      expect(cur.needsClearerPhoto).toBe(true);
      expect(cur.marketplaceConfirmed).toBe(false);
    });

    // ⛔ §0.5 OWNER DECISION — APPROVED 2026-08-18. A machines-routed item must
    // NOT arrive carrying "Boring & Drilling Machines" as though the seller had
    // picked it. Note the AI's id IS valid for the machines tree, so
    // CategoryConditionCard would never clear it — the clear has to happen in
    // the store.
    it('clears the AI category on a machines-routed item', async () => {
      warm(['101lab', '101machine', '101it']);
      const mapped = mapSmartDetection(machinesItem(), 'LabGreenbidz');
      expect(mapped.products[0].fields.categoryId).toBe('5300');   // the AI DID send one

      await useScanDraft.getState().applySmartDetection(mapped, [photo(0)], 'single');

      const cur = useScanDraft.getState().current!;
      expect(cur.marketplace).toBe('101machine');
      expect(cur.categoryId ?? '').toBe('');
      expect(cur.categoryName ?? '').toBe('');
      expect(cur.parentCategoryId ?? '').toBe('');
      expect(cur.customSubcategory ?? '').toBe('');
    });

    it('keeps the AI category on a lab-routed item', async () => {
      warm(['101lab', '101machine', '101it']);
      const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
      await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');
      expect(useScanDraft.getState().queuedItems[1].categoryId).toBe('5375');
    });
  });

  // demoteCurrentToPending was removed in Phase 9 when the staged screen was
  // deleted — detection Back now resets the session instead of demoting.
});
