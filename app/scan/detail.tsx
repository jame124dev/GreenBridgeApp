import { useCallback, useEffect, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { router } from 'expo-router';
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
  FieldGroupSurfaceProvider,
  IdentityCard,
  LocationCard,
  MarketplaceCard,
  OptionalDetailsSection,
  PhotosCard,
  PricingCard,
  ProfitIntelligenceCard,
  RoutingChip,
  SectionBand,
  SpecsCard,
  useDetailController,
  useRowScroller,
} from '@/features/scanner/components/detail';
/*
  v2 SHELL. This route is a thin composition — the visible surface is the
  fifteen cards under `features/scanner/components/detail/*`, which are still on
  the old kit. What changes here is the container only:

    SafeAreaView + `bg-brand-background`  →  v2 `Screen`

  `Screen` owns the safe areas (so `edges={['top','bottom']}` goes), the status
  bar style and the ground colour, and `scroll={false}` leaves this screen's own
  `KeyboardAwareScrollView` in charge — which it must be, because `scrollRef`
  drives the row-jump that the footer chips and the invalid-submit alert use.

  ⚠️ ORDER IS LOAD-BEARING AND TESTED. `keyboardStickyFooter.test.ts` asserts
  that the first JSX element after `</KeyboardAwareScrollView>` IS
  `KeyboardStickyView` — anything else is a footer sitting behind the IME. The
  sticky block stays a direct sibling of the scroll view inside `Screen`.
*/
import { Screen } from '@/features/v2/ui';
import { GUTTER, space } from '@/theme/v2';
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

  /*
    ⚠️ EVERY HOOK MUST SIT ABOVE `if (!draft) return null;`.

    These three used to sit BELOW it. `draft` is `useScanDraft(s => s.current)`,
    which is null before a draft is loaded and non-null after — so the component
    rendered two hooks on the first pass and five on the next, which is the
    condition React throws "rendered more hooks than during the previous render"
    on. It had not bitten yet only because the screen is usually mounted with a
    draft already in the store. Found 2026-10-08 when adding `footerHeight`
    tripped `react-hooks/rules-of-hooks` on all three at once; moving them up
    fixes the two that were already there as well as the new one.
  */

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

  /*
    Measured height of the sticky footer block, so the scroll can end clear of
    it. Seeded with the old hardcoded 132 only as a FIRST-FRAME value — the
    `onLayout` below replaces it before the seller can scroll, and seeding 0
    would let the last field render under the footer for a frame.
  */
  const [footerHeight, setFooterHeight] = useState(132);
  // Plus one gutter, so the last field clears the footer instead of touching it.
  const footerInset = footerHeight + GUTTER;

  if (!draft) return null;

  const formValues = form.watch();
  const required = getRequiredStatus(formValues, draft.photos?.length ?? 0);

  return (
    <FormProvider {...form}>
      <Screen scroll={false} tabBar={false} testID="scan-detail">
        <DetailAppBar />
        <KeyboardAwareScrollView
          ref={scrollRef}
          style={styles.scroll}
          // 132, not 48: the sticky footer is ~112pt tall (progress strip + two
          // buttons + the home-indicator inset) and 48 left the last card sitting
          // underneath it, so LOCATION and INSTALLATION were unreachable without
          // fighting the scroll.
          /*
            MEASURED, not hardcoded. `FORM_INPUT_RULES.md`: never hardcode an
            inset that has to clear a sibling — measure it with `onLayout`.

            The footer is not a fixed height. It carries a progress strip whose
            chips WRAP to a second line as more fields come up short, and a
            `SellerApprovalNotice` that is present for some sellers and absent
            for others. The old literal 132 was measured once, against one
            state, and was wrong in both directions: too small when the chips
            wrapped (the last field went back under the footer) and too large in
            the common case, which is the empty band of white below Installation.
          */
          contentContainerStyle={[styles.scrollContent, { paddingBottom: footerInset }]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
        {/*
          GREY BANDS, NOT EIGHT BORDERED CARDS.

          `FORM_UX_PANEL.md` §A: all three reviewers independently found that
          everything on this screen carried the same visual weight — the four
          fields that block submission looked exactly like the four the AI had
          already filled in. Mercari's structure
          (`Docs/scan/_refs/ref-mercari-list-an-item.jpg`) is the answer: a grey
          spacer band with a sentence-case heading, then full-bleed white rows
          separated by a hairline. The frame moves off the cards and onto the
          page, which is why the provider is here and not in each component —
          `grouped-edit.tsx` and `listing-edit.tsx` mount the same cards and keep
          the old frame until they are restructured too (see `SectionBand.tsx`).

          Presentation only. Every row, every value and every registerRow
          wrapper below is the one that was here before.
        */}
        <FieldGroupSurfaceProvider value="flush">
          <View style={styles.gutterTop} onLayout={registerRow('photos')}>
            <PhotosCard
              photos={draft.photos ?? []}
              rearrangeLabel={t('mobile.review.rearrange')}
              /*
                Only with something to rearrange. With one photo the control
                opens a reorder screen that cannot reorder anything — and
                `PhotosCard`'s own contract says to OMIT a control rather than
                show one that does nothing (its `onRearrange` docblock, on the
                Guideline 2.1 "App Completeness" risk). Seen on a device with a
                single-photo draft, where the overlay still read
                "Rearrange photos" beside a "1/1" counter.
              */
              onRearrange={
                (draft.photos?.length ?? 0) > 1
                  ? () => router.push(routes.scanReorderPhotosEdit())
                  : undefined
              }
              onAddMore={addMorePhotos}
            />
          </View>
          {/* M-3 — the routing answer sits at the TOP of the scroll, above the
              identity fields, because it decides which category tree and which
              currency the rest of the form uses. It renders NOTHING when only
              one marketplace is supported, so a fail-closed install is 1.0.3. */}
          <View style={styles.gutterBlock}>
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
          </View>

          {/* A bare band — a plain grey spacer. Vinted does the same between the
              photo strip and the first field block: a heading here would name
              something the title field says better by being the title field. */}
          <SectionBand />
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
          <SectionBand title={t('mobile.detail.bandDetails', { defaultValue: 'Details' })} />
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
          {/* Weight / dimensions / CO₂ / serial / documents are ALL optional, and
              stacked flat they were roughly a third of a 7,483px scroll — each
              shouting as loudly as price and location. Folded behind one row per
              the approved design. `filledCount` means a seller never has to open
              the section to find out they already answered something in it. */}
          {/* The disclosure keeps CARDS inside it, deliberately. A band titles a
              region of the page the seller is already looking at; this content
              is behind a tap, and once opened it is two unrelated things
              (specs, documents) that need their own frames. `DocumentsCard` is
              a card regardless — it is not one of the six this pass owns — so
              flushing `SpecsCard` alone would make the pair disagree. */}
          <View style={styles.gutterBlock}>
          <FieldGroupSurfaceProvider value="card">
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
          </FieldGroupSurfaceProvider>
          </View>

          {/*
            ⚠️ ORDER: both of these moved on 2026-10-08, and the reason is that a
            BAND IS A CLAIM ABOUT WHAT FOLLOWS IT.

            "More details — weight, size, CO₂, documents" used to sit AFTER
            `PricingCard`, which put it under the Pricing heading although not one
            field in it is about price. It is item detail, so it now closes the
            Details group.

            `ProfitIntelligenceCard` — the AI's resale range — used to sit ABOVE
            the Pricing band, i.e. under Details, although its whole job is to
            inform the number the seller is about to type. It now opens Pricing,
            directly above the field it exists to help with. It still renders
            nothing when the AI returned no tiers, and `FieldGroup` drops the
            null, so an absent estimate leaves no gap behind.
          */}
          <SectionBand title={t('mobile.detail.bandPricing', { defaultValue: 'Pricing' })} />
          <View style={styles.gutterBlock}>
            <ProfitIntelligenceCard aiPrices={draft.aiPrices} />
          </View>
          <View onLayout={registerRow('price')}>
            <PricingCard />
          </View>
          {/* VisibilityCard removed for now — all listings ship as PUBLIC
              (the default on emptyDraft + sessionVisibility). Re-mount when
              product calls for it; the underlying store fields stay intact. */}
          <SectionBand title={t('mobile.detail.bandLocation', { defaultValue: 'Location' })} />
          <View onLayout={registerRow('location')}>
            <LocationCard />
          </View>
          {/*
            ⛔ THE REQUIRED CHECKLIST CARD WAS REMOVED FROM THIS SCREEN.

            It listed all seven required rows with ticks at the very end of a
            four-screen scroll — a second "what is missing" system competing
            with `RequiredProgressStrip`, which says the same thing in the
            sticky footer where it is ALWAYS visible and whose chips scroll you
            to the offending field. Two trackers for one truth: the buried one
            is the one to drop, and the orange card was also the single
            heaviest block on an already text-dense form.

            ⚠️ IT STAYS IN `app/scan/grouped-edit.tsx`. That screen has no
            `DetailFooter` and therefore no progress strip — the card is its
            only persistent account of what is still missing, with just an
            Alert on submit otherwise. Removing it there would leave nothing.
          */}
        </FieldGroupSurfaceProvider>
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
          <View
            /*
              ⚠️ The measurement goes on THIS inner View, not on
              `KeyboardStickyView`. The sticky view takes `styles.hidden`
              (`display: 'none'`) while the keyboard is up, and a hidden view
              lays out at height 0 — measuring there would collapse the scroll's
              bottom inset on every keystroke and restore it on blur, which is a
              visible jump in the scroll position. The guard below drops the 0
              anyway; this just keeps the two concerns apart.
            */
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              // `> 0` because a `display: 'none'` ancestor reports 0, and
              // rounding because sub-pixel layout churn would re-render the
              // whole scroll on every frame of the chip-wrap animation.
              if (h > 0) setFooterHeight(Math.round(h));
            }}
          >
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
          </View>
        </KeyboardStickyView>
      </Screen>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  /*
    ⚠️ NO `paddingBottom` HERE ANY MORE. It is applied at the call site from
    `footerInset`, which is the MEASURED footer height plus a gutter.

    This used to be a hardcoded `132` with a comment admitting it was the exact
    thing `FORM_INPUT_RULES.md` says to measure. Resolved 2026-10-08: the footer
    grows when the progress chips wrap to a second line and shrinks when the
    seller-approval notice is absent, so no single literal is right for every
    state. Do not reintroduce one.
  */
  /*
    NO HORIZONTAL PADDING AND NO `gap` ANY MORE. Both moved INTO the content:
    the white field groups and the grey bands draw edge to edge (that is what
    "full-bleed" means and it is the whole visual difference), so a gutter here
    would inset them and a `gap` would open a white stripe between a band and
    the block it titles. Everything that is still an island — photos, the
    routing chip, the profit panel, the optional disclosure — carries the gutter
    itself, below.
  */
  // `paddingBottom` is supplied at the call site from the measured footer.
  scrollContent: {},
  /** The first island: the page gutter plus the top padding the old `padding: GUTTER` gave it. */
  gutterTop: { paddingHorizontal: GUTTER, paddingTop: GUTTER },
  /** The same, plus the breathing room the deleted `gap` used to provide. */
  gutterBlock: { paddingHorizontal: GUTTER, paddingTop: space.lg, gap: space.sm },
  // `display: none` rather than unmounting: unmounting the footer would drop the
  // progress strip's layout registrations and make the row-jump targets stale.
  hidden: { display: 'none' },
});
