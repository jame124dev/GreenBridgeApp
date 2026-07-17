// Swipeable results pager — the "View all N" popup for chat search results.
// The inline thread shows a capped 2-column grid (conversation first); THIS
// modal is where the buyer flips through the full result set one product per
// page (horizontal snap paging), with a live "n / N" counter and a tap-through
// to the real marketplace listing. (User feedback: 28 stacked full-width cards
// buried the chat — browse belongs in a dedicated, swipeable surface.)
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ImageOff, X } from 'lucide-react-native';

import { AppImage } from '@/components/ui';
import { fonts, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { createThemedStyles, useColor } from './theme';
import { Chip, condLabel, countryLabel } from './cardKit';
import type { ProductRow } from './cards';

export function ProductPagerSheet({
  visible,
  rows,
  onClose,
  onOpenProduct,
}: {
  visible: boolean;
  rows: ProductRow[];
  onClose: () => void;
  /** Tap-through to the marketplace listing (caller closes + navigates). */
  onOpenProduct: (row: ProductRow) => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const accentIconMuted = useColor('accent.iconMuted');
  const textMuted = useColor('text.muted');
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<ProductRow>>(null);

  // Page geometry: the card fills the sheet minus its horizontal padding, and
  // each FlatList page snaps to exactly one card width.
  const sheetWidth = Math.min(windowWidth - spacing.lg * 2, 520);
  const pageWidth = sheetWidth - spacing.lg * 2;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      if (i !== index) {
        haptics.tap();
        setIndex(Math.max(0, Math.min(rows.length - 1, i)));
      }
    },
    [index, pageWidth, rows.length],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Scrim — tap outside the sheet to dismiss. */}
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.sheet, { width: sheetWidth }]} onPress={() => undefined}>
          {/* Header: count eyebrow + live position + close. */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {t('mobile.labCards.resultsCount', { count: rows.length })}
            </Text>
            <Text style={styles.headerCounter}>
              {t('mobile.labCards.pagerOf', { current: index + 1, total: rows.length })}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.labCommon.close')}
              style={styles.closeBtn}
            >
              <X size={18} color={textMuted} />
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={rows}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={pageWidth}
            decelerationRate="fast"
            onMomentumScrollEnd={onMomentumEnd}
            keyExtractor={(row, i) => `${row.id ?? 'x'}-${i}`}
            getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
            renderItem={({ item: row }) => {
              const priced = typeof row.price === 'number' && row.price > 0;
              return (
                <Pressable
                  style={[styles.page, { width: pageWidth }]}
                  onPress={() => onOpenProduct(row)}
                  accessibilityRole="button"
                  accessibilityLabel={row.name ?? t('mobile.labCards.untitledListing')}
                >
                  <View style={styles.pageImage}>
                    {row.image ? (
                      <AppImage
                        source={{ uri: row.image }}
                        style={styles.pageImageFill}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.pageImagePlaceholder}>
                        <ImageOff size={30} color={accentIconMuted} />
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={2} style={styles.pageName}>
                    {row.name || t('mobile.labCards.untitledListing')}
                  </Text>
                  <View style={styles.pageChips}>
                    {row.condition ? <Chip tone="emerald">{condLabel(row.condition)}</Chip> : null}
                    {row.country ? <Chip>{countryLabel(row.country)}</Chip> : null}
                  </View>
                  {priced ? (
                    <Text style={styles.pagePrice}>
                      {`${row.currency ? `${row.currency} ` : ''}${row.price!.toLocaleString()}`}
                    </Text>
                  ) : (
                    <Text style={styles.pagePriceMuted}>{t('mobile.labCards.priceOnRequest')}</Text>
                  )}
                  <View style={styles.openHint}>
                    <Text style={styles.openHintText}>{t('mobile.labCards.openListing')}</Text>
                  </View>
                </Pressable>
              );
            }}
          />

          {/* Swipe affordance — dots for small sets, the counter carries big ones. */}
          {rows.length > 1 && rows.length <= 8 ? (
            <View style={styles.dots}>
              {rows.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createThemedStyles((t) => ({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 14, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: t.color['surface.raised'],
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: t.color['text.muted'],
  },
  headerCounter: {
    fontFamily: fonts.labelMedium,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    color: t.color['text.secondary'],
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color['surface.alt'],
  },
  page: { gap: spacing.sm },
  pageImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: t.color['surface.alt'],
  },
  pageImageFill: { width: '100%', height: '100%' },
  pageImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageName: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: t.color['text.primary'],
    minHeight: 44,
  },
  pageChips: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  pagePrice: { fontFamily: fonts.semibold, fontSize: 15, color: t.color['accent.pressed'] },
  pagePriceMuted: { fontFamily: fonts.regular, fontSize: 13, color: t.color['text.muted'] },
  openHint: {
    marginTop: spacing.xs,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: t.color['surface.alt'],
  },
  openHintText: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: t.color['accent.pressed'],
  },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.color['border.subtle'],
  },
  dotActive: { backgroundColor: t.color['accent.pressed'] },
}));
