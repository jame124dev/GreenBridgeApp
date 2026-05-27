// Build-time feature flags. `EXPO_PUBLIC_*` env vars are inlined by Expo at
// bundle time, so these are constants — safe to branch on without re-render
// concerns. Set in `.env` (e.g. `EXPO_PUBLIC_SMART_DETECT=1`) and restart Metro.

/**
 * Smart-detection scan flow (Docs/SMART_DETECTION_FLOW.md). When on, the Scan
 * button skips the Single/Grouped picker and goes straight to the camera; fresh
 * single-mode sessions then use `/wp/analyze-smart-detection` (manual grouped
 * keeps `/wp/analyze-process-images`). **On by default** — set
 * `EXPO_PUBLIC_SMART_DETECT=0` in `.env` and restart Metro to fall back to the
 * legacy listing-method flow.
 */
export const SMART_DETECT_ENABLED = process.env.EXPO_PUBLIC_SMART_DETECT !== '0';
