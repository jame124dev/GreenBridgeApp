// (lab) Account — the customer profile / settings tab. Reuses the seller
// Settings composition verbatim (app/(tabs)/profile.tsx): the same
// src/features/settings cards + useUserProfile + useLogout, so profile data,
// verification and preferences render identically for the customer fork. The
// only fork-specific bits are the sign-out redirect target (still /(auth)/login)
// and extra bottom padding to clear the absolutely-positioned FrostedTabBar
// (bottom:0 overlay ≈ 57px + safe-area) that the customer nav uses.
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ChevronRight, FileText, LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTabBarHeight } from '@/features/lab/components';
import { AppVersionLine } from '@/features/lab/updates';
import { useLogout } from '@/features/auth/useLogout';
import { useUserProfile } from '@/features/auth/useUserProfile';
import {
  AddressCard,
  DeleteAccountLink,
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
import { draftsEnabled } from '@/lib/flags';
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
  const tabBarHeight = useTabBarHeight();

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
        // Clear the FrostedTabBar (its live height incl. the bottom safe-area
        // inset) plus 4xl breathing room so the last card isn't hidden under the
        // nav — the old flat `+72` ignored insets and clipped on gesture-nav.
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing['4xl'] }}
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
          <View className="mx-lg">
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

            {/* Activity — Task 13: resume a saved AI draft (sell listing or
                buy request) from the shared drafts list. Gated on
                `draftsEnabled()` so it's a no-op with the flag off, matching
                every other drafts surface (Home's "Your drafts" entry,
                Task 12's "Save as draft"). Its own group rather than folded
                into Preferences/Security so it reads as a navigation action,
                not a setting. */}
            {draftsEnabled() && (
              <>
                <SectionHeader label={t('mobile.profile.sectionActivity', { defaultValue: 'Activity' })} />
                <View className="gap-6">
                  <Pressable
                    onPress={() => {
                      haptics.tap();
                      router.push('/scan/drafts' as unknown as Href);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.drafts.yourDrafts', { defaultValue: 'Your drafts' })}
                  >
                    <Card>
                      <Card.Header
                        icon={<FileText color={brand.primary} size={18} />}
                        iconBg={brand.primarySurface}
                        title={t('mobile.drafts.yourDrafts', { defaultValue: 'Your drafts' })}
                        description={t('mobile.drafts.yourDraftsDesc', {
                          defaultValue: 'Resume a saved listing or request',
                        })}
                        right={<ChevronRight color={brand.textMuted} size={18} />}
                      />
                    </Card>
                  </Pressable>
                </View>
              </>
            )}

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
              {/* Account deletion (App Store Guideline 5.1.1(v)). A quiet link,
                  not a second red button — see DeleteAccountLink for why. */}
              <DeleteAccountLink />
            </View>

            {/* Which build is actually running. Support-critical when a shipped
                OTA fix appears not to have arrived — see AppVersionLine. */}
            <AppVersionLine />
          </View>
        ) : null}
      </Screen>
    </BottomSheetModalProvider>
  );
}
