// MatchProductCard — one matched product inside a WantCard (mobile port of the
// web MyWants `MatchCard`). Image + title + a colour-graded RELEVANCE % (raw
// hybrid score) with a matching strength bar, price, condition + country chips,
// and a "View details" action that opens the Match Detail screen. Null-safe via
// the `MatchProductVM` mapper — never renders "undefined", never throws.
//
// NOTE: the web card also has a "Watch" (wishlist) action; the mobile lab app
// has no wishlist client, so that affordance is intentionally omitted here (a
// documented v1 deferral) — "View details" is the single per-match action.
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ExternalLink, PackageSearch } from 'lucide-react-native';

import { AppImage, Text } from '@/components/ui';
import { brand, fonts, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { tierStyle, type MatchProductVM } from '@/features/lab/wants/data/wantsView';

const NEUTRALS = {
  title: '#10201A',
  sub: '#6B7A72',
  border: '#E7EDE8',
  chipInk: '#5B6B63',
  chipBg: '#F1F5F4',
  imgBg: '#EEF4EF',
} as const;

export function MatchProductCard({
  vm,
  onOpen,
}: {
  vm: MatchProductVM;
  onOpen: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const tier = tierStyle(vm.tier);
  const open = () => {
    haptics.tap();
    onOpen(vm.matchId);
  };

  return (
    <View style={[styles.card, { borderLeftColor: tier.bar }]}>
      {/* Thumbnail */}
      <Pressable onPress={open} style={styles.thumb} accessibilityRole="imagebutton" accessibilityLabel={vm.name}>
        {vm.image ? (
          <AppImage source={{ uri: vm.image }} style={styles.thumbImg} />
        ) : (
          <View style={[styles.thumbImg, styles.thumbFallback]}>
            <PackageSearch size={22} color="#B6C2BA" strokeWidth={1.8} />
          </View>
        )}
      </Pressable>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Pressable onPress={open} style={styles.titleWrap} accessibilityRole="button">
            <Text numberOfLines={2} style={styles.title}>
              {vm.name}
            </Text>
          </Pressable>
          {vm.pct != null ? (
            <View style={styles.pctWrap}>
              <Text style={[styles.pct, { color: tier.text }]}>{vm.pct}%</Text>
              <Text style={styles.pctCaption}>{t('mobile.labWants.relevance')}</Text>
            </View>
          ) : null}
        </View>

        {/* Price + chips */}
        <View style={styles.metaRow}>
          <Text style={styles.price}>{vm.priceText}</Text>
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

        {/* Relevance bar */}
        {vm.pct != null ? (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${vm.pct}%`, backgroundColor: tier.bar }]} />
          </View>
        ) : null}

        {/* Action */}
        <Pressable onPress={open} style={styles.viewBtn} accessibilityRole="button" accessibilityLabel={t('mobile.labWants.viewDetails')}>
          <ExternalLink size={13} color={brand.primary} strokeWidth={2.2} />
          <Text style={styles.viewText}>{t('mobile.labWants.viewDetails')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: NEUTRALS.border,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  thumb: { width: 72, height: 72, flexShrink: 0 },
  thumbImg: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: NEUTRALS.imgBg },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: NEUTRALS.title },
  pctWrap: { alignItems: 'flex-end', flexShrink: 0 },
  pct: { fontFamily: fonts.headingBold, fontSize: 16, lineHeight: 18 },
  pctCaption: {
    fontFamily: fonts.label,
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#9AA89F',
    marginTop: 1,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  price: { fontFamily: fonts.bold, fontSize: 13, color: NEUTRALS.title },
  chip: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: NEUTRALS.chipBg },
  chipText: { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 14, color: NEUTRALS.chipInk },
  barTrack: { height: 4, borderRadius: radius.full, backgroundColor: '#EEF2EF', overflow: 'hidden', marginTop: 8 },
  barFill: { height: 4, borderRadius: radius.full },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.primaryBorder,
    backgroundColor: brand.primarySurface,
  },
  viewText: { fontFamily: fonts.bold, fontSize: 11, color: brand.primary },
});
