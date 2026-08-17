/**
 * Seller "edit my listing" — the published-listing counterpart of
 * `app/scan/detail.tsx`.
 *
 * It is deliberately the SAME editor: the cards under
 * `features/scanner/components/detail/*` are mounted against the same
 * `DetailFormInput` RHF shape, hydrated from the listing instead of from a
 * scan draft (`listingToFormValues`). What this screen adds on top is what a
 * published listing needs and a draft does not:
 *
 *   - the review split, shown BEFORE saving (`PolicySection`), so approval is
 *     never a surprise discovered afterwards
 *   - dirty-field diffing, so the PATCH carries only what changed
 *     (`buildListingEditChangeSet`)
 *   - the sold / not-yours / already-pending states (`resolveEditGate`), each
 *     with a sentence and one way forward
 *
 * Route params — either identifier works:
 *   `productId` … the contract is product-scoped, go straight in
 *   `batchPk`   … the seller's lists are batch-scoped; resolve the product
 *                 first, and ask which item if the batch holds several
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { FormProvider, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import {
  CategoryConditionCard,
  DescriptionCard,
  IdentityCard,
  LocationCard,
  PricingCard,
} from '@/features/scanner/components/detail';
import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import { useBatchDetail } from '@/features/scanner/useBatchDetail';
import { useEnLabCategories, useLabCategories } from '@/features/scanner/useLabCategories';
import type { DetailFormInput } from '@/features/scanner/schema';
import { EditStateView } from '@/features/listings/components/EditStateView';
import { ListingPhotosSection } from '@/features/listings/components/ListingPhotosSection';
import { LockedMarketplaceRow } from '@/features/listings/components/LockedMarketplaceRow';
import { PendingEditNotice } from '@/features/listings/components/PendingEditNotice';
import { PolicySection } from '@/features/listings/components/PolicySection';
import { SaveReceipt } from '@/features/listings/components/SaveReceipt';
import {
  classifyListingEditError,
  serverMessageOf,
  type ListingEditErrorKind,
} from '@/features/listings/listingEditApi';
import { canSubmitListingEdit, resolveEditGate } from '@/features/listings/listingEditGate';
import { dedupeFieldLabels, joinLabels } from '@/features/listings/listingEditLabels';
import {
  buildListingEditChangeSet,
  listingToFormValues,
  makeListingEditSchema,
} from '@/features/listings/listingEditMapping';
import { resolveEditMode, splitByPolicy } from '@/features/listings/listingEditPolicy';
import type {
  ListingEditImage,
  ListingEditPatchResult,
} from '@/features/listings/listingEditTypes';
import { useListingEdit, useSaveListingEdit } from '@/features/listings/useListingEdit';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { brand } from '@/constants/theme';

/* ── shell ───────────────────────────────────────────────────────────────── */

function EditAppBar({ onBack, subtitle }: { onBack: () => void; subtitle?: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-md px-lg py-2.5 border-b border-brand-border-strong bg-brand-background">
      <Pressable
        onPress={onBack}
        hitSlop={10}
        className="p-xs"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
      >
        <MaterialIcons name="arrow-back" size={22} color={brand.foreground} />
      </Pressable>
      <View className="flex-1">
        <Text variant="subtitle" tone="primary" numberOfLines={1}>
          {t('mobile.listingEdit.title')}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone="tertiary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Shell({ subtitle, onBack, children }: {
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-brand-background" edges={['top', 'bottom']}>
      <EditAppBar onBack={onBack} subtitle={subtitle} />
      {children}
    </SafeAreaView>
  );
}

function goToListings() {
  router.replace(routes.labListings);
}

/* ── route: resolve which product to edit ────────────────────────────────── */

export default function ListingEditRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ productId?: string; batchPk?: string; title?: string }>();

  const explicitProductId = params.productId ? Number(params.productId) : undefined;
  const batchPk = params.batchPk ? Number(params.batchPk) : undefined;
  const [pickedProductId, setPickedProductId] = useState<number | null>(null);

  // Only fetched when we arrived with a batch and no product — the seller's
  // lists are batch-scoped but the edit contract is product-scoped.
  const needsResolve = !explicitProductId && !!batchPk && !pickedProductId;
  const batch = useBatchDetail(needsResolve ? batchPk : undefined);

  const soleProductId =
    needsResolve && batch.data?.products.length === 1
      ? batch.data.products[0].productId
      : undefined;

  const productId = explicitProductId ?? pickedProductId ?? soleProductId;

  if (productId) {
    return <ListingEditor productId={productId} batchPk={batchPk} headerSubtitle={params.title} />;
  }

  return (
    <Shell subtitle={params.title} onBack={() => router.back()}>
      {!batchPk ? (
        <EditStateView
          icon="help-outline"
          title={t('mobile.listingEdit.noTargetTitle')}
          body={t('mobile.listingEdit.noTargetBody')}
          primary={{ label: t('mobile.listingEdit.backToListings'), onPress: goToListings }}
        />
      ) : batch.isLoading ? (
        <EditStateView busy title={t('mobile.listingEdit.resolvingTitle')} />
      ) : batch.isError ? (
        <EditStateView
          icon="wifi-off"
          title={t('mobile.listingEdit.error.offline.title')}
          body={t('mobile.listingEdit.error.offline.body')}
          primary={{ label: t('mobile.listingEdit.retry'), onPress: () => void batch.refetch() }}
          secondary={{ label: t('mobile.listingEdit.backToListings'), onPress: goToListings }}
        />
      ) : !batch.data?.products.length ? (
        <EditStateView
          icon="inventory-2"
          title={t('mobile.listingEdit.noItemsTitle')}
          body={t('mobile.listingEdit.noItemsBody')}
          primary={{ label: t('mobile.listingEdit.backToListings'), onPress: goToListings }}
        />
      ) : (
        <View className="p-2xl gap-md">
          <Text variant="subtitle" tone="primary">
            {t('mobile.listingEdit.pickItemTitle')}
          </Text>
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.listingEdit.pickItemBody', { n: batch.data.products.length })}
          </Text>
          {batch.data.products.map((p) => (
            <Pressable
              key={p.productId}
              onPress={() => {
                haptics.tap();
                setPickedProductId(p.productId);
              }}
              className="flex-row items-center justify-between bg-brand-surface border border-brand-border-strong rounded-sm p-lg"
              style={{ gap: 12 }}
              accessibilityRole="button"
              accessibilityLabel={p.title || `#${p.productId}`}
            >
              <Text variant="bodyMd" tone="primary" className="flex-1" numberOfLines={2}>
                {p.title || `#${p.productId}`}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={brand.placeholder} />
            </Pressable>
          ))}
        </View>
      )}
    </Shell>
  );
}

/* ── the editor ──────────────────────────────────────────────────────────── */

const SECTION_FIELDS = {
  photos: ['images'],
  identity: ['title', 'brand'],
  description: ['description'],
  category: ['category_id', 'category_name', 'condition', 'grade'],
  pricing: ['quantity', 'price_format', 'price_per_unit', 'price_currency'],
  location: ['location', 'operation_status'],
} as const;

function ListingEditor({
  productId,
  batchPk,
  headerSubtitle,
}: {
  productId: number;
  batchPk?: number;
  headerSubtitle?: string;
}) {
  const { t, i18n } = useTranslation();
  const query = useListingEdit(productId);
  const save = useSaveListingEdit(productId, batchPk);

  const [baseline, setBaseline] = useState<DetailFormInput | null>(null);
  const [images, setImages] = useState<ListingEditImage[]>([]);
  const [receipt, setReceipt] = useState<ListingEditPatchResult | null>(null);
  const [saveError, setSaveError] = useState<ListingEditErrorKind | null>(null);
  // The server's own sentence for the failure, when it sends one.
  const [saveErrorHint, setSaveErrorHint] = useState<string | undefined>(undefined);

  // The resolver is built per-listing ("you can change it, you can't blank
  // it"), but RHF captures `resolver` once at init — so read the live baseline
  // through a ref instead of rebuilding the form on every load.
  const baselineRef = useRef<DetailFormInput | null>(null);
  baselineRef.current = baseline;

  const resolver = useCallback<Resolver<DetailFormInput>>(
    (values, ctx, options) =>
      zodResolver(makeListingEditSchema(baselineRef.current ?? values))(values, ctx, options),
    [],
  );

  const form = useForm<DetailFormInput>({ resolver, defaultValues: emptyDetailDefaults() });
  const { reset, getValues, watch } = form;
  const values = watch();

  const mode = resolveEditMode(query.data?.edit_mode ?? null);
  const gate = resolveEditGate(query.data);
  const categories = useLabCategories(values.marketplace);
  // Same EN reference tree `CategoryConditionCard` bridges against. Shared
  // React Query cache, so this is a read of the card's own fetch, not a second
  // request — see the baseline re-take below for why the screen has to know.
  const enCategories = useEnLabCategories(values.marketplace);

  /* hydrate — once per listing, and again after a save lands new server truth */
  const hydratedFor = useRef<number | null>(null);
  useEffect(() => {
    const data = query.data;
    if (!data || hydratedFor.current === data.product_id) return;
    hydratedFor.current = data.product_id;
    const next = listingToFormValues(data);
    reset(next);
    setBaseline(next);
    setImages(data.images ?? []);
  }, [query.data, reset]);

  /**
   * `CategoryConditionCard` normalises `categoryId` by itself once the category
   * tree lands (it bridges an id created under another locale's tree). That is
   * not a seller edit, so re-take the baseline for the category fields the
   * moment the tree settles — the picker renders a spinner until then, so no
   * real user change can be swallowed here.
   */
  const categoryRebased = useRef(false);
  // REVIEW FIX: the card normalises `categoryId` only once BOTH trees are in
  // (`enBridgeSettled` in CategoryConditionCard). Re-taking the baseline on the
  // locale tree alone meant that for every non-English seller the EN tree could
  // land afterwards, rewrite (or clear) `categoryId`, and show up as a category
  // change the seller never made — a REVIEW field, so a no-op admin approval,
  // or a "Category is required" error on an untouched field when it cleared.
  const enBridgeSettled =
    i18n.language === 'en' ||
    i18n.language.startsWith('en') ||
    enCategories.isSuccess ||
    enCategories.isError;
  const categoriesSettled = (categories.isSuccess || categories.isError) && enBridgeSettled;
  useEffect(() => {
    if (!baseline || !categoriesSettled || categoryRebased.current) return;
    categoryRebased.current = true;
    const v = getValues();
    setBaseline((prev) =>
      prev
        ? {
            ...prev,
            categoryId: v.categoryId,
            parentCategoryId: v.parentCategoryId,
            parentCategoryName: v.parentCategoryName,
          }
        : prev,
    );
  }, [baseline, categoriesSettled, getValues]);

  const serverImages = query.data?.images;
  const serverFields = query.data?.fields;
  const categoryOptions = categories.data?.options;

  const changeSet = useMemo(() => {
    if (!baseline) return { fields: [] as string[], body: {} };
    return buildListingEditChangeSet({
      baseline,
      current: values,
      original: serverFields,
      baselineImages: serverImages ?? [],
      keptImages: images,
      categoryOptions,
    });
    // `values` is a fresh object on every keystroke (RHF watch) — that is the
    // point: the summary line and the CTA have to track typing.
  }, [baseline, values, serverFields, serverImages, images, categoryOptions]);

  const changed = changeSet.fields;
  const changedSplit = splitByPolicy(changed, mode);
  const canSave = canSubmitListingEdit({
    gate,
    changedCount: changed.length,
    saving: save.isPending,
  });

  const onBack = useCallback(() => {
    if (changed.length === 0) {
      router.back();
      return;
    }
    Alert.alert(
      t('mobile.listingEdit.discardTitle'),
      t('mobile.listingEdit.discardBody'),
      [
        { text: t('mobile.listingEdit.discardCancel'), style: 'cancel' },
        {
          text: t('mobile.listingEdit.discardConfirm'),
          style: 'destructive',
          onPress: () => router.back(),
        },
      ],
      { cancelable: true },
    );
  }, [changed.length, t]);

  const submit = form.handleSubmit(
    () => {
      if (changed.length === 0) return;
      setSaveError(null);
      setSaveErrorHint(undefined);
      haptics.impact();
      save.mutate(changeSet.body, {
        onSuccess: (result) => {
          haptics.success();
          setReceipt(result);
          // Let the refetched listing re-hydrate the form: instant fields are
          // now the new truth, held fields flip this screen into its
          // pending-review state. Without this the editor would keep showing a
          // stale baseline and claim there are still unsaved changes.
          hydratedFor.current = null;
        },
        onError: (err) => {
          haptics.error();
          const kind = classifyListingEditError(err);
          setSaveError(kind);
          setSaveErrorHint(serverMessageOf(err));
          // A sale (or a revoked claim) changes what this screen IS, not just
          // what the last tap did — refetch so the gate renders the truth.
          //
          // 'saleRecordBlocked' is deliberately NOT in this list. It means one
          // field could not be written (no sale record / no batch / bidding
          // locked) on a listing that is otherwise perfectly editable. Refetching
          // would re-render the gate as editable and the seller would retry into
          // the same error forever — which is exactly the loop this replaced.
          if (kind === 'sold' || kind === 'forbidden' || kind === 'unauthorized') {
            void query.refetch();
          }
        },
      });
    },
    () => {
      haptics.error();
      setSaveError('invalid');
      setSaveErrorHint(undefined);
    },
  );

  const onReceiptDone = useCallback(() => {
    setReceipt(null);
    router.back();
  }, []);

  const and = t('mobile.listingEdit.and');

  /* ── which state are we in? ───────────────────────────────────────────── */

  let content: React.ReactNode;

  if (query.isLoading || (query.isSuccess && !baseline)) {
    content = (
      <Shell subtitle={headerSubtitle} onBack={() => router.back()}>
        <EditStateView busy title={t('mobile.listingEdit.loadingTitle')} />
      </Shell>
    );
  } else if (query.isError) {
    const kind = classifyListingEditError(query.error);
    const recoverable = kind === 'offline' || kind === 'server';
    content = (
      <Shell subtitle={headerSubtitle} onBack={() => router.back()}>
        <EditStateView
          icon={errorIcon(kind)}
          title={t(`mobile.listingEdit.error.${kind}.title`)}
          body={t(`mobile.listingEdit.error.${kind}.body`)}
          primary={
            recoverable
              ? { label: t('mobile.listingEdit.retry'), onPress: () => void query.refetch() }
              : { label: t('mobile.listingEdit.backToListings'), onPress: goToListings }
          }
          secondary={
            recoverable
              ? { label: t('mobile.listingEdit.backToListings'), onPress: goToListings }
              : undefined
          }
        />
      </Shell>
    );
  } else if (gate.kind === 'locked') {
    const reasonKey =
      gate.reason === 'sold' ? 'sold' : gate.reason === 'notOwner' ? 'notOwner' : 'locked';
    content = (
      <Shell subtitle={headerSubtitle} onBack={() => router.back()}>
        <EditStateView
          icon={gate.reason === 'sold' ? 'sell' : 'lock-outline'}
          title={t(`mobile.listingEdit.${reasonKey}Title`)}
          body={t(`mobile.listingEdit.${reasonKey}Body`)}
          primary={{ label: t('mobile.listingEdit.backToListings'), onPress: goToListings }}
        />
      </Shell>
    );
  } else if (gate.kind === 'pendingReview') {
    content = (
      <Shell subtitle={headerSubtitle} onBack={() => router.back()}>
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        >
          <PendingEditNotice pending={gate.pending} />
        </KeyboardAwareScrollView>
        <View className="px-lg pt-2.5 pb-2.5 border-t border-brand-border-strong bg-brand-surface">
          <Button
            label={t('mobile.listingEdit.backToListings')}
            onPress={goToListings}
            variant="primary"
            fullWidth
          />
        </View>
      </Shell>
    );
  } else {
    const summary =
      changed.length === 0
        ? t('mobile.listingEdit.noChanges')
        : changedSplit.review.length === 0
          ? t('mobile.listingEdit.summaryAllInstant', { n: changed.length })
          : t('mobile.listingEdit.summaryMixed', {
              n: changed.length,
              fields: joinLabels(dedupeFieldLabels(changedSplit.review, t), and),
            });

    content = (
      <FormProvider {...form}>
        <Shell subtitle={headerSubtitle} onBack={onBack}>
          <KeyboardAwareScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
          >
            {/* Says the quiet part out loud once, up top, before anything is
                touched — the per-section badges below then read as detail
                rather than as a warning the seller has to decode. */}
            <View className="bg-brand-info-bg border border-brand-border rounded-sm p-lg">
              <Text variant="bodySm" tone="secondary">
                {t(`mobile.listingEdit.modeIntro.${mode}`)}
              </Text>
            </View>

            <PolicySection
              label={t('mobile.listingEdit.section.photos')}
              fields={SECTION_FIELDS.photos}
              mode={mode}
              changedFields={changed}
            >
              <ListingPhotosSection
                images={images}
                onChange={setImages}
                removedCount={Math.max(0, (serverImages?.length ?? 0) - images.length)}
                needsReview={splitByPolicy(['images'], mode).review.length > 0}
              />
            </PolicySection>

            <PolicySection
              label={t('mobile.listingEdit.section.identity')}
              fields={SECTION_FIELDS.identity}
              mode={mode}
              changedFields={changed}
            >
              <IdentityCard variant="edit" />
            </PolicySection>

            <PolicySection
              label={t('mobile.listingEdit.section.description')}
              fields={SECTION_FIELDS.description}
              mode={mode}
              changedFields={changed}
            >
              <DescriptionCard />
            </PolicySection>

            <LockedMarketplaceRow marketplace={values.marketplace} />

            <PolicySection
              label={t('mobile.listingEdit.section.category')}
              fields={SECTION_FIELDS.category}
              mode={mode}
              changedFields={changed}
            >
              <CategoryConditionCard />
            </PolicySection>

            <PolicySection
              label={t('mobile.listingEdit.section.pricing')}
              fields={SECTION_FIELDS.pricing}
              mode={mode}
              changedFields={changed}
            >
              <PricingCard />
            </PolicySection>

            <PolicySection
              label={t('mobile.listingEdit.section.location')}
              fields={SECTION_FIELDS.location}
              mode={mode}
              changedFields={changed}
            >
              <LocationCard variant="edit" />
            </PolicySection>

            {saveError ? (
              <View className="bg-brand-destructive-bg border border-brand-destructive rounded-sm p-lg gap-xxs">
                <Text variant="bodyMd" tone="danger">
                  {t(`mobile.listingEdit.error.${saveError}.title`)}
                </Text>
                <Text variant="bodySm" tone="secondary">
                  {t(`mobile.listingEdit.error.${saveError}.body`)}
                </Text>
                {/* The server names WHICH field it refused and why — far more
                    useful than our generic line, so show it when we have it. */}
                {saveErrorHint ? (
                  <Text variant="bodySm" tone="secondary">
                    {saveErrorHint}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </KeyboardAwareScrollView>

          {/* Sticky footer — the single primary CTA, with the consequence
              spelled out right above it so Save is never a leap of faith. */}
          <View className="px-lg pt-2.5 pb-2.5 border-t border-brand-border-strong bg-brand-surface gap-xs">
            <Text
              variant="bodySm"
              tone={changedSplit.review.length > 0 ? 'secondary' : 'tertiary'}
              numberOfLines={2}
            >
              {save.isPending ? t('mobile.listingEdit.savingExplain') : summary}
            </Text>
            <Button
              label={t('mobile.listingEdit.save')}
              onPress={() => void submit()}
              variant="primary"
              fullWidth
              disabled={!canSave}
              loading={save.isPending}
            />
          </View>
        </Shell>
      </FormProvider>
    );
  }

  // The receipt lives OUTSIDE the state switch on purpose: a save that lands a
  // held edit flips this screen into its pending-review state, which would
  // otherwise unmount the modal before the seller had read what happened.
  return (
    <>
      {content}
      <SaveReceipt result={receipt} onDone={onReceiptDone} />
    </>
  );
}

function errorIcon(kind: ListingEditErrorKind): keyof typeof MaterialIcons.glyphMap {
  switch (kind) {
    case 'offline':
      return 'wifi-off';
    case 'sold':
      return 'sell';
    case 'forbidden':
    case 'unauthorized':
      return 'lock-outline';
    case 'notFound':
      return 'search-off';
    case 'saleRecordBlocked':
      return 'edit-off';
    default:
      return 'error-outline';
  }
}
