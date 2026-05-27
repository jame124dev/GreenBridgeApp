import { View, Linking } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, Text } from '@/components/ui';
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
    <Screen scroll={false} padded={false} edges={[]}>
      {/* Gradient Hero */}
      <LinearGradient colors={[...gradients.hero]} className="pb-[32px] rounded-b-[32px]">
        <SafeAreaView edges={['top']}>
          <View className="px-lg pt-md items-center">
            <Text variant="title" tone="inverse" className="text-center font-bold">
              {t('mobile.auth.pending.heading')}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Main Content with bottom safe area */}
      <SafeAreaView edges={['bottom']} className="flex-1 px-lg pt-xl justify-between">
        <View className="gap-lg">
          <Card variant="flat" className="gap-md">
            <Text variant="body" tone="secondary" className="text-center">
              {t('mobile.auth.pending.body')}
            </Text>
          </Card>
        </View>

        <View className="gap-md pb-lg">
          <Button
            label={t('mobile.auth.pending.openSite')}
            onPress={() => Linking.openURL('https://greenbidz.com/dashboard/settings')}
            variant="primary"
            size="lg"
            fullWidth
          />

          <Button
            label={t('mobile.auth.pending.signOut')}
            onPress={handleSignOut}
            disabled={logoutMut.isPending}
            loading={logoutMut.isPending}
            variant="secondary"
            size="lg"
            fullWidth
          />
        </View>
      </SafeAreaView>
    </Screen>
  );
}
