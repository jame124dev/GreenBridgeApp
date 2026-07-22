import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useLogout } from '@/features/auth/useLogout';
import { useRecheckApproval } from '@/features/auth/useLogin';
import { LoginError } from '@/services/auth/login';
import { haptics } from '@/lib/haptics';
import { gradients } from '@/theme/gradients';

/**
 * Approval gate — shown whenever the account isn't approved (login returns
 * ACCOUNT_PENDING → `isPending`; the RootLayout AuthGuard bounces every route
 * here until it clears). "Check approval status" re-verifies via the pending
 * refresh token; the moment an admin approves, the store gets the real profile
 * and the AuthGuard routes the user into the app — no sign-out/in needed. Also
 * auto-checks once on open so a seller approved while the app was closed lands
 * straight in.
 */
export default function PendingScreen() {
  const { t } = useTranslation();
  const logoutMut = useLogout();
  const recheck = useRecheckApproval();
  const [notApprovedYet, setNotApprovedYet] = useState(false);

  const check = useCallback(() => {
    if (recheck.isPending) return;
    setNotApprovedYet(false);
    recheck.mutate(undefined, {
      // Success → useRecheckApproval sets the profile + clears isPending, and
      // the AuthGuard redirects out of (auth) into the app.
      onSuccess: () => haptics.success(),
      onError: (err) => {
        if (err instanceof LoginError && err.code === 'ACCOUNT_PENDING') {
          setNotApprovedYet(true); // still pending — stay put, show a gentle note
        } else {
          // 401 → the axios interceptor already logged out + routed to login;
          // network/other → surface a failure feel and let them retry.
          haptics.error();
        }
      },
    });
  }, [recheck]);

  // Auto-check once on open: catches an approval that happened while the app
  // was closed so the seller doesn't have to tap.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    check();
  }, [check]);

  const handleSignOut = () =>
    logoutMut.mutate(undefined, { onSuccess: () => router.replace('/(auth)/login') });

  const checking = recheck.isPending;

  return (
    <View className="flex-1 bg-background">
      <LinearGradient colors={[...gradients.hero]} className="h-36 justify-end px-6 pb-5">
        <Text className="font-sans-bold text-2xl text-white">{t('mobile.auth.pending.heading')}</Text>
      </LinearGradient>

      <SafeAreaView className="flex-1 px-6 pt-8">
        <Text className="text-base leading-6 text-foreground">{t('mobile.auth.pending.body')}</Text>

        {notApprovedYet ? (
          <Text className="mt-4 text-sm leading-5 text-muted-foreground">
            {t('mobile.auth.pending.notApprovedYet', {
              defaultValue: "Not approved yet — we'll let you in the moment an admin approves your account.",
            })}
          </Text>
        ) : null}

        {/* Primary: re-check approval → enter the app when approved. */}
        <Pressable
          onPress={check}
          disabled={checking}
          className="mt-6 h-12 flex-row items-center justify-center gap-2 rounded bg-primary active:opacity-90"
          accessibilityRole="button"
        >
          {checking ? <ActivityIndicator color="#ffffff" /> : null}
          <Text className="font-sans-medium text-primary-foreground">
            {checking
              ? t('mobile.auth.pending.checking', { defaultValue: 'Checking…' })
              : t('mobile.auth.pending.checkStatus', { defaultValue: 'Check approval status' })}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL('https://greenbidz.com/dashboard/settings')}
          className="mt-4 h-12 items-center justify-center rounded border border-border active:opacity-90"
          accessibilityRole="button"
        >
          <Text className="font-sans-medium text-foreground">{t('mobile.auth.pending.openSite')}</Text>
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          disabled={logoutMut.isPending}
          className="mt-4 h-12 items-center justify-center rounded active:opacity-90"
          accessibilityRole="button"
        >
          <Text className="font-sans-medium text-muted-foreground">
            {logoutMut.isPending ? t('mobile.auth.pending.signingOut') : t('mobile.auth.pending.signOut')}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
