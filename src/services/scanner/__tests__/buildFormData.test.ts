import { describe, it, expect } from '@jest/globals';

import { buildProductFormData } from '../buildFormData';
import type { DraftItem, Photo } from '@/stores/scanDraftStore';

// Verifies the GCS-vs-legacy branch in buildProductFormData. We don't try to
// inspect every meta field — those are already exercised by the
// appendSpecsToDescription / mapAnalyze / scanDraftStore suites. The only
// behavior unique to this pair of tests is:
//
//   - WITH `gcs`: NO `images` parts, has `gcs_image_paths[]` per photo,
//     has one `gcs_session_id`.
//   - WITHOUT `gcs`: legacy behavior — `images` parts present.
//
// FormData.getAll/entries isn't directly inspectable in the RN polyfill but
// the React-Native FormData stores _parts as an internal array. In jest's
// node environment we get the standard `FormData` from undici, which exposes
// the standard iterator. Tests use a small `keysFromFormData` helper for both.

function keysFromFormData(fd: FormData): string[] {
  // Standard DOM FormData (jest node env): entries() works.
  const out: string[] = [];
  const iter = (fd as unknown as { entries?: () => Iterable<[string, unknown]> }).entries?.();
  if (iter && typeof (iter as Iterable<[string, unknown]>)[Symbol.iterator] === 'function') {
    for (const [k] of iter) out.push(String(k));
    return out;
  }
  // Fallback for RN polyfill — read internal _parts.
  const parts: unknown[] = (fd as unknown as { _parts?: unknown[] })._parts ?? [];
  for (const p of parts) {
    if (Array.isArray(p)) out.push(String(p[0]));
  }
  return out;
}

function fakePhoto(uri: string): Photo {
  return { uri, width: 100, height: 100 };
}

function fakeDraft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    photos: [],
    ai: null,
    productIds: [],
    title: 'Test product',
    description: 'desc',
    categoryId: null,
    categoryName: null,
    condition: ['usedFunctional'],
    operationStatus: ['deinstalled'],
    pricePerUnit: '100',
    priceCurrency: 'USD',
    priceFormat: 'buyNow',
    quantity: 1,
    locations: ['Taipei'],
    locationCountries: ['Taiwan'],
    documents: [],
    allowedSites: [],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
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
    aiPrices: null,
    ...overrides,
  };
}

const baseOpts = {
  sellerId: 574,
  sellerName: 'Akash Seller',
  siteType: 'LabGreenbidz',
};

describe('buildProductFormData — GCS branch', () => {
  it('without `gcs`: appends `images` parts (legacy multipart path)', async () => {
    const draft = fakeDraft();
    const photos = [fakePhoto('file://a.jpg'), fakePhoto('file://b.jpg')];

    const fd = await buildProductFormData(draft, photos, baseOpts);
    const keys = keysFromFormData(fd);

    const imageCount = keys.filter((k) => k === 'images').length;
    const gcsPathCount = keys.filter((k) => k === 'gcs_image_paths[]').length;
    const gcsSessionCount = keys.filter((k) => k === 'gcs_session_id').length;

    expect(imageCount).toBe(2);
    expect(gcsPathCount).toBe(0);
    expect(gcsSessionCount).toBe(0);
  });

  it('with `gcs`: appends `gcs_image_paths[]` + `gcs_session_id`, NO `images` parts', async () => {
    const draft = fakeDraft();
    const photos = [
      fakePhoto('file://a.jpg'),
      fakePhoto('file://b.jpg'),
      fakePhoto('file://c.jpg'),
    ];
    const gcs = {
      sessionId: 'sess-xyz',
      objectNames: [
        'sellers/574/2026/05/abc/0-a.jpg',
        'sellers/574/2026/05/abc/1-b.jpg',
        'sellers/574/2026/05/abc/2-c.jpg',
      ],
    };

    const fd = await buildProductFormData(draft, photos, baseOpts, gcs);
    const keys = keysFromFormData(fd);

    const imageCount = keys.filter((k) => k === 'images').length;
    const gcsPathCount = keys.filter((k) => k === 'gcs_image_paths[]').length;
    const gcsSessionCount = keys.filter((k) => k === 'gcs_session_id').length;

    expect(imageCount).toBe(0);
    expect(gcsPathCount).toBe(3);
    expect(gcsSessionCount).toBe(1);
  });

  it('with `gcs`: documents are still appended (Wordfence 403 only affects images)', async () => {
    const draft = fakeDraft({
      documents: [
        { uri: 'file://x.pdf', name: 'x.pdf', mimeType: 'application/pdf' },
      ],
    });
    const photos = [fakePhoto('file://a.jpg')];
    const gcs = {
      sessionId: 'sess-xyz',
      objectNames: ['sellers/574/2026/05/abc/0-a.jpg'],
    };

    const fd = await buildProductFormData(draft, photos, baseOpts, gcs);
    const keys = keysFromFormData(fd);
    const docCount = keys.filter((k) => k === 'documents').length;

    expect(docCount).toBe(1);
  });
});
