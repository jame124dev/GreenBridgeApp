// Navigation policy for the marketplace WebViews — which URLs stay inside the
// WebView, which are handed to the OS, and which are refused.
//
// Kept in its own module (no `react-native-webview` import) so it stays a pure,
// unit-testable decision function; the component just applies the verdict.
import { getMarketplaceUrl } from '@/lib/env';

export const MARKETPLACE_URL = getMarketplaceUrl();

// Host of the configured marketplace origin — always kept in-view (covers a
// local dev server like 10.0.2.2:3200 as well as the live site).
export const MARKETPLACE_HOST = (() => {
  try {
    return new URL(MARKETPLACE_URL).hostname.toLowerCase();
  } catch {
    return '';
  }
})();

/** Append `?app=1` (embed flag) to a marketplace path, preserving any query. */
export function marketplaceUri(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const sep = clean.includes('?') ? '&' : '?';
  return `${MARKETPLACE_URL}${clean}${sep}app=1`;
}

// Keep these hosts inside the WebView; everything else (maps, mailto:, tel:,
// linkedin, storage.googleapis.com, payment redirects…) opens in the system
// browser via Linking.
export function isInternalUrl(url: string): boolean {
  try {
    if (url.startsWith('about:')) return true;
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return (
      (MARKETPLACE_HOST && h === MARKETPLACE_HOST) ||
      h === '101lab.co' ||
      h.endsWith('.101lab.co') ||
      h === 'greenbidz.com' ||
      h.endsWith('.greenbidz.com')
    );
  } catch {
    // Unparseable → let the WebView handle it rather than bouncing to the OS.
    return true;
  }
}

// Schemes an IFRAME is allowed to load. These render content in place; none of
// them can launch another app. Anything else (maps:, tel:, mailto:, itms-apps:,
// comgooglemaps:, intent:…) is refused outright for a subframe.
const SUBFRAME_CONTENT_SCHEMES = ['http:', 'https:', 'about:', 'data:', 'blob:', 'file:'];

function isEmbeddableSubframeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return SUBFRAME_CONTENT_SCHEMES.some((s) => u.startsWith(s));
}

/** What to do with one navigation request. `openExternally` is the URL to hand
 *  to the OS, or null to keep everything in-app. */
export type MarketplaceNavDecision = { allow: boolean; openExternally: string | null };

/**
 * Decide one WebView navigation request.
 *
 * THE SUBFRAME RULE IS LOAD-BEARING. iOS asks the host app to approve *every*
 * navigation action, iframes included: WKWebView's
 * `decidePolicyForNavigationAction` always fires `onShouldStartLoadWithRequest`
 * (react-native-webview only applies its `isTopFrame` check to
 * `onLoadingStart`, never to this callback). Android reports the main frame
 * only and does not send `isTopFrame` at all — hence the strict `=== false`,
 * which leaves Android on exactly its previous top-frame behaviour.
 *
 * Treating a subframe like a tapped link is what threw iOS users out of a
 * listing and into Google Maps: the 101 Lab listing page embeds a
 * `maps.google.com` map for the item's location, and that iframe's load was
 * being handed to `Linking.openURL`, which iOS resolves to the Maps app. An
 * iframe is page content, never the user asking to leave the app, so it is
 * either rendered in place or dropped — it is NEVER escalated to the OS.
 *
 * `hasTargetFrame` (iOS: `navigationAction.targetFrame != nil`) separates a
 * real iframe from a `target="_blank"` / `window.open` tap, which iOS can also
 * report with `isTopFrame: false`. A new-window request has no target frame, so
 * it must keep falling through to the external-link rule — that is how the
 * listing's own "Open in Maps" button still works.
 */
export function marketplaceNavDecision(req: {
  url: string;
  isTopFrame?: boolean;
  hasTargetFrame?: boolean;
}): MarketplaceNavDecision {
  if (req.isTopFrame === false && req.hasTargetFrame !== false) {
    return { allow: isEmbeddableSubframeUrl(req.url), openExternally: null };
  }
  if (isInternalUrl(req.url)) return { allow: true, openExternally: null };
  return { allow: false, openExternally: req.url };
}
