// Follow-up #1 — resuming a background ("pending-ai") draft from "Your drafts".
//
// Locks the CONTRACT of the pure resume mapper the drafts screen calls
// (`mapPendingAiDraft`), so the fix is verifiable without mounting the whole
// scan-store/screen stack. What this must prove:
//   1. it recognizes ONLY the real backend `pending-ai` payload shape
//      (`{ kind, result, imageUrls, mode }`, verified against
//      recognitionRunner.buildPendingAiDraftFields) and returns null for
//      anything else — so the screen degrades gracefully instead of guessing.
//   2. `payload.result` feeds the SAME `mapSmartDetection` transform the live
//      v2 stream uses (so a resumed draft is byte-identical to a fresh scan).
//   3. `sourcePhotos` are the canonical GCS URLs, index-aligned with each
//      product's `image_indexes` — i.e. long enough to cover the largest index
//      so the store's `validateMappedDetection`/`buildPhotoSlices` won't reject.
import { describe, it, expect } from '@jest/globals';
import {
  mapPendingAiDraft,
  pendingAiImageUrls,
  type PendingAiDraftPayload,
} from '@/services/drafts/pendingAiResume';
import { validateMappedDetection } from '@/features/scanner/applySmartDetection';
import type { SmartDetectionResponse } from '@/features/scanner/smartDetectionTypes';

const SITE = '101lab';

const SINGLE_RESULT: SmartDetectionResponse = {
  success: true,
  language: 'en',
  detection: { suggested_mode: 'single', confidence: 0.92, summary: '1 item detected' },
  merged_single: {
    name: 'Centrifuge X100',
    equipment_description: 'A benchtop centrifuge.',
    condition: 'used',
    price: { reselling_price: 1500 },
    product_cat: { id: 42, name: 'Centrifuges' },
  },
  products: [
    {
      id: 'p-1',
      image_indexes: [0, 1, 2],
      document_indexes: [],
      data: {
        name: 'Centrifuge X100',
        equipment_description: 'A benchtop centrifuge.',
        condition: 'used',
        price: { reselling_price: 1500 },
        product_cat: { id: 42, name: 'Centrifuges' },
      },
    },
  ],
  suggested_terms: {},
  image_urls: ['https://gcs/a.jpg', 'https://gcs/b.jpg', 'https://gcs/c.jpg'],
};

const MULTI_RESULT: SmartDetectionResponse = {
  success: true,
  language: 'en',
  detection: { suggested_mode: 'multiple', confidence: 0.6, summary: '2 items detected' },
  merged_single: { name: 'Mixed lot', condition: 'used', price: 2000, product_cat: { id: '', name: '' } },
  products: [
    {
      id: 'p-1',
      image_indexes: [0, 1],
      document_indexes: [],
      data: { name: 'Microscope M9', condition: 'new', product_cat: { id: 5, name: 'Microscopes' } },
    },
    {
      id: 'p-2',
      image_indexes: [2, 3],
      document_indexes: [],
      data: { name: 'Analyzer A2', condition: 'used', product_cat: { id: 6, name: 'Analyzers' } },
    },
  ],
  suggested_terms: {},
  image_urls: ['https://gcs/0.jpg', 'https://gcs/1.jpg', 'https://gcs/2.jpg', 'https://gcs/3.jpg'],
};

/** A pending-ai payload exactly as the backend writes it. */
function backendPayload(
  result: SmartDetectionResponse,
  mode: 'single' | 'multi',
): PendingAiDraftPayload {
  return {
    v: 1,
    kind: 'pending-ai',
    mode,
    language: 'en',
    result,
    imageUrls: result.image_urls,
  };
}

describe('mapPendingAiDraft', () => {
  it('returns null for anything that is not a resumable pending-ai payload', () => {
    expect(mapPendingAiDraft(null, SITE)).toBeNull();
    expect(mapPendingAiDraft(undefined, SITE)).toBeNull();
    expect(mapPendingAiDraft({ kind: 'form-blob', persistedScan: {} }, SITE)).toBeNull();
    expect(mapPendingAiDraft({ kind: 'pending-ai' }, SITE)).toBeNull(); // no result
    // pending-ai with a result but no images to slice against → not resumable.
    expect(
      mapPendingAiDraft({ kind: 'pending-ai', result: { ...SINGLE_RESULT, image_urls: [] } }, SITE),
    ).toBeNull();
  });

  it('maps a single-product pending-ai draft to a single mapped detection', () => {
    const resume = mapPendingAiDraft(backendPayload(SINGLE_RESULT, 'single'), SITE);
    expect(resume).not.toBeNull();
    expect(resume!.mapped.mode).toBe('single');
    expect(resume!.mapped.products[0].fields.title).toBe('Centrifuge X100');
    expect(resume!.sourcePhotos).toHaveLength(3);
    expect(resume!.sourcePhotos[0].uri).toBe('https://gcs/a.jpg');
  });

  it('maps a multi-product pending-ai draft to a grouped mapped detection', () => {
    const resume = mapPendingAiDraft(backendPayload(MULTI_RESULT, 'multi'), SITE);
    expect(resume).not.toBeNull();
    expect(resume!.mapped.mode).toBe('grouped');
    expect(resume!.mapped.products).toHaveLength(2);
    expect(resume!.sourcePhotos).toHaveLength(4);
  });

  it('produces sourcePhotos long enough to satisfy the store validator (index alignment)', () => {
    // The real gate `applySmartDetection` runs first — a misaligned length here
    // would throw at resume time. Prove the mapper never hands back a bundle
    // the store would reject.
    for (const [result, mode] of [
      [SINGLE_RESULT, 'single'],
      [MULTI_RESULT, 'multi'],
    ] as const) {
      const resume = mapPendingAiDraft(backendPayload(result, mode), SITE)!;
      expect(() =>
        validateMappedDetection(resume.mapped, resume.sourcePhotos.length),
      ).not.toThrow();
    }
  });

  it('reconstructs sourcePhotos from imageUrls even when the mapper trims products (single mode)', () => {
    // Single mode slices products to 1, but ALL image_urls must still surface
    // as sourcePhotos so a later "actually multiple" path has every photo.
    const resume = mapPendingAiDraft(backendPayload(SINGLE_RESULT, 'single'), SITE)!;
    expect(resume.sourcePhotos.map((p) => p.uri)).toEqual(SINGLE_RESULT.image_urls);
  });

  it('falls back to the mapper responseImageUrls when top-level imageUrls is absent', () => {
    // A defensively-written draft with result.image_urls but no top-level
    // imageUrls still resumes (both are the same array server-side).
    const payload = { kind: 'pending-ai', mode: 'single', result: SINGLE_RESULT } as const;
    const resume = mapPendingAiDraft(payload, SITE);
    expect(resume).not.toBeNull();
    expect(resume!.sourcePhotos).toHaveLength(3);
  });
});

describe('pendingAiImageUrls', () => {
  it('passes through a plain string[] and drops empties', () => {
    expect(pendingAiImageUrls({ imageUrls: ['https://a', '', 'https://b'] })).toEqual([
      'https://a',
      'https://b',
    ]);
  });

  it('normalizes a defensive {url}[] shape', () => {
    expect(
      pendingAiImageUrls({ imageUrls: [{ url: 'https://a' }, { url: '' }, { url: 'https://b' }] }),
    ).toEqual(['https://a', 'https://b']);
  });

  it('returns [] for a missing / non-array imageUrls', () => {
    expect(pendingAiImageUrls({})).toEqual([]);
    expect(pendingAiImageUrls(null)).toEqual([]);
    expect(pendingAiImageUrls(undefined)).toEqual([]);
  });
});
