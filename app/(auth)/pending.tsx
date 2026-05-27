import { View, Text, Pressable, Linking } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useLogout } from '@/features/auth/useLogout';
import { gradients } from '@/theme/gradients';

export default function PendingScreen() {
  const { t } = useTranslation();
  const logoutMut = useLogout();

  const handleSignOut = () =>
    logoutMut.mutate(undefined, {
      onSuccess: () => router.replace('/(auth)/login'),
    });

  return (
    <View className="flex-1 bg-background">
      <LinearGradient colors={[...gradients.hero]} className="h-36 justify-end px-6 pb-5">
        <Text className="font-sans-bold text-2xl text-white">{t('mobile.auth.pending.heading')}</Text>
      </LinearGradient>

      <SafeAreaView className="flex-1 px-6 pt-8">
        <Text className="text-base leading-6 text-foreground">
          {t('mobile.auth.pending.body')}
        </Text>

        <Pressable
          onPress={() => Linking.openURL('https://greenbidz.com/dashboard/settings')}
          className="mt-6 h-12 items-center justify-center rounded bg-primary active:opacity-90"
        >
          <Text className="font-sans-medium text-primary-foreground">{t('mobile.auth.pending.openSite')}</Text>
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          disabled={logoutMut.isPending}
          className="mt-4 h-12 items-center justify-center rounded border border-border active:opacity-90"
        >
          <Text className="font-sans-medium text-foreground">
            {logoutMut.isPending ? t('mobile.auth.pending.signingOut') : t('mobile.auth.pending.signOut')}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
