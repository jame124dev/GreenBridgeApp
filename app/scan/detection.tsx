import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

/*
  v2 KIT. Step 1 of the two-step detection wizard — where a seller checks the
  AI's grouping before anything is listed. Presentation only: the grouping
  logic, the move/delete handlers, the sheets and every `router` call below are
  untouched.
*/
import {
  Chip,
  GlyphButton,
  Hairline,
  OptionCard,
  PrimaryAction,
  Screen,
  SectionHeader,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';
/*
  `DetectionGroupCard` (the NativeWind radio card) is gone from this screen —
  see `features/v2/ui/OptionCard.tsx` and `group-cover-strip.tsx` for what
  replaced it and why. This was its LAST importer — `grep -rn DetectionGroupCard
  app src` now returns only comments — so the file is dead code. Left on disk
  rather than deleted in the same change that replaces it, so the two can be
  reviewed apart; delete it once this screen is signed off.
*/
import { GroupCoverStrip } from '@/features/v2/detection/group-cover-strip';
import { GroupPhotoCard } from '@/features/v2/detection/group-photo-card';
import { IdentifyUnknownSheet } from '@/features/scanner/components/detection/IdentifyUnknownSheet';
import { MoveToGroupSheet } from '@/features/scanner/components/detection/MoveToGroupSheet';
import { CONDITION_LABELS } from '@/features/scanner/constants';
import { buildPhotoSlices } from '@/features/scanner/applySmartDetection';
import type { MappedProduct } from '@/features/scanner/smartDetectionTypes';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { useScanDraft, type ListingMode, type Photo } from '@/stores/scanDraftStore';

type WizardStep = 'capture' | 'listing';

/**
 * A product carrying a key that survives edits.
 *
 * ⚠️ The list was keyed `p-${index}`, and every mutator on this screen can
 * REMOVE an entry — `deletePhoto` and `movePhoto` both end with
 * `.filter(p => p.imageIndexes.length > 0)`. Deleting group 2 of 5 therefore
 * shifts groups 3–5 up one index, so React reuses card 3's mounted subtree for
 * what is now product 4: the photo strip keeps its old scroll offset, an
 * in-flight image swaps under the user, and any per-card state belongs to the
 * wrong product. Harmless at 3 groups, visibly wrong at 30.
 *
 * `_key` is minted once per group when the detection arrives and then rides
 * along through the spreads in every mutator. It is stripped before the list
 * is handed to `applySmartDetection` so nothing downstream sees it.
 */
type EditableProduct = MappedProduct & { _key: string };

let keySeq = 0;
const withKeys = (products: MappedProduct[]): EditableProduct[] =>
  products.map((p) => ({ ...p, _key: `grp-${keySeq++}` }));

/**
 * W5 (scan_v3) — 2-step detection wizard.
 *
 * Step 1 — capture/regroup: the seller can identify products the AI failed
 *   to name and reassign photos between groups before committing. Edits live
 *   in component state (`editedProducts`); nothing flows back to the store
 *   until the user finishes step 2 and taps Continue.
 *
 * Step 2 — listing mode: existing single-vs-grouped radio picker, now
 *   driven by the (possibly edited) product list.
 *
 * `applySmartDetection` gets handed a `MappedSmartDetection` clone with the
 * edited products array — no signature change required since the caller has
 * always built the mapped object.
 */
export default function DetectionScreen() {
  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const pendingDetection = useScanDraft((s) => s.pendingDetection);
  const current = useScanDraft((s) => s.current);
  const applySmartDetection = useScanDraft((s) => s.applySmartDetection);
  const setPendingDetection = useScanDraft((s) => s.setPendingDetection);
  const reset = useScanDraft((s) => s.reset);

  const sourcePhotos = current?.photos ?? [];

  // Wizard state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('capture');
  // Mutable local copy of the AI's products — accepts seller edits (identify
  // unknowns, move photos between groups). Reset on every fresh detection
  // arrival by keying off the pending detection's first product id.
  const [editedProducts, setEditedProducts] = useState<EditableProduct[]>(() =>
    withKeys(pendingDetection?.products ?? []),
  );
  const [identifyingIndex, setIdentifyingIndex] = useState<number | null>(null);
  const [movingPhoto, setMovingPhoto] = useState<{
    productIdx: number;
    imageIdx: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultChoice: ListingMode = useMemo(() => {
    if (!pendingDetection) return 'grouped';
    return pendingDetection.meta.suggestedMode === 'multiple' ? 'grouped' : 'single';
  }, [pendingDetection]);

  const [choice, setChoice] = useState<ListingMode>(defaultChoice);

  // ── Edit operations ──────────────────────────────────────────────────────
  /** Overwrite a product's title (identify-unknown handler). */
  const renameProduct = (idx: number, title: string) => {
    setEditedProducts((prev) => {
      const next = [...prev];
      const item = next[idx];
      if (!item) return prev;
      next[idx] = {
        ...item,
        fields: {
          ...item.fields,
          title,
          ai: { ...item.fields.ai, name: title },
        },
      };
      return next;
    });
  };

  /**
   * Move a single image index from one product's group to another. If the
   * source product ends up with 0 photos, drop the entry entirely — empty
   * groups can't be applied (validateMappedDetection rejects them).
   */
  const movePhoto = (fromIdx: number, imageIdx: number, toIdx: number) => {
    setEditedProducts((prev) => {
      const next = prev.map((p) => ({ ...p, imageIndexes: [...p.imageIndexes] }));
      const src = next[fromIdx];
      const dst = next[toIdx];
      if (!src || !dst) return prev;
      src.imageIndexes = src.imageIndexes.filter((i) => i !== imageIdx);
      // Avoid duplicates if the destination somehow already has it.
      if (!dst.imageIndexes.includes(imageIdx)) {
        dst.imageIndexes.push(imageIdx);
      }
      // Drop the source if it's now empty — the seller effectively merged it.
      const cleaned = next.filter((p) => p.imageIndexes.length > 0);
      return cleaned;
    });
  };

  /**
   * Remove a photo from its product group entirely. We don't mutate
   * `sourcePhotos` itself (that would shift every higher index) — just drop
   * the index from `editedProducts`. Anything not referenced by a product's
   * imageIndexes never enters `buildPhotoSlices` at submit time, so the
   * photo is effectively excluded from the listing. If the product ends up
   * with 0 photos, drop the whole product (same cleanup as `movePhoto`).
   */
  const deletePhoto = (fromIdx: number, imageIdx: number) => {
    setEditedProducts((prev) => {
      const next = prev.map((p, i) =>
        i === fromIdx
          ? { ...p, imageIndexes: p.imageIndexes.filter((idx) => idx !== imageIdx) }
          : p,
      );
      return next.filter((p) => p.imageIndexes.length > 0);
    });
  };

  /**
   * Confirm with the native dialog before destroying the photo.
   *
   * ⚠️ THE DIALOG USED TO LIE IN THE ONE CASE THAT MATTERS. `deletePhoto` ends
   * with `.filter((p) => p.imageIndexes.length > 0)`, so removing a group's
   * LAST photo deletes the whole product — its title, category, condition,
   * price, and any name the seller just typed into the Identify sheet — while
   * the dialog promised only that "this photo won't be included".
   *
   * On a one-photo-per-group detection, which is the common result, that meant
   * EVERY × silently destroyed a product. So the copy branches on what the tap
   * will actually do, and names the product being lost.
   */
  const confirmDeletePhoto = (productIdx: number, imageIdx: number) => {
    const product = editedProducts[productIdx];
    const isLastPhoto = (product?.imageIndexes.length ?? 0) <= 1;
    const productName =
      product?.fields.title?.trim() ||
      t('mobile.detection.unknownProduct', { defaultValue: 'Unknown product' });

    Alert.alert(
      isLastPhoto
        ? t('mobile.detection.deleteProductTitle', { defaultValue: 'Remove this product?' })
        : t('mobile.detection.deletePhotoTitle', { defaultValue: 'Delete photo?' }),
      isLastPhoto
        ? t('mobile.detection.deleteProductBody', {
            name: productName,
            defaultValue: `This is the only photo in this group, so "${productName}" will be removed from the scan entirely.`,
          })
        : t('mobile.detection.deletePhotoBody', {
            defaultValue: "This photo won't be included in the listing.",
          }),
      [
        { text: t('mobile.common.cancel'), style: 'cancel' },
        {
          text: isLastPhoto
            ? t('mobile.detection.removeProduct', { defaultValue: 'Remove product' })
            : t('mobile.common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => {
            haptics.tap();
            deletePhoto(productIdx, imageIdx);
          },
        },
      ],
    );
  };

  // Per-group thumb strips for the listing-step radio card. Recomputes
  // whenever editedProducts changes so the user sees their regrouping
  // reflected in the multi-card preview on step 2.
  const groupThumbs = useMemo(() => {
    if (sourcePhotos.length === 0) return [];
    const perProduct = editedProducts.map((p) => p.imageIndexes);
    const { slices } = buildPhotoSlices(sourcePhotos, perProduct);
    return slices;
  }, [editedProducts, sourcePhotos]);

  // Redirect to the camera when there's no pending detection. Must run after
  // commit (in an effect) — navigating during render triggers a React
  // "update a component while rendering a different component" error.
  useEffect(() => {
    if (!pendingDetection) {
      router.replace(routes.scanCamera);
    }
  }, [pendingDetection]);

  if (!pendingDetection) {
    return null;
  }

  const displayedCount = editedProducts.length;
  const confidencePct = Math.round(pendingDetection.meta.confidence * 100);

  // ── Nav / submit ─────────────────────────────────────────────────────────
  /**
   * ⚠️ BACK AT STEP 1 IS THE MOST DESTRUCTIVE CONTROL ON THIS SCREEN, and it
   * had no confirmation at all. `reset()` throws away the entire detection —
   * every regrouping, every rename, every discarded photo — from a 44pt arrow
   * in the corner. Deleting ONE photo asked for confirmation while discarding
   * ALL of them did not, which is backwards.
   *
   * Only asks once there is something to lose: a seller who opens the screen
   * and immediately backs out should not be interrogated.
   */
  const onBack = () => {
    if (step === 'listing') {
      setStep('capture');
      return;
    }

    const discard = () => {
      reset();
      router.replace(routes.scanCamera);
    };

    if (editedProducts.length === 0) {
      discard();
      return;
    }

    Alert.alert(
      t('mobile.detection.discardTitle', { defaultValue: 'Discard this scan?' }),
      t('mobile.detection.discardBody', {
        count: editedProducts.length,
        defaultValue: `The ${editedProducts.length} group(s) the AI found, and any changes you made, will be lost.`,
      }),
      [
        { text: t('mobile.detection.keepReviewing', { defaultValue: 'Keep reviewing' }), style: 'cancel' },
        {
          text: t('mobile.detection.discard', { defaultValue: 'Discard' }),
          style: 'destructive',
          onPress: discard,
        },
      ],
    );
  };

  const onContinueFromCapture = () => {
    if (editedProducts.length === 0) {
      Alert.alert(
        t('mobile.detection.noGroupsTitle', { defaultValue: 'No groups to list' }),
        t('mobile.detection.noGroupsBody', {
          defaultValue: 'Add at least one photo to a group before continuing.',
        }),
      );
      return;
    }
    haptics.tap();
    setStep('listing');
  };

  const onSubmit = async () => {
    if (submitting) return;
    if (sourcePhotos.length === 0) {
      reset();
      router.replace(routes.scanCamera);
      return;
    }
    setSubmitting(true);
    try {
      // Re-wrap the original mapped object with the edited products array so
      // the store layer sees the seller's changes. `mergedSingleFields` is
      // unchanged — that's used for the "actually one product" override only.
      // `_key` is this screen's own list identity — strip it so the store and
      // the publish payload keep seeing plain `MappedProduct`s.
      const mappedWithEdits = {
        ...pendingDetection,
        products: editedProducts.map(({ _key, ...p }) => p),
      };
      await applySmartDetection(mappedWithEdits, sourcePhotos, choice);
      setPendingDetection(null);
      haptics.success();
      // if/else, not a ternary — behaviour identical. Two `Href`s in one
      // expression makes TypeScript resolve expo-router's generated route union
      // across both branches, and that union is past its limit now that
      // `app/v2/scan/` carries more screens than when this file was committed
      // (`TS2590`, `typedRoutes: true` in `app.config.ts`).
      if (choice === 'single') {
        router.replace(routes.scanDetail);
      } else {
        router.replace(routes.scanGroupedReview);
      }
    } catch (err) {
      haptics.error();
      const msg = (err as Error)?.message ?? t('mobile.processing.errorFallback');
      Alert.alert(t('mobile.processing.errorFallback'), msg, [
        { text: t('mobile.common.cancel') },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const pickChoice = (next: ListingMode) => {
    if (next === choice) return;
    haptics.tap();
    setChoice(next);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Screen scroll={false} tabBar={false} testID="scan-detection">
      <View style={styles.appBar}>
        {/*
          `GlyphButton`, NOT `IconAction`. IconAction is the round ACCENT disc
          for "add a want" — its own docblock says it is not a general icon
          button — and using it here put a 46pt filled green circle in the top
          corner, louder than the screen's title and clipped by the edge.
          GlyphButton is the quiet 44pt target the kit uses for exactly this.
        */}
        <GlyphButton onPress={onBack} accessibilityLabel={t('mobile.detection.back')}>
          <ChevronLeft color={c.ink} size={icon.lg} strokeWidth={1.8} />
        </GlyphButton>
        <View style={styles.appBarCentre}>
          <Text variant="eyebrow" color="inkMuted">
            {t('mobile.detection.stepOf', {
              defaultValue: 'STEP {{current}} OF 2',
              current: step === 'capture' ? 1 : 2,
            })}
          </Text>
        </View>
        {/* Balances the back button so the step label stays optically centred. */}
        <View style={styles.appBarSpacer} />
      </View>

      {/*
        Step 1 owns a FlatList, step 2 a ScrollView — deliberately not one
        shared scroller. Step 1's list is unbounded (the AI returns up to
        MAX_PRODUCTS groups, each with its own horizontal photo strip), and in
        a ScrollView every one of those cards and every <Image> inside them
        mounts at once. Step 2 is four fixed radio cards and virtualising it
        would buy nothing.
      */}
      {step === 'capture' ? (
        <CaptureStep
          editedProducts={editedProducts}
          sourcePhotos={sourcePhotos}
          confidencePct={confidencePct}
          onIdentify={(idx) => setIdentifyingIndex(idx)}
          onTapPhoto={(productIdx, imageIdx) =>
            setMovingPhoto({ productIdx, imageIdx })
          }
          onDeletePhoto={confirmDeletePhoto}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ListingStep
            choice={choice}
            displayedCount={displayedCount}
            groupThumbs={groupThumbs}
            onPick={pickChoice}
          />
        </ScrollView>
      )}

      {/*
        `insets.bottom`, added after the device shot: without it the pill sat
        UNDER the Android navigation bar and "Looks good" was half-covered by
        the ☰ ◻ ◁ row. `Screen` reserves the top inset but this footer is its
        own block, so it owns its own bottom.
      */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Hairline />
        <PrimaryAction
          label={
            step === 'capture'
              ? // "Looks good →" carried its own arrow glyph. The pill is
                // already the forward action; an arrow inside the label is
                // decoration the button's shape has said twice.
                t('mobile.detection.continueCapture', { defaultValue: 'Looks good' })
              : t('mobile.detection.continue')
          }
          onPress={step === 'capture' ? onContinueFromCapture : onSubmit}
          loading={submitting}
          // Capture step gates on the detected GROUPS (deleting every photo
          // from every group leaves sourcePhotos non-empty but nothing to
          // continue with); submit step keeps the source-photo guard.
          disabled={
            submitting ||
            (step === 'capture' ? editedProducts.length === 0 : sourcePhotos.length === 0)
          }
        />
      </View>

      {/* Identify-unknown sheet — opened from a per-product "Identify" pill. */}
      <IdentifyUnknownSheet
        visible={identifyingIndex !== null}
        initialName={
          identifyingIndex !== null
            ? editedProducts[identifyingIndex]?.fields.title ?? ''
            : ''
        }
        onSave={(name) => {
          if (identifyingIndex !== null) renameProduct(identifyingIndex, name);
        }}
        onClose={() => setIdentifyingIndex(null)}
      />

      {/* Move-photo destination picker — opened from a thumbnail tap. */}
      <MoveToGroupSheet
        visible={movingPhoto !== null}
        fromProductIndex={movingPhoto?.productIdx ?? 0}
        products={editedProducts}
        photos={sourcePhotos}
        onMove={(toIdx) => {
          if (movingPhoto) {
            movePhoto(movingPhoto.productIdx, movingPhoto.imageIdx, toIdx);
            haptics.tap();
            setMovingPhoto(null);
          }
        }}
        onClose={() => setMovingPhoto(null)}
      />
    </Screen>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────
function CaptureStep({
  editedProducts,
  sourcePhotos,
  confidencePct,
  onIdentify,
  onTapPhoto,
  onDeletePhoto,
}: {
  editedProducts: EditableProduct[];
  sourcePhotos: Photo[];
  confidencePct: number;
  onIdentify: (productIdx: number) => void;
  onTapPhoto: (productIdx: number, imageIdx: number) => void;
  onDeletePhoto: (productIdx: number, imageIdx: number) => void;
}) {
  const { t } = useTranslation();
  const total = editedProducts.length;

  const header = (
    <>
      {/*
        The chips are read as ONE line, not two, because `Chip` sets
        `accessibilityElementsHidden` on itself — its label never reaches a
        screen reader on its own, so the row has to speak for both.
      */}
      <View
        style={styles.badgeRow}
        accessible
        accessibilityLabel={[
          t('mobile.detection.groupCount', {
            count: total,
            defaultValue: `${total} groups`,
          }),
          t('mobile.detection.confidence', { pct: confidencePct }),
        ].join('. ')}
      >
        <Chip
          label={t('mobile.detection.groupCount', {
            count: total,
            defaultValue: `${total} groups`,
          })}
          tone="neutral"
        />
        <Chip label={t('mobile.detection.confidence', { pct: confidencePct })} tone="accent" />
      </View>

      <Text variant="h2">
        {t('mobile.detection.captureTitle', {
          defaultValue: 'Review the groups',
        })}
      </Text>
      <Text variant="body" color="inkMuted" style={styles.subtitle}>
        {t('mobile.detection.captureSubtitle', {
          defaultValue:
            'Tap a photo to move it to another group. Identify any product the AI couldn’t name.',
        })}
      </Text>
    </>
  );

  /*
    `text-warning` on a centred caption was colour doing the work of meaning.
    `SectionNote tone="muted"` says the same thing in the kit's one voice for
    "here is why you cannot continue yet" — and it is not amber, because
    nothing has gone wrong.
  */
  const footer =
    total === 0 ? (
      <SectionNote tone="muted">
        {t('mobile.detection.noGroupsHint', {
          defaultValue: 'Add a photo to at least one group to continue.',
        })}
      </SectionNote>
    ) : null;

  return (
    <FlatList
      data={editedProducts}
      /*
        `_key`, never the index — see the EditableProduct docblock. Deleting a
        group renumbers everything below it, and an index key hands the
        deleted card's mounted subtree to its neighbour.
      */
      keyExtractor={(product) => product._key}
      renderItem={({ item, index }) => (
        <ProductGroupEditor
          index={index}
          total={total}
          product={item}
          photos={sourcePhotos}
          onIdentify={() => onIdentify(index)}
          onTapPhoto={(imageIdx) => onTapPhoto(index, imageIdx)}
          onDeletePhoto={(imageIdx) => onDeletePhoto(index, imageIdx)}
        />
      )}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentContainerStyle={styles.scrollContent}
      ItemSeparatorComponent={Separator}
      // A 37-group scan is one long undifferentiated column; the bar is the
      // only thing telling the seller how far down it they are.
      showsVerticalScrollIndicator={total > 4}
      // Each row is a card plus a horizontal photo strip of full-bleed images.
      // Keeping the mounted window small is the whole point of the swap.
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      /*
        Deliberately NOT `removeClippedSubviews`. These rows are
        variable-height — a photo strip plus chips that wrap — which is the
        exact case where it detaches Android subviews it cannot measure and
        leaves blank cells behind. The three window props above already bound
        what is mounted; nothing else in this app turns it on.
      */
      keyboardShouldPersistTaps="handled"
    />
  );
}

/** The gap `styles.groupList` used to apply, now that the list owns spacing. */
function Separator() {
  return <View style={styles.groupGap} />;
}

// ── Step 2 ─────────────────────────────────────────────────────────────────
function ListingStep({
  choice,
  displayedCount,
  groupThumbs,
  onPick,
}: {
  choice: ListingMode;
  displayedCount: number;
  groupThumbs: Photo[][];
  onPick: (next: ListingMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Text variant="h2" style={styles.stepTitle}>
        {t('mobile.detection.title')}
      </Text>
      <Text variant="body" color="inkMuted" style={styles.subtitle}>
        {t('mobile.detection.listingStepSubtitle', {
          defaultValue: 'Decide whether to list these as one or as separate items.',
          count: displayedCount,
        })}
      </Text>

      <SectionHeader title={t('mobile.detection.modeHeader', { defaultValue: 'List as' })} />
      {/*
        `accessibilityRole="radiogroup"` on the wrapper. The two cards each
        declare `role="radio"` with a `checked` state, but without a group
        around them a screen reader announces two unrelated radios and never
        says "1 of 2".
      */}
      <View style={styles.modeList} accessibilityRole="radiogroup">
        <OptionCard
          selected={choice === 'single'}
          onSelect={() => onPick('single')}
          title={t('mobile.detection.singleTitle')}
          description={t('mobile.detection.singleDesc')}
          /*
            The single option gets a preview too, and it is the SAME mosaic —
            every photo pooled into one tile. The card it replaces previewed
            only the multi option, so the choice was between a picture and a
            sentence, which is not a fair comparison of two outcomes.
          */
          preview={
            groupThumbs.length > 0 ? (
              <GroupCoverStrip groups={[groupThumbs.flat()]} />
            ) : undefined
          }
          testID="scan-detection-mode-single"
        />
        <OptionCard
          selected={choice === 'grouped'}
          onSelect={() => onPick('grouped')}
          title={t('mobile.detection.multiTitle', { count: displayedCount })}
          description={t('mobile.detection.multiDesc', { count: displayedCount })}
          countLabel={String(displayedCount)}
          preview={<GroupCoverStrip groups={groupThumbs} />}
          testID="scan-detection-mode-grouped"
        />
      </View>
    </>
  );
}

// ── ProductGroupEditor — per-product card with tap-to-move thumbs ──────────
function ProductGroupEditor({
  index,
  total,
  product,
  photos,
  onIdentify,
  onTapPhoto,
  onDeletePhoto,
}: {
  index: number;
  /** How many groups the scan has, so the card can say "3 of 37" out loud. */
  total: number;
  product: MappedProduct;
  photos: Photo[];
  onIdentify: () => void;
  onTapPhoto: (imageIdx: number) => void;
  onDeletePhoto: (imageIdx: number) => void;
}) {
  // No `useV2Colors()` here any more — this function reads the detection and
  // hands over strings; the colour lives in `GroupPhotoCard`.
  const { t } = useTranslation();
  const f = product.fields;

  const titleText = f.title?.trim();
  const showIdentifyPill = !titleText;
  const subtitleParts = [f.brand, f.model, f.year].filter((s) => s && s.trim());
  const subtitle = subtitleParts.join(' · ');

  /*
    ── WHAT THE CARD SHOWS, AND WHY IT CHANGED ────────────────────────────────

    This card used to render four of the ~20 fields `SmartItemFields` carries:
    title, brand, model, year. On real data that is often just a title and a
    brand, so a full-width card held one short line and a 64pt thumbnail — about
    a quarter of its own width — and the screen read as empty (device shot,
    2026-09-24).

    The screen's question is "did the AI understand these groups?", so the
    fields that answer it come first:

      category   the strongest "does it know what this is?" signal
      condition  what it thinks the state is
      price      the AI's estimate — concrete, and what the seller looks for
      photos     the count, because the strip scrolls and hides its own length

    Everything is omitted when absent rather than rendered empty, so a sparse
    detection collapses to the title instead of showing blank labels.
  */
  const conditionKey = Array.isArray(f.condition) ? f.condition[0] : undefined;
  const conditionText = conditionKey ? CONDITION_LABELS[conditionKey] ?? conditionKey : undefined;

  const categoryText = f.categoryName?.trim() || undefined;

  const priceText = (() => {
    const raw = String(f.pricePerUnit ?? '').trim();
    if (!raw) return undefined;

    /*
      ⚠️ DO NOT STRIP EVERY NON-DIGIT. `pricePerUnit` is a free-text AI field,
      and the model returns ranges: "$1,200–$1,500". The previous
      `.replace(/[^0-9.]/g, '')` concatenated both ends into `12001500` and
      rendered "$12,001,500" on a card the seller is one tap from approving.

      So: take the FIRST number in the string, and if a second one follows,
      show the range rather than inventing a single figure. Separators covered
      are hyphen, en-dash, em-dash and the word "to".
    */
    const nums = raw.match(/\d[\d,]*(?:\.\d+)?/g);
    if (!nums || nums.length === 0) return undefined;

    const toNum = (s: string) => Number(s.replace(/,/g, ''));
    const lo = toNum(nums[0]);
    if (!Number.isFinite(lo) || lo <= 0) return undefined;

    const money = (n: number) =>
      f.priceCurrency === 'USD' ? `$${n.toLocaleString()}` : `${f.priceCurrency} ${n.toLocaleString()}`;

    const isRange = /[-–—]|\bto\b/i.test(raw) && nums.length > 1;
    const hi = isRange ? toNum(nums[1]) : NaN;

    return isRange && Number.isFinite(hi) && hi > lo ? `${money(lo)}–${money(hi)}` : money(lo);
  })();

  const docCount = product.documentIndexes.length;

  const metaChips = [categoryText, conditionText].filter(Boolean) as string[];

  /*
    The group's photos, resolved in the SAME pass as their global indexes. The
    card needs both — the index is what `onTapPhoto`/`onDeletePhoto` act on —
    and a missing photo has to drop from both lists together, or the two arrays
    stop lining up and the × removes the wrong image.
  */
  const resolved = product.imageIndexes
    .map((imageIdx) => ({ imageIdx, photo: photos[imageIdx] }))
    .filter((p): p is { imageIdx: number; photo: Photo } => Boolean(p.photo));

  /*
    ⚠️ COUNT FROM `resolved`, NOT `product.imageIndexes`. `resolved` drops
    indexes whose source photo has gone missing, so counting the raw index list
    let a card read "3 photos" above an empty strip — the count describing
    something the card was not showing.
  */
  const photoCount = resolved.length;

  const countLabel = [
    t('mobile.detection.photoCount', {
      count: photoCount,
      defaultValue: photoCount === 1 ? '1 photo' : `${photoCount} photos`,
    }),
    docCount > 0
      ? t('mobile.detection.docCount', {
          count: docCount,
          defaultValue: docCount === 1 ? '1 document' : `${docCount} documents`,
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  /*
    The DRAWING is `GroupPhotoCard`, copied from `bids/bid-card.tsx` (which is
    obytes' `post-card.tsx`, MIT). This function keeps what it should have kept
    all along: reading the detection and handing over display strings. See the
    card's header for the search that was run and what was adjusted.
  */
  return (
    <GroupPhotoCard
      index={index}
      total={total}
      title={titleText || t('mobile.detection.unknownProduct', { defaultValue: 'Unknown product' })}
      subtitle={subtitle}
      metaChips={metaChips}
      priceText={priceText}
      photos={resolved.map((r) => r.photo)}
      imageIndexes={resolved.map((r) => r.imageIdx)}
      countLabel={countLabel}
      unnamed={showIdentifyPill}
      identifyLabel={t('mobile.detection.identify', { defaultValue: 'Identify' })}
      renameLabel={t('mobile.detection.rename', { defaultValue: 'Rename' })}
      movePhotoLabel={t('mobile.detection.movePhoto', {
        defaultValue: 'Move this photo to another group',
      })}
      removePhotoLabel={t('mobile.detection.removePhoto', {
        defaultValue: 'Remove this photo',
      })}
      onIdentify={onIdentify}
      onTapPhoto={onTapPhoto}
      onDeletePhoto={onDeletePhoto}
    />
  );
}

/*
  Styles, in tokens. This file previously carried its layout in NativeWind
  classes built on the OLD brand scale (`bg-brand-surface`, `text-neutral-500`,
  `text-warning`) plus inline objects for anything the scale could not say.
  Neither survives a colour-scheme change, which is why the delete badge was
  hard-coded dark-on-white.
*/
const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    // GUTTER, not space.md — at 8pt the back button's 44pt target was flush
    // against the screen edge.
    paddingHorizontal: GUTTER,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  appBarCentre: { flex: 1, alignItems: 'center' },
  /** Mirrors the back button's 44pt width so the step label is optically centred. */
  appBarSpacer: { width: 44 },

  scrollContent: { paddingHorizontal: GUTTER, paddingBottom: space['7xl'] },

  badgeRow: {
    flexDirection: 'row',
    // Wraps rather than squeezing: "12 groups" + "Confidence 100%" is close to
    // the gutter width at the largest text size.
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  subtitle: { marginTop: space.xs, marginBottom: space.md },
  stepTitle: { marginTop: space.md },
  /*
    `gap` on a wrapper is not available to a FlatList — the rows are siblings
    of the header, not children of a flex box — so the spacing that
    `groupList` used to apply now comes from an ItemSeparatorComponent, and
    the header carries its own bottom margin.
  */
  groupGap: { height: space.sm },
  modeList: { gap: space.md },

  /*
    The eleven card styles that were here — group, groupHeader, indexBadge,
    groupText, metaRow, metaChips, photoStrip, thumb, thumbImage, photoCell,
    removeBadge — moved into `features/v2/detection/group-photo-card.tsx` with
    the markup they belonged to. This screen now owns only its own chrome.
  */

  // `paddingBottom` is applied at the call site from `insets.bottom`.
  footer: { paddingHorizontal: GUTTER, paddingTop: space.sm, gap: space.md },
});
