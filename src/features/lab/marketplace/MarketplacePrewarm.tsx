// Hidden background warmer for the buyer-marketplace WebView (Approach A, see
// MARKETPLACE_PREWARM_ENABLED). Mounted once by the (lab) layout: after the first
// screen settles it loads `/buyer-marketplace?app=1` in an off-screen 1×1 WebView
// with the native session injected (the same auth handoff as the visible
// MarketplaceWebView), then tears itself down once the page has loaded.
//
// Why: each visible marketplace WebView (Browse tab, product-detail from a chat
// card) is a fresh, isolated instance. Warming here pays the one-time WebView
// renderer-process spawn AND fills the app-shared HTTP cache (Next.js immutable
// JS/CSS/font chunks) + session cookie, so those visible instances skip the
// cold-engine spawn and the bundle download and reach first paint faster. It does
// NOT pre-hydrate the SPA for them — separate contexts can't share a live DOM;
// that would need a single persistent instance (the deferred "Approach B").
//
// Gated by MARKETPLACE_PREWARM_ENABLED + auth + a once-per-session guard (see
// prewarm.ts). Renders null when it shouldn't warm or once it's done.
import { useEffect, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { getMarketplaceUrl } from '@/lib/env';
import { useAuth } from '@/stores/authStore';
import { marketplaceUri } from './MarketplaceWebView';
import { buildInjectedAuthJS } from './webAuthBridge';
import { markWarmed, shouldPrewarm } from './prewarm';

const MARKETPLACE_URL = getMarketplaceUrl();

// Dev-only lifecycle trace (stripped in release). The warmer is invisible, so
// this is the only way to observe it firing — via Metro / `adb logcat ReactNativeJS`.
const trace = (msg: string) => {
  if (__DEV__) console.log('[prewarm]', msg);
};

// Linger after `onLoadEnd` before tearing down, so the SPA's async JS chunks +
// first data actually finish downloading into the shared cache — `onLoadEnd`
// fires on the top document, before those fetches settle.
const PREWARM_LINGER_MS = 6000;
// Hard cap: if the page never loads (offline / slow), stop and free the WebView
// rather than holding a stuck hidden instance.
const PREWARM_HARD_CAP_MS = 20000;

// Off-screen, invisible, non-interactive — a 1×1 opacity-0 view still renders (so
// the WebView actually loads) but is inert. A 0-size view can be skipped by the
// platform and never load, which would defeat the warm.
const HIDDEN_WRAP = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  top: 0,
  left: 0,
  opacity: 0,
  zIndex: -1,
};

export function MarketplacePrewarm() {
  const authed = useAuth((s) => s.isAuthed());
  const hydrated = useAuth((s) => s.hydrated);

  const [start, setStart] = useState(false);
  const [injectedJs, setInjectedJs] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const startedRef = useRef(false);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide once, after auth has hydrated. Defer the actual start until
  // interactions settle so the warm never competes with the first screen's paint.
  useEffect(() => {
    if (startedRef.current || done) return;
    if (!hydrated || !authed) return;
    if (!shouldPrewarm({ authed })) return;
    startedRef.current = true;
    markWarmed(); // commit now → never a second attempt this session
    const task = InteractionManager.runAfterInteractions(() => {
      trace(`start → ${marketplaceUri('/buyer-marketplace')}`);
      setStart(true);
    });
    return () => task.cancel();
  }, [hydrated, authed, done]);

  // Build the auth-injection JS only once we've committed to starting.
  useEffect(() => {
    if (!start) return;
    let alive = true;
    buildInjectedAuthJS().then((js) => {
      if (alive) setInjectedJs(js);
    });
    return () => {
      alive = false;
    };
  }, [start]);

  // Hard cap + timer cleanup.
  useEffect(() => {
    if (!start) return;
    const cap = setTimeout(() => setDone(true), PREWARM_HARD_CAP_MS);
    return () => {
      clearTimeout(cap);
      if (lingerRef.current) clearTimeout(lingerRef.current);
    };
  }, [start]);

  // Only keep same-origin top-level navigations inside the warmer; never hand a
  // hidden WebView off to the system browser (no Linking here, unlike the visible
  // WebView). Sub-resource fetches (chunks/data) aren't navigations, so they load
  // regardless of this gate.
  const onShouldStart = (req: ShouldStartLoadRequest): boolean => {
    const url = req.url || '';
    return url.startsWith('about:') || url.startsWith(MARKETPLACE_URL);
  };

  if (!start || !injectedJs || done) return null;

  return (
    <View
      style={HIDDEN_WRAP}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <WebView
        source={{ uri: marketplaceUri('/buyer-marketplace') }}
        applicationNameForUserAgent="GreenBridgeApp"
        injectedJavaScriptBeforeContentLoaded={injectedJs}
        cacheEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        incognito={false}
        originWhitelist={[MARKETPLACE_URL, 'https://101lab.co', 'https://*.greenbidz.com']}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={onShouldStart}
        onLoadEnd={() => {
          if (lingerRef.current) return;
          trace(`loadEnd → cache warming, teardown in ${PREWARM_LINGER_MS}ms`);
          lingerRef.current = setTimeout(() => {
            trace('done → torn down (warm)');
            setDone(true);
          }, PREWARM_LINGER_MS);
        }}
        onError={() => {
          trace('error → torn down (no warm)');
          setDone(true);
        }}
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
}
