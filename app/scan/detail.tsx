import { useCallback, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

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
import { useCreateDraft, useUpdateDraft } from '@/services/drafts/draftHooks';
import { SellerApprovalNotice } from '@/features/seller/components/SellerApprovalNotice';
import { buildScanDraftPayload } from '@/services/drafts/draftPayload';
import { getSiteType } from '@/services/scanner/buildFormData';

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

  // Task 8 — "Save as draft". First save on a session calls `createDraft`;
  // once we have a server id + updated_at, subsequent saves switch to
  // `updateDraft` (optimistic-concurrency PUT keyed on expectedUpdatedAt).
  // Both mutations return METADATA ONLY (id + updated_at, no payload/
  // session_uuid echoed back) — see draftApi.ts's verified-against-live-
  // backend note, so we never read anything else off the response.
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [savingDraft, setSavingDraft] = useState(false);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);

  const handleSaveDraft = useCallback(async () => {
    const snapshot = useScanDraft.getState().snapshotForServer();
    const gcs = snapshot.gcs;
    const imagesOrdered = gcs
      ? Object.entries(gcs.objectNameByPhotoUri).map(([uri, objectName]) => ({ url: uri, objectName }))
      : [];
    const built = buildScanDraftPayload(snapshot, imagesOrdered);
    const siteType = getSiteType();
    const sessionUuid = serverDraftId ?? snapshot.current?.id ?? `temp-${snapshot.mode}-${Date.now()}`;
    try {
      setSavingDraft(true);
      if (serverDraftId && serverUpdatedAt) {
        const res = await updateDraft.mutateAsync({
          id: serverDraftId,
          expectedUpdatedAt: serverUpdatedAt,
          patch: { title: built.title, product_count: built.product_count, payload: built.payload },
        });
        setServerUpdatedAt(res.updated_at);
      } else {
        const res = await createDraft.mutateAsync({
          session_uuid: sessionUuid,
          flow: 'ai',
          mode: built.mode,
          title: built.title,
          site_type: siteType,
          product_count: built.product_count,
          payload: built.payload,
        });
        setServerDraftId(res.id);
        setServerUpdatedAt(res.updated_at);
      }
      toast.success(t('mobile.drafts.saved', { defaultValue: 'Draft saved' }));
    } catch {
      toast.error(t('mobile.drafts.saveFailed', { defaultValue: 'Could not save draft' }));
    } finally {
      setSavingDraft(false);
    }
  }, [serverDraftId, serverUpdatedAt, createDraft, updateDraft, t]);

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
        {/* Only single mode submits from this screen — in grouped mode the footer
            leads to the review hub, which carries its own copy of this notice. */}
        {!isGrouped && <SellerApprovalNotice />}
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
          onSaveDraft={handleSaveDraft}
          savingDraft={savingDraft}
        />
      </SafeAreaView>
    </FormProvider>
  );
}
