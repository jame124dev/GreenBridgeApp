// Shared 101 Lab marketplace WebView — the buyer marketplace rendered inside a
// WebView with the native session handed over via localStorage (see
// webAuthBridge.ts). Both the Browse tab (`/buyer-marketplace`) and the pushed
// product-detail screen (`/buyer-marketplace/:batchId`) render THIS component so
// the auth bridge, the WEB↔NATIVE "message seller" contract, back-navigation,
// and the loading/error surfaces stay identical across both.
//
// The web detects the embed via the `applicationNameForUserAgent` UA suffix AND
// the `?app=1` query param, then strips its own header/footer and defers
// "message seller" to the native chat.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  WebViewNavigation,
  ShouldStartLoadRequest,
} from 'react-native-webview/lib/WebViewTypes';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshCw, WifiOff } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { getMarketplaceUrl } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { registerMarketplaceAuthClear } from '@/lib/marketplaceWebView';
import {
  buildAuthPayload,
  buildClearAuthCall,
  buildInjectedAuthJS,
  buildSetAuthCall,
} from './webAuthBridge';

const MARKETPLACE_URL = getMarketplaceUrl();

// Host of the configured marketplace origin — always kept in-view (covers a
// local dev server like 10.0.2.2:3200 as well as the live site).
const MARKETPLACE_HOST = (() => {
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
function isInternalUrl(url: string): boolean {
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

type WebEvent =
  | { type: 'message-seller'; batchId: number; sellerId: number | string; sellerName?: string }
  | { type: 'auth-expired' }
  | { type: 'ready' };

export type MarketplaceWebViewHandle = { reload: () => void };

type Props = {
  /** Marketplace path to load, e.g. `/buyer-marketplace` or `/buyer-marketplace/123`. */
  path: string;
  /** Space to reserve at the bottom for an absolute tab bar (0 on pushed screens). */
  bottomInset?: number;
  /** Register the auth-clear callback (only the persistent Browse tab should). */
  registerAuthClear?: boolean;
  /**
   * Hide the web's own site header (`<header class="z-50">`). The detail page
   * (ListingDetail) keeps its header by design "for consistent navigation", but
   * inside a pushed native screen we ALREADY render a native header — the web
   * one is redundant chrome. Browse leaves this off so its compact web header
   * stays. Injected before first paint so there's no header flash.
   */
  hideSiteHeader?: boolean;
};

/** CSS injector — hides the web's own site chrome (top `<header class="z-50">`
 *  nav + bottom `<footer class="bg-foreground">`) so a listing opened inside a
 *  pushed native screen reads as a clean product page under our native header,
 *  not the full site. Runs via `injectedJavaScript` (AFTER the document loads, so
 *  document.head is guaranteed — appending to a bare <html> before content isn't
 *  honored) and re-adds on DOMContentLoaded as a belt-and-suspenders for slow
 *  paints. The style node persists across the SPA's client-side navigation. */
function buildHideHeaderJS(): string {
  return `(function(){try{
    function add(){
      if(document.getElementById('gb-hide-chrome'))return;
      var s=document.createElement('style');
      s.id='gb-hide-chrome';
      s.textContent='header.z-50,footer.bg-foreground{display:none!important;}';
      (document.head||document.body||document.documentElement).appendChild(s);
    }
    add();
    document.addEventListener('DOMContentLoaded',add);
  }catch(e){}})();
true;`;
}

/**
 * The marketplace WebView with the native-session bridge. Loads
 * `marketplaceUri(path)`, injects the auth keys before first paint, re-injects a
 * fresh session on focus, bridges "message seller" to the native deal thread,
 * and renders the skeleton / offline surfaces.
 */
export const MarketplaceWebView = forwardRef<MarketplaceWebViewHandle, Props>(
  function MarketplaceWebView(
    { path, bottomInset = 0, registerAuthClear = false, hideSiteHeader = false },
    ref,
  ) {
    const router = useRouter();
    const { t } = useTranslation();

    const webRef = useRef<WebView>(null);
    const canGoBackRef = useRef(false);
    const authRetriesRef = useRef(0);

    // Gate the WebView mount until the async auth read resolves, so the token is
    // present in localStorage at inject time.
    const [injectedJs, setInjectedJs] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [errored, setErrored] = useState(false);

    useEffect(() => {
      let alive = true;
      buildInjectedAuthJS().then((js) => {
        if (alive) setInjectedJs(js);
      });
      return () => {
        alive = false;
      };
    }, []);

    // Re-inject a fresh session on every focus (token may have refreshed while
    // the screen was backgrounded).
    useFocusEffect(
      useCallback(() => {
        let alive = true;
        buildAuthPayload().then((payload) => {
          if (alive) webRef.current?.injectJavaScript(buildSetAuthCall(payload));
        });
        return () => {
          alive = false;
        };
      }, []),
    );

    // Let the logout flow clear the web session in this WebView while mounted.
    // Only the persistent Browse tab registers — a pushed screen registering
    // would clobber the tab's callback on pop (the registry holds one fn).
    useEffect(() => {
      if (!registerAuthClear) return;
      registerMarketplaceAuthClear(() => webRef.current?.injectJavaScript(buildClearAuthCall()));
      return () => registerMarketplaceAuthClear(null);
    }, [registerAuthClear]);

    // Android hardware back → navigate WebView history before leaving the screen.
    useEffect(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBackRef.current) {
          webRef.current?.goBack();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, []);

    const reload = useCallback(() => {
      haptics.tap();
      authRetriesRef.current = 0;
      setErrored(false);
      setLoading(true);
      webRef.current?.reload();
    }, []);

    useImperativeHandle(ref, () => ({ reload }), [reload]);

    const onShouldStartLoadWithRequest = useCallback((req: ShouldStartLoadRequest): boolean => {
      if (isInternalUrl(req.url)) return true;
      Linking.openURL(req.url).catch(() => {});
      return false;
    }, []);

    const onMessage = useCallback(
      (e: WebViewMessageEvent) => {
        let evt: WebEvent;
        try {
          evt = JSON.parse(e.nativeEvent.data) as WebEvent;
        } catch {
          return;
        }
        if (!evt || typeof evt.type !== 'string') return;

        switch (evt.type) {
          case 'message-seller': {
            const { batchId, sellerId, sellerName } = evt;
            if (batchId == null || sellerId == null) return;
            haptics.tap();
            router.push({
              pathname: '/(lab)/deal/[id]',
              params: {
                id: String(batchId),
                sellerId: String(sellerId),
                name: sellerName ?? '',
              },
            });
            break;
          }
          case 'auth-expired': {
            authRetriesRef.current += 1;
            if (authRetriesRef.current > 2) {
              // Fresh token isn't fixing it — bounce to native login.
              authRetriesRef.current = 0;
              router.replace('/(auth)/login');
              return;
            }
            buildAuthPayload().then((payload) => {
              webRef.current?.injectJavaScript(buildSetAuthCall(payload));
            });
            break;
          }
          case 'ready': {
            setLoading(false);
            break;
          }
        }
      },
      [router],
    );

    const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
      canGoBackRef.current = nav.canGoBack;
    }, []);

    return (
      <View style={styles.webWrap}>
        {injectedJs && !errored ? (
          <WebView
            ref={webRef}
            source={{ uri: marketplaceUri(path) }}
            applicationNameForUserAgent="GreenBridgeApp"
            injectedJavaScriptBeforeContentLoaded={injectedJs}
            injectedJavaScript={hideSiteHeader ? buildHideHeaderJS() : undefined}
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            originWhitelist={[MARKETPLACE_URL, 'https://101lab.co', 'https://*.greenbidz.com']}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onMessage={onMessage}
            onNavigationStateChange={onNavigationStateChange}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setErrored(true);
            }}
            onHttpError={(e) => {
              // 5xx on the top document → treat as an error surface.
              if (e.nativeEvent.statusCode >= 500) {
                setLoading(false);
                setErrored(true);
              }
            }}
            // iOS honors `contentInset`; Android does NOT, so there the last
            // product row scrolled under the floating tab bar. Shrink the
            // WebView by the inset on Android so its content clears the bar.
            style={[styles.web, Platform.OS === 'android' && bottomInset ? { marginBottom: bottomInset } : null]}
            contentInset={{ bottom: bottomInset }}
          />
        ) : null}

        {/* Card-grid skeleton — shown until first paint / onLoadEnd. */}
        {loading && !errored ? (
          <View style={[styles.overlay, { paddingBottom: bottomInset }]} pointerEvents="none">
            <SkeletonGrid />
          </View>
        ) : null}

        {/* Error / offline state. */}
        {errored ? (
          <View style={[styles.overlay, styles.errorState, { paddingBottom: bottomInset }]}>
            <View style={styles.errorIcon}>
              <WifiOff size={26} color={brand.textMuted} strokeWidth={2} />
            </View>
            <Text style={styles.errorTitle}>{t('mobile.labBrowse.errorTitle')}</Text>
            <Text style={styles.errorBody}>{t('mobile.labBrowse.errorBody')}</Text>
            <Pressable
              onPress={reload}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.labCommon.retry')}
              style={styles.retryBtn}
            >
              <RefreshCw size={16} color={brand.primaryForeground} strokeWidth={2.4} />
              <Text style={styles.retryText}>{t('mobile.labCommon.retry')}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  },
);

// Rough two-column card grid so the loading state mirrors the marketplace's
// product feed rather than a bare spinner.
function SkeletonGrid() {
  const cards = Array.from({ length: 6 });
  return (
    <View style={styles.skelWrap}>
      <View style={styles.skelSearch} />
      <View style={styles.skelChips}>
        <View style={[styles.skelChip, { width: 64 }]} />
        <View style={[styles.skelChip, { width: 88 }]} />
        <View style={[styles.skelChip, { width: 72 }]} />
      </View>
      <View style={styles.skelGrid}>
        {cards.map((_, i) => (
          <View key={i} style={styles.skelCard}>
            <View style={styles.skelThumb} />
            <View style={[styles.skelLine, { width: '82%' }]} />
            <View style={[styles.skelLine, { width: '56%' }]} />
            <View style={[styles.skelLine, styles.skelPrice, { width: '40%' }]} />
          </View>
        ))}
      </View>
      <View style={styles.skelSpinner}>
        <ActivityIndicator size="small" color={brand.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrap: { flex: 1, position: 'relative' },
  web: { flex: 1, backgroundColor: lab.bg },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: lab.bg,
  },

  // Skeleton
  skelWrap: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  skelSearch: { height: 44, borderRadius: radius.md, backgroundColor: '#E7ECE8' },
  skelChips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  skelChip: { height: 30, borderRadius: radius.full, backgroundColor: '#EBF0EC' },
  skelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    rowGap: spacing.md,
  },
  skelCard: {
    width: '48%',
    borderRadius: radius.lg,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: lab.hairline,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  skelThumb: { height: 108, borderRadius: radius.md, backgroundColor: '#E7ECE8' },
  skelLine: { height: 10, borderRadius: radius.sm, backgroundColor: '#ECF1ED' },
  skelPrice: { height: 14, backgroundColor: '#E1EAE4', marginTop: 2 },
  skelSpinner: { alignItems: 'center', paddingVertical: spacing.xl },

  // Error state
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.surfaceMuted,
    marginBottom: spacing.xs,
  },
  errorTitle: { fontFamily: fonts.bold, fontSize: 16, color: lab.ink, textAlign: 'center' },
  errorBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: lab.inkSub,
    textAlign: 'center',
    maxWidth: 260,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: greenDarkest,
  },
  retryText: { fontFamily: fonts.bold, fontSize: 14, color: brand.primaryForeground },
});
