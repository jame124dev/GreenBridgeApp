import { describe, it, expect } from '@jest/globals';

import {
  shouldSkipDetectionChoice,
  isClearlyMultiProduct,
} from '../smartDetectionRouting';
import type { MappedSmartDetection } from '../smartDetectionTypes';

// Synthetic mapper outputs — we only ever read `meta`, so the rest is empty.
function mapped(
  meta: Partial<MappedSmartDetection['meta']>,
): Pick<MappedSmartDetection, 'meta'> {
  return {
    meta: {
      summary: '',
      confidence: 1,
      suggestedMode: 'multiple',
      productCount: 2,
      ...meta,
    },
  };
}

// Test cases mirror the web's `smartDetectionRouting` truth table so that
// "ported 1:1" is checked by code, not just claimed in a comment.

describe('shouldSkipDetectionChoice', () => {
  it('skips when productCount is 0', () => {
    expect(
      shouldSkipDetectionChoice(
        mapped({ productCount: 0, suggestedMode: 'multiple' }),
        10,
      ),
    ).toBe(true);
  });

  it('skips when productCount is 1', () => {
    expect(
      shouldSkipDetectionChoice(
        mapped({ productCount: 1, suggestedMode: 'single' }),
        10,
      ),
    ).toBe(true);
  });

  it('skips when imageCount is 0', () => {
    expect(
      shouldSkipDetectionChoice(
        mapped({ productCount: 5, suggestedMode: 'multiple' }),
        0,
      ),
    ).toBe(true);
  });

  it('skips when imageCount is 1 (single photo can\'t be N products)', () => {
    expect(
      shouldSkipDetectionChoice(
        mapped({ productCount: 5, suggestedMode: 'multiple' }),
        1,
      ),
    ).toBe(true);
  });

  it('shows detection when ambiguous: many photos AND many products', () => {
    expect(
      shouldSkipDetectionChoice(
        mapped({ productCount: 3, suggestedMode: 'multiple' }),
        12,
      ),
    ).toBe(false);
  });

  it('shows detection when AI says single but somehow returned >1 product', () => {
    // Edge case: AI verdict disagrees with payload — surface to user.
    expect(
      shouldSkipDetectionChoice(
        mapped({ productCount: 3, suggestedMode: 'single' }),
        12,
      ),
    ).toBe(false);
  });

  it('skips the historical AI-single+1-product redundant branch', () => {
    // This case is already caught by productCount <= 1; including it for
    // truth-table parity with the web predicate.
    expect(
      shouldSkipDetectionChoice(
        mapped({ productCount: 1, suggestedMode: 'single' }),
        5,
      ),
    ).toBe(true);
  });
});

describe('isClearlyMultiProduct', () => {
  it('true when AI returned more than one product', () => {
    expect(isClearlyMultiProduct(mapped({ productCount: 3 }))).toBe(true);
  });

  it('false at exactly one product', () => {
    expect(isClearlyMultiProduct(mapped({ productCount: 1 }))).toBe(false);
  });

  it('false at zero products', () => {
    expect(isClearlyMultiProduct(mapped({ productCount: 0 }))).toBe(false);
  });
});
