// (lab) Listings — the full "my listings" view reached from Home's Recent
// listings "See all". Lives in the (lab) tab group with href:null so the
// FrostedTabBar SHOWS and, per its OWNED_BY_TAB map, the ACCOUNT tab renders
// active while you're here (my listings = an account/seller concern).
//
// Content uses `MyListingsEditList` — the same `useRecentSubmissions` source
// and row layout as Home's read-only `RecentSubmissionsList`, plus the one
// thing this screen is for: an Edit action per listing. Home and History keep
// the read-only list; this is the seller's management view, so it is the right
// (and only) home for the edit entry point.
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';

import { Screen, Text } from '@/components/ui';
import { MyListingsEditList } from '@/features/listings/components/MyListingsEditList';
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

      <MyListingsEditList limit={30} />
    </Screen>
    </LabScreenBg>
  );
}
