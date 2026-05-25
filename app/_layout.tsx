import '../global.css';
import '@/i18n';

import { useEffect, type ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';

import { setUnauthorizedHandler } from '@/api/interceptors';
import { warnMissingEnvInDev } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/stores/authStore';

warnMissingEnvInDev();

SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const profile = useAuth((s) => s.profile);
  const isPending = useAuth((s) => s.isPending);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onPending = segments[1] === 'pending';

    if (isPending) {
      if (!onPending) router.replace('/(auth)/pending');
      return;
    }

    if (!profile && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (profile && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [profile, isPending, segments, hydrated, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const reset = useAuth((s) => s.reset);
  const hydrated = useAuth((s) => s.hydrated);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    hydrate();
    setUnauthorizedHandler(() => {
      reset();
      router.replace('/(auth)/login');
    });
  }, [hydrate, reset, router]);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync();
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGuard>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
