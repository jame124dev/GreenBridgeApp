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

/**
 * Smart-detection v2 — SSE streaming transport
 * (Docs/SMART_DETECT_V2_SSE_INTEGRATION_PLAN.md). Orthogonal to
 * `SMART_DETECT_ENABLED`: that one decides *whether* smart-detect runs at all,
 * this one decides *which transport* it uses once it does.
 *
 *   SMART_DETECT_ENABLED=0                        → neither (legacy flow)
 *   SMART_DETECT_ENABLED=1 && this=0 (default)    → v1 blocking POST
 *   SMART_DETECT_ENABLED=1 && this=1              → v2 SSE stream
 *
 * **Opt-in, default OFF.** Set `EXPO_PUBLIC_SMART_DETECT_V2=1` in `.env` and
 * restart Metro. Mirrors the backend's `SMART_DETECT_V2_ENABLED` rollout gate.
 * v1 stays the instant-rollback fallback. (Web always falls back to v1 — the
 * SSE client is native-only; see `smartDetectV2Enabled`.)
 */
export const SMART_DETECT_V2_ENABLED = process.env.EXPO_PUBLIC_SMART_DETECT_V2 === '1';
