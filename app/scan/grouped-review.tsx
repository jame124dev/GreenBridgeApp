import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

/*
  v2 KIT. This screen was the last NativeWind holdout in the scan flow — it
  ran on `brand.*` constants, hardcoded `fontSize`, raw hex (`#14452f`,
  `#d4d8df`, `#f4f7f6`) and a local CTA that reimplemented the primary button,
  so arriving here from the freshly-ported `scan/detection` looked like leaving
  the app. Presentation only: every predicate, handler, gate and `router` call
  below is untouched.
*/
import {
  Chip,
  GlyphButton,
  Hairline,
  PrimaryAction,
  ProgressLine,
  QuietAction,
  Row,
  RowThumb,
  RowTrailing,
  Screen,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';
import {
  getDraftRequiredStatus,
  type RequiredRowKey,
} from '@/features/scanner/requiredStatus';
import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import { useRequiredRowLabel } from '@/features/scanner/requiredRowLabels';
import { isRoutingResolved } from '@/features/scanner/routing/routingState';
import { useSubmitGroupedListing } from '@/features/scanner/useSubmitGroupedListing';
import {
  exportGroupedReviewToXlsx,
  type ExportProgress,
} from '@/features/scanner/exportGroupedReviewXlsx';
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
  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  // The same key→label map `HubRow` uses, so the footer's summary and the
  // rows' chips cannot name the same field two different ways.
  const labelForBlocked = useRequiredRowLabel();
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
        // M-3 — an unanswered routing question is a missing required answer,
        // counted alongside the schema rows so the hub's "n of m ready" and the
        // pre-flight sweep agree with the footer.
        const routingResolved = isRoutingResolved(item);
        const ready = status.allComplete && hasPhotos && routingResolved;
        const missingKeys = (Object.keys(status.rows) as RequiredRowKey[]).filter(
          (k) => !status.rows[k],
        );
        const missingCount = missingKeys.length + (routingResolved ? 0 : 1);
        return { ready, missingCount, missingKeys, routingResolved };
      }),
    [queuedItems],
  );

  const total = queuedItems.length;
  const readyCount = rowStatuses.filter((r) => r.ready).length;
  const allReady = total > 0 && readyCount === total;

  /** Where "fix the next one" goes. `null` once everything passes. */
  const firstIncompleteIndex = rowStatuses.findIndex((r) => !r.ready);
  const firstIncomplete = firstIncompleteIndex === -1 ? null : firstIncompleteIndex;

  /*
    One sentence naming what is blocking submit.

    A 9-product scan of one supplier's spreadsheet produces NINE rows missing
    the SAME field — location — and saying "Missing: location" nine times down
    the list tells the seller nothing they cannot see. When every incomplete
    product is short of exactly the same thing, say it once and say how many.
    Otherwise fall back to the count of products that still need attention.

    Derived from `rowStatuses`, which is derived from `getDraftRequiredStatus`,
    so it cannot drift from the predicate Submit actually enforces.
  */
  const blockedSummary = useMemo(() => {
    const incomplete = rowStatuses.filter((r) => !r.ready);
    if (incomplete.length === 0) return '';

    // An unanswered routing question outranks the schema rows — it decides
    // which tree the other fields even belong to.
    if (incomplete.every((r) => !r.routingResolved)) {
      return t('mobile.reviewHub.blockedAllMarketplace', {
        count: incomplete.length,
        defaultValue: `${incomplete.length} products still need a marketplace.`,
      });
    }

    const keySets = incomplete.map((r) => r.missingKeys);
    const shared =
      keySets[0]?.length === 1 &&
      keySets.every((keys) => keys.length === 1 && keys[0] === keySets[0][0])
        ? keySets[0][0]
        : null;

    if (shared) {
      return t('mobile.reviewHub.blockedSharedField', {
        count: incomplete.length,
        field: labelForBlocked(shared).toLowerCase(),
        defaultValue: `${incomplete.length} products still need a ${labelForBlocked(shared).toLowerCase()}.`,
      });
    }

    return t('mobile.reviewHub.blockedMixed', {
      count: incomplete.length,
      defaultValue: `${incomplete.length} products still need details.`,
    });
  }, [rowStatuses, t, labelForBlocked]);

  /*
    ⚠️ ABOVE THE EARLY RETURN. This `useState` arrived with the Excel export and
    sat BELOW `if (queuedItems.length === 0) return null` — a rules-of-hooks
    violation that eslint reports as an error, and a real crash, not a style
    note: while the queue is empty the component returns before this hook runs,
    so the moment an item arrives React sees one more hook than last render and
    throws "Rendered more hooks than during the previous render." The queue
    starts empty on a cold open of this route.
  */
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

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
  /**
   * "Export to Excel" — a bulk take-away of what the scan found, one row per
   * queued product with its own photo embedded. Reads the LIVE store queue
   * (not the React snapshot) for the same reason `onSubmitAll`'s pre-flight
   * sweep does: this can be tapped moments after an edit that hasn't finished
   * re-rendering this closure yet.
   */
  const onExport = async () => {
    if (isExporting) return;
    haptics.tap();
    setIsExporting(true);
    setExportProgress(null);
    try {
      const liveItems = useScanDraft.getState().queuedItems;
      await exportGroupedReviewToXlsx(liveItems, setExportProgress);
    } catch (err) {
      if (__DEV__) console.warn('[onExport] failed', err);
      haptics.error();
      toast.error(
        t('mobile.reviewHub.exportFailed', {
          defaultValue: "Couldn't export the spreadsheet. Try again.",
        }),
      );
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

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
        getDraftRequiredStatus(it).allComplete &&
        (it.photos?.length ?? 0) > 0 &&
        isRoutingResolved(it);
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
    <Screen scroll={false} tabBar={false} testID="scan-grouped-review">
      {/*
        App bar matches `scan/detection`'s exactly — a 44pt `GlyphButton` and
        nothing else. The old header put the screen TITLE in the bar at
        `text-5xl`, which on a 9-product scan wrapped to two lines and pushed
        the list down by 30pt before a single row was visible. The title now
        scrolls with the content, where a long one costs nothing.
      */}
      <View style={styles.appBar}>
        <GlyphButton
          onPress={() => safeBack()}
          disabled={submitGrouped.isPending}
          accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
        >
          <ChevronLeft color={c.ink} size={icon.lg} strokeWidth={1.8} />
        </GlyphButton>
        <View style={styles.appBarCentre}>
          <Text variant="eyebrow" color="inkMuted">
            {t('mobile.reviewHub.eyebrow', { defaultValue: 'REVIEW' })}
          </Text>
        </View>
        <View style={styles.appBarSpacer} />
      </View>
      <Hairline />

      <FlatList
        data={queuedItems}
        /*
          `item.id`, never the index. Same reason as `scan/detection`: the queue
          can lose an entry (the "actually one product" collapse empties it
          outright) and an index key would hand a deleted row's mounted subtree
          to its neighbour. The store already gives every draft a stable id, so
          this one was free.
        */
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const { ready, missingCount, missingKeys, routingResolved } =
            rowStatuses[index] ?? {
              ready: false,
              missingCount: 1,
              missingKeys: [] as RequiredRowKey[],
              routingResolved: true,
            };
          return (
            <HubRow
              index={index}
              total={total}
              item={item}
              ready={ready}
              missingCount={missingCount}
              missingKeys={missingKeys}
              routingResolved={routingResolved}
              onPress={() => onRowTap(index)}
              disabled={submitGrouped.isPending}
            />
          );
        }}
        ListHeaderComponent={
          <>
            {/*
              ── WHAT CAME OFF THIS HEADER, AND WHY ────────────────────────────

              It was four stacked blocks before a single product was visible:
              two chips, the `h2`, and a two-sentence subtitle — and between
              them the same facts were repeated:

                • the COUNT appeared twice — a `10 products` chip directly above
                  a heading reading "Review 10 products";
                • READINESS appeared three times — a `10 of 10 ready` chip here,
                  the `ProgressLine` in the pinned footer, and the blocked
                  summary sentence beside it.

              The chips lost. The heading already carries the count, and the
              footer is PINNED — its progress line is on screen the whole time,
              right next to the control the number is about, so a second copy at
              the top of a scrolling header is the one that can go.

              The subtitle lost its second sentence for the same reason:
              "Submit unlocks when every product is ready" is a rule the footer
              already states more usefully, and states specifically ("9 products
              still need a location") instead of in the abstract.

              The heading needs the gutter EXPLICITLY. `Row` is full-bleed and
              applies GUTTER itself, so `listContent` deliberately has no
              horizontal padding — which left this `h2` starting at x=0, hard
              against the screen edge. Caught on the first device-width shot.
            */}
            <View style={styles.headingRow}>
              <Text variant="h2">
                {t('mobile.reviewHub.heading', {
                  defaultValue: 'Review {{count}} products',
                  count: total,
                })}
              </Text>
              <Text variant="body" color="inkMuted" style={styles.subtitle}>
                {t('mobile.reviewHub.subtitleShort', {
                  defaultValue: 'Tap a product to fill in its details.',
                })}
              </Text>

              {/*
                ⚠️ THE READINESS CHIP STAYS — and the `N products` chip beside
                it did not. Removing BOTH was the first attempt, on the premise
                that the pinned footer already showed readiness. It does not:
                `ProgressLine` takes its `label` as `accessibilityLabel` only
                (`ProgressLine.tsx:80`) and its docblock is explicit that the
                design has "no percentage label beside it". So the footer draws
                a bar and no number, and dropping this chip deleted the only
                visible count of how much is left — caught on the device shot.

                The count chip really was redundant: the `h2` directly above it
                reads "Review 10 products". So the split is now one fact each —
                the heading says how many there are, this says how many are
                done — with no duplication and nothing lost.
              */}
              {/*
                ⚠️ THE LABEL IS ON THE WRAPPER, NOT THE CHIP. `Chip` sets
                `accessibilityElementsHidden` + `importantForAccessibility=
                "no-hide-descendants"` (Chip.tsx:49-50), so its own text never
                reaches a screen reader — its docblock says to put the value on
                the parent whenever the chip is the only place that value
                appears, which is exactly the case here now that the footer's
                `ProgressLine` carries its label as an a11y string only.

                This was dropped when the header was restructured and the count
                went silent; the chip was the last visible copy of it.
              */}
              <View
                style={styles.badgeRow}
                accessible
                accessibilityLabel={t('mobile.reviewHub.readyChip', {
                  ready: readyCount,
                  total,
                  defaultValue: `${readyCount} of ${total} ready`,
                })}
              >
                <Chip
                  label={t('mobile.reviewHub.readyChip', {
                    ready: readyCount,
                    total,
                    defaultValue: `${readyCount} of ${total} ready`,
                  })}
                  tone={allReady ? 'accent' : 'neutral'}
                />
              </View>
            </View>

            {/* Smart-detection low-confidence nudge (R-4 preserved). */}
            {isLowConfidence ? (
              /* `SectionNote` takes no `icon` — the kit deliberately keeps one
                 voice for "here is something to know". The sparkle that used
                 to sit beside this line was carrying the "AI said so" meaning,
                 which the copy already states. */
              <View style={styles.noteRow}>
                <SectionNote tone="muted">
                  {t('mobile.itemReview.lowConfidenceHint')}
                </SectionNote>
              </View>
            ) : null}

            {/*
              "It's actually one product" handoff to detail.tsx (R-4 preserved).
              Was a hand-rolled pill; `QuietAction` is the kit's shape for a
              real-but-secondary action and gives it a 44pt target, which the
              6pt-padded pill did not have.
            */}
            {showCollapsePill ? (
              <View style={styles.collapseRow}>
                <QuietAction
                  label={t('mobile.itemReview.itsOneProduct')}
                  onPress={useAsSingleProduct}
                />
              </View>
            ) : null}
          </>
        }
        ListFooterComponent={
          <SectionNote tone="muted">
            {t('mobile.reviewHub.scanFootnote', {
              defaultValue: 'Detected from your scan — tap any product to review.',
            })}
          </SectionNote>
        }
        ItemSeparatorComponent={RowSeparator}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={total > 4}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
      />

      {/*
        Pinned footer. `insets.bottom` is applied here, not by `Screen` — this
        block sits outside the list and owns its own bottom, the same fix
        `scan/detection`'s footer needed after the Android nav bar covered it.
      */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Hairline />

        <View style={styles.footerBody}>
          <ProgressLine
            value={readyCount}
            total={total}
            label={t('mobile.reviewHub.readyCounter', {
              ready: readyCount,
              total,
              defaultValue: `${readyCount} of ${total} products ready`,
            })}
            animated
          />

          {/*
            ⚠️ THE BLOCKED STATE USED TO BE A GREY BUTTON AND NOTHING ELSE.

            On the 9-product scan this screen was built against, every row was
            missing the same field, the counter read "0 OF 9 PRODUCTS READY",
            and the only control was disabled. Nothing on screen said WHAT was
            missing or where to go — the seller's next move was to guess that
            the rows were tappable.

            So when submit is blocked, the footer names the blocker and offers
            the jump. `blockedSummary` collapses the common case — the same
            field missing from every product — into one sentence instead of
            repeating it N times down the list.
          */}
          {!allReady && canPublish ? (
            <>
              <SectionNote tone="muted">{blockedSummary}</SectionNote>
              <PrimaryAction
                label={t('mobile.reviewHub.fixFirst', {
                  index: (firstIncomplete ?? 0) + 1,
                  defaultValue: `Open product ${(firstIncomplete ?? 0) + 1}`,
                })}
                onPress={() => {
                  // `firstIncomplete`, not the raw `findIndex` result —
                  // `findIndex` returns -1 when everything passes, and -1 + 1
                  // would label the button "Open product 0" and jump to
                  // `scanGroupedEdit(-1)`.
                  if (firstIncomplete === null) return;
                  onRowTap(firstIncomplete);
                }}
                /*
                  FILLED, not tinted. `UX_DESIGN_RULES.md` asks for one obvious
                  primary CTA, and while submit is blocked the only thing the
                  seller can actually do is open the next incomplete product —
                  so that is the primary. Drawn as `tinted` first, which put a
                  pale pill above a grey pill and made the live control and the
                  dead one look equally important.
                */
                disabled={submitGrouped.isPending}
                testID="scan-grouped-review-fix-first"
              />
            </>
          ) : null}

          {/* Says the seller-details step is coming BEFORE the CTA is tapped.
              Renders nothing for an approved seller. */}
          <SellerApprovalNotice />

          {/*
            Secondary, deliberately NOT a second `PrimaryAction` —
            `UX_DESIGN_RULES.md` allows exactly one filled pill per screen, and
            that is Submit. `QuietAction` (`tone="accent"`) is the kit's own
            "findable but not offered" register — the same one `matches.tsx`
            uses for a want's "Resume".
          */}
          <QuietAction
            label={
              isExporting
                ? exportProgress
                  ? t('mobile.reviewHub.exportingProgress', {
                      defaultValue: `Preparing {{done}} of {{total}}…`,
                      done: exportProgress.done,
                      total: exportProgress.total,
                    })
                  : t('mobile.reviewHub.exporting', { defaultValue: 'Preparing spreadsheet…' })
                : t('mobile.reviewHub.export', { defaultValue: 'Export to Excel' })
            }
            onPress={onExport}
            disabled={isExporting || total === 0}
            tone="accent"
            testID="scan-grouped-review-export"
          />

          <PrimaryAction
            label={ctaLabel}
            onPress={onSubmitAll}
            loading={submitGrouped.isPending}
            // An incomplete row only blocks PUBLISHING. A user who still has to
            // add seller details may go and do that now — the missing field and
            // the approval wait then run in parallel instead of in series.
            disabled={(!allReady && canPublish) || submitGrouped.isPending}
            testID="scan-grouped-review-submit"
          />
        </View>
      </View>
    </Screen>
  );
}

/** The gap the old `Stack gap="lg"` applied, now that the list owns spacing. */
function RowSeparator() {
  const c = useV2Colors();
  return <View style={[styles.rowDivider, { backgroundColor: c.hairline }]} />;
}

/*
  `CtaSubmitButton` was here — a 70-line local reimplementation of the primary
  button, written to avoid rebranding the shared `Button` primitive. `Screen`'s
  v2 `PrimaryAction` is that button, already brand-correct in both schemes, so
  the override had nothing left to protect and is gone. Its one hard-won note
  is preserved in the kit: the fill lives on an inner `View`, never on a
  functional `style` on the Pressable, because NativeWind's interop silently
  DROPS layout props from a `({ pressed }) => …` style — see
  `reference_nativewind_drops_function_styles`.
*/

// ── Hub row ──────────────────────────────────────────────────────────────────

function HubRow({
  index,
  total,
  item,
  ready,
  missingCount,
  missingKeys,
  routingResolved,
  onPress,
  disabled,
}: {
  index: number;
  /** How many products the scan has, so the row can say "3 of 9" out loud. */
  total: number;
  item: DraftItem;
  ready: boolean;
  missingCount: number;
  missingKeys: RequiredRowKey[];
  /** M-3 — false when this item's routing question is still unanswered. */
  routingResolved: boolean;
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

  /*
    D1: composed accessibility label includes completion status — and now the
    POSITION too. `Row` announces itself as one node, so on a 9-product list
    "Kubota 3500 centrifuge, needs info" gives no sense of how far down the
    seller is; the visible list has no numbers either, so there is nothing to
    fall back on.
  */
  const position = t('mobile.reviewHub.rowPosition', {
    index: index + 1,
    total,
    defaultValue: `${index + 1} of ${total}`,
  });
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
    // Routing first: it is the answer that decides which tree the other
    // missing fields even belong to, so naming a category before a marketplace
    // would send the seller to a picker that is about to be reloaded.
    if (!routingResolved) {
      return t('mobile.reviewHub.statusMissingMarketplace', {
        defaultValue: 'Pick a marketplace',
      });
    }
    return t('mobile.reviewHub.statusMissing', {
      defaultValue: 'Missing: {{preview}}',
      preview: preview || 'details',
    });
  })();

  const marketplaceLine = routingResolved
    ? (MARKETPLACE_OPTIONS.find((o) => o.value === item.marketplace)?.label ??
       item.marketplace)
    : t('mobile.reviewHub.pickMarketplace', { defaultValue: 'Marketplace not chosen' });

  /*
    ── WHY THIS IS A `Row` AND NOT A CARD ────────────────────────────────────

    The old row was a bordered, shadowed 80pt card with a 96pt hero. Nine of
    them is nine boxes in a column, each with its own outline, and at that
    count the borders carry no information — every row has one — while the
    96pt image pushed the title into a two-line wrap on most products.

    `Row` is the kit's list member: a 46pt thumb, a title, a subline, a
    trailing cluster, separated by space rather than by outlines. It also
    solves, by construction, the two things the old row had to fix by hand —
    `minWidth: 0` on the text column so a 90-character AI title truncates
    instead of shoving the chevron off-screen, and a tap target over the whole
    row rather than hitSlop on a chevron.
  */
  return (
    <Row
      title={title}
      titleLines={2}
      subtitle={marketplaceLine}
      /*
        The status is the THIRD line, not a chip in the trailing cluster.
        `Row` announces the trailing slot to nobody (its own docblock warns
        about this) and, more practically, "Missing: location, condition +1
        more" does not fit in a trailing chip — it truncated to "Missing: l…".
      */
      meta={ready ? undefined : missingLabel}
      leading={
        <RowThumb uri={hero}>
          {/* No photo yet is the normal state of a draft, not an error — show
              the product's number rather than a broken-image box. */}
          <Text variant="rowTitle" color="inkSubtle">
            {index + 1}
          </Text>
        </RowThumb>
      }
      /*
        ── NO PER-ROW "READY" CHIP ───────────────────────────────────────────

        A green `Ready` chip used to sit here on every COMPLETE row, and
        nothing at all on the incomplete ones — so the exception was quieter
        than the rule, which is backwards. On the ten-product scan this screen
        was rebuilt against, every row was ready: ten identical green chips
        down the right edge, carrying no information, while the row that
        actually needed a tap looked plainer than its neighbours.

        Readiness is still stated twice, in the two places that answer a
        question the seller is actually asking: the `N of N ready` chip in the
        header, and the progress line beside Submit. What a ROW needs to say is
        whether IT needs something, and an incomplete row already says that in
        its own words on the `meta` line ("Missing: location") — so the extra
        line IS the marker, and its absence is the "ready" state.

        Same rule as the blocked summary in the footer and the Messages inbox:
        say the exception once, not the rule ten times.
      */
      trailing={<RowTrailing />}
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={`${position}. ${a11yLabel}`}
      testID={`scan-grouped-review-row-${index}`}
    />
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    // GUTTER, not space.md — at 8pt the back button's 44pt target sits flush
    // against the screen edge. Same value as `scan/detection`'s bar.
    paddingHorizontal: GUTTER,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  appBarCentre: { flex: 1, alignItems: 'center' },
  /** Mirrors the back button's 44pt width so the eyebrow is optically centred. */
  appBarSpacer: { width: 44 },

  /*
    `Row` is FULL-BLEED — it applies GUTTER itself — so the list content must
    NOT add horizontal padding, or every row is inset twice and the thumbnails
    stop lining up with the header's text.
  */
  listContent: { paddingBottom: space['7xl'] },

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.md,
    /*
      NO `paddingHorizontal` any more: this row now sits INSIDE `headingRow`,
      which already applies the gutter. Keeping its own would inset the chip a
      second time and push it out of line with the heading above it.
    */
    alignSelf: 'flex-start',
  },
  /*
    The heading and its one supporting line are one block now, so they share a
    gutter and a bottom margin instead of each carrying their own. `paddingTop`
    gives the title air under the app bar, which the removed chip row used to
    provide by accident.
  */
  headingRow: {
    paddingHorizontal: GUTTER,
    paddingTop: space.lg,
    paddingBottom: space.lg,
  },
  subtitle: { marginTop: space.xs },
  collapseRow: {
    alignSelf: 'flex-start',
    /*
      GUTTER minus `QuietAction`'s own 4pt inset, so its LABEL lines up with
      the heading above it rather than its touch target. At a flat GUTTER the
      text started 4pt right of everything else — small, but it is the only
      left edge on the screen that did not agree with the others.
    */
    paddingHorizontal: GUTTER - space.xs,
    /*
      Pulled UP against the heading block, not floated between it and the list.
      `headingRow` already ends with `paddingBottom: space.lg`, and this row
      added its own margin on top of that, so the control sat marooned in white
      space with a gap above and below — reading as a stray control rather than
      as part of the intro. A negative top margin cancels the block's trailing
      padding so the two belong together, and the remaining bottom margin is
      what separates the whole intro from the first product.
    */
    marginTop: -space.sm,
    marginBottom: space.lg,
  },
  noteRow: { paddingHorizontal: GUTTER, marginBottom: space.sm },

  /** Rows separate by space, not by outlines — see the note in `HubRow`. */
  /*
    A DIVIDER, not a gap. This was `height: space.xxs` — 2pt of nothing — and
    on a ten-product list that is not separation you can follow: the rows ran
    together into one column of text. Matches and Messages both got hairlines
    for exactly this; this screen was left behind, which is why it still read
    as the odd one out.

    Inset past the thumbnail so the rule starts under the text and the
    thumbnails keep reading as a column — the standard list treatment, and the
    same inset `deals.tsx` uses.

    `hairlineWidth`, not 1: at 3x a 1dp line is three physical pixels and draws
    as a grey stripe rather than a rule.
  */
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: GUTTER + 46 + space.md,
  },

  // `paddingBottom` is applied at the call site from `insets.bottom`.
  footer: { paddingTop: 0 },
  footerBody: { paddingHorizontal: GUTTER, paddingTop: space.sm, gap: space.sm },
});
