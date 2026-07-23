import '../global.css';
import '@/i18n';

import { useEffect, type ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { BackgroundRecognitionWatcher } from '@/features/scanner/BackgroundRecognitionWatcher';
import { isSessionExpired } from '@/lib/authSession';
import { warnMissingEnvInDev } from '@/lib/env';
import { IS_CUSTOMER } from '@/lib/flags';
import { queryClient } from '@/lib/queryClient';
import { initOneSignal, loginOneSignal } from '@/lib/onesignal';
import { useAuth } from '@/stores/authStore';

// Post-auth home route for this bundle: the customer (lab) app or the seller
// tabs. Selected once at build time by the EXPO_PUBLIC_USER_TYPE fork.
const HOME_ROUTE = IS_CUSTOMER ? '/(lab)/(tabs)/home' : '/(tabs)';

warnMissingEnvInDev();

SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const profile = useAuth((s) => s.profile);
  const isPending = useAuth((s) => s.isPending);
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
    const onPending = (segments as string[]).includes('pending');

    if (isPending) {
      if (!onPending) router.replace('/(auth)/pending');
      return;
    }

    if (!profile && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (profile && inAuthGroup) {
      router.replace(HOME_ROUTE);
    }
  }, [profile, isPending, segments, hydrated, router]);

  return <>{children}</>;
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
    // OneSignal push foundation: init + permission prompt once on boot.
    initOneSignal();
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
            </QueryClientProvider>
            {/* Bottom-anchored so the notification card floats over content
                and clears the top header; offset lifts it above the tab bar. */}
            <Toaster position="bottom-center" offset={96} />
          </SafeAreaProvider>
        </KeyboardProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
