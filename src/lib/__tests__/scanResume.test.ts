import { describe, it, expect } from '@jest/globals';

import { getScanResumeRoute } from '../scanResume';
import { routes } from '../routes';
import type { DraftItem, Photo } from '@/stores/scanDraftStore';
import type { MappedSmartDetection } from '@/features/scanner/smartDetectionTypes';

// Note: SMART_DETECT_ENABLED is read at module load. The fresh-scan branch
// resolves to `scanCamera` (smart-detect on) or `scanListingMethod` (off);
// tests below avoid asserting that exact value and instead use it via the
// inferred `freshScanRoute` semantics — i.e., absence of any resume signal.

const photo = (i: number): Photo => ({ uri: `file://${i}.jpg`, width: 1, height: 1 });

function draft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    photos: [photo(0)],
    ai: null,
    productIds: [],
    title: '',
    description: '',
    categoryId: null,
    categoryName: null,
    condition: [],
    operationStatus: [],
    pricePerUnit: '',
    priceCurrency: 'USD',
    priceFormat: 'buyNow',
    quantity: 1,
    locations: [],
    locationCountries: [],
    documents: [],
    allowedSites: [],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
    // S1 field-model expansion — tests fix a baseline draft, real values come
    // through `overrides`.
    brand: '',
    model: '',
    year: '',
    weight: '',
    dimensions: '',
    co2Emissions: '',
    grade: 'A',
    serialNumber: '',
    marketplace: '101lab',
    installation: 'deinstalled',
    listingDurationDays: 90,
    ...overrides,
  };
}

const stubMapped = {} as MappedSmartDetection;

describe('getScanResumeRoute', () => {
  describe('warm pendingDetection branch', () => {
    it('routes to scanDetection when pendingDetection is set, regardless of other state', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: draft({ lastStep: 'detail', ai: null }),
        pendingDetection: stubMapped,
      });
      expect(route).toBe(routes.scanDetection);
    });

    it('ignores null/undefined pendingDetection', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: null,
        pendingDetection: null,
      });
      // No staged screen anymore — falls through to freshScanRoute (camera or
      // listing-method depending on SMART_DETECT_ENABLED).
      expect(route).not.toBe(routes.scanDetection);
    });
  });

  describe('grouped mode branches', () => {
    it('routes to grouped-review when queue is non-empty and no current draft', () => {
      const route = getScanResumeRoute({
        mode: 'grouped',
        queuedItems: [draft({ id: 'q1' })],
        current: null,
      });
      expect(route).toBe(routes.scanGroupedReview);
    });

    it('routes to detail when grouped current has ai data', () => {
      const route = getScanResumeRoute({
        mode: 'grouped',
        queuedItems: [],
        current: draft({ ai: { name: 'x' } as DraftItem['ai'] }),
      });
      expect(route).toBe(routes.scanDetail);
    });

    it('routes to processing when grouped current is mid-flow without ai', () => {
      const route = getScanResumeRoute({
        mode: 'grouped',
        queuedItems: [],
        current: draft({ lastStep: 'processing', ai: null }),
      });
      expect(route).toBe(routes.scanProcessing);
    });
  });

  describe('single mode branches', () => {
    it('routes to detail when current.lastStep is detail', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: draft({ lastStep: 'detail' }),
      });
      expect(route).toBe(routes.scanDetail);
    });

    it('routes to detail when legacy lastStep is review', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: draft({ lastStep: 'review' }),
      });
      expect(route).toBe(routes.scanDetail);
    });

    it('routes to detail when ai is set (no explicit lastStep)', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: draft({ ai: { name: 'x' } as DraftItem['ai'] }),
      });
      expect(route).toBe(routes.scanDetail);
    });

    it('routes to processing when current is mid-flow without ai', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: draft({ lastStep: 'processing', ai: null }),
      });
      expect(route).toBe(routes.scanProcessing);
    });
  });

  describe('precedence: pendingDetection > current', () => {
    it('pendingDetection wins over current in detail', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: draft({ lastStep: 'detail' }),
        pendingDetection: stubMapped,
      });
      expect(route).toBe(routes.scanDetection);
    });

    it('current wins when no pendingDetection', () => {
      const route = getScanResumeRoute({
        mode: 'single',
        queuedItems: [],
        current: draft({ lastStep: 'processing' }),
      });
      expect(route).toBe(routes.scanProcessing);
    });
  });
});
