import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import CurrencyInput from 'react-native-currency-input';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { AppImage } from '@/components/ui';
import {
  CONDITION_LABELS,
  DEFAULT_OPERATION_STATUS,
  VALID_CONDITION_KEYS,
  type ConditionKey,
} from '@/features/scanner/constants';
import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { PhotoZoomViewer } from '@/components/scanner/PhotoZoomViewer';
import { persistDocumentsForDraft } from '@/services/upload/persistPhotos';
import { getDeviceLocation, hasLocationPermission } from '@/services/location/getDeviceLocation';
import { readCachedLocation } from '@/features/location/pickupStore';
import { useCreateListing } from '@/features/scanner/useCreateListing';
import { getRequiredStatus } from '@/features/scanner/requiredStatus';
import { useScanDraft } from '@/stores/scanDraftStore';
import type { BatchVisibility } from '@/types/batch';
import { colors, fonts, fontSize, radius, spacing } from '@/theme';

// Checklist status icon colors (Stitch step-complete / step-pending).
const STEP_DONE = colors.primaryDim;
const STEP_PENDING = colors.tertiaryDim;

const VISIBILITY_OPTIONS: {
  key: BatchVisibility;
  label: string;
  hint: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { key: 'PUBLIC', label: 'Public', hint: 'Visible on the marketplace', icon: 'public' },
  { key: 'PRIVATE', label: 'Private', hint: 'Only you can see this batch', icon: 'visibility-off' },
  { key: 'NETWORK', label: 'Network', hint: 'Selected buyers only', icon: 'hub' },
];

export default function DetailScreen() {
  const { t } = useTranslation();
  const draft = useScanDraft((s) => s.current);
  const mode = useScanDraft((s) => s.mode);
  const queuedCount = useScanDraft((s) => s.queuedItems.length);
  const patch = useScanDraft((s) => s.patch);
  const setLastStep = useScanDraft((s) => s.setLastStep);
  const updatePhotos = useScanDraft((s) => s.updatePhotos);
  const enqueueCurrentItem = useScanDraft((s) => s.enqueueCurrentItem);
  const prepareGroupedReview = useScanDraft((s) => s.prepareGroupedReview);
  const saveCurrentToGroupedQueue = useScanDraft((s) => s.saveCurrentToGroupedQueue);
  const editingGroupedItem = useScanDraft((s) => s.editingGroupedItem);
  const createListing = useCreateListing();
  const categories = useLabCategories();
  const isGrouped = mode === 'grouped';

  useEffect(() => {
    setLastStep('detail');
  }, [setLastStep]);

  const { control, handleSubmit, reset, watch, setValue } = useForm<DetailFormInput>({
    resolver: zodResolver(detailSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      condition: [],
      operationStatus: [...DEFAULT_OPERATION_STATUS],
      priceFormat: 'buyNow',
      pricePerUnit: '',
      priceCurrency: 'USD',
      quantity: 1,
      address: '',
      country: '',
    },
  });

  useEffect(() => {
    if (!draft) {
      router.replace(routes.scanHome);
      return;
    }
    reset({
      title: draft.title,
      description: draft.description,
      categoryId: draft.categoryId ?? '',
      condition: draft.condition,
      operationStatus: draft.operationStatus,
      priceFormat: draft.priceFormat,
      pricePerUnit: draft.pricePerUnit,
      priceCurrency: draft.priceCurrency,
      quantity: draft.quantity,
      address: draft.location?.address ?? '',
      country: draft.location?.country ?? '',
    });
  }, [draft, reset]);

  const priceFormat = watch('priceFormat');
  const selectedConditions = watch('condition');

  // ── Pickup location ──────────────────────────────────────────────────────
  const [locating, setLocating] = useState(false);

  // Auto-fill on open: only when the draft has no location yet AND permission is
  // already granted — never prompts the user from a screen they didn't ask. The
  // synchronous form `reset()` above runs first; this async fill lands after it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cur = useScanDraft.getState().current;
      if (cur?.location?.address || cur?.location?.country) return;

      // Reuse the location already detected on Home (cached) so the listing
      // pickup fields fill instantly without a second GPS round-trip.
      const cached = readCachedLocation();
      if (cached?.address || cached?.country) {
        setValue('address', cached.address, { shouldValidate: true });
        setValue('country', cached.country, { shouldValidate: true });
        return;
      }

      // Otherwise, silent GPS fill when permission's already granted.
      if (!(await hasLocationPermission())) return;
      const res = await getDeviceLocation();
      if (cancelled || !res.ok) return;
      setValue('address', res.location.address, { shouldValidate: true });
      setValue('country', res.location.country, { shouldValidate: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [setValue]);

  // Manual "Use my location" — prompts for permission if needed.
  const useMyLocation = async () => {
    haptics.tap();
    setLocating(true);
    try {
      const res = await getDeviceLocation();
      if (res.ok) {
        setValue('address', res.location.address, { shouldValidate: true });
        setValue('country', res.location.country, { shouldValidate: true });
      } else if (res.reason === 'denied') {
        Alert.alert(
          t('mobile.detail.locationDeniedTitle', { defaultValue: 'Location permission needed' }),
          t('mobile.detail.locationDeniedBody', {
            defaultValue: 'Enable location access in Settings to auto-fill the pickup address.',
          }),
        );
      } else {
        Alert.alert(
          t('mobile.detail.locationUnavailableTitle', { defaultValue: "Couldn't get location" }),
          t('mobile.detail.locationUnavailableBody', {
            defaultValue: 'Make sure location/GPS is on, then try again.',
          }),
        );
      }
    } finally {
      setLocating(false);
    }
  };

  const pickDocuments = async () => {
    if (!draft) return;
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const added = result.assets.map((a) => ({
      uri: a.uri,
      name: a.name ?? 'document',
      mimeType: a.mimeType ?? 'application/octet-stream',
    }));
    try {
      const merged = [...draft.documents, ...added];
      const persisted = await persistDocumentsForDraft(merged, draft.id);
      patch({ documents: persisted });
    } catch {
      Alert.alert(t('mobile.detail.docSaveFailedTitle'), t('mobile.detail.docSaveFailedBody'));
    }
  };

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

  const removeDocument = (index: number) => {
    if (!draft) return;
    patch({ documents: draft.documents.filter((_, i) => i !== index) });
  };

  const toggleCondition = (key: ConditionKey) => {
    const next = selectedConditions.includes(key)
      ? selectedConditions.filter((c) => c !== key)
      : [...selectedConditions, key];
    setValue('condition', next, { shouldValidate: true });
  };

  const selectVisibility = (key: BatchVisibility) => {
    if (key === 'NETWORK') {
      Alert.alert(
        'Network visibility',
        'Assigning network buyers is available on the web dashboard for now. Choose Public or Private, or set Network on web after submit.',
      );
      return;
    }
    patch({ visibility: key });
  };

  const buildUpdated = (values: DetailFormInput) => {
    const current = useScanDraft.getState().current;
    if (!current) return null;
    const cat = categories.data?.options.find((o) => o.id === values.categoryId);
    return {
      ...current,
      title: values.title,
      description: values.description,
      categoryId: values.categoryId,
      categoryName: cat?.name ?? null,
      condition: values.condition,
      operationStatus: values.operationStatus,
      priceFormat: values.priceFormat,
      pricePerUnit: values.pricePerUnit ?? '',
      priceCurrency: values.priceCurrency,
      quantity: values.quantity,
      location: { address: values.address, country: values.country },
      lastStep: 'detail' as const,
    };
  };

  const onSubmitSingle = (values: DetailFormInput) => {
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
  };

  const onAddAnother = (values: DetailFormInput) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    enqueueCurrentItem();
    router.push(routes.scanCamera);
  };

  const onReviewGroup = (values: DetailFormInput) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    prepareGroupedReview();
    router.push(routes.scanGroupedReview);
  };

  const onSaveAndReturnToReview = (values: DetailFormInput) => {
    const updated = buildUpdated(values);
    if (!updated) return;
    patch(updated);
    saveCurrentToGroupedQueue();
    router.replace(routes.scanGroupedReview);
  };

  if (!draft) return null;

  // REQUIRED checklist + Submit gate — both read from one source of truth
  // (getRequiredStatus → detailSchema). `formValues` is a live snapshot so the
  // checklist + the app-bar progress recompute on every keystroke.
  const pricePerUnitValue = watch('pricePerUnit');
  const formValues = watch();
  const required = getRequiredStatus(formValues, draft.photos?.length ?? 0);
  const allRequired = required.allComplete;
  const categoryLabel = categories.data?.options.find((o) => o.id === formValues.categoryId)?.label;
  const currencyPrefix = formValues.priceCurrency === 'TWD' ? 'NT$ ' : '$';
  const progressPct = Math.round((required.doneCount / required.total) * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* App bar — back + title + live step progress (driven by the checklist). */}
      <View style={styles.appBar}>
        <Pressable onPress={() => safeBack()} hitSlop={10} style={styles.appBarBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.appBarTitle}>{t('mobile.detail.title')}</Text>
        <View style={styles.appBarProgress}>
          <Text style={styles.stepLabel}>
            {required.doneCount}/{required.total}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Gallery
          photos={draft.photos ?? []}
          rearrangeLabel={t('mobile.review.rearrange')}
          onRearrange={() => router.push(routes.scanReorderPhotosEdit())}
          onAddMore={addMorePhotos}
        />

        {/* Basic info card */}
        <View style={styles.card}>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <View style={styles.field}>
                <FieldLabel text={t('mobile.detail.sectionTitle')} ai />
                <TextInput
                  style={[styles.input, styles.titleInput]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  maxLength={80}
                />
                <Text style={styles.charCount}>{value?.length ?? 0}/80</Text>
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </View>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <View style={styles.field}>
                <FieldLabel text={t('mobile.detail.sectionDescription')} ai />
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  numberOfLines={5}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{value?.length ?? 0}/500</Text>
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </View>
            )}
          />
        </View>

        {/* Category + Condition card */}
        <View style={styles.card}>
          <Controller
            control={control}
            name="categoryId"
            render={({ field: { value, onChange }, fieldState }) => (
              <View style={styles.field}>
                <FieldLabel text={t('mobile.detail.sectionCategory')} required />
                {categories.isLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : categories.isError ? (
                  <Text style={styles.error}>{t('mobile.detail.categoriesLoadFailed')}</Text>
                ) : (
                  <ScrollView
                    style={styles.catList}
                    contentContainerStyle={styles.catListContent}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {categories.data?.options.map((opt) => {
                      const active = value === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={[styles.catRow, active && styles.catRowActive]}
                          onPress={() => onChange(opt.id)}
                        >
                          <Text
                            style={[styles.catRowText, active && styles.catRowTextActive]}
                            numberOfLines={1}
                          >
                            {opt.label}
                          </Text>
                          <MaterialIcons
                            name={active ? 'check-circle' : 'chevron-right'}
                            size={20}
                            color={active ? colors.primary : colors.placeholder}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </View>
            )}
          />

          <View style={styles.field}>
            <FieldLabel text={t('mobile.detail.sectionCondition')} required />
            <View style={styles.pillRow}>
              {VALID_CONDITION_KEYS.map((key) => {
                const active = selectedConditions.includes(key);
                return (
                  <Pressable
                    key={key}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => toggleCondition(key)}
                  >
                    {active ? (
                      <MaterialIcons name="check" size={16} color={colors.primaryForeground} />
                    ) : null}
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {t(`mobile.detail.condition.${key}`, { defaultValue: CONDITION_LABELS[key] })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Price + Quantity card */}
        <View style={styles.card}>
          <View style={styles.priceQtyRow}>
            <View style={styles.priceCol}>
              <FieldLabel text={t('mobile.detail.sectionPrice')} required />
              <View style={styles.segRow}>
                <Pressable
                  style={[styles.segBtn, priceFormat === 'buyNow' && styles.segBtnActive]}
                  onPress={() => setValue('priceFormat', 'buyNow')}
                >
                  <Text style={[styles.segText, priceFormat === 'buyNow' && styles.segTextActive]}>
                    {t('mobile.detail.priceBuyNow')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.segBtn, priceFormat === 'offer' && styles.segBtnActive]}
                  onPress={() => setValue('priceFormat', 'offer')}
                >
                  <Text style={[styles.segText, priceFormat === 'offer' && styles.segTextActive]}>
                    {t('mobile.detail.priceMakeOffer')}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.qtyCol}>
              <FieldLabel text={t('mobile.detail.sectionQuantity')} />
              <Controller
                control={control}
                name="quantity"
                render={({ field: { value, onChange } }) => (
                  <View style={styles.stepper}>
                    <Pressable onPress={() => onChange(Math.max(1, value - 1))} style={styles.stepBtn}>
                      <MaterialIcons name="remove" size={20} color={colors.foreground} />
                    </Pressable>
                    <Text style={styles.stepValue}>{value}</Text>
                    <Pressable onPress={() => onChange(value + 1)} style={styles.stepBtn}>
                      <MaterialIcons name="add" size={20} color={colors.foreground} />
                    </Pressable>
                  </View>
                )}
              />
            </View>
          </View>

          {priceFormat === 'buyNow' ? (
            <Controller
              control={control}
              name="pricePerUnit"
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <View style={styles.field}>
                  {/* CurrencyInput is numeric; the form field is a string (per
                      detailSchema), so bridge number <-> string at the edges. */}
                  <CurrencyInput
                    style={styles.input}
                    value={value ? Number(value) : null}
                    onChangeValue={(num) => onChange(num != null ? String(num) : '')}
                    onBlur={onBlur}
                    prefix={currencyPrefix}
                    delimiter=","
                    separator="."
                    precision={2}
                    minValue={0}
                    keyboardType="decimal-pad"
                    placeholder={`${currencyPrefix}0.00`}
                    placeholderTextColor={colors.placeholder}
                  />
                  {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
                </View>
              )}
            />
          ) : null}
        </View>

        {/* Documents card (optional) */}
        <View style={styles.card}>
          <FieldLabel text={t('mobile.detail.sectionDocuments')} />
          {draft.documents.map((doc, i) => (
            <View key={`${doc.uri}-${i}`} style={styles.docRow}>
              <MaterialIcons name="description" size={18} color={colors.textMuted} />
              <Text style={styles.docName} numberOfLines={1}>
                {doc.name}
              </Text>
              <Pressable onPress={() => removeDocument(i)} hitSlop={8}>
                <Text style={styles.docRemove}>{t('mobile.common.remove')}</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addDocBtn} onPress={pickDocuments}>
            <MaterialIcons name="add" size={18} color={colors.primary} />
            <Text style={styles.addDocText}>{t('mobile.detail.addDocument')}</Text>
          </Pressable>
        </View>

        {/* Listing visibility card (single mode only) */}
        {!isGrouped ? (
          <View style={styles.card}>
            <FieldLabel text="LISTING VISIBILITY" />
            <View style={styles.visGrid}>
              {VISIBILITY_OPTIONS.map((opt) => {
                const active = draft.visibility === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.visCard, active && styles.visCardActive]}
                    onPress={() => selectVisibility(opt.key)}
                  >
                    <View style={styles.visTop}>
                      <MaterialIcons
                        name={opt.icon}
                        size={22}
                        color={active ? colors.primary : colors.textMuted}
                      />
                      {active ? (
                        <MaterialIcons name="check-circle" size={18} color={colors.primary} />
                      ) : null}
                    </View>
                    <Text style={[styles.visTitle, active && styles.visTitleActive]}>{opt.label}</Text>
                    <Text style={styles.visHint}>{opt.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Location card */}
        <View style={styles.card}>
          <View style={styles.locationHeader}>
            <FieldLabel text={t('mobile.detail.sectionLocation')} required />
            <Pressable
              onPress={useMyLocation}
              disabled={locating}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.detail.useMyLocation', { defaultValue: 'Use my location' })}
              style={styles.useLocationBtn}
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialIcons name="my-location" size={16} color={colors.primary} />
              )}
              <Text style={styles.useLocationText}>
                {t('mobile.detail.useMyLocation', { defaultValue: 'Use my location' })}
              </Text>
            </Pressable>
          </View>
          <Controller
            control={control}
            name="address"
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <>
                <View style={styles.iconInput}>
                  <MaterialIcons name="location-on" size={20} color={colors.placeholder} />
                  <TextInput
                    style={styles.iconInputField}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('mobile.detail.addressPlaceholder')}
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </>
            )}
          />
          <Controller
            control={control}
            name="country"
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <>
                <View style={[styles.iconInput, { marginTop: spacing.md }]}>
                  <MaterialIcons name="public" size={20} color={colors.placeholder} />
                  <TextInput
                    style={styles.iconInputField}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('mobile.detail.countryPlaceholder')}
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </>
            )}
          />
        </View>

        {/* REQUIRED checklist — amber card with live sync + per-row status. */}
        <View style={[styles.checklistCard, allRequired && styles.checklistCardOk]}>
          <View style={styles.checklistHeader}>
            <Text style={styles.checklistTitle}>
              {allRequired
                ? t('mobile.detail.required.header_complete')
                : t('mobile.detail.required.header_inprogress', {
                    done: required.doneCount,
                    total: required.total,
                  })}
            </Text>
            <View style={styles.liveSync}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <ChecklistRow
            done={required.rows.photos}
            label={t('mobile.detail.required.photos')}
            detail={
              required.rows.photos
                ? t('mobile.detail.required.photosDetail_some', { count: draft.photos.length })
                : t('mobile.detail.required.photosDetail_empty')
            }
          />
          <ChecklistRow
            done={required.rows.title}
            label={t('mobile.detail.required.title')}
            detail={
              required.rows.title
                ? (formValues.title ?? '').trim()
                : t('mobile.detail.required.titleDetail_empty')
            }
          />
          <ChecklistRow
            done={required.rows.description}
            label={t('mobile.detail.required.description')}
            detail={
              required.rows.description
                ? t('mobile.detail.required.done')
                : t('mobile.detail.required.descriptionDetail_empty')
            }
          />
          <ChecklistRow
            done={required.rows.category}
            label={t('mobile.detail.required.category')}
            detail={
              required.rows.category
                ? (categoryLabel ?? t('mobile.detail.required.done'))
                : t('mobile.detail.required.categoryDetail_empty')
            }
          />
          <ChecklistRow
            done={required.rows.condition}
            label={t('mobile.detail.required.condition')}
            detail={
              required.rows.condition
                ? selectedConditions
                    .map((k) =>
                      t(`mobile.detail.condition.${k}`, {
                        defaultValue: (CONDITION_LABELS as Record<string, string>)[k],
                      }),
                    )
                    .join(', ')
                : t('mobile.detail.required.conditionDetail_empty')
            }
          />
          <ChecklistRow
            done={required.rows.price}
            label={t('mobile.detail.required.price')}
            detail={
              required.rows.price
                ? priceFormat === 'offer'
                  ? t('mobile.detail.required.priceDetail_offer')
                  : `${draft.priceCurrency} ${pricePerUnitValue}`
                : t('mobile.detail.required.priceDetail_empty')
            }
          />
          <ChecklistRow
            done={required.rows.location}
            label={t('mobile.detail.required.location')}
            detail={
              required.rows.location
                ? [formValues.address, formValues.country].filter(Boolean).join(', ')
                : t('mobile.detail.required.locationDetail_empty')
            }
          />

          <View style={styles.promo}>
            <Text style={styles.promoText}>
              Completing all steps boosts your listing visibility by up to{' '}
              <Text style={styles.promoHighlight}>40%</Text>.
            </Text>
          </View>
        </View>

        {/* Seller tips card */}
        <View style={styles.tipsCard}>
          <FieldLabel text="SELLER TIPS" />
          <View style={styles.tipRow}>
            <MaterialIcons name="lightbulb" size={20} color={colors.primary} />
            <Text style={styles.tipText}>
              Clear photos of the serial number and engine plate increase buyer trust.
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Sticky footer action bar */}
      <View style={styles.footer}>
        {isGrouped ? (
          editingGroupedItem ? (
            <FooterButton
              label={t('mobile.detail.saveAndReturn')}
              onPress={handleSubmit(onSaveAndReturnToReview)}
              disabled={!allRequired}
              primary
              flex={1}
            />
          ) : (
            <>
              <FooterButton
                label={t('mobile.detail.reviewGroup', { count: queuedCount + 1 })}
                onPress={handleSubmit(onReviewGroup)}
                disabled={!allRequired}
                flex={1}
              />
              <FooterButton
                label={t('mobile.detail.addAnother')}
                onPress={handleSubmit(onAddAnother)}
                disabled={!allRequired}
                primary
                flex={2}
              />
            </>
          )
        ) : (
          <>
            <FooterButton
              label={t('mobile.detail.preview', { defaultValue: 'Preview' })}
              onPress={() =>
                Alert.alert(
                  t('mobile.detail.preview', { defaultValue: 'Preview' }),
                  t('mobile.detail.previewSoon', {
                    defaultValue: 'Listing preview is coming soon.',
                  }),
                )
              }
              flex={1}
            />
            <FooterButton
              label={t('mobile.detail.submitListing')}
              onPress={handleSubmit(onSubmitSingle)}
              disabled={!allRequired}
              loading={createListing.isPending}
              primary
              icon="arrow-forward"
              flex={2}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Label-caps field label with optional red `*` and an AI badge (auto_awesome + "AI"). */
function FieldLabel({ text, ai, required }: { text: string; ai?: boolean; required?: boolean }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={[styles.fieldLabel, required && styles.fieldLabelError]}>
        {text}
        {required ? ' *' : ''}
      </Text>
      {ai ? (
        <View style={styles.aiBadge}>
          <MaterialIcons name="auto-awesome" size={11} color={colors.primary} />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One row in the amber REQUIRED checklist — filled check (done) or error (pending). */
function ChecklistRow({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <View style={styles.checkRow}>
      <MaterialIcons
        name={done ? 'check-circle' : 'error'}
        size={22}
        color={done ? STEP_DONE : STEP_PENDING}
      />
      <View style={styles.checkTextWrap}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={[styles.checkDetail, !done && styles.checkDetailPending]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

/** Footer action button — filled (primary) or outline; optional trailing icon. */
function FooterButton({
  label,
  onPress,
  primary,
  disabled,
  loading,
  icon,
  flex,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  flex: number;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.footerBtn,
        { flex },
        primary ? styles.footerBtnPrimary : styles.footerBtnOutline,
        primary && isDisabled && styles.footerBtnPrimaryDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} size="small" />
      ) : (
        <>
          <Text
            style={[
              styles.footerBtnText,
              primary ? styles.footerBtnTextPrimary : styles.footerBtnTextOutline,
              primary && isDisabled && styles.footerBtnTextPrimaryDisabled,
            ]}
          >
            {label}
          </Text>
          {icon ? (
            <MaterialIcons
              name={icon}
              size={18}
              color={isDisabled ? '#304c41' : colors.primaryForeground}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/**
 * Hero gallery: a 16:9 cover image with a counter + Rearrange overlay, plus a
 * horizontal thumbnail strip (selected outline) ending in an "ADD MORE" tile.
 * Tapping the hero opens the full-screen zoom viewer at the active photo.
 */
function Gallery({
  photos,
  rearrangeLabel,
  onRearrange,
  onAddMore,
}: {
  photos: { uri: string }[];
  rearrangeLabel: string;
  onRearrange: () => void;
  onAddMore: () => void;
}) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!photos.length) return null;

  const activeIdx = Math.min(active, photos.length - 1);
  const heroW = width - spacing['3xl'] * 2;
  const heroH = Math.round((heroW * 9) / 16);

  return (
    <View style={styles.gallerySection}>
      <View style={styles.heroWrap}>
        <Pressable onPress={() => setViewerIndex(activeIdx)}>
          <AppImage source={{ uri: photos[activeIdx].uri }} style={{ width: '100%', height: heroH }} />
        </Pressable>
        <View style={styles.heroCounter}>
          <Text style={styles.heroCounterText}>
            {activeIdx + 1}/{photos.length}
          </Text>
        </View>
        <Pressable style={styles.rearrangeBtn} onPress={onRearrange} hitSlop={8}>
          <MaterialIcons name="photo-library" size={16} color={colors.primary} />
          <Text style={styles.rearrangeBtnText} numberOfLines={1}>
            {rearrangeLabel}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbStrip}
      >
        {photos.map((p, i) => (
          <Pressable
            key={p.uri}
            onPress={() => setActive(i)}
            style={[styles.thumb, i === activeIdx && styles.thumbActive]}
          >
            <AppImage source={{ uri: p.uri }} style={styles.thumbImg} />
          </Pressable>
        ))}
        <Pressable style={styles.addThumb} onPress={onAddMore}>
          <MaterialIcons name="add-a-photo" size={20} color={colors.textMuted} />
          <Text style={styles.addThumbText}>ADD MORE</Text>
        </Pressable>
      </ScrollView>

      <PhotoZoomViewer
        visible={viewerIndex !== null}
        photos={photos}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // App bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  appBarBtn: { padding: spacing.xs },
  appBarTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSize['5xl'],
    color: colors.foreground,
  },
  appBarProgress: { marginLeft: 'auto', alignItems: 'flex-end', gap: 4 },
  stepLabel: {
    fontFamily: fonts.label,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  progressTrack: {
    width: 96,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },

  scrollView: { flex: 1 },
  scroll: { padding: spacing['3xl'], paddingBottom: spacing['10xl'], gap: spacing.md },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: spacing['6xl'],
    gap: spacing.md,
  },
  field: { gap: spacing.sm },

  // Field labels
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldLabel: {
    fontFamily: fonts.label,
    fontSize: fontSize.md,
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  fieldLabelError: { color: colors.destructive },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.xs,
  },
  aiBadgeText: { fontFamily: fonts.label, fontSize: 10, color: colors.primary },

  // Inputs
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  titleInput: { fontFamily: fonts.headingSemibold, fontSize: fontSize['4xl'] },
  multiline: { minHeight: 110 },
  charCount: {
    fontFamily: fonts.label,
    fontSize: fontSize.sm,
    color: colors.placeholder,
    textAlign: 'right',
  },
  error: { color: colors.destructive, fontSize: fontSize.md, marginTop: 2 },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  useLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
  },
  useLocationText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.xl,
  },
  iconInputField: {
    flex: 1,
    paddingVertical: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },

  // Category rows
  catList: { maxHeight: 240 },
  catListContent: { gap: spacing.sm, paddingBottom: spacing.xs },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  catRowActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySurface },
  catRowText: { flex: 1, fontFamily: fonts.labelMedium, fontSize: fontSize.lg, color: colors.foreground },
  catRowTextActive: { color: colors.primary, fontFamily: fonts.label },

  // Condition pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontFamily: fonts.labelMedium, fontSize: fontSize.lg, color: colors.foreground },
  pillTextActive: { color: colors.primaryForeground },

  // Price + quantity
  priceQtyRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  priceCol: { flex: 1, gap: spacing.sm },
  qtyCol: { gap: spacing.sm },
  segRow: { flexDirection: 'row', gap: spacing.sm },
  segBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontFamily: fonts.labelMedium, fontSize: fontSize.lg, color: colors.textMuted },
  segTextActive: { color: colors.primaryForeground },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    overflow: 'hidden',
    height: 48,
  },
  stepBtn: { width: 40, height: '100%', alignItems: 'center', justifyContent: 'center' },
  stepValue: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },

  // Documents
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  docName: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.foreground },
  docRemove: { fontFamily: fonts.label, fontSize: fontSize.base, color: colors.destructive },
  addDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.xs,
    paddingVertical: spacing.lg,
  },
  addDocText: { fontFamily: fonts.label, fontSize: fontSize.lg, color: colors.primary },

  // Visibility grid
  visGrid: { gap: spacing.sm },
  visCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: 4,
  },
  visCardActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySurface },
  visTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  visTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSize.xl, color: colors.foreground },
  visTitleActive: { color: colors.primary },
  visHint: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.textMuted },

  // Gallery
  gallerySection: { gap: spacing.md },
  heroWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  heroCounter: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    backgroundColor: 'rgba(18, 28, 40, 0.6)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  heroCounterText: { fontFamily: fonts.labelMedium, fontSize: fontSize.base, color: '#fff' },
  rearrangeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rearrangeBtnText: { fontFamily: fonts.label, fontSize: fontSize.base, color: colors.primary },
  thumbStrip: { gap: spacing.md, paddingVertical: 2 },
  thumb: {
    width: 96,
    height: 54,
    borderRadius: radius.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  thumbActive: { borderWidth: 2, borderColor: colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  addThumb: {
    width: 96,
    height: 54,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addThumbText: { fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5, color: colors.textMuted },

  // Checklist (amber card)
  checklistCard: {
    backgroundColor: colors.tertiarySurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.tertiaryDim,
    padding: spacing['6xl'],
    gap: spacing.sm,
  },
  checklistCardOk: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  checklistTitle: {
    fontFamily: fonts.label,
    fontSize: fontSize.md,
    letterSpacing: 0.8,
    color: colors.tertiaryForeground,
  },
  liveSync: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveText: { fontFamily: fonts.label, fontSize: 10, color: colors.tertiaryForeground },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: radius.xs,
    padding: spacing.md,
  },
  checkTextWrap: { flex: 1 },
  checkLabel: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.foreground },
  checkDetail: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  checkDetailPending: { color: colors.destructive, fontFamily: fonts.semibold },
  promo: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xs,
    padding: spacing.lg,
  },
  promoText: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.brandGlow, lineHeight: 18 },
  promoHighlight: { fontFamily: fonts.bold, color: colors.primaryAccent },

  // Seller tips
  tipsCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: spacing['6xl'],
    gap: spacing.md,
  },
  tipRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  tipText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.textMuted, lineHeight: 20 },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.xs,
    minHeight: 48,
  },
  footerBtnPrimary: { backgroundColor: colors.primary },
  footerBtnPrimaryDisabled: { backgroundColor: '#aecebe' },
  footerBtnOutline: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  footerBtnText: { fontFamily: fonts.label, fontSize: fontSize.xl },
  footerBtnTextPrimary: { color: colors.primaryForeground },
  footerBtnTextPrimaryDisabled: { color: '#304c41' },
  footerBtnTextOutline: { color: colors.foreground },
});
