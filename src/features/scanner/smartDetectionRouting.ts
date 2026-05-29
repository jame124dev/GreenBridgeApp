import type { MappedSmartDetection } from './smartDetectionTypes';

/**
 * Ported 1:1 from the seller web app
 * (`GreenBridgeSeller/src/pages/new-submission-upload/utils/smartDetectionRouting.ts`),
 * with the input reshaped from `SmartDetectionResponse` → `MappedSmartDetection`.
 * The signals we read (raw `productCount`, raw `suggestedMode`, and the user's
 * `imageCount`) are preserved on `mapped.meta` so the predicate's truth table
 * matches the web's exactly.
 *
 * Truth table (parity with web):
 *   productCount ≤ 1                       → skip (single by default)
 *   imageCount   ≤ 1                       → skip (one photo can't be N products)
 *   suggestedMode='single' && count===1    → skip (kept as a defensive branch
 *                                                 even though it's a subset of
 *                                                 the first rule — matches web)
 *   otherwise                              → show detection
 */
export function shouldSkipDetectionChoice(
  mapped: Pick<MappedSmartDetection, 'meta'>,
  imageCount: number,
): boolean {
  const { productCount, suggestedMode } = mapped.meta;
  if (productCount <= 1) return true;
  if (imageCount <= 1) return true;
  if (suggestedMode === 'single' && productCount === 1) return true;
  return false;
}

/** Companion to the predicate — true when the AI clearly returned >1 product. */
export function isClearlyMultiProduct(
  mapped: Pick<MappedSmartDetection, 'meta'>,
): boolean {
  return mapped.meta.productCount > 1;
}
