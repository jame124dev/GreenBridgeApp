// (lab) Product detail — one marketplace listing, opened when a buyer taps a
// product card in the AI chat (or anywhere a product surfaces). Rather than fork
// the web's rich listing page natively, we render the SAME buyer-marketplace
// detail page (`/buyer-marketplace/:batchId`) inside the shared MarketplaceWebView
// so it looks and behaves exactly like 101 Lab, with the native session and the
// "message seller" bridge intact.
//
// Route:  /(lab)/product/[id]  (stack-level, tab bar HIDDEN — registered in
//         app/(lab)/_layout.tsx). Params: id = batchId, name = listing title
//         (header only; optional).
import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, fonts, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { safeBack } from '@/lib/safeBack';
import { MarketplaceWebView, marketplaceUri } from '@/features/lab/marketplace/MarketplaceWebView';

export default function LabProductDetail() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  const path = `/buyer-marketplace/${encodeURIComponent(String(id))}`;
  const title = (name && name.trim()) || t('mobile.labProduct.title');

  const onBack = useCallback(() => {
    haptics.tap();
    safeBack('/(lab)/(tabs)/browse');
  }, []);

  const onOpenWeb = useCallback(() => {
    haptics.tap();
    // Drop the ?app=1 embed flag for the external browser (full site chrome).
    Linking.openURL(marketplaceUri(path).replace(/[?&]app=1$/, '')).catch(() => {});
  }, [path]);

  return (
    <View style={styles.root}>
      {/* Fixed nav header — back + listing title + open-in-browser. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labProduct.back')}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ChevronLeft size={24} color={lab.ink} strokeWidth={2.2} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
        <Pressable
          onPress={onOpenWeb}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labProduct.openInBrowser')}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ExternalLink size={18} color={lab.inkMeta} />
        </Pressable>
      </View>

      {/* No `bottomInset`: there is no tab bar on this pushed screen, and
          MarketplaceWebView reserves the OS bottom inset itself when the prop is
          omitted (see its Props JSDoc). Passing `insets.bottom` here would be a
          second control for the same job — and the reason this screen's listing
          page used to draw its sticky action bar under the Android 3-button nav
          bar was exactly that the reservation was the caller's job. The header
          above is the only inset this screen owns (`insets.top`; the root is a
          bare View and the Stack has headerShown:false, so nothing double-pads). */}
      <MarketplaceWebView path={path} hideSiteHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: brand.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lab.hairline,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: lab.ink,
    textAlign: 'center',
  },
});
