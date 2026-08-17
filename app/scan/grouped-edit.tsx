import { useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { HStack, Screen, Text } from '@/components/ui';
import {
  CategoryConditionCard,
  DescriptionCard,
  DocumentsCard,
  IdentityCard,
  LocationCard,
  MarketplaceCard,
  PhotosCard,
  PricingCard,
  ProfitIntelligenceCard,
  RequiredChecklist,
  SpecsCard,
} from '@/features/scanner/components/detail';
import {
  buildDraftPatch,
  draftToFormValues,
} from '@/features/scanner/components/detail/formMapping';
import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

/**
 * Round 2 R2 — per-item editor for the multi-product review hub.
 *
 * Reached from the hub's row tap via `routes.scanGroupedEdit(index)`. Binds
 * to `queuedItems[index]` via FormProvider + the shared `draftToFormValues`
 * helper. On Save & Return:
 *  - VALID: `patchQueuedItem(index, buildDraftPatch(values, item, categoryOptions))`
 *    then `router.back()` to the hub, where the row badge flips to Ready ✓.
 *  - INVALID: per pre-coding note R-1, **never a silent no-op** — fires
 *    `haptics.error()`, surfaces an Alert listing the missing required
 *    fields, and `setFocus`es the first invalid field (auto-scrolls inputs).
 *
 * Photos are NOT in the form schema; they're checked manually inside both
 * the valid and invalid paths so the user always gets feedback when
 * required content is missing.
 *
 * Pre-coding note R-2 honored: writes via `patchQueuedItem(index, …)` only;
 * `editQueuedItem` is never called (that path mutates `current` /
 * `editingGroupedItem` — incompatible with the hub).
 */
export default function GroupedEditScreen() {
  const { t } = useTranslation();
  const { index: indexParam } = useLocalSearchParams<{ index: string }>();
  const index = Number(indexParam);

  const queuedItems = useScanDraft((s) => s.queuedItems);
  const patchQueuedItem = useScanDraft((s) => s.patchQueuedItem);

  const item = Number.isFinite(index) ? queuedItems[index] : undefined;

  // Categories for THIS item's marketplace — keyed via the hook's queryKey so
  // navigating to a different item's editor re-fetches the right tree.
  const categories = useLabCategories(item?.marketplace);
  const categoryOptions = categories.data?.options;

  const form = useForm<DetailFormInput>({
    resolver: zodResolver(detailSchema),
    defaultValues: item ? draftToFormValues(item) : undefined,
  });

  // Bounce back if the index is bad or the item went away while we were here.
  useEffect(() => {
    if (!item) router.replace(routes.scanGroupedReview);
  }, [item]);

  if (!item) return null;

  // Map of field-error keys → translated section labels. Some RHF errors share
  // a section (locations + locationCountries → "Location"); de-duped below.
  const fieldLabels: Record<string, string> = {
    title: t('mobile.detail.sectionTitle', { defaultValue: 'Title' }),
    description: t('mobile.detail.sectionDescription', {
      defaultValue: 'Description',
    }),
    categoryId: t('mobile.detail.sectionCategory', { defaultValue: 'Category' }),
    condition: t('mobile.detail.sectionCondition', { defaultValue: 'Condition' }),
    pricePerUnit: t('mobile.detail.sectionPrice', { defaultValue: 'Price' }),
    locations: t('mobile.detail.sectionLocation', { defaultValue: 'Location' }),
    locationCountries: t('mobile.detail.sectionLocation', {
      defaultValue: 'Location',
    }),
  };

  const photosLabel = t('mobile.groupedEdit.sectionPhotos', {
    defaultValue: 'Photos',
  });

  const onValid = (values: DetailFormInput) => {
    // Photos aren't a form field — guard explicitly so this path can't
    // silently save with zero photos.
    if ((item.photos?.length ?? 0) === 0) {
      haptics.error();
      Alert.alert(
        t('mobile.groupedEdit.missingTitle', {
          defaultValue: 'Some fields are missing',
        }),
        t('mobile.groupedEdit.missingBody', {
          defaultValue: 'Please add: {{fields}}',
          fields: photosLabel,
        }),
      );
      return;
    }
    const patch = buildDraftPatch(values, item, categoryOptions);
    patchQueuedItem(index, patch);
    haptics.success();
    router.back();
  };

  // Pre-coding note R-1 (load-bearing): the dead-button fix. ANY failed save
  // path fires haptics + Alert naming the missing fields + setFocus on the
  // first invalid field. No save path may silently no-op.
  const onInvalid = (errors: FieldErrors<DetailFormInput>) => {
    haptics.error();

    const missing = Array.from(
      new Set(
        Object.keys(errors).map(
          (k) => fieldLabels[k] ?? k.replace(/^./, (c) => c.toUpperCase()),
        ),
      ),
    );
    if ((item.photos?.length ?? 0) === 0) missing.unshift(photosLabel);

    Alert.alert(
      t('mobile.groupedEdit.missingTitle', {
        defaultValue: 'Some fields are missing',
      }),
      t('mobile.groupedEdit.missingBody', {
        defaultValue: 'Please add: {{fields}}',
        fields: missing.join(', '),
      }),
    );

    // Best-effort scroll-to / focus the first invalid field. RHF's setFocus
    // only works on Controllers wired with a ref (mostly TextInputs); silently
    // no-ops for non-input fields, which is the intended degrade.
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      try {
        form.setFocus(firstErrorField as keyof DetailFormInput);
      } catch {
        // setFocus throws if no ref is registered — ignore.
      }
    }
  };

  const onSave = form.handleSubmit(onValid, onInvalid);

  // Mid-editor photo rearrange/add is not implemented for the grouped (multi-
  // product) editor. The controls are therefore NOT rendered — PhotosCard hides
  // them when no handler is passed.
  //
  // They previously showed a "Coming soon" alert. That is a Guideline 2.1
  // (App Completeness) rejection risk: Apple treats placeholder features as an
  // unfinished app, and this build has already been rejected twice under 2.1.
  // A control that does nothing is worse than no control.
  // The single-product editor (app/scan/detail.tsx) DOES implement both and
  // passes real handlers, so that screen is unaffected.

  return (
    // `scroll={false}` for the same reason as grouped-review.tsx: otherwise
    // Screen's own ScrollView wraps the header, the KeyboardAwareScrollView below
    // and the Save footer — nesting same-axis scrollers, un-pinning the footer,
    // and double-reserving the bottom inset (~48px dead gap under the CTA).
    <Screen padded={false} scroll={false} edges={['top', 'bottom']}>
      <HStack
        align="center"
        justify="space-between"
        style={{ paddingHorizontal: 20, paddingTop: 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
        >
          <ChevronLeft color={brand.foreground} size={24} />
        </Pressable>
        <Text
          className="font-heading text-5xl text-brand-foreground"
          style={{ lineHeight: 28 }}
        >
          {t('mobile.groupedEdit.heading', {
            defaultValue: 'Product {{index}}',
            index: index + 1,
          })}
        </Text>
        <View style={{ width: 24 }} />
      </HStack>

      <FormProvider {...form}>
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <PhotosCard
            photos={item.photos ?? []}
            rearrangeLabel={t('mobile.review.rearrange')}
          />
          <IdentityCard />
          <DescriptionCard />
          <MarketplaceCard />
          <CategoryConditionCard />
          <ProfitIntelligenceCard aiPrices={item.aiPrices} />
          <PricingCard />
          <SpecsCard />
          <DocumentsCard
            draft={item}
            onPatch={(p) => patchQueuedItem(index, p)}
          />
          <LocationCard />
          <RequiredChecklist draft={item} />
        </KeyboardAwareScrollView>
      </FormProvider>

      <View
        className="px-md pt-sm pb-md bg-brand-background"
        style={{ borderTopWidth: 1, borderTopColor: brand.border }}
      >
        {/* D6: local brand-CTA override (pre-coding note D-1) — does NOT touch
            the shared `Button` primitive, so the rest of the app keeps its
            current emerald primary. Disabled = flat neutral fill (NOT
            opacity-50) per D-1. The editor's Save path has no loading/disabled
            state today, but the conditional styles are wired for completeness
            so future use can flip a `loading` prop without re-skinning. */}
        {(() => {
          const loading = false;
          const disabled = false;
          const isInactive = loading || disabled;
          return (
            <Pressable
              onPress={onSave}
              disabled={isInactive}
              accessibilityRole="button"
              accessibilityState={{ disabled: isInactive, busy: loading }}
              accessibilityLabel={t('mobile.groupedEdit.saveReturn', {
                defaultValue: 'Save & Return',
              })}
            >
              {({ pressed }) => (
                // Fill + padding on a plain inner View — a functional style on
                // an interop'd Pressable silently drops layout props on this
                // RN/NativeWind build (it made the hub Submit button collapse to
                // bare text). A View is immune.
                <View
                  style={{
                    backgroundColor: isInactive
                      ? '#d4d8df'
                      : pressed
                      ? brand.primaryDim
                      : brand.primary,
                    minHeight: 52,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      className="font-semi text-2xl"
                      style={{
                        color: isInactive ? brand.mutedForeground : '#ffffff',
                      }}
                    >
                      {t('mobile.groupedEdit.saveReturn', {
                        defaultValue: 'Save & Return',
                      })}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })()}
      </View>
    </Screen>
  );
}
