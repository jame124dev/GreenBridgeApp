import { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  CONDITION_LABELS,
  DEFAULT_OPERATION_STATUS,
  VALID_CONDITION_KEYS,
  type ConditionKey,
} from '@/features/scanner/constants';
import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { routes } from '@/lib/routes';
import { VisibilitySelector } from '@/components/scanner/VisibilitySelector';
import { persistDocumentsForDraft } from '@/services/upload/persistPhotos';
import { useCreateListing } from '@/features/scanner/useCreateListing';
import { useScanDraft } from '@/stores/scanDraftStore';
import type { BatchVisibility } from '@/types/batch';

export default function DetailScreen() {
  const draft = useScanDraft((s) => s.current);
  const mode = useScanDraft((s) => s.mode);
  const queuedCount = useScanDraft((s) => s.queuedItems.length);
  const patch = useScanDraft((s) => s.patch);
  const setLastStep = useScanDraft((s) => s.setLastStep);
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
      Alert.alert('Could not save documents', 'Please try again.');
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

    createListing.mutate(useScanDraft.getState().current ?? updated, {
      onSuccess: ({ batchPk, batchNumber }) => {
        router.replace(routes.scanSuccess(batchPk, batchNumber, 1));
      },
      onError: (err) => {
        Alert.alert('Submit failed', (err as Error).message ?? 'Please try again');
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Listing details</Text>
        <Text style={styles.subtitle}>Edit fields before submitting.</Text>

        <Text style={styles.label}>Title</Text>
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} />
              {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />

        <Text style={styles.label}>Description</Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
              {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />

        <Text style={styles.label}>Category</Text>
        {categories.isLoading ? (
          <ActivityIndicator color="#0a4a2f" />
        ) : categories.isError ? (
          <Text style={styles.error}>Could not load categories. Pull to retry by leaving and re-opening this screen.</Text>
        ) : (
          <Controller
            control={control}
            name="categoryId"
            render={({ field: { value, onChange }, fieldState }) => (
              <ScrollView
                style={styles.categoryScroll}
                contentContainerStyle={styles.chipRow}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {categories.data?.options.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.chip, value === opt.id && styles.chipActive]}
                    onPress={() => onChange(opt.id)}
                  >
                    <Text style={[styles.chipText, value === opt.id && styles.chipTextActive]} numberOfLines={2}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </ScrollView>
            )}
          />
        )}

        <Text style={styles.label}>Condition</Text>
        <View style={styles.chipRow}>
          {VALID_CONDITION_KEYS.map((key) => (
            <Pressable
              key={key}
              style={[styles.chip, selectedConditions.includes(key) && styles.chipActive]}
              onPress={() => toggleCondition(key)}
            >
              <Text style={[styles.chipText, selectedConditions.includes(key) && styles.chipTextActive]}>
                {CONDITION_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Price format</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, priceFormat === 'buyNow' && styles.chipActive]}
            onPress={() => setValue('priceFormat', 'buyNow')}
          >
            <Text style={[styles.chipText, priceFormat === 'buyNow' && styles.chipTextActive]}>Buy now</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, priceFormat === 'offer' && styles.chipActive]}
            onPress={() => setValue('priceFormat', 'offer')}
          >
            <Text style={[styles.chipText, priceFormat === 'offer' && styles.chipTextActive]}>Make offer</Text>
          </Pressable>
        </View>

        {priceFormat === 'buyNow' ? (
          <>
            <Text style={styles.label}>Price</Text>
            <Controller
              control={control}
              name="pricePerUnit"
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                  />
                  {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
                </>
              )}
            />
          </>
        ) : null}

        <Text style={styles.label}>Quantity</Text>
        <Controller
          control={control}
          name="quantity"
          render={({ field: { value, onChange } }) => (
            <View style={styles.stepper}>
              <Pressable onPress={() => onChange(Math.max(1, value - 1))} style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{value}</Text>
              <Pressable onPress={() => onChange(value + 1)} style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          )}
        />

        <Text style={styles.label}>Documents (optional)</Text>
        {draft.documents.map((doc, i) => (
          <View key={`${doc.uri}-${i}`} style={styles.docRow}>
            <Text style={styles.docName} numberOfLines={1}>
              {doc.name}
            </Text>
            <Pressable onPress={() => removeDocument(i)}>
              <Text style={styles.docRemove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.docAdd} onPress={pickDocuments}>
          <Text style={styles.docAddText}>Add document</Text>
        </Pressable>

        {!isGrouped ? (
          <VisibilitySelector
            value={draft.visibility}
            onChange={(visibility: BatchVisibility) => patch({ visibility })}
          />
        ) : null}

        <Text style={styles.label}>Location</Text>
        <Controller
          control={control}
          name="address"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Street address"
                placeholderTextColor="#9ca3af"
              />
              {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />
        <Controller
          control={control}
          name="country"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Country"
                placeholderTextColor="#9ca3af"
              />
              {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />

        {isGrouped ? (
          editingGroupedItem ? (
            <Pressable
              style={styles.submit}
              onPress={handleSubmit(onSaveAndReturnToReview)}
            >
              <Text style={styles.submitText}>Save & return to group review</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.submit}
                onPress={handleSubmit(onAddAnother)}
              >
                <Text style={styles.submitText}>Save & scan another item</Text>
              </Pressable>
              <Pressable
                style={styles.secondarySubmit}
                onPress={handleSubmit(onReviewGroup)}
              >
                <Text style={styles.secondarySubmitText}>
                  Review group ({queuedCount + 1} item{queuedCount === 0 ? '' : 's'})
                </Text>
              </Pressable>
            </>
          )
        ) : (
          <Pressable
            style={[styles.submit, createListing.isPending && styles.submitDisabled]}
            onPress={handleSubmit(onSubmitSingle)}
            disabled={createListing.isPending}
          >
            {createListing.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit listing</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#13171f' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginBottom: 16 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#13171f', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5ec',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#13171f',
  },
  multiline: { minHeight: 100 },
  error: { color: '#dc3737', fontSize: 12, marginTop: 4 },
  categoryScroll: { maxHeight: 200, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    backgroundColor: '#fff',
    maxWidth: '48%',
  },
  chipActive: { backgroundColor: '#0a4a2f', borderColor: '#0a4a2f' },
  chipText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#13171f' },
  chipTextActive: { color: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, color: '#0a4a2f' },
  stepValue: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  submit: {
    marginTop: 24,
    backgroundColor: '#0a4a2f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  secondarySubmit: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0a4a2f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondarySubmitText: { color: '#0a4a2f', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5ec',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  docName: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#13171f', marginRight: 8 },
  docRemove: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#dc3737' },
  docAdd: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a4a2f',
    marginBottom: 8,
  },
  docAddText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0a4a2f' },
});
