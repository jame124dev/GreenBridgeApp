import type { StagePhase } from './smartDetectStreamTypes';

/**
 * Task 10 — "Continue in background" on the v2 (SSE streaming) processing
 * screen. Pure visibility predicate for the affordance, extracted so the
 * flag-off-safety + in-flight gate can be unit-tested without rendering the
 * whole streaming screen (which pulls the SSE / reanimated / router stack).
 *
 * The button is offered ONLY while the scan is actively streaming (phases
 * `validating` → `extracting_products`) and disappears the instant it goes
 * `done`, the instant we begin navigating to results, and whenever the
 * background-recognition flag is off. Flag-off ⇒ never offered, which — since
 * the button is the only thing that can flip `leftInBackgroundRef` — keeps the
 * screen's unmount abort behaving EXACTLY as it did before the feature.
 */
export function shouldOfferBackground(opts: {
  flagEnabled: boolean;
  phase: StagePhase;
  isNavigating: boolean;
}): boolean {
  return opts.flagEnabled && opts.phase !== 'done' && !opts.isNavigating;
}
