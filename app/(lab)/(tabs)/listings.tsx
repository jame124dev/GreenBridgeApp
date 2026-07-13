// (lab) Listings — the full "my listings" view reached from Home's Recent
// listings "See all". Lives in the (lab) tab group with href:null so the
// FrostedTabBar SHOWS and, per its OWNED_BY_TAB map, the ACCOUNT tab renders
// active while you're here (my listings = an account/seller concern).
//
// Content reuses the seller RecentSubmissionsList (same useRecentSubmissions
// source as Home + the History tab), with a higher limit and row taps → listing
// detail already wired inside it.
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';

import { Screen, Text } from '@/components/ui';
import { RecentSubmissionsList } from '@/components/scanner/RecentSubmissionsList';
import { useTabBarHeight, LabScreenBg } from '@/features/lab/components';
import { haptics } from '@/lib/haptics';
import { greenDarkest, spacing } from '@/constants/theme';

export default function LabListings() {
  const router = useRouter();
  const tabBarH = useTabBarHeight();
  const { t } = useTranslation();

  return (
    <LabScreenBg>
    <Screen
      scroll
      padded={false}
      edges={['top']}
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{
        // Screen's SafeAreaView already insets the top — avoid double-inset.
        paddingTop: spacing.sm,
        paddingHorizontal: 22,
        paddingBottom: tabBarH + spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labHome.back')}
        >
          <ChevronLeft size={26} color={greenDarkest} />
        </Pressable>
        <Text variant="title" tone="primary" style={{ fontWeight: '700' }}>
          {t('mobile.labHome.myListings')}
        </Text>
      </View>

      <RecentSubmissionsList limit={30} title={t('mobile.labHome.allListings')} />
    </Screen>
    </LabScreenBg>
  );
}
