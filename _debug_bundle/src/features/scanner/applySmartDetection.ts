import type { Photo } from '@/stores/scanDraftStore';

import type { MappedSmartDetection } from './smartDetectionTypes';

/** Thrown when mapped smart-detection output cannot be applied to the draft store. */
export class SmartDetectionApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmartDetectionApplyError';
  }
}

/**
 * Slice `source` by global file indexes (deduped, in index order).
 * Drops negative, non-integer, and out-of-range indexes.
 */
export function slicePhotosByIndexes(source: Photo[], imageIndexes: number[]): Photo[] {
  const seen = new Set<number>();
  const out: Photo[] = [];
  for (const i of imageIndexes) {
    if (!Number.isInteger(i) || i < 0 || i >= source.length || seen.has(i)) continue;
    seen.add(i);
    out.push(source[i]);
  }
  return out;
}

/**
 * Build one photo array per detected product. Unassigned source photos (indexes
 * never referenced) are appended to the first group — mirrors backend orphan
 * attachment to product 0.
 */
export function buildPhotoSlices(
  source: Photo[],
  perProductIndexes: number[][],
): { slices: Photo[][]; orphanCount: number } {
  const assigned = new Set<number>();
  const slices: Photo[][] = [];

  for (const indexes of perProductIndexes) {
    const photos: Photo[] = [];
    const seen = new Set<number>();
    for (const i of indexes) {
      if (!Number.isInteger(i) || i < 0 || i >= source.length || seen.has(i)) continue;
      seen.add(i);
      assigned.add(i);
      photos.push(source[i]);
    }
    slices.push(photos);
  }

  const orphans: Photo[] = [];
  for (let i = 0; i < source.length; i++) {
    if (!assigned.has(i)) orphans.push(source[i]);
  }
  if (orphans.length > 0 && slices.length > 0) {
    slices[0] = [...slices[0], ...orphans];
  } else if (orphans.length > 0 && slices.length === 0) {
    slices.push(orphans);
  }

  return { slices, orphanCount: orphans.length };
}

export function validateMappedDetection(
  mapped: MappedSmartDetection,
  sourcePhotoCount: number,
): void {
  if (sourcePhotoCount === 0) {
    throw new SmartDetectionApplyError('No photos to apply smart detection to');
  }
  if (mapped.products.length === 0) {
    throw new SmartDetectionApplyError('Smart detection returned no products');
  }
}
