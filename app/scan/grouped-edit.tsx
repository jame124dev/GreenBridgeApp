import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

/*
  v2 KIT for this screen's CHROME — app bar, footer, CTA. The form CARDS below
  are the shared set from `features/scanner/components/detail/`, rendered
  identically by `app/scan/detail.tsx`; they are ported separately so both
  screens move together.
*/
import { GlyphButton, Hairline, PrimaryAction, Screen, Text } from '@/features/v2/ui';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';
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
  RoutingChip,
  SpecsCard,
} from '@/features/scanner/components/detail';
import {
  buildDraftPatch,
  draftToFormValues,
} from '@/features/scanner/components/detail/formMapping';
import { CLEARED_CATEGORY_DRAFT_FIELDS } from '@/features/scanner/routing/routingState';
import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

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

  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  const queuedItems = useScanDraft((s) => s.queuedItems);
  /** For "PRODUCT 3 OF 9" in the app bar — read live, so a removal re-counts. */
  const total = queuedItems.length;
  /**
   * The sticky footer's measured height, fed to the scroll view's
   * `bottomOffset`. 0 until the first layout pass, which is correct: the
   * keyboard cannot be open before the footer has been laid out.
   */
  const [footerH, setFooterH] = useState(0);
  const patchQueuedItem = useScanDraft((s) => s.patchQueuedItem);

  const item = Number.isFinite(index) ? queuedItems[index] : undefined;

  const form = useForm<DetailFormInput>({
    resolver: zodResolver(detailSchema),
    defaultValues: item ? draftToFormValues(item) : undefined,
  });

  // Categories for THIS item's marketplace — keyed via the hook's queryKey so
  // navigating to a different item's editor re-fetches the right tree.
  //
  // M-4 Step 8-6 — read the FORM, not the store item. `CategoryConditionCard`
  // renders its tree from `watch('marketplace')`, and this screen has NO reset
  // effect (defaultValues are set once), so after the RoutingChip changes the
  // form value the store item still holds the old marketplace until Save. A
  // store read here would resolve `categoryName` against the wrong tree and
  // land `null`, which silently drops `category_name` from the submit payload.
  // ⚠️ `useForm` must stay ABOVE this line.
  const categories = useLabCategories(form.watch('marketplace'));
  const categoryOptions = categories.data?.options;

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
    <Screen scroll={false} tabBar={false} testID="scan-grouped-edit">
      {/*
        Same app bar as `scan/detection` and `scan/grouped-review`, so moving
        between the three reads as one flow. The heading was `text-5xl` centred
        between a bare chevron and a 24pt spacer — at that size "Product 10"
        crowded the back control, and the spacer was 24pt against a 44pt
        button, so the title was never actually centred.
      */}
      <View style={styles.appBar}>
        <GlyphButton
          onPress={() => router.back()}
          accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
        >
          <ChevronLeft color={c.ink} size={icon.lg} strokeWidth={1.8} />
        </GlyphButton>
        <View style={styles.appBarCentre}>
          {/*
            "PRODUCT 3 OF 9", not "Product 3". The seller arrives here from a
            list of N and will come back to it; the count is the only thing on
            this screen saying how much is left. `total` comes from the live
            queue, so it stays right if an item is removed.
          */}
          <Text variant="eyebrow" color="inkMuted">
            {t('mobile.groupedEdit.eyebrow', {
              index: index + 1,
              total,
              defaultValue: `PRODUCT ${index + 1} OF ${total}`,
            })}
          </Text>
        </View>
        <View style={styles.appBarSpacer} />
      </View>
      <Hairline />

      <FormProvider {...form}>
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          /*
            ⚠️ `bottomOffset` must clear the STICKY FOOTER, not just the
            keyboard. `FORM_INPUT_RULES.md` §4: a footer that rides up with the
            IME lands exactly where a keyboard-aware scroll puts the focused
            field, so the LAST field of a long form is covered while every
            control on it still works. This form's last card is LOCATION — the
            one field every product here is missing — so that is precisely the
            field at risk.

            Measured, not guessed: `footerH` comes from the footer's own
            `onLayout` below. A hardcoded 24 was the previous value and it
            stopped being right the moment the footer's padding changed.
          */
          bottomOffset={footerH + space.xl}
        >
          <PhotosCard
            photos={item.photos ?? []}
            rearrangeLabel={t('mobile.review.rearrange')}
          />
          {/* M-3 — the same routing chip as detail.tsx, because retargeting a
              per-item marketplace happens in the ITEM EDITOR, not on the hub
              (plan §9): a second write path to `marketplace` re-opens the
              documented hydration race.

              ABOVE the IdentityCard, exactly as on detail.tsx and exactly as
              plan Step 9-6 asked. It shipped below it in a48e893 (whose message
              already claimed "at the TOP of both editors") and the wiring test
              was relaxed to "above the description" to match. Order matters
              here: this answer decides which category tree and which currency
              the fields underneath are edited against, so "where does this item
              go" has to come before "what is this item" — and the two editors
              must not disagree about it. Pinned for both files by
              src/features/scanner/__tests__/routingWiring.test.ts. */}
          <RoutingChip
            draft={item}
            onConfirm={(marketplace) =>
              patchQueuedItem(index, {
                marketplace,
                marketplaceConfirmed: true,
                // ⛔ blocker (c), grouped variant — and here the failure mode is
                // WORSE than a stale form. `patchQueuedItem` merges immediately,
                // so without this the STORED item carries the new marketplace
                // with the OLD categoryId. This screen's `useForm` sets
                // defaultValues once and has no reset effect, so nothing
                // re-syncs it, and `onValid` is the only thing that writes the
                // form back. If the seller leaves via the app bar or the Android
                // hardware back instead of Save, that mismatched pair PERSISTS —
                // grouped-review then counts the row ready and the pre-flight
                // sweep passes it, and submit sends the old tree's id with the
                // new allowed_sites.
                ...CLEARED_CATEGORY_DRAFT_FIELDS,
              })
            }
          />
          {/* FIX 1b — see detail.tsx: the unreadable nameplate is a brand/model
              fact, not a marketplace question. */}
          <IdentityCard needsClearerPhoto={item.needsClearerPhoto === true} />
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

      {/* M-11 — same lift as app/scan/detail.tsx, for the same reason (S1,
          2026-08-18): with `KeyboardProvider` enabled the library disables
          Android's adjustResize window shrink and adds no bottom padding of its
          own, so the IME draws over this footer. Both platforms wrapped; iOS is
          unverified on win32. */}
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        {/*
          The 60-line CTA that was here — a local reimplementation of the
          primary button, wired with `loading`/`disabled` constants that were
          hardcoded `false` — is replaced by the kit's `PrimaryAction`. Its one
          real finding is preserved in that primitive: the fill belongs on an
          inner View, never on a `({ pressed }) => …` style, because NativeWind's
          interop silently drops layout props from a functional style.
        */}
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}
          // Feeds `bottomOffset` above — see the note there for why this is
          // measured rather than written down.
          onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        >
          <Hairline />
          <View style={styles.footerBody}>
            <PrimaryAction
              label={t('mobile.groupedEdit.saveReturn', { defaultValue: 'Save & Return' })}
              onPress={onSave}
              testID="scan-grouped-edit-save"
            />
          </View>
        </View>
      </KeyboardStickyView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GUTTER,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  appBarCentre: { flex: 1, alignItems: 'center' },
  /** Mirrors the back button's 44pt width so the eyebrow is optically centred. */
  appBarSpacer: { width: 44 },

  scroll: { flex: 1 },
  /*
    The cards carry their own internal padding, so the container supplies only
    the gutter and the rhythm between them. `paddingBottom` is deliberately
    generous: this is a long form whose last card must be reachable above the
    sticky footer even with the keyboard closed.
  */
  scrollContent: { paddingHorizontal: GUTTER, paddingBottom: space['7xl'], gap: space.sm },

  // `paddingBottom` is applied at the call site from `insets.bottom`.
  footer: { paddingTop: 0 },
  footerBody: { paddingHorizontal: GUTTER, paddingTop: space.sm },
});
