// MatchListCard — one matched product on the "All matches" screen (redesign
// mockup: `.mcard`). A richer sibling of `MatchProductCard`: a colour-graded
// left stripe (tier.bar) + product thumb + name/price + condition/country chips
// + a RelevanceRing, and a two-button footer — "View details" (ghost) and
// "Message seller" (solid greenDarkest, the bridge into the Messages flow).
//
// The card is dumb: it renders a `MatchProductVM` and calls back for the two
// actions; the screen owns routing (details vs. seller thread / Messages inbox).
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { usePop, usePressScale, POP_STAGGER_MS } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { RelevanceRing, ProductThumb } from '@/features/lab/components';
import { tierStyle, type MatchProductVM } from '@/features/lab/wants/data/wantsView';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Neutral condition-chip surface (country chip is tier-tinted). No exact token.
const CHIP_BG = '#F1F5F4';

export function MatchListCard({
  vm,
  index = 0,
  onViewDetails,
  onMessageSeller,
}: {
  vm: MatchProductVM;
  index?: number;
  onViewDetails: () => void;
  onMessageSeller: () => void;
}) {
  const { t } = useTranslation();
  const tier = tierStyle(vm.tier);
  const ghost = usePressScale();
  const solid = usePressScale();

  const openDetails = () => {
    haptics.tap();
    onViewDetails();
  };
  const messageSeller = () => {
    haptics.tap();
    onMessageSeller();
  };

  return (
    <Animated.View entering={usePop(index * POP_STAGGER_MS)} style={[styles.card, { borderLeftColor: tier.bar }]}>
      {/* Top: thumb + info + ring */}
      <View style={styles.top}>
        <ProductThumb uri={vm.image} size={60} kind="machine" />

        <View style={styles.info}>
          <Text numberOfLines={2} style={styles.name}>
            {vm.name}
          </Text>
          <Text style={styles.price}>{vm.priceText}</Text>
          <View style={styles.chipRow}>
            {vm.condition ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{vm.condition}</Text>
              </View>
            ) : null}
            {vm.country ? (
              <View style={[styles.chip, { backgroundColor: tier.chipBg }]}>
                <Text style={[styles.chipText, { color: tier.text }]}>{vm.country}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <RelevanceRing pct={vm.pct} size={52} tier={vm.tier} />
      </View>

      {/* Footer: two actions */}
      <View style={styles.foot}>
        <AnimatedPressable
          onPress={openDetails}
          onPressIn={ghost.onPressIn}
          onPressOut={ghost.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labWants.viewDetails')}
          style={[styles.btn, styles.ghost, ghost.style]}
        >
          <Text style={styles.ghostText}>{t('mobile.labWants.viewDetails')}</Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={messageSeller}
          onPressIn={solid.onPressIn}
          onPressOut={solid.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labWants.messageSeller')}
          style={[styles.btn, styles.solid, solid.style]}
        >
          <MessageSquare size={14} color="#fff" strokeWidth={2.2} />
          <Text style={styles.solidText}>{t('mobile.labWants.messageSeller')}</Text>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: lab.hairline,
    borderLeftWidth: 4,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 13,
    paddingVertical: spacing.md,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: lab.ink },
  price: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: lab.ink, marginTop: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: 6 },
  chip: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: CHIP_BG },
  chipText: { fontFamily: fonts.label, fontSize: 10.5, lineHeight: 14, color: lab.inkSub },
  foot: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 13,
    paddingBottom: spacing.md,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    minHeight: 44,
    borderRadius: radius.md,
  },
  ghost: { backgroundColor: '#EEF3EF', borderWidth: 1, borderColor: lab.hairline },
  ghostText: { fontFamily: fonts.bold, fontSize: 12, color: greenDarkest },
  solid: { backgroundColor: greenDarkest },
  solidText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
});
