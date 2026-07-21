// src/features/scanner/__tests__/backgroundAffordance.test.ts
import { describe, it, expect } from '@jest/globals';

import { shouldOfferBackground } from '@/features/scanner/backgroundAffordance';
import type { StagePhase } from '@/features/scanner/smartDetectStreamTypes';

const STREAMING_PHASES: StagePhase[] = [
  'validating',
  'preparing_documents',
  'preparing_pdfs',
  'ai_running',
  'extracting_products',
];

describe('shouldOfferBackground (v2 "Continue in background" gate)', () => {
  it('offers the affordance while streaming, flag on, not navigating', () => {
    for (const phase of STREAMING_PHASES) {
      expect(
        shouldOfferBackground({ flagEnabled: true, phase, isNavigating: false }),
      ).toBe(true);
    }
  });

  it('hides the affordance once the stream is done', () => {
    expect(
      shouldOfferBackground({ flagEnabled: true, phase: 'done', isNavigating: false }),
    ).toBe(false);
  });

  it('hides the affordance once we begin navigating to results', () => {
    expect(
      shouldOfferBackground({
        flagEnabled: true,
        phase: 'extracting_products',
        isNavigating: true,
      }),
    ).toBe(false);
  });

  // Flag-off safety: v2 is the DEFAULT screen under SMART_DETECT_V2=1, so a
  // regression here hits the default detect flow. When the background flag is
  // off the button must NEVER render — regardless of phase — which is what
  // keeps `leftInBackgroundRef` false and the unmount abort unchanged.
  it('never offers the affordance when the flag is off', () => {
    for (const phase of [...STREAMING_PHASES, 'done' as StagePhase]) {
      expect(
        shouldOfferBackground({ flagEnabled: false, phase, isNavigating: false }),
      ).toBe(false);
      expect(
        shouldOfferBackground({ flagEnabled: false, phase, isNavigating: true }),
      ).toBe(false);
    }
  });
});
