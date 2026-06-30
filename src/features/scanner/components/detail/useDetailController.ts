import { useEffect } from 'react';
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
  const { handleSubmit, reset } = form;

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

