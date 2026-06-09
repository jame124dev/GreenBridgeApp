import { SMART_DETECT_V2_ENABLED } from '@/lib/flags';

/**
 * Single home for "should this scan use the v2 SSE transport?" — so a future
 * remote-config / A-B source only touches here.
 *
 * Plain function, NOT a hook: it reads a build-time constant, no React state,
 * so it must not be named `use*` (react-hooks/rules-of-hooks reserves that
 * prefix). Promote to a `useSmartDetectV2Enabled()` hook only if a
 * runtime/remote source later needs to trigger re-renders.
 *
 * Works on web too: `react-native-sse` is XHR-based (NOT fetch), and browsers
 * stream `text/event-stream` incrementally over XHR — so the earlier
 * "web → v1 only" guard (premised on fetch streaming) was unnecessary and has
 * been removed.
 */
export const smartDetectV2Enabled = (): boolean => SMART_DETECT_V2_ENABLED;
