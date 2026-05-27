import { View } from 'react-native';
import { router } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useLogout } from '@/features/auth/useLogout';
import { useUserProfile } from '@/features/auth/useUserProfile';
import {
  AddressCard,
  LanguageRegionCard,
  ProfileHero,
  ProfileInfoCard,
  ProfileSkeleton,
  SecurityCard,
} from '@/features/settings';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/stores/authStore';
import { colors, spacing } from '@/theme';

export default function SettingsScreen() {
  const { t }        = useTranslation();
  const profile      = useAuth((s) => s.profile);
  const profileQuery = useUserProfile();
  const logoutMut    = useLogout();

  const handleSignOut = () => {
    haptics.warning();
    logoutMut.mutate(undefined, {
      onSuccess: () => router.replace('/(auth)/login'),
    });
  };

  return (
    <BottomSheetModalProvider>
    <Screen padded={false} scroll edges={['top']} contentContainerStyle={{ paddingBottom: spacing['9xl'] }}>
      <ProfileHero
        firstName={profileQuery.data?.personalInfo.firstName || profile?.name || ''}
        email={profileQuery.data?.email || profile?.email || ''}
        name={profile?.name}
        role={profile?.role}
      />

      {profileQuery.isLoading ? (
        <ProfileSkeleton />
      ) : profileQuery.data ? (
        <>
          <View className="mx-8 mt-6 gap-6">
            <ProfileInfoCard profile={profileQuery.data} />
            <AddressCard profile={profileQuery.data} />
            <SecurityCard />
            <LanguageRegionCard profile={profileQuery.data} />

            <Button
              label={logoutMut.isPending ? t('mobile.profile.signingOut') : t('mobile.profile.signOut')}
              onPress={handleSignOut}
              variant="danger"
              loading={logoutMut.isPending}
              leftIcon={<LogOut color={colors.destructiveStrong} size={18} />}
              fullWidth
            />
          </View>
        </>
      ) : null}
    </Screen>
    </BottomSheetModalProvider>
  );
}
