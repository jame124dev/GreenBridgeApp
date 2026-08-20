import { useCallback, useEffect, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Keyboard, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { getRequiredStatus } from '@/features/scanner/requiredStatus';
import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  isRoutingResolved,
} from '@/features/scanner/routing/routingState';
import {
  CategoryConditionCard,
  DescriptionCard,
  DetailAppBar,
  DetailFooter,
  DocumentsCard,
  IdentityCard,
  LocationCard,
  MarketplaceCard,
  OptionalDetailsSection,
  PhotosCard,
  PricingCard,
  ProfitIntelligenceCard,
  RequiredChecklist,
  RoutingChip,
  SpecsCard,
  useDetailController,
  useRowScroller,
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

  // M-8/M-9: the footer chips and the invalid-submit alert both jump to the card
  // that owns a required row.
  const { scrollRef, registerRow, scrollToRow } = useRowScroller();
  const controller = useDetailController({ scrollToRow });
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

  // Plain RN listeners rather than a keyboard-controller hook: this only needs a
  // boolean, and `didShow`/`didHide` fire after the IME has settled, so the
  // footer does not flicker mid-animation.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <FormProvider {...form}>
      <SafeAreaView className="flex-1 bg-brand-background" edges={['top', 'bottom']}>
        <DetailAppBar />
        <KeyboardAwareScrollView
          ref={scrollRef}
          className="flex-1"
          // 132, not 48: the sticky footer is ~112pt tall (progress strip + two
          // buttons + the home-indicator inset) and 48 left the last card sitting
          // underneath it, so LOCATION and INSTALLATION were unreachable without
          // fighting the scroll.
          contentContainerStyle={{ padding: 16, paddingBottom: 132, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View onLayout={registerRow('photos')}>
            <PhotosCard
              photos={draft.photos ?? []}
              rearrangeLabel={t('mobile.review.rearrange')}
              onRearrange={() => router.push(routes.scanReorderPhotosEdit())}
              onAddMore={addMorePhotos}
            />
          </View>
          {/* M-3 — the routing answer sits at the TOP of the scroll, above the
              identity fields, because it decides which category tree and which
              currency the rest of the form uses. It renders NOTHING when only
              one marketplace is supported, so a fail-closed install is 1.0.3. */}
          <RoutingChip
            draft={draft}
            onConfirm={(marketplace) =>
              useScanDraft.getState().patch({
                marketplace,
                marketplaceConfirmed: true,
                // ⛔ blocker (c) — THE SAME PATCH. `patch()` builds
                // `{ ...cur, ...partial }` and sets a NEW `current` object, which
                // re-fires useDetailController's `useEffect(..., [draft, reset])`
                // and runs `reset(draftToFormValues(draft))`. `draftToFormValues`
                // maps `categoryId: draft.categoryId ?? ''`. So a patch carrying
                // only `marketplace` RESTORES the old category into the form — and
                // submit then sends `product_category_ids` from the PREVIOUS tree
                // with `allowed_sites[]` from the NEW one. The chip's `setValue`
                // calls cannot win that race; the store patch has to carry the
                // clear.
                //
                // Unconditional: `pick()` only calls `onConfirm` from a tap, and
                // re-confirming the SAME marketplace still means the seller has
                // just been shown "we won't guess the category" — clearing is the
                // honest outcome either way, and RoutingChip.pick already guards
                // the form-side clear on `m !== current`, so a no-op re-tap looks
                // unchanged.
                ...CLEARED_CATEGORY_DRAFT_FIELDS,
              })
            }
          />
          <View onLayout={registerRow('title')}>
            {/* FIX 1b — `needs_clearer_photo` says the server could not read a
                NAMEPLATE, so it is answered here (brand/model) rather than as a
                marketplace question. See routingNeedsAsk. */}
            <IdentityCard needsClearerPhoto={draft.needsClearerPhoto === true} />
          </View>
          <View onLayout={registerRow('description')}>
            <DescriptionCard />
          </View>
          <MarketplaceCard />
          {/* Category AND condition both live in this one card, so both rows
              register the SAME wrapper. Do not nest two wrappers: the inner y
              would be 0 relative to the outer and the jump would be a no-op.
              Splitting the card is M-2's job, in another phase. */}
          <View
            onLayout={(e) => {
              registerRow('category')(e);
              registerRow('condition')(e);
            }}
          >
            <CategoryConditionCard />
          </View>
          <ProfitIntelligenceCard aiPrices={draft.aiPrices} />
          <View onLayout={registerRow('price')}>
            <PricingCard />
          </View>
          {/* Weight / dimensions / CO₂ / serial / documents are ALL optional, and
              stacked flat they were roughly a third of a 7,483px scroll — each
              shouting as loudly as price and location. Folded behind one row per
              the approved design. `filledCount` means a seller never has to open
              the section to find out they already answered something in it. */}
          <OptionalDetailsSection
            filledCount={
              [
                formValues.weight,
                formValues.dimensions,
                formValues.co2Emissions,
                formValues.serialNumber,
              ].filter((v) => String(v ?? '').trim().length > 0).length +
              (draft.documents?.length ? 1 : 0)
            }
          >
            <SpecsCard />
            <DocumentsCard draft={draft} />
          </OptionalDetailsSection>
          {/* VisibilityCard removed for now — all listings ship as PUBLIC
              (the default on emptyDraft + sessionVisibility). Re-mount when
              product calls for it; the underlying store fields stay intact. */}
          <View onLayout={registerRow('location')}>
            <LocationCard />
          </View>
          <RequiredChecklist draft={draft} />
        </KeyboardAwareScrollView>
        {/* M-11 — lift the notice + footer above the keyboard. Wrapped for BOTH
            platforms per the S1 observation (2026-08-18): `KeyboardProvider` is
            mounted with `enabled` defaulting to true (app/_layout.tsx:176), which
            makes react-native-keyboard-controller call
            `setDecorFitsSystemWindows(window, false)` and skip its own bottom
            padding (`!active` gate, EdgeToEdgeReactViewGroup.kt:115) — so Android's
            manifest `adjustResize` does NOT shrink the window and the IME draws
            over this block. `KeyboardAwareScrollView` only rescues content INSIDE
            the scroll; the footer is its sibling. iOS is unverified on the win32
            machine this was built on — check it on a Mac before 1.0.4 ships. */}
        {/* HIDDEN WHILE TYPING — observed on a Galaxy S20 FE (2026-08-20).
            KeyboardStickyView lifts this block above the IME, but the scroll view
            behind it keeps its full height, so the footer landed in the MIDDLE of
            the screen with form fields visible both above AND below it — WEIGHT
            above, CO2 EMISSIONS below. It read as a broken overlay rather than a
            footer. Nobody needs "Save as draft" while editing a field, and it
            comes straight back on blur, so the honest fix is not to draw it. */}
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={keyboardOpen ? styles.hidden : undefined}>
          {/* Only single mode submits from this screen — in grouped mode the footer
              leads to the review hub, which carries its own copy of this notice. */}
          {!isGrouped && <SellerApprovalNotice />}
          <DetailFooter
            isGrouped={isGrouped}
            editingGroupedItem={editingGroupedItem}
            queuedCount={queuedCount}
            // M-3 — an unanswered routing question blocks Submit for the same
            // reason a missing category does: `marketplace` drives
            // `allowed_sites[]` (buildFormData.ts:223-224) and therefore the
            // product's site_id. Kept HERE rather than inside
            // `getRequiredStatus` so this phase does not collide with M-7,
            // which owns requiredStatus.ts.
            //
            // ⚠️ AFTER PHASE 5 THIS IS NOT ENOUGH ON ITS OWN (integration C4).
            // The single-mode Submit is `disabled={!!submitting}`, so
            // `allRequired` feeds only the GROUPED buttons.
            // `missingRouting()` in useDetailController is what actually stops a
            // single-mode submit. Keep BOTH: this one keeps the button visibly
            // disabled in grouped mode, that one is the correctness fix.
            allRequired={required.allComplete && isRoutingResolved(draft)}
            submitting={submitting}
            onSubmitSingle={onSubmitSingle}
            onAddAnother={onAddAnother}
            onReviewGroup={onReviewGroup}
            onSaveAndReturnToReview={onSaveAndReturnToReview}
            onSaveDraft={handleSaveDraft}
            savingDraft={savingDraft}
            required={required}
            onPressRow={scrollToRow}
          />
        </KeyboardStickyView>
      </SafeAreaView>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  // `display: none` rather than unmounting: unmounting the footer would drop the
  // progress strip's layout registrations and make the row-jump targets stale.
  hidden: { display: 'none' },
});
