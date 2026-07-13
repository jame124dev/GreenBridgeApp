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

/**
 * Build-time user-type fork. Selects which app the bundle targets: the seller
 * dashboard (default) or the new customer app. Set `EXPO_PUBLIC_USER_TYPE` to
 * `customer` in `.env` and restart Metro; any other value (or unset) is seller.
 * Routing off this flag is the Shell phase — this module only reads it.
 */
export const USER_TYPE = (process.env.EXPO_PUBLIC_USER_TYPE === 'customer' ? 'customer' : 'seller') as 'seller' | 'customer';
export const IS_CUSTOMER = USER_TYPE === 'customer';

/**
 * (lab) customer-app dynamic flags (NewVersion/dynamic/06-roadmap-risks.md §4).
 * All **opt-in, default OFF** — with a flag off the corresponding surface reads
 * the static `demo.ts` path exactly as the Phase-1 build (no half-wired states).
 * Build-time `EXPO_PUBLIC_*`, inlined by Expo → a Metro restart applies a change,
 * not a hot-reload. **Client flag ⊆ backend flag:** never turn one ON before its
 * backend counterpart is enabled on the target env, or the endpoint 404s.
 */

/** P1 streaming composer/Processing → ASSISTANT `POST /chat/stream`. Default OFF. */
export const LAB_CHAT_ENABLED = process.env.EXPO_PUBLIC_LAB_CHAT === '1';

/** P3 Want-To-Buy save/list/matches. Backend counterpart: `wtb_enabled`. Default OFF. */
export const WTB_ENABLED = process.env.EXPO_PUBLIC_WTB === '1';

/** P2 attachment turns → ASSISTANT `POST /detect/stream`. Backend: `detect_stream_enabled`. Default OFF. */
export const DETECT_STREAM_ENABLED = process.env.EXPO_PUBLIC_DETECT_STREAM === '1';
