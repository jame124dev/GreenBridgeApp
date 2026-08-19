import '../global.css';
import '@/i18n';

import { useEffect, type ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { MaterialIcons } from '@expo/vector-icons';
import { Toaster } from 'sonner-native';

import { setUnauthorizedHandler } from '@/api/interceptors';
import { AppSplash } from '@/components/AppSplash';
import { spacing } from '@/constants/theme';
// Leaf import, NOT the `@/features/lab/components` barrel: this is the root
// layout, so a barrel import would eagerly evaluate ~25 lab components (home
// composer, sheets, animated chrome) at boot — dead weight in the seller fork.
import { TAB_BAR_BASE_HEIGHT } from '@/features/lab/components/FrostedTabBar';
import { PushPermissionGate } from '@/features/notifications';
import { BackgroundRecognitionWatcher } from '@/features/scanner/BackgroundRecognitionWatcher';
import {
  fetchSupportedMarketplaces,
  SUPPORTED_QUERY_KEY,
} from '@/features/scanner/routing/supportedMarketplaces';
import { isSessionExpired } from '@/lib/authSession';
import { warnMissingEnvInDev } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { initOneSignal, loginOneSignal } from '@/lib/onesignal';
import { useAuth } from '@/stores/authStore';

// Post-auth home route for this bundle: the customer (lab) app or the seller
// tabs. Selected once at build time by the EXPO_PUBLIC_USER_TYPE fork.
const HOME_ROUTE = '/(lab)/(tabs)/home';

warnMissingEnvInDev();

SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const profile = useAuth((s) => s.profile);
  const hydrated = useAuth((s) => s.hydrated);
  const reset = useAuth((s) => s.reset);

  // Boot guard: a persisted profile whose refresh token has expired is a dead
  // session — the app looks logged in but every authed call (esp. the AI chat)
  // is treated as anonymous. Force re-login instead. Fail-open (see
  // isSessionExpired): only fires when the refresh token is provably expired.
  useEffect(() => {
    if (!hydrated || !profile) return;
    let cancelled = false;
    void isSessionExpired().then((expired) => {
      if (!cancelled && expired) {
        reset();
        router.replace('/(auth)/login');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, profile, reset, router]);

  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    // ⚠️ DO NOT re-add a redirect here. `isPending` means "not approved in the main
    // users queue", which is the state EVERY new app signup starts in. Bouncing
    // those users to /(auth)/pending is what made a fresh install a dead end.
    // A pending account is a working BUYER account: browse, search, prices, AI
    // chat, messaging and wants all work. Only the SELL path is gated, and that
    // gate lives in launchSellerScan() keyed off /seller-upgrade/my-status.

    if (!profile && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (profile && inAuthGroup) {
      router.replace(HOME_ROUTE);
    }
  }, [profile, segments, hydrated, router]);

  return <>{children}</>;
}

/**
 * The app's single Toaster, extracted so it can read `useSafeAreaInsets()` —
 * which only resolves INSIDE `SafeAreaProvider`, i.e. not in RootLayout itself.
 *
 * Why the offset is computed and not a constant: sonner-native's Positioner does
 * `bottom: offset || bottom || 40`, so an explicit `offset` REPLACES the
 * safe-area inset rather than adding to it. The previous flat `offset={96}` was
 * therefore a fixed distance from the PHYSICAL screen bottom that ignored
 * `insets.bottom` entirely, and 96 < the live bottom bar (66 + inset ≈ 114 on
 * Android 3-button nav) — so every toast, including the NotificationToast card
 * and its dismiss X, overlapped the bottom of the tab bar and could steal taps
 * from a tab. Deriving it from the exported bar height keeps the two in sync.
 */
function AppToaster() {
  const insets = useSafeAreaInsets();
  return (
    <Toaster
      position="bottom-center"
      offset={TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.sm}
    />
  );
}

export default function RootLayout() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const reset = useAuth((s) => s.reset);
  const hydrated = useAuth((s) => s.hydrated);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    ...MaterialIcons.font,
  });

  const profileId = useAuth((s) => s.profile?.id);

  useEffect(() => {
    hydrate();
    setUnauthorizedHandler(() => {
      reset();
      router.replace('/(auth)/login');
    });
    // Init only — the permission ask is deliberately NOT here (it fired on the
    // login screen). PushPermissionGate owns it, post-auth.
    initOneSignal();
    // M-12 / blocker (a) — warm the supported-marketplaces cache BEFORE any
    // scan can build a draft. `draftFromSmartFields` reads the MMKV cache
    // SYNCHRONOUSLY via `supportedNow()`, and it runs from
    // `applySmartDetection`, which processing-v2.tsx invokes long before
    // RoutingChip mounts on detail.tsx. Without this, a fresh install's FIRST
    // scan sees one marketplace, throws away the AI's verdict and stamps
    // `marketplaceConfirmed: true` — i.e. behaves exactly like 1.0.3, for every
    // user, on every install.
    //
    // `queryClient` is a module singleton (src/lib/queryClient.ts), so this
    // works even though the effect is OUTSIDE the QueryClientProvider below —
    // do not "fix" that by moving the effect. `staleTime` must match
    // useSupportedMarketplaces', or RoutingChip's mount refetches immediately.
    //
    // Fire-and-forget: `fetchSupportedMarketplaces` never rejects (it resolves
    // to the cached or fallback list), so there is nothing to catch and nothing
    // to block on.
    void queryClient.prefetchQuery({
      queryKey: SUPPORTED_QUERY_KEY,
      queryFn: fetchSupportedMarketplaces,
      staleTime: 30 * 60_000,
    });
  }, [hydrate, reset, router]);

  // Identify the signed-in user to OneSignal so backend external_id sends land.
  useEffect(() => {
    if (profileId != null) loginOneSignal(profileId);
  }, [profileId]);

  useEffect(() => {
    // Hide on EITHER success or error — a flaky font CDN on first run must not
    // pin the app on the splash forever (fontsLoaded would stay false).
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || !hydrated) return <AppSplash />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <KeyboardProvider>
          <SafeAreaProvider>
            <StatusBar style="dark" />
            <QueryClientProvider client={queryClient}>
              <AuthGuard>
                <Stack screenOptions={{ headerShown: false }} />
              </AuthGuard>
              {/* Headless: surfaces a finished background-recognition draft
                  (list refresh + toast) on ANY screen — must live under the
                  QueryClientProvider so it can invalidate the drafts query. */}
              <BackgroundRecognitionWatcher />
              {/* Headless: the post-auth push-permission ask (see the gate for
                  why it can't live in initOneSignal). */}
              <PushPermissionGate />
            </QueryClientProvider>
            {/* Bottom-anchored so the notification card floats over content and
                clears the top header; the offset lifts it above the bottom tab
                bar AND the OS navigation bar (see AppToaster). */}
            <AppToaster />
          </SafeAreaProvider>
        </KeyboardProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
