import { FormProvider } from 'react-hook-form';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';

import { getRequiredStatus } from '@/features/scanner/requiredStatus';
import {
  CategoryConditionCard,
  DescriptionCard,
  DetailAppBar,
  DetailFooter,
  DocumentsCard,
  IdentityCard,
  LocationCard,
  MarketplaceCard,
  PhotosCard,
  PricingCard,
  ProfitIntelligenceCard,
  RequiredChecklist,
  SpecsCard,
  useDetailController,
} from '@/features/scanner/components/detail';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

/**
 * Scan detail route — thin composition. Form ownership, submit modes, photo
 * add-more, and draft hydration all live in `useDetailController`. UI lives
 * in the per-card components under `features/scanner/components/detail/*`.
 *
 * S6.2.b2.i — `styles.ts` was deleted; the few container/scroll styles the
 * route used (`container`, `scrollView`, `scroll`) move to NativeWind classes
 * here. `paddingBottom: 48` on the scroll content uses an inline style since
 * it's outside the spacing scale.
 */
export default function DetailScreen() {
  const { t } = useTranslation();
  const draft = useScanDraft((s) => s.current);
  const mode = useScanDraft((s) => s.mode);
  const queuedCount = useScanDraft((s) => s.queuedItems.length);
  const editingGroupedItem = useScanDraft((s) => s.editingGroupedItem);
  const isGrouped = mode === 'grouped';

  const controller = useDetailController();
  const { form, submitting, addMorePhotos, onSubmitSingle, onAddAnother, onReviewGroup, onSaveAndReturnToReview } = controller;

  if (!draft) return null;

  const formValues = form.watch();
  const required = getRequiredStatus(formValues, draft.photos?.length ?? 0);

  return (
    <FormProvider {...form}>
      <SafeAreaView className="flex-1 bg-brand-background" edges={['top', 'bottom']}>
        <DetailAppBar />
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <PhotosCard
            photos={draft.photos ?? []}
            rearrangeLabel={t('mobile.review.rearrange')}
            onRearrange={() => router.push(routes.scanReorderPhotosEdit())}
            onAddMore={addMorePhotos}
          />
          <IdentityCard />
          <DescriptionCard />
          <MarketplaceCard />
          <CategoryConditionCard />
          <ProfitIntelligenceCard aiPrices={draft.aiPrices} />
          <PricingCard />
          <SpecsCard />
          <DocumentsCard draft={draft} />
          {/* VisibilityCard removed for now — all listings ship as PUBLIC
              (the default on emptyDraft + sessionVisibility). Re-mount when
              product calls for it; the underlying store fields stay intact. */}
          <LocationCard />
          <RequiredChecklist draft={draft} />
        </KeyboardAwareScrollView>
        <DetailFooter
          isGrouped={isGrouped}
          editingGroupedItem={editingGroupedItem}
          queuedCount={queuedCount}
          allRequired={required.allComplete}
          submitting={submitting}
          onSubmitSingle={onSubmitSingle}
          onAddAnother={onAddAnother}
          onReviewGroup={onReviewGroup}
          onSaveAndReturnToReview={onSaveAndReturnToReview}
        />
      </SafeAreaView>
    </FormProvider>
  );
}
