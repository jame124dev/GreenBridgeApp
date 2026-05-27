import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, ChevronLeft, ChevronRight, Sparkles, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage, Badge, Button, HStack, Screen, Stack } from '@/components/ui';
import { useSubmitGroupedListing } from '@/features/scanner/useSubmitGroupedListing';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { useScanDraft, type DraftItem } from '@/stores/scanDraftStore';
import { colors, fonts, fontSize, radius, spacing } from '@/theme';

// How many trailing photos to show as thumbnails under the hero before
// collapsing the rest into a "+N" overlay on the last tile.
const MAX_THUMBS = 4;

export default function GroupedReviewScreen() {
  const { t } = useTranslation();
  const queuedItems = useScanDraft((s) => s.queuedItems);
  const sessionVisibility = useScanDraft((s) => s.sessionVisibility);
  const networkSellers = useScanDraft((s) => s.networkSellers);
  const removeQueuedItem = useScanDraft((s) => s.removeQueuedItem);
  const editQueuedItem = useScanDraft((s) => s.editQueuedItem);
  const submitGrouped = useSubmitGroupedListing();
  const reset = useScanDraft((s) => s.reset);

  // Smart-detection meta — only populated when this screen was reached via the
  // auto single-vs-multiple flow (Docs/SMART_DETECTION_FLOW.md). Empty otherwise.
  const detectionSummary = useScanDraft((s) => s.detectionSummary);
  const detectionConfidence = useScanDraft((s) => s.detectionConfidence);
  const mergedSingle = useScanDraft((s) => s.mergedSingle);
  const collapseToSingle = useScanDraft((s) => s.collapseToSingleFromSmartDetection);

  const fromDetection = !!detectionSummary;
  const isLowConfidence = fromDetection && detectionConfidence < 0.7;

  const useAsSingleProduct = async () => {
    haptics.impact();
    await collapseToSingle();
    router.replace(routes.scanDetail);
  };

  const editItem = (id: string) => {
    editQueuedItem(id);
    router.push(routes.scanDetail);
  };

  useEffect(() => {
    if (queuedItems.length === 0) router.replace(routes.scanHome);
  }, [queuedItems.length]);

  const onSubmit = () => {
    const items = useScanDraft.getState().queuedItems;
    haptics.impact();
    submitGrouped.mutate(
      { items, visibility: sessionVisibility, networkSellers },
      {
        onSuccess: ({ batchPk, batchNumber, itemCount }) => {
          haptics.success();
          reset();
          router.replace(routes.scanSuccess(batchPk, batchNumber, itemCount));
        },
        onError: (err) => {
          haptics.error();
          const saved = useScanDraft.getState().queuedItems.filter((i) => i.productId).length;
          const base = (err as Error).message ?? t('mobile.detail.submitFailedBodyDefault');
          const message =
            saved > 0
              ? `${base}\n\n${t('mobile.groupedReview.partialProgress', { saved, count: saved })}`
              : base;
          Alert.alert(t('mobile.groupedReview.submitFailedTitle'), message);
        },
      },
    );
  };

  const addAnother = () => router.push(routes.scanCamera);

  if (queuedItems.length === 0) return null;

  const count = queuedItems.length;

  return (
    <Screen padded={false}>
      <HStack align="center" justify="space-between" style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('mobile.groupedReview.heading')}</Text>
        <View style={{ width: 24 }} />
      </HStack>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title block — "We found N products" framing when the AI proposed the
            split; plain count otherwise (manual grouped path). */}
        <Text style={styles.bigTitle}>
          {fromDetection
            ? t('mobile.itemReview.foundProducts', { count })
            : t('mobile.groupedReview.heading')}
        </Text>
        <Text style={styles.bigSubtitle}>
          {fromDetection
            ? t('mobile.itemReview.checkGroups')
            : t('mobile.groupedReview.subtitle', { count })}
        </Text>

        {/* Low-confidence nudge + "it's actually one product" override. */}
        {isLowConfidence ? (
          <View style={styles.hintRow}>
            <Sparkles color={colors.primary} size={16} />
            <Text style={styles.hintText}>{t('mobile.itemReview.lowConfidenceHint')}</Text>
          </View>
        ) : null}
        {fromDetection && mergedSingle ? (
          <Pressable onPress={useAsSingleProduct} hitSlop={8} style={styles.override}>
            <Text style={styles.overrideText}>{t('mobile.itemReview.itsOneProduct')}</Text>
          </Pressable>
        ) : null}

        <Stack gap="xl" style={styles.cards}>
          {queuedItems.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              canRemove={count > 1}
              onEdit={() => editItem(item.id)}
              onRemove={() => removeQueuedItem(item.id)}
            />
          ))}
        </Stack>

        <Pressable style={styles.addAnother} onPress={addAnother}>
          <Text style={styles.addAnotherText}>{t('mobile.groupedReview.addAnother')}</Text>
        </Pressable>

        <View style={styles.submit}>
          <Button
            label={t('mobile.groupedReview.submitN', { count })}
            onPress={onSubmit}
            loading={submitGrouped.isPending}
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

// One detected product — hero photo + trailing-thumbnail strip + photo-count
// badge + a Ready/Details-needed status chip. The whole card opens the item in
// Detail; a low-key trash affordance removes it. Mirrors the Stitch
// "Smart Detection" card, themed with the app's tokens.
function ProductCard({
  item,
  canRemove,
  onEdit,
  onRemove,
}: {
  item: DraftItem;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const photoCount = item.photos.length;
  const hero = item.photos[0]?.uri;
  const rest = item.photos.slice(1, MAX_THUMBS + 1);
  const overflow = photoCount - 1 - rest.length;
  // "Needs attention" when the AI couldn't title or categorise the group.
  const needsAttention = !item.title?.trim() || !item.categoryName?.trim();

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      <HStack align="center" justify="space-between" style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title?.trim() || t('mobile.groupedReview.untitled')}
        </Text>
        <Badge variant="neutral" label={t('mobile.itemReview.photos', { count: photoCount })} />
      </HStack>

      {hero ? (
        <View style={styles.heroWrap}>
          <AppImage source={{ uri: hero }} style={styles.hero} contentFit="contain" />
        </View>
      ) : null}

      {rest.length > 0 ? (
        <HStack gap="sm" style={styles.thumbStrip}>
          {rest.map((p, i) => {
            const isLast = i === rest.length - 1;
            return (
              <View key={p.uri} style={styles.thumbWrap}>
                <AppImage source={{ uri: p.uri }} style={styles.thumb} contentFit="contain" />
                {isLast && overflow > 0 ? (
                  <View style={styles.thumbOverlay}>
                    <Text style={styles.thumbOverlayText}>+{overflow}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </HStack>
      ) : null}

      <HStack align="center" justify="space-between" style={styles.cardFoot}>
        {needsAttention ? (
          <Badge
            variant="review"
            dot
            label={t('mobile.itemReview.detailsNeeded')}
            leftIcon={<AlertTriangle color={colors.warningText} size={12} />}
          />
        ) : (
          <Badge variant="neutral" label={(item.categoryName ?? '').trim()} />
        )}
        <HStack align="center" gap="lg">
          {canRemove ? (
            <Pressable onPress={onRemove} hitSlop={10}>
              <Trash2 color={colors.destructive} size={18} />
            </Pressable>
          ) : null}
          <ChevronRight color={colors.mutedForeground} size={18} />
        </HStack>
      </HStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing['5xl'],
    paddingTop: spacing.md,
  },
  headerTitle: { fontFamily: fonts.heading, fontSize: fontSize['3xl'], color: colors.foreground },
  scroll: { paddingHorizontal: spacing['5xl'], paddingBottom: spacing['9xl'] },

  bigTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSize['5xl'],
    color: colors.foreground,
    marginTop: spacing['3xl'],
  },
  bigSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  // Low-confidence hint + override
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
    color: colors.foreground,
    lineHeight: 18,
  },
  override: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  overrideText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.primary },

  cards: { marginTop: spacing['3xl'] },

  // Rich product card (hero + thumbnails + chips)
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardPressed: { opacity: 0.92 },
  cardHead: {},
  cardTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSize.xl,
    color: colors.foreground,
    marginRight: spacing.md,
  },
  // Product-on-white tile (marketplace style) — clean backdrop for cutout PNGs
  // and letterboxed photos alike; `contain` keeps the whole product visible.
  heroWrap: {
    width: '100%',
    height: 172,
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
  },
  hero: { width: '100%', height: '100%' },
  thumbStrip: { flexWrap: 'nowrap' },
  thumbWrap: { flex: 1, position: 'relative' },
  thumb: {
    width: '100%',
    height: 56,
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlayText: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: '#fff' },
  cardFoot: { paddingHorizontal: spacing.xs },

  // Add another (dashed CTA)
  addAnother: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing['3xl'],
  },
  addAnotherText: { fontFamily: fonts.semibold, fontSize: fontSize.xl, color: colors.primary },

  submit: { marginTop: spacing.md },
});
