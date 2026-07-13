// (lab) Browse — the 101 Lab buyer marketplace, rendered inside a WebView.
//
// Rather than re-build the catalog/search/filters natively, the Browse tab
// embeds the live web marketplace (`${MARKETPLACE_URL}/buyer-marketplace`) and
// hands it the native session. The web detects the embed via the
// `applicationNameForUserAgent="GreenBridgeApp"` UA suffix AND the `?app=1`
// query param, then strips its own header/footer and defers "message seller"
// to the native chat. See webAuthBridge.ts for the localStorage handoff and
// the WEB↔NATIVE bridge contract.
//
// Tab bar SHOWS here (headerShown:false — we render our own compact top bar and
// pad the bottom so content clears the FrostedTabBar).
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RefreshCw, WifiOff } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { getMarketplaceUrl } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { registerMarketplaceAuthClear } from '@/lib/marketplaceWebView';
import { useTabBarHeight } from '@/features/lab/components';
import {
  buildAuthPayload,
  buildClearAuthCall,
  buildInjectedAuthJS,
  buildSetAuthCall,
} from '@/features/lab/marketplace/webAuthBridge';

const MARKETPLACE_URL = getMarketplaceUrl();
const MARKETPLACE_URI = `${MARKETPLACE_URL}/buyer-marketplace?app=1`;
// Host of the configured marketplace origin — always kept in-view (covers a
// local dev server like 10.0.2.2:3200 as well as the live site).
const MARKETPLACE_HOST = (() => {
  try {
    return new URL(MARKETPLACE_URL).hostname.toLowerCase();
  } catch {
    return '';
  }
})();

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

export default function LabBrowse() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
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
  // the tab was backgrounded).
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

  // Let the logout flow clear the web session in this WebView while it's mounted.
  useEffect(() => {
    registerMarketplaceAuthClear(() =>
      webRef.current?.injectJavaScript(buildClearAuthCall()),
    );
    return () => registerMarketplaceAuthClear(null);
  }, []);

  // Android hardware back → navigate WebView history before leaving the tab.
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

  const reload = useCallback(() => {
    haptics.tap();
    authRetriesRef.current = 0;
    setErrored(false);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  return (
    // The web marketplace keeps its own header (brand + hamburger menu + mobile
    // search) in embedded mode, so we render NO native top bar here — just hold
    // the status-bar inset with the header's white so it blends, then the WebView.
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.webWrap}>
        {injectedJs && !errored ? (
          <WebView
            ref={webRef}
            source={{ uri: MARKETPLACE_URI }}
            applicationNameForUserAgent="GreenBridgeApp"
            injectedJavaScriptBeforeContentLoaded={injectedJs}
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
            style={styles.web}
            contentInset={{ bottom: tabBarHeight }}
            // Reserve space for the absolute tab bar so the bottom of the page
            // (and the lifted Filters FAB) clears it.
          />
        ) : null}

        {/* Card-grid skeleton — shown until first paint / onLoadEnd. */}
        {loading && !errored ? (
          <View style={[styles.overlay, { paddingBottom: tabBarHeight }]} pointerEvents="none">
            <SkeletonGrid />
          </View>
        ) : null}

        {/* Error / offline state. */}
        {errored ? (
          <View style={[styles.overlay, styles.errorState, { paddingBottom: tabBarHeight }]}>
            <View style={styles.errorIcon}>
              <WifiOff size={26} color={brand.textMuted} strokeWidth={2} />
            </View>
            <Text style={styles.errorTitle}>{t('mobile.labBrowse.errorTitle')}</Text>
            <Text style={styles.errorBody}>
              {t('mobile.labBrowse.errorBody')}
            </Text>
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
    </View>
  );
}

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
  // White status-bar strip so it blends with the web header sitting just below.
  root: { flex: 1, backgroundColor: brand.surface },
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
  errorState: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing['2xl'] },
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
  errorBody: { fontFamily: fonts.regular, fontSize: 13, color: lab.inkSub, textAlign: 'center', maxWidth: 260 },
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
