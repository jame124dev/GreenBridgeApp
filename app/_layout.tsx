import '../global.css';
import '@/i18n';

import { silenceExceljsLogNoise } from '@/lib/silenceExceljsLogNoise';
silenceExceljsLogNoise();

import { useEffect, type ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
// The i18n INSTANCE, not `useTranslation`: `endSession` is a plain function
// called from an effect callback, not a component, so there is no hook to use.
// eslint's `import/no-named-as-default-member` suggests `import { t }` here —
// deliberately not taken: that binding is captured at module load, and this
// module is evaluated before `@/i18n` has finished initialising.
import i18n from 'i18next';

import { hasPendingV2Return, homeRoute } from '@/features/v2/routing/postAuthLanding';
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
// Poppins — the v2 redesign (app/v2/). Exactly three weights: that is all the
// design canvas uses across 238 styled text nodes. An unloaded face does not
// throw, it silently falls back to the system font, so this list and
// `fonts` in src/theme/v2/scale.ts must stay in step.
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { MaterialIcons } from '@expo/vector-icons';
import { Toaster, toast } from 'sonner-native';

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
import { logout } from '@/services/auth/logout';
import { isSessionExpired } from '@/lib/authSession';
import { warnMissingEnvInDev } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { initOneSignal, loginOneSignal } from '@/lib/onesignal';
import { useAuth } from '@/stores/authStore';

// ⛔ `HOME_ROUTE = '/(lab)/(tabs)/home'` used to live here. It is gone, not
// unused: "home" is `homeRoute()` from `postAuthLanding.ts`, the one flag-keyed
// answer for the whole app. Four separate copies of this constant are exactly
// why the launch redirect stayed on the old UI for a version after the
// post-auth return had been fixed. Do not reintroduce it — import `homeRoute`.

warnMissingEnvInDev();

SplashScreen.preventAutoHideAsync();

/**
 * WHAT HAPPENS WHEN A SESSION DIES — one function, because it happened in two
 * places and only one of them was ever thought about.
 *
 * Both callers previously did `reset()` then `router.replace('/(auth)/login')`.
 * `reset()` clears the profile, so from that instant the person **is a guest**
 * — and this file states the rule against walling a guest twice, fifteen lines
 * apart, both times citing the App Review rejection of 1.0.3 (21) on
 * 2026-08-24 under Guideline 5.1.1(v).
 *
 * The wall was removed for someone who had never signed in and left standing
 * for everyone who had — the larger group, since every account reaches it
 * eventually just by not opening the app until the refresh token dies.
 *
 * ── IT WAS A DEAD END, NOT A DETOUR ────────────────────────────────────────
 *
 * Found on device 2026-09-22 with two phones on one Metro: the Realme (no
 * stored profile) cold-booted into v2 Home as a guest; the Samsung (stored
 * profile, expired refresh token) cold-booted into the full-screen sign-in
 * form. `app/(auth)/login.tsx` has no "continue as guest" affordance,
 * `app/(auth)/_layout.tsx` is a bare `Stack` with `headerShown: false`, and it
 * is reached by `replace` — so there is no back entry. A returning user could
 * not browse a single product.
 *
 * ── WHAT IT DOES INSTEAD ───────────────────────────────────────────────────
 *
 * Lands them where a guest belongs (`homeRoute()` — flag-keyed, never a
 * hardcoded path) and SAYS the session ended, because being signed out
 * silently is its own defect: the seller's listings simply vanish. Signing in
 * is then offered at the point of use by `requireAuth()`, which is how the
 * rest of the app already asks.
 */
function endSession(reset: () => void, router: ReturnType<typeof useRouter>): void {
  /**
   * ⚠️ `logout()` FIRST, AND IT IS NOT OPTIONAL.
   *
   * `useAuth.reset()` removes only `auth.approval` and the in-memory state
   * (`stores/authStore.ts:62-65`). `auth.profile`, `auth.userId` and both
   * SecureStore tokens survive it — `services/auth/logout.ts` is the only thing
   * that clears them.
   *
   * That was survivable while this path ended on the sign-in screen, because
   * signing in overwrote the stale row. Landing on Home removes that repair
   * step, so without this the SAME expired refresh token is rehydrated on the
   * next cold boot, `isSessionExpired()` is true again, and the toast fires
   * again — every launch, for ever. Each launch also has a window, before the
   * async check resolves, where Home renders the signed-in shell and fires
   * account-scoped queries against a dead token.
   *
   * The 401 arm already gets this for free (`api/interceptors.ts` awaits
   * `logout()` before calling the handler); doing it here is what actually
   * makes the two arms converge, which was the point of extracting them.
   * `logout()` is idempotent, so the double call on that arm is harmless.
   */
  void logout();
  reset();
  /**
   * `defaultValue`, not a positional second argument: `t(key, 'string')` is
   * read as options by some i18next configs and silently renders the KEY.
   * The key exists in all six locales — this default is the belt, not the
   * braces.
   */
  toast.info(
    i18n.t('mobile.auth.sessionEnded', {
      defaultValue: 'Your session ended. Sign in again to pick up where you left off.',
    }),
  );
  router.replace(homeRoute());
}

function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const profile = useAuth((s) => s.profile);
  const hydrated = useAuth((s) => s.hydrated);
  const reset = useAuth((s) => s.reset);

  // Boot guard: a persisted profile whose refresh token has expired is a dead
  // session — the app looks logged in but every authed call (esp. the AI chat)
  // is treated as anonymous. Clear it instead. Fail-open (see
  // isSessionExpired): only fires when the refresh token is provably expired.
  //
  // ⛔ IT DOES NOT SEND THEM TO THE SIGN-IN SCREEN. It used to, and that
  // rebuilt the 5.1.1(v) wall for everyone who HAD an account — see the note
  // on `endSession` below.
  useEffect(() => {
    if (!hydrated || !profile) return;
    let cancelled = false;
    void isSessionExpired().then((expired) => {
      if (!cancelled && expired) endSession(reset, router);
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

    // ⛔ NO GUEST REDIRECT. This used to bounce every session-less user to
    // /(auth)/login, so a fresh install landed on a sign-in wall and could not
    // browse a single product. App Review rejected 1.0.3 (21) for it on
    // 2026-08-24 -- Guideline 5.1.1(v), "registration can only be required for
    // account-based features". Guests now stay in the app; the ones that truly
    // need an identity ask for it at the point of use via `requireAuth()`.
    //
    // Do NOT re-add a redirect here, and do not "fix" a guest crash by putting
    // one back -- fix the screen to tolerate a null profile instead.

    // ⚠️ THE RACE THAT ATE THE v2 RETURN — do not simplify this condition.
    //
    // This effect fires the moment `profile` becomes truthy while the route is
    // still inside `(auth)`, which is the SAME instant `login.tsx` issues its
    // own replace. Two redirects race, and the hardcoded one won often enough
    // to make "signing in throws me back to the old UI" look intermittent.
    // Patching the auth screens alone does not fix it; this is the third and
    // most easily missed ejection point.
    //
    // When a v2 landing is owed, stand down and let the auth screen place the
    // person — `postAuthLanding()` is the single decision point.
    if (profile && inAuthGroup && !hasPendingV2Return()) {
      // `homeRoute()`, not the local HOME_ROUTE constant — with the v2 flag on,
      // "home" is `/v2`, and bouncing to the legacy home here would undo the
      // front-door fix for anyone who signed in.
      router.replace(homeRoute());
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
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    ...MaterialIcons.font,
  });

  const profileId = useAuth((s) => s.profile?.id);

  useEffect(() => {
    hydrate();
    setUnauthorizedHandler(() => {
      // ⛔ A 401 FOR A GUEST IS NOT A SESSION EXPIRY. This handler is what
      // actually defeated the first attempt at guest browsing: the door
      // redirects were removed, a guest reached Home, some authenticated hook
      // fired, the 401 came back, and THIS bounced them to login anyway -- the
      // 5.1.1(v) wall rebuilt one layer down.
      //
      // With no profile there is no session to expire and nothing to recover:
      // the request simply needed an account the caller does not have. The
      // caller shows its own empty state or a `requireAuth` prompt.
      if (!useAuth.getState().profile) return;
      // Same landing as the boot guard — see `endSession`. This is the path the
      // comment above already calls "the 5.1.1(v) wall rebuilt one layer down";
      // it was fixed for the guest arm and left standing for this one.
      endSession(reset, router);
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
