// (lab) Account — the customer profile / settings tab. Reuses the seller
// Settings composition verbatim (app/(tabs)/profile.tsx): the same
// src/features/settings cards + useUserProfile + useLogout, so profile data,
// verification and preferences render identically for the customer fork. The
// only fork-specific bits are the sign-out redirect target (still /(auth)/login)
// and extra bottom padding to clear the absolutely-positioned FrostedTabBar
// (bottom:0 overlay ≈ 57px + safe-area) that the customer nav uses.
import { View } from 'react-native';
import { router } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useLogout } from '@/features/auth/useLogout';
import { useUserProfile } from '@/features/auth/useUserProfile';
import {
  AddressCard,
  LanguageRegionCard,
  NotificationPreferencesCard,
  ProfileHero,
  ProfileInfoCard,
  ProfileSkeleton,
  QuickActionsStrip,
  SecurityCard,
  VerificationCard,
} from '@/features/settings';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/stores/authStore';
import { brand, spacing } from '@/constants/theme';

// Small-caps group label between section cards. Mirrors the seller Settings
// screen's local helper (the global `SectionLabel` primitive is scanner-form
// specific), kept local so the customer account tree stays self-contained.
function SectionHeader({ label }: { label: string }) {
  return (
    <Text
      variant="caption"
      tone="tertiary"
      className="mt-3xl mb-md font-bold tracking-widest uppercase"
    >
      {label}
    </Text>
  );
}

export default function LabAccount() {
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
      <Screen
        padded={false}
        scroll
        edges={['top']}
        // Clear the FrostedTabBar (absolute, bottom:0) plus the seller screen's
        // usual 4xl breathing room so the last card isn't hidden under the nav.
        contentContainerStyle={{ paddingBottom: spacing['4xl'] + 72 }}
      >
        <ProfileHero
          firstName={profileQuery.data?.personalInfo.firstName || profile?.name || ''}
          email={profileQuery.data?.email || profile?.email || ''}
          name={profile?.name}
          role={profile?.role}
        />

        <QuickActionsStrip
          onSignOut={handleSignOut}
          signingOut={logoutMut.isPending}
        />

        {profileQuery.isLoading ? (
          <ProfileSkeleton />
        ) : profileQuery.data ? (
          <View className="mx-8">
            {/* Account — Verification card leads so the trust signal sits above the fold */}
            <SectionHeader label={t('mobile.profile.sectionAccount', { defaultValue: 'Account' })} />
            <View className="gap-6">
              <VerificationCard profile={profileQuery.data} />
              <ProfileInfoCard profile={profileQuery.data} />
              <AddressCard profile={profileQuery.data} />
            </View>

            {/* Preferences */}
            <SectionHeader label={t('mobile.profile.sectionPreferences', { defaultValue: 'Preferences' })} />
            <View className="gap-6">
              <LanguageRegionCard profile={profileQuery.data} />
              <NotificationPreferencesCard />
            </View>

            {/* Security — sign-out is the destructive end of this group */}
            <SectionHeader label={t('mobile.profile.sectionSecurity', { defaultValue: 'Security' })} />
            <View className="gap-6">
              <SecurityCard />
              <Button
                label={logoutMut.isPending ? t('mobile.profile.signingOut') : t('mobile.profile.signOut')}
                onPress={handleSignOut}
                variant="danger"
                loading={logoutMut.isPending}
                leftIcon={<LogOut color={brand.destructiveStrong} size={18} />}
                fullWidth
              />
            </View>
          </View>
        ) : null}
      </Screen>
    </BottomSheetModalProvider>
  );
}
