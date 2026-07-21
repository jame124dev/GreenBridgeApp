// Background marketplace WebView prewarm — decision + once-per-session guard
// (Approach A, see MARKETPLACE_PREWARM_ENABLED). Kept as a pure module so the
// gating logic is unit-testable without a WebView; the actual hidden WebView
// lives in MarketplacePrewarm.tsx.
import { MARKETPLACE_PREWARM_ENABLED } from '@/lib/flags';

// Session-scoped guard: warm at most once per app process. Module state outlives
// component mounts, so navigating in and out of the (lab) group (which re-mounts
// the layout) doesn't re-spawn the warmer.
let hasWarmed = false;

/**
 * Should we mount the hidden warmer now? True only when the flag is enabled, the
 * user is authed (so the warmed page + cache reflect the buyer's real session),
 * and we haven't already warmed this session. `enabled` defaults to the build
 * flag but is overridable so the decision can be exercised in tests.
 */
export function shouldPrewarm({
  authed,
  enabled = MARKETPLACE_PREWARM_ENABLED,
}: {
  authed: boolean;
  enabled?: boolean;
}): boolean {
  return enabled && authed && !hasWarmed;
}

/**
 * Mark the session warmed. Called once, the moment we commit to warming — so a
 * failed load (offline) or a layout re-mount never triggers a second attempt.
 * Approach A is best-effort: a miss just means the visible screen loads cold, as
 * it did before.
 */
export function markWarmed(): void {
  hasWarmed = true;
}

/** Test-only: reset the session guard between cases. */
export function resetPrewarmForTest(): void {
  hasWarmed = false;
}
