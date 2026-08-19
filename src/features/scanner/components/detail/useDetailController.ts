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
import { isRoutingResolved } from '@/features/scanner/routing/routingState';
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

  useEffect(() => {
    setLastStep('detail');
  }, [setLastStep]);

  const form = useForm<DetailFormInput>({
    resolver: zodResolver(detailSchema),
    defaultValues: emptyDetailDefaults(),
  });
  const { handleSubmit, reset } = form;

  // M-4 Step 8-6 — read the marketplace from the FORM, not the store.
  // `CategoryConditionCard` renders its tree from `watch('marketplace')`, so
  // reading the store here would resolve `categoryName` against the PREVIOUS
  // marketplace's tree for one render after the RoutingChip changes the form
  // value — and `buildDraftPatch`'s
  // `categoryOptions?.find((o) => o.id === values.categoryId)` (formMapping.ts)
  // would then miss and land `categoryName: null`. That is NOT cosmetic:
  // `category_name` IS submitted (buildFormData.ts:164 single / :271 grouped),
  // so a null silently drops the field from the payload.
  //
  // ⚠️ `form` must be created ABOVE this pair, or it is used before
  // initialisation. Order: useForm -> form.watch -> useLabCategories.
  const currentMarketplace = form.watch('marketplace');
  const categories = useLabCategories(currentMarketplace);
  const labelForRow = useRequiredRowLabel();

  const draft = useScanDraft((s) => s.current);
  // ⚠️ THE FORM IS A SCRATCH BUFFER OVER THE STORE, and this effect is why.
  // `draft` is the persisted object; any store write creates a NEW one and this
  // re-runs, replacing the whole form with the STORED values. Two consequences
  // worth knowing before you touch anything here:
  //   1. Blocker (c) DEPENDS on it — RoutingChip's onConfirm patches the cleared
  //      category into the store precisely so this reset restores the clear.
  //      `reset(..., { keepDirtyValues: true })` would defeat that and let submit
  //      send the previous tree's category id with the new allowed_sites[].
  //   2. Only the four submit paths write form values back, so a JS RESTART (an
  //      Android config change outside android:configChanges — density, not
  //      rotation — a low-memory kill, or a dev reload) reverts every edit made
  //      since the last store write: the category, the title, the price, the
  //      specs. Reported from the device pass 2026-08-19 as "a config change
  //      reverts unsaved category edits"; it is not category-specific.
  // Deliberately NOT fixed in that pass — the three options and their costs are
  // written up in Docs/multi-marketplace/phases/PHASE_5_APP_HONESTY_AND_FORMS.md
  // §11.1. Do not "tidy" this into an autosave without reading it.
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
   * C4 — after S9 the single-mode Submit is no longer disabled on state
   * (DetailFooter: `disabled={!!submitting}`), and `marketplaceConfirmed` is a
   * DRAFT field, not a `detailSchema` field — so `handleSubmit` cannot see it
   * and `onInvalid` can never fire for it. Without this guard M-3/M-4's routing
   * gate is bypassed on the single-item path and an item with
   * `marketplaceConfirmed: false` submits: `marketplace` drives `allowed_sites[]`
   * (buildFormData.ts:223-224) and therefore the product's `site_id`, so that
   * ships a listing to a marketplace nobody chose.
   *
   * Mirrors `missingPhotos()` exactly. It does NOT go through `alertMissing`
   * because routing is not a `RequiredRowKey` — `REQUIRED_ROWS` has seven
   * entries and `marketplace` is not one of them, and making it one changes
   * `getRequiredStatus`'s signature in a file M-7 owns (integration C4 defers
   * that "fuller option" explicitly). If a later phase adds the eighth row,
   * delete this function and use `alertMissing(['marketplace'])`.
   */
  const missingRouting = (): boolean => {
    const draftNow = useScanDraft.getState().current;
    if (!draftNow || isRoutingResolved(draftNow)) return false;
    haptics.error();
    Alert.alert(
      t('mobile.groupedEdit.missingTitle', { defaultValue: 'Some fields are missing' }),
      t('mobile.detail.routing.askCta', { defaultValue: 'Choose a marketplace to continue' }),
    );
    return true;
  };

  const submitSingleValidated = handleSubmit((values) => {
    if (missingPhotos()) return;
    if (missingRouting()) return;
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

