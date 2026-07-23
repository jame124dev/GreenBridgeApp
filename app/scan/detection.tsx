import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Edit3, Sparkles, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage, Button, Screen, Text } from '@/components/ui';
import { DetectionGroupCard } from '@/components/scanner/DetectionGroupCard';
import { IdentifyUnknownSheet } from '@/features/scanner/components/detection/IdentifyUnknownSheet';
import { MoveToGroupSheet } from '@/features/scanner/components/detection/MoveToGroupSheet';
import { buildPhotoSlices } from '@/features/scanner/applySmartDetection';
import type { MappedProduct } from '@/features/scanner/smartDetectionTypes';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { useScanDraft, type ListingMode, type Photo } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

type WizardStep = 'capture' | 'listing';

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
  const [editedProducts, setEditedProducts] = useState<MappedProduct[]>(
    () => pendingDetection?.products ?? [],
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

  /** Confirm with the native dialog before destroying the photo. */
  const confirmDeletePhoto = (productIdx: number, imageIdx: number) => {
    Alert.alert(
      t('mobile.detection.deletePhotoTitle', { defaultValue: 'Delete photo?' }),
      t('mobile.detection.deletePhotoBody', {
        defaultValue: "This photo won't be included in the listing.",
      }),
      [
        { text: t('mobile.common.cancel'), style: 'cancel' },
        {
          text: t('mobile.common.delete', { defaultValue: 'Delete' }),
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
  const onBack = () => {
    if (step === 'listing') {
      setStep('capture');
      return;
    }
    reset();
    router.replace(routes.scanCamera);
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
      const mappedWithEdits = { ...pendingDetection, products: editedProducts };
      await applySmartDetection(mappedWithEdits, sourcePhotos, choice);
      setPendingDetection(null);
      haptics.success();
      router.replace(
        choice === 'single' ? routes.scanDetail : routes.scanGroupedReview,
      );
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
    <Screen padded={false} scroll={false} edges={['top', 'bottom']}>
      <View className="flex-row items-center px-md pt-sm pb-xs">
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.detection.back')}
        >
          <ChevronLeft color={brand.foreground} size={24} />
        </Pressable>
        <View className="flex-1 items-center">
          <Text
            className="font-label text-xs text-brand-text-muted"
            style={{ letterSpacing: 0.8 }}
          >
            {t('mobile.detection.stepOf', {
              defaultValue: 'STEP {{current}} OF 2',
              current: step === 'capture' ? 1 : 2,
            })}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
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
          <ListingStep
            choice={choice}
            displayedCount={displayedCount}
            groupThumbs={groupThumbs}
            onPick={pickChoice}
          />
        )}
      </ScrollView>

      <View
        className="px-md pt-sm pb-md bg-brand-background"
        style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: brand.border }}
      >
        <Button
          label={
            step === 'capture'
              ? t('mobile.detection.continueCapture', { defaultValue: 'Looks good →' })
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
          fullWidth
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
  editedProducts: MappedProduct[];
  sourcePhotos: Photo[];
  confidencePct: number;
  onIdentify: (productIdx: number) => void;
  onTapPhoto: (productIdx: number, imageIdx: number) => void;
  onDeletePhoto: (productIdx: number, imageIdx: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View className="self-start flex-row items-center gap-xs bg-brand-primary-surface px-sm py-xs rounded-full mt-xs mb-sm">
        <Sparkles color={brand.primary} size={14} />
        <Text className="font-bold text-caption text-brand-primary tracking-wide">
          {t('mobile.detection.confidence', { pct: confidencePct })}
        </Text>
      </View>

      <Text className="font-bold text-title text-neutral-900">
        {t('mobile.detection.captureTitle', {
          defaultValue: 'Review the groups',
        })}
      </Text>
      <Text className="font-sans text-bodySm text-neutral-500 mt-xs mb-sm">
        {t('mobile.detection.captureSubtitle', {
          defaultValue:
            'Tap a photo to move it to another group. Identify any product the AI couldn’t name.',
        })}
      </Text>

      <View className="gap-sm mt-sm mb-md">
        {editedProducts.map((product, index) => (
          <ProductGroupEditor
            key={`p-${index}`}
            index={index}
            product={product}
            photos={sourcePhotos}
            onIdentify={() => onIdentify(index)}
            onTapPhoto={(imageIdx) => onTapPhoto(index, imageIdx)}
            onDeletePhoto={(imageIdx) => onDeletePhoto(index, imageIdx)}
          />
        ))}
      </View>

      {editedProducts.length === 0 ? (
        <Text
          className="font-sans text-caption text-warning mb-sm text-center"
        >
          {t('mobile.detection.noGroupsHint', {
            defaultValue: 'Add a photo to at least one group to continue.',
          })}
        </Text>
      ) : null}
    </>
  );
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
      <Text className="font-bold text-title text-neutral-900 mt-md">
        {t('mobile.detection.title')}
      </Text>
      <Text className="font-sans text-bodySm text-neutral-500 mt-xs mb-md">
        {t('mobile.detection.listingStepSubtitle', {
          defaultValue: 'Decide whether to list these as one or as separate items.',
          count: displayedCount,
        })}
      </Text>

      <Text
        className="font-label text-xs text-brand-text-muted mb-xs mt-sm"
        style={{ letterSpacing: 0.8 }}
      >
        {t('mobile.detection.modeHeader', { defaultValue: 'LIST AS' })}
      </Text>
      <View className="gap-md">
        <DetectionGroupCard
          selected={choice === 'single'}
          onSelect={() => onPick('single')}
          title={t('mobile.detection.singleTitle')}
          description={t('mobile.detection.singleDesc')}
        />
        <DetectionGroupCard
          selected={choice === 'grouped'}
          onSelect={() => onPick('grouped')}
          title={t('mobile.detection.multiTitle', { count: displayedCount })}
          description={t('mobile.detection.multiDesc', { count: displayedCount })}
          groupThumbs={groupThumbs}
        />
      </View>
    </>
  );
}

// ── ProductGroupEditor — per-product card with tap-to-move thumbs ──────────
function ProductGroupEditor({
  index,
  product,
  photos,
  onIdentify,
  onTapPhoto,
  onDeletePhoto,
}: {
  index: number;
  product: MappedProduct;
  photos: Photo[];
  onIdentify: () => void;
  onTapPhoto: (imageIdx: number) => void;
  onDeletePhoto: (imageIdx: number) => void;
}) {
  const { t } = useTranslation();
  const f = product.fields;

  const titleText = f.title?.trim();
  const showIdentifyPill = !titleText;
  const subtitleParts = [f.brand, f.model, f.year].filter((s) => s && s.trim());
  const subtitle = subtitleParts.join(' · ');

  return (
    <View className="bg-brand-surface border border-brand-border rounded-lg p-md gap-sm">
      {/* Header row — title + identify-pill (when unnamed) */}
      <View className="flex-row items-start gap-sm">
        <View
          className="bg-brand-primary items-center justify-center"
          style={{
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: 11,
            marginTop: 2,
          }}
        >
          <Text className="font-bold text-white" style={{ fontSize: 11 }}>
            {index + 1}
          </Text>
        </View>
        <View className="flex-1">
          <Text
            className={`font-bold text-bodyMd ${titleText ? 'text-brand-foreground' : 'text-brand-text-muted'}`}
            numberOfLines={2}
          >
            {titleText ||
              t('mobile.detection.unknownProduct', {
                defaultValue: 'Unknown product',
              })}
          </Text>
          {subtitle ? (
            <Text className="font-sans text-sm text-brand-text-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {showIdentifyPill ? (
          <Pressable
            onPress={onIdentify}
            className="flex-row items-center gap-xs bg-brand-primary-surface rounded-full px-sm"
            style={{ paddingVertical: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.detection.identify', {
              defaultValue: 'Identify',
            })}
          >
            <Edit3 color={brand.primary} size={12} />
            <Text className="font-bold text-brand-primary" style={{ fontSize: 11 }}>
              {t('mobile.detection.identify', { defaultValue: 'Identify' })}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onIdentify}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.detection.rename', {
              defaultValue: 'Rename',
            })}
          >
            <Edit3 color={brand.placeholder} size={16} />
          </Pressable>
        )}
      </View>

      {/* Photo strip — tap photo to move to another group, tap × to delete */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // paddingTop=8 leaves clearance for the × badge that sits at top: -6.
        contentContainerStyle={{ gap: 10, paddingTop: 8, paddingBottom: 2 }}
      >
        {product.imageIndexes.map((imageIdx) => {
          const photo = photos[imageIdx];
          if (!photo) return null;
          return (
            <View key={`img-${imageIdx}`} style={{ width: 64, height: 64 }}>
              <Pressable
                onPress={() => onTapPhoto(imageIdx)}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.detection.movePhoto', {
                  defaultValue: 'Move this photo to another group',
                })}
                // P4 — office-doc origin label exposed to screen readers only
                // (64×64 thumb has no room for a visible caption; the hero
                // image in PhotosCard.tsx gets the visible version).
                accessibilityHint={photo.sourceLabel}
                className="rounded-xs overflow-hidden border border-brand-border-strong"
                style={{ width: 64, height: 64 }}
              >
                <AppImage
                  source={{ uri: photo.uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              </Pressable>
              {/* × delete badge — sits over the top-right corner. Larger
                  hitSlop so the 18px target is comfortable to tap. */}
              <Pressable
                onPress={() => onDeletePhoto(imageIdx)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.detection.removePhoto', {
                  defaultValue: 'Remove this photo',
                })}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#111827',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#FFFFFF',
                }}
              >
                <X color="#FFFFFF" size={12} strokeWidth={3} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
