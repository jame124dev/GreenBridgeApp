import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage, HStack, Screen, Stack } from '@/components/ui';
import {
  getDraftRequiredStatus,
  type RequiredRowKey,
} from '@/features/scanner/requiredStatus';
import { useRequiredRowLabel } from '@/features/scanner/requiredRowLabels';
import { useSubmitGroupedListing } from '@/features/scanner/useSubmitGroupedListing';
import {
  SellerApprovalNotice,
  useSubmitCtaLabel,
} from '@/features/seller/components/SellerApprovalNotice';
import { canSubmitListing, redirectToSellerApplication } from '@/features/seller/sellerSubmitGate';
import { useCanSell } from '@/features/seller/useSellerUpgrade';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { useScanDraft, type DraftItem } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

/**
 * Round 2 R1 — review LIST hub (replaces the Round-1 linear wizard).
 *
 * One row per `queuedItems[i]` with a live completion badge. Tapping a row
 * opens the per-item editor (R2 route `routes.scanGroupedEdit(index)`); when
 * the editor's Save & Return lands, the hub re-renders from the live
 * `queuedItems` store and the badge flips to "Ready ✓".
 *
 * Submit is pinned at the bottom and DISABLED until every row passes the
 * Ready predicate (note R-3: `getDraftRequiredStatus(item).allComplete` AND
 * `item.photos.length > 0`). A helper line shows "{ready} of {total} ready"
 * so the gate is never a mystery.
 *
 * Note R-2 honored: all per-item writes go through `patchQueuedItem(index, …)`
 * from the editor; the hub itself never touches `editQueuedItem` /
 * `current` / `editingGroupedItem`.
 * Note R-4 honored: smart-detection low-confidence nudge and the "it's
 * actually one product" pill (which leaves the wizard for the single-product
 * `detail.tsx` editor) live at the top of the hub. Empty-queue redirect
 * to `routes.scanHome` preserved.
 */
export default function GroupedReviewHub() {
  const { t } = useTranslation();
  const queuedItems = useScanDraft((s) => s.queuedItems);
  const reset = useScanDraft((s) => s.reset);
  const sessionVisibility = useScanDraft((s) => s.sessionVisibility);
  const networkSellers = useScanDraft((s) => s.networkSellers);
  const submitGrouped = useSubmitGroupedListing();
  // Seller approval is required to PUBLISH, not to author (see
  // `@/features/seller/sellerSubmitGate`). Reactive here so the CTA can tell the
  // truth about what it will do; the callback re-reads the predicate itself.
  const canPublish = useCanSell();
  const ctaLabel = useSubmitCtaLabel(
    t('mobile.reviewHub.submitAll', { defaultValue: 'Submit all' }),
  );

  // Smart-detection handoff state (note R-4).
  const detectionSummary = useScanDraft((s) => s.detectionSummary);
  const detectionConfidence = useScanDraft((s) => s.detectionConfidence);
  const mergedSingle = useScanDraft((s) => s.mergedSingle);
  const collapseToSingle = useScanDraft((s) => s.collapseToSingleFromSmartDetection);

  // Bounce to home when the queue empties — BUT NOT while a submit is in
  // flight or has just succeeded. onSuccess calls reset() (emptying the queue)
  // immediately before navigating to the Success screen; without this guard the
  // empty-queue redirect races and overrides that nav, dumping the user on Home
  // instead of Success (and making it look like nothing was submitted).
  useEffect(() => {
    if (submitGrouped.isPending || submitGrouped.isSuccess) return;
    if (queuedItems.length === 0) router.replace(routes.scanHome);
  }, [queuedItems.length, submitGrouped.isPending, submitGrouped.isSuccess]);

  // Per-row + aggregate readiness. Single source of truth: the same
  // `getDraftRequiredStatus` predicate Submit will enforce (note R-3).
  // D3 (note D-3): also surface the missing-row keys so the badge can preview
  // them ("Missing: price, condition") — derived from the SAME `rows` object
  // the predicate already builds; no parallel field-derivation path.
  const rowStatuses = useMemo(
    () =>
      queuedItems.map((item) => {
        const status = getDraftRequiredStatus(item);
        const hasPhotos = (item.photos?.length ?? 0) > 0;
        const ready = status.allComplete && hasPhotos;
        const missingKeys = (Object.keys(status.rows) as RequiredRowKey[]).filter(
          (k) => !status.rows[k],
        );
        const missingCount = missingKeys.length;
        return { ready, missingCount, missingKeys };
      }),
    [queuedItems],
  );

  const total = queuedItems.length;
  const readyCount = rowStatuses.filter((r) => r.ready).length;
  const allReady = total > 0 && readyCount === total;

  if (queuedItems.length === 0) return null;

  const fromDetection = !!detectionSummary;
  const isLowConfidence = fromDetection && detectionConfidence < 0.7;
  const showCollapsePill = fromDetection && mergedSingle;

  const onRowTap = (index: number) => {
    haptics.tap();
    router.push(routes.scanGroupedEdit(index));
  };

  const useAsSingleProduct = async () => {
    haptics.impact();
    await collapseToSingle();
    router.replace(routes.scanDetail);
  };

  // R3: gated Submit. The Button's `disabled={!allReady || isPending}` already
  // prevents the typical not-ready tap, but we re-sweep here as defense in
  // depth — if any item somehow fails the Ready predicate at submit time
  // (e.g. a store-side race), name the broken row, jump the user there,
  // never let a partial-data POST reach the backend (whose grouped endpoint
  // would otherwise 400).
  const onSubmitAll = () => {
    if (submitGrouped.isPending) return;

    // ⚠️ SELL GATE — choke point 1 of 2 (the other is `onSubmitSingle` in
    // `useDetailController`; they POST to different endpoints, so both need it).
    //
    // FIRST, before the field sweep below: when the tap is going to take them to
    // the seller form, nagging about an unfilled price on the way is noise. The
    // draft stays in `useScanDraft` (in-memory), so it is still here on return.
    if (!canSubmitListing()) {
      haptics.tap();
      redirectToSellerApplication();
      return;
    }

    // Pre-flight sweep over the live store queue (not the React snapshot).
    const liveItems = useScanDraft.getState().queuedItems;
    for (let i = 0; i < liveItems.length; i++) {
      const it = liveItems[i];
      if (!it) continue;
      const ok =
        getDraftRequiredStatus(it).allComplete && (it.photos?.length ?? 0) > 0;
      if (!ok) {
        haptics.error();
        Alert.alert(
          t('mobile.reviewHub.finalValidationTitle', {
            defaultValue: 'A product needs info',
          }),
          t('mobile.reviewHub.finalValidationBody', {
            defaultValue:
              'Product {{index}} is missing required fields. Open it to fix.',
            index: i + 1,
          }),
          [
            { text: t('mobile.common.cancel'), style: 'cancel' },
            {
              text: t('mobile.reviewHub.openProduct', {
                defaultValue: 'Open product {{index}}',
                index: i + 1,
              }),
              onPress: () => router.push(routes.scanGroupedEdit(i)),
            },
          ],
        );
        return;
      }
    }

    haptics.impact();

    submitGrouped.mutate(
      {
        items: liveItems,
        visibility: sessionVisibility,
        networkSellers,
      },
      {
        onSuccess: ({ batchPk, batchNumber, itemCount, groupId, items }) => {
          haptics.success();
          reset();
          router.replace(
            routes.scanSuccess(batchPk, batchNumber, itemCount, groupId, items),
          );
        },
        onError: (err) => {
          haptics.error();
          Alert.alert(
            t('mobile.reviewWizard.submitFailedTitle', {
              defaultValue: 'Submission failed',
            }),
            (err as Error).message ??
              t('mobile.detail.submitFailedBodyDefault'),
          );
        },
      },
    );
  };

  return (
    // `scroll={false}` is required, not cosmetic: without it Screen wraps the
    // header, the inner ScrollView below AND the "pinned" Submit footer in a
    // SECOND vertical ScrollView (flexGrow:1 + its own bottom padding). That
    // nested same-axis scroller meant the footer was not actually pinned, and
    // the bottom inset was reserved twice (SafeAreaView 'bottom' edge + the
    // outer scroller), leaving a ~48px dead gap under the primary CTA.
    // detection.tsx has the identical 3-region layout and does this correctly.
    <Screen padded={false} scroll={false} edges={['top', 'bottom']}>
      {/* Stitch "Review Inventory" redesign: left-aligned bold header with a
          hairline rule, instead of the old centered title + right spacer. */}
      <HStack
        align="center"
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: brand.divider,
        }}
      >
        <Pressable
          onPress={() => safeBack()}
          hitSlop={12}
          disabled={submitGrouped.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
          style={{ opacity: submitGrouped.isPending ? 0.4 : 1 }}
        >
          <ChevronLeft color={brand.foreground} size={24} />
        </Pressable>
        <Text
          className="font-heading text-5xl text-brand-foreground"
          style={{ lineHeight: 30 }}
        >
          {t('mobile.reviewHub.heading', {
            defaultValue: 'Review {{count}} products',
            count: total,
          })}
        </Text>
      </HStack>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 40,
          flexGrow: 1,
        }}
      >
        {/* Smart-detection low-confidence nudge (R-4 preserved). */}
        {isLowConfidence ? (
          <View
            className="flex-row items-start gap-1.5 bg-brand-primary-surface rounded-sm p-2.5 mt-md"
          >
            <Sparkles color={brand.primary} size={16} />
            <Text
              className="flex-1 font-sans text-md text-brand-foreground"
              style={{ lineHeight: 18 }}
            >
              {t('mobile.itemReview.lowConfidenceHint')}
            </Text>
          </View>
        ) : null}

        {/* "It's actually one product" handoff to detail.tsx (R-4 preserved).
            D5 (F10): demoted to neutral muted surface + hairline border so
            brand-green stays reserved for the primary path. */}
        {showCollapsePill ? (
          <Pressable
            onPress={useAsSingleProduct}
            hitSlop={8}
            className="self-start mt-2.5 px-md rounded-pill border border-brand-border bg-brand-surface-muted"
            style={{ paddingVertical: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.itemReview.itsOneProduct')}
          >
            <Text className="font-semi text-base text-brand-muted-foreground">
              {t('mobile.itemReview.itsOneProduct')}
            </Text>
          </Pressable>
        ) : null}

        <Text
          className="font-sans text-base text-brand-text-muted"
          style={{ lineHeight: 22, marginTop: 20, marginBottom: 16 }}
        >
          {t('mobile.reviewHub.subtitle', {
            defaultValue:
              'Tap a product to fill in its details. Submit unlocks when every product is ready.',
          })}
        </Text>

        <Stack gap="lg">
          {queuedItems.map((item, index) => {
            const { ready, missingCount, missingKeys } = rowStatuses[index] ?? {
              ready: false,
              missingCount: 1,
              missingKeys: [] as RequiredRowKey[],
            };
            return (
              <HubRow
                key={item.id}
                index={index}
                item={item}
                ready={ready}
                missingCount={missingCount}
                missingKeys={missingKeys}
                onPress={() => onRowTap(index)}
                disabled={submitGrouped.isPending}
              />
            );
          })}
        </Stack>

        {/* D5 (F6 / round-3): `marginTop:'auto'` consumes all the slack the
            `flexGrow:1` content container creates, pushing this anchor note to
            the BOTTOM of the scroll area (just above the pinned footer) instead
            of leaving the rows top-aligned over a dead white band. With a short
            1–2 product list the note now sits low and the void is gone; with a
            long list that overflows, `marginTop:'auto'` collapses to 0 and the
            note simply trails the rows as normal scrollable content. */}
        <Text
          className="font-sans text-base text-brand-text-muted text-center"
          style={{
            lineHeight: 20,
            marginTop: 'auto',
            paddingTop: 40,
            fontStyle: 'italic',
          }}
        >
          {t('mobile.reviewHub.scanFootnote', {
            defaultValue:
              'Detected from your scan — tap any product to review.',
          })}
        </Text>
      </ScrollView>

      {/* Pinned footer: progress bar + caps ready-counter + gated Submit
          (Stitch "Review Inventory" redesign — brand forest-green fill). */}
      <View
        className="bg-brand-background"
        style={{ borderTopWidth: 1, borderTopColor: brand.border }}
      >
        {/* Thin progress track: fills forest-green as products become ready. */}
        <View style={{ height: 4, backgroundColor: brand.divider }}>
          <View
            style={{
              height: 4,
              width: `${total > 0 ? Math.round((readyCount / total) * 100) : 0}%`,
              backgroundColor: brand.primaryDim,
            }}
          />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 16,
            gap: 12,
          }}
        >
          {/* Caps "{ready} OF {total} PRODUCTS READY" + trailing divider rule.
              Numerator emphasised in brand foreground (carried over from the
              D2/F9 split-counter intent). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text
              className="font-medium"
              style={{
                fontSize: 12,
                letterSpacing: 1,
                color: brand.textMuted,
                textTransform: 'uppercase',
              }}
            >
              <Text style={{ color: brand.foreground }}>
                {t('mobile.reviewHub.readyCounterFraction', {
                  defaultValue: '{{ready}} of {{total}}',
                  ready: readyCount,
                  total,
                })}
              </Text>
              {' '}
              {t('mobile.reviewHub.readyCounterSuffix', {
                defaultValue: 'products ready',
              })}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: brand.divider }} />
          </View>

          {/* Says the seller-details step is coming BEFORE the CTA is tapped.
              Renders nothing for an approved seller. */}
          <SellerApprovalNotice />

          {/* D2 (F2 + note D-1): local override — DO NOT modify the shared
              Button primitive (would rebrand the whole app). Brand forest
              #14452f enabled, FLAT neutral when disabled (no opacity-50). */}
          <CtaSubmitButton
            label={ctaLabel}
            onPress={onSubmitAll}
            loading={submitGrouped.isPending}
            // An incomplete row only blocks PUBLISHING. A user who still has to
            // add seller details may go and do that now — the missing field and
            // the approval wait then run in parallel instead of in series.
            disabled={(!allReady && canPublish) || submitGrouped.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}

// ── Brand CTA (D2 / note D-1) ─────────────────────────────────────────────────
// Local override only — keeps the shared Button primitive untouched so we don't
// silently rebrand every primary button in the app. Disabled state is a FLAT
// neutral fill (not opacity-50), so the label stays readable.
function CtaSubmitButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  // The button's fill + padding live on an explicit inner <View>, NOT on the
  // Pressable's functional `style`. On this RN/Hermes + NativeWind build, a
  // functional style on an interop'd Pressable silently DROPS layout props
  // (minHeight/padding/alignItems) — which made the button shrink to hug its
  // text and read as floating, background-less text. A plain View is immune.
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      accessibilityLabel={label}
    >
      {({ pressed }) => (
        <View
          style={{
            // Disabled = a CLEARLY VISIBLE neutral-gray button (matching the
            // Stitch "Review Inventory" mock), NOT the near-white surfaceMuted
            // that vanished into the page background. Enabled = forest #14452f.
            backgroundColor: disabled
              ? '#d4d8df'
              : pressed
                ? brand.primaryDim
                : brand.primary,
            borderRadius: 12,
            minHeight: 52,
            paddingVertical: 16,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: disabled ? 1 : 0,
            borderColor: brand.borderStrong,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text
              className="font-bold"
              style={{
                fontSize: 16,
                color: disabled ? brand.mutedForeground : '#ffffff',
              }}
            >
              {label}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ── Hub row ──────────────────────────────────────────────────────────────────

function HubRow({
  index,
  item,
  ready,
  missingCount,
  missingKeys,
  onPress,
  disabled,
}: {
  index: number;
  item: DraftItem;
  ready: boolean;
  missingCount: number;
  missingKeys: RequiredRowKey[];
  onPress: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const labelForRow = useRequiredRowLabel();
  const hero = item.photos[0]?.uri;
  const title =
    item.title?.trim() ||
    t('mobile.reviewHub.untitled', {
      defaultValue: 'Product {{index}}',
      index: index + 1,
    });

  // D1: composed accessibility label includes completion status.
  const a11yLabel = ready
    ? t('mobile.reviewHub.rowA11yReady', {
        defaultValue: '{{title}}, ready',
        title,
      })
    : t('mobile.reviewHub.rowA11yNeedsInfo', {
        defaultValue: '{{title}}, needs info, {{count}} fields missing',
        title,
        count: missingCount,
      });

  // D3 (F7 + note D-3): build a missing-fields preview from the SAME
  // `getDraftRequiredStatus` rows the predicate uses (no parallel derivation).
  // Translate row keys via the existing `mobile.detail.section*` keys (which
  // ship UPPERCASE in en.json) then lowercase to keep the chip sentence-case.
  // Cap at 2 names + "+N more" when longer.
  const missingLabel = (() => {
    const names = missingKeys.map((k) => labelForRow(k).toLowerCase());
    const head = names.slice(0, 2).join(', ');
    const extra = names.length - 2;
    const preview = extra > 0 ? `${head} +${extra} more` : head;
    return t('mobile.reviewHub.statusMissing', {
      defaultValue: 'Missing: {{preview}}',
      preview: preview || 'details',
    });
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => ({
        opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
        backgroundColor: brand.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: brand.borderStrong,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 80,
        // Light card elevation so rows read as tappable cards on the near-
        // white page background (D1 fix for F3).
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          flexGrow: 1,
          flexShrink: 1,
        }}
      >
      {hero ? (
        <AppImage
          source={{ uri: hero }}
          style={{
            width: 96,
            height: 96,
            borderRadius: 8,
            backgroundColor: '#f4f7f6',
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 8,
            backgroundColor: '#f4f7f6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text className="font-bold text-brand-foreground text-base">
            {index + 1}
          </Text>
        </View>
      )}

      {/* Middle column: flex:1 + minWidth:0 prevents the chevron from
          wrapping below long titles (D1 fix for F1). */}
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Text
          className="font-bold text-brand-foreground"
          numberOfLines={2}
          style={{ fontSize: 16, lineHeight: 21 }}
        >
          {title}
        </Text>
        {/* D3 (F5/F7/F8): inline status chips — call-site overrides so we don't
            touch the shared Badge primitive (which hard-codes `font-bold
            uppercase` on its inner Text and would have app-wide blast radius).
            Ready = brand-green success chip; Needs-info = amber with the
            missing-fields preview, sentence-case, no redundant dot. */}
        {ready ? (
          <View
            className="flex-row items-center self-start rounded-lg px-2 py-1 gap-xs"
            style={{
              backgroundColor: brand.successBg,
              borderColor: brand.successBorder,
              borderWidth: 1,
            }}
          >
            <CheckCircle2 color={brand.primary} size={14} />
            <Text
              className="font-medium"
              style={{
                color: brand.primary,
                fontSize: 11,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {t('mobile.reviewHub.statusReady', { defaultValue: 'Ready' })}
            </Text>
          </View>
        ) : (
          <View
            className="flex-row items-center self-start rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 gap-xs"
          >
            <AlertTriangle color={brand.warningText} size={14} />
            <Text
              className="font-medium text-neutral-700"
              style={{
                fontSize: 11,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {missingLabel}
            </Text>
          </View>
        )}
      </View>

      {/* Right-anchored chevron with a fixed-width box so it never wraps. */}
      <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight color={brand.textMuted} size={24} />
      </View>
      </View>
    </Pressable>
  );
}
