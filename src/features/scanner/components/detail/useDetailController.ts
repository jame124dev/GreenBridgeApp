import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useForm, type FieldErrors, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';
import { useCreateListing } from '@/features/scanner/useCreateListing';
import {
  canSubmitListing,
  redirectToSellerApplication,
} from '@/features/seller/sellerSubmitGate';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { useRequiredRowLabel } from '@/features/scanner/requiredRowLabels';
import {
  REQUIRED_ROWS,
  rowForPath,
  type RequiredRowKey,
} from '@/features/scanner/requiredStatus';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

import {
  buildDraftPatch,
  draftToFormValues,
  emptyDetailDefaults,
} from './formMapping';

/**
 * Owns the RHF form + the 4 submit modes + addMorePhotos for `app/scan/detail.tsx`.
 * Extracted from the inline route logic so the route file stays a thin composition.
 *
 * Submit modes — all read the live form snapshot via `handleSubmit`:
 *  - `onSubmitSingle`           — single mode: create product + batch, route to success
 *  - `onAddAnother`             — grouped mode: enqueue current item, back to camera
 *  - `onReviewGroup`            — grouped mode: enqueue + go straight to review
 *  - `onSaveAndReturnToReview`  — grouped edit mode: save edits + replace to review
 */
export function useDetailController(opts?: {
  /** M-9: jump the seller to the card that owns a missing row. Supplied by
   *  `app/scan/detail.tsx` from `useRowScroller`. Optional, so any other caller
   *  keeps working. */
  scrollToRow?: (row: RequiredRowKey) => void;
}) {
  const { t } = useTranslation();
  const patch = useScanDraft((s) => s.patch);
  const setLastStep = useScanDraft((s) => s.setLastStep);
  const updatePhotos = useScanDraft((s) => s.updatePhotos);
  const enqueueCurrentItem = useScanDraft((s) => s.enqueueCurrentItem);
  const prepareGroupedReview = useScanDraft((s) => s.prepareGroupedReview);
  const createListing = useCreateListing();
  const currentMarketplace = useScanDraft((s) => s.current?.marketplace);
  const categories = useLabCategories(currentMarketplace);

  useEffect(() => {
    setLastStep('detail');
  }, [setLastStep]);

  const form = useForm<DetailFormInput>({
    resolver: zodResolver(detailSchema),
    defaultValues: emptyDetailDefaults(),
  });
  const { handleSubmit, reset } = form;
  const labelForRow = useRequiredRowLabel();

  const draft = useScanDraft((s) => s.current);
  useEffect(() => {
    if (!draft) {
      router.replace(routes.scanHome);
      return;
    }
    reset(draftToFormValues(draft));
  }, [draft, reset]);

  // Clearing categoryId/categoryName when the marketplace changes is handled in
  // MarketplaceCard's onPress (user-driven only). A watch-effect here wrongly
  // fired during initial hydration — the form's default marketplace ('101lab')
  // flips to the AI-suggested one ('101it'), which looked like a user switch and
  // wiped the auto-filled category before the category tree even loaded.

  const addMorePhotos = async () => {
    if (!draft) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;
    const added = result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    try {
      await updatePhotos([...(draft.photos ?? []), ...added]);
    } catch {
      Alert.alert(t('mobile.reorder.savingTitle'), t('mobile.reorder.savingBody'));
    }
  };

  const buildUpdated = (values: DetailFormInput) => {
    const current = useScanDraft.getState().current;
    if (!current) return null;
    return buildDraftPatch(values, current, categories.data?.options);
  };

  /**
   * M-9 — the dead-button fix, copied from `app/scan/grouped-edit.tsx:127-160`
   * ("no save path may silently no-op"). Any failed submit fires haptics, an Alert
   * naming the missing fields, a scroll to the first offending card, and
   * `setFocus` on the first invalid field.
   *
   * Field names come from `useRequiredRowLabel` via `rowForPath`, so a field is
   * named here exactly as the footer chips and the review hub name it. The copy
   * keys are `mobile.groupedEdit.*`, reused verbatim (they are already translated
   * in all six locales) rather than duplicated under `mobile.detail.*` — the same
   * cross-namespace reuse the hub already does with `mobile.detail.section*`
   * (grouped-review.tsx:546-565).
   */
  const missingRowsFrom = (errors: FieldErrors<DetailFormInput>): RequiredRowKey[] => {
    const rows = new Set<RequiredRowKey>();
    for (const field of Object.keys(errors)) {
      const row = rowForPath([field]);
      if (row) rows.add(row);
    }
    if ((useScanDraft.getState().current?.photos?.length ?? 0) === 0) rows.add('photos');
    // REQUIRED_ROWS order, so the list reads top-to-bottom like the screen.
    return REQUIRED_ROWS.filter((k) => rows.has(k));
  };

  const alertMissing = (rows: RequiredRowKey[]) => {
    haptics.error();
    Alert.alert(
      t('mobile.groupedEdit.missingTitle', { defaultValue: 'Some fields are missing' }),
      t('mobile.groupedEdit.missingBody', {
        defaultValue: 'Please add: {{fields}}',
        fields: rows.map(labelForRow).join(', '),
      }),
    );
    const first = rows[0];
    if (first) opts?.scrollToRow?.(first);
  };

  const onInvalid = (errors: FieldErrors<DetailFormInput>) => {
    const rows = missingRowsFrom(errors);
    if (rows.length > 0) {
      alertMissing(rows);
    } else {
      // No error path mapped to a visible row. Unreachable after S4's coercion
      // seam, but never alert an empty field list — name the raw fields the way
      // grouped-edit.tsx:127-160 does for unmapped keys.
      haptics.error();
      Alert.alert(
        t('mobile.groupedEdit.missingTitle', { defaultValue: 'Some fields are missing' }),
        t('mobile.groupedEdit.missingBody', {
          defaultValue: 'Please add: {{fields}}',
          fields: Object.keys(errors)
            .map((k) => k.replace(/^./, (c) => c.toUpperCase()))
            .join(', '),
        }),
      );
    }
    // Best-effort focus. RHF's setFocus only works on Controllers wired with a ref
    // (mostly TextInputs) and silently no-ops otherwise — the intended degrade,
    // same as grouped-edit.tsx:152-159.
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      try {
        form.setFocus(firstErrorField as keyof DetailFormInput);
      } catch {
        // no ref registered — ignore
      }
    }
  };

  /**
   * Photos are not part of `detailSchema`, so the VALID path has to guard them
   * explicitly now that Submit is no longer disabled on incomplete state (S9).
   * Mirrors grouped-edit.tsx:105-117.
   */
  const missingPhotos = (): boolean => {
    if ((useScanDraft.getState().current?.photos?.length ?? 0) > 0) return false;
    alertMissing(['photos']);
    return true;
  };

  /**
   * SEAM FOR PHASE 4 (integration doc C4) — the routing gate goes HERE, not in the
   * footer. S9 changed the single-mode Submit to `disabled={!!submitting}`, so
   * `allRequired` now feeds only the grouped-mode buttons; and
   * `marketplaceConfirmed` is a DRAFT field (`scanDraftStore.ts` `DraftItem`), not
   * a `detailSchema` field, so `handleSubmit` cannot see it and `onInvalid` can
   * never fire for it. ANDing `isRoutingResolved(draft)` into `allRequired` would
   * therefore be a silent no-op on the single-item path.
   *
   * Phase 4 must add a `missingRouting()` guard that mirrors `missingPhotos()`
   * exactly — read the draft from `useScanDraft.getState().current`, return false
   * when `isRoutingResolved(draftNow)`, otherwise `haptics.error()` + `Alert.alert`
   * and return true — and call it as the second statement of
   * `submitSingleValidated`, immediately after `if (missingPhotos()) return;`.
   */

  const submitSingleValidated = handleSubmit((values) => {
    if (missingPhotos()) return;
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    haptics.impact();
    createListing.mutate(useScanDraft.getState().current ?? updated, {
      onSuccess: ({ batchPk, batchNumber }) => {
        haptics.success();
        router.replace(routes.scanSuccess(batchPk, batchNumber, 1));
      },
      onError: (err) => {
        haptics.error();
        Alert.alert(
          t('mobile.detail.submitFailedTitle'),
          (err as Error).message ?? t('mobile.detail.submitFailedBodyDefault'),
        );
      },
    });
  }, onInvalid);

  /**
   * ⚠️ SELL GATE — choke point 2 of 2. `createListing` POSTs to
   * `/wp/create-product-direct` + create-batch, a DIFFERENT endpoint from the
   * grouped submit in `app/scan/grouped-review.tsx`, so gating only that one
   * would leave single-product publishing wide open.
   *
   * Wraps `handleSubmit` rather than living inside it: a blocked user is going to
   * the seller form, so running field validation first would surface errors about
   * a publish that is not about to happen. Their draft stays in `useScanDraft`.
   *
   * `onAddAnother` / `onReviewGroup` / `onSaveAndReturnToReview` stay UNGATED —
   * they only move work around inside the app.
   */
  const onSubmitSingle = () => {
    if (!canSubmitListing()) {
      haptics.tap();
      redirectToSellerApplication();
      return;
    }
    void submitSingleValidated();
  };

  const onAddAnother = handleSubmit((values) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    enqueueCurrentItem();
    router.push(routes.scanCamera);
  }, onInvalid);

  const onReviewGroup = handleSubmit((values) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    prepareGroupedReview();
    router.push(routes.scanGroupedReview);
  }, onInvalid);

  const onSaveAndReturnToReview = handleSubmit((values) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    enqueueCurrentItem();
    router.replace(routes.scanGroupedReview);
  }, onInvalid);

  return {
    form,
    submitting: createListing.isPending,
    addMorePhotos,
    onSubmitSingle,
    onAddAnother,
    onReviewGroup,
    onSaveAndReturnToReview,
  } satisfies DetailController;
}

export interface DetailController {
  form: UseFormReturn<DetailFormInput>;
  submitting: boolean;
  addMorePhotos: () => Promise<void>;
  onSubmitSingle: () => void;
  onAddAnother: () => void;
  onReviewGroup: () => void;
  onSaveAndReturnToReview: () => void;
}

