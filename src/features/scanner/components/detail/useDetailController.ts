import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';
import { useCreateListing } from '@/features/scanner/useCreateListing';
import { useLabCategories } from '@/features/scanner/useLabCategories';
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
export function useDetailController() {
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
  const { handleSubmit, reset, watch, setValue } = form;

  const draft = useScanDraft((s) => s.current);
  useEffect(() => {
    if (!draft) {
      router.replace(routes.scanHome);
      return;
    }
    reset(draftToFormValues(draft));
  }, [draft, reset]);

  // W3 (scan_v3): clear categoryId + categoryName when the user switches
  // marketplaces. Web parity — `NewSubmissionUploadPage.tsx:230-238` does
  // the same. Skip the initial hydration (the draftToFormValues effect above
  // legitimately sets marketplace AND categoryId together; no drift) by
  // tracking the previous marketplace in a ref and only reacting to
  // user-driven changes after that first set.
  const watchedMarketplace = watch('marketplace');
  const prevMarketplaceRef = useRef<string | undefined>(undefined);
  // setValue calls inside the effect ARE the effect's intent — synchronize
  // categoryId/categoryName with a user-driven marketplace transition. The
  // setState-in-effect rule's "compute in render" suggestion doesn't fit:
  // we need to detect the transition (compare prev to current via ref) and
  // emit the side effect exactly once per change.
  useEffect(() => {
    const prev = prevMarketplaceRef.current;
    prevMarketplaceRef.current = watchedMarketplace;
    if (prev === undefined || prev === watchedMarketplace) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue('categoryId', '', { shouldValidate: false });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue('categoryName', '', { shouldValidate: false });
  }, [watchedMarketplace, setValue]);

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

  const onSubmitSingle = handleSubmit((values) => {
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
  });

  const onAddAnother = handleSubmit((values) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    enqueueCurrentItem();
    router.push(routes.scanCamera);
  });

  const onReviewGroup = handleSubmit((values) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    prepareGroupedReview();
    router.push(routes.scanGroupedReview);
  });

  const onSaveAndReturnToReview = handleSubmit((values) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    enqueueCurrentItem();
    router.replace(routes.scanGroupedReview);
  });

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

