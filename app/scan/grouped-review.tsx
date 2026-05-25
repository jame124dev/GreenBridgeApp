import { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Trash2 } from 'lucide-react-native';

import { VisibilitySelector } from '@/components/scanner/VisibilitySelector';
import { useSubmitGroupedListing } from '@/features/scanner/useSubmitGroupedListing';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';
import type { BatchVisibility } from '@/types/batch';

export default function GroupedReviewScreen() {
  const queuedItems = useScanDraft((s) => s.queuedItems);
  const sessionVisibility = useScanDraft((s) => s.sessionVisibility);
  const networkSellers = useScanDraft((s) => s.networkSellers);
  const patchSession = useScanDraft((s) => s.patchSession);
  const removeQueuedItem = useScanDraft((s) => s.removeQueuedItem);
  const editQueuedItem = useScanDraft((s) => s.editQueuedItem);
  const submitGrouped = useSubmitGroupedListing();
  const reset = useScanDraft((s) => s.reset);

  useEffect(() => {
    if (queuedItems.length === 0) {
      router.replace(routes.scanHome);
    }
  }, [queuedItems.length]);

  const onSubmit = () => {
    const items = useScanDraft.getState().queuedItems;
    submitGrouped.mutate(
      {
        items,
        visibility: sessionVisibility,
        networkSellers,
      },
      {
        onSuccess: ({ batchPk, batchNumber, itemCount }) => {
          reset();
          router.replace(routes.scanSuccess(batchPk, batchNumber, itemCount));
        },
        onError: (err) => {
          const saved = useScanDraft.getState().queuedItems.filter((i) => i.productId).length;
          const base = (err as Error).message ?? 'Please try again';
          const message =
            saved > 0
              ? `${base}\n\n${saved} product(s) were already created on the server. Fix any issues and tap Submit again to finish the batch (already-created products will not be duplicated).`
              : base;
          Alert.alert('Submit failed', message);
        },
      },
    );
  };

  const addAnother = () => {
    router.push(routes.scanCamera);
  };

  if (queuedItems.length === 0) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color="#13171f" size={24} />
        </Pressable>
        <Text style={styles.title}>Grouped submission</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.subtitle}>
        {queuedItems.length} item{queuedItems.length === 1 ? '' : 's'} in this batch. Submit when
        ready.
      </Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {queuedItems.map((item, index) => (
          <View key={item.id} style={styles.card}>
            <Image
              source={{ uri: item.photos[0]?.uri }}
              style={styles.thumb}
            />
            <View style={styles.cardBody}>
              <Text style={styles.itemIndex}>Item {index + 1}</Text>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title || 'Untitled'}
              </Text>
              {item.categoryName ? (
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {item.categoryName}
                </Text>
              ) : null}
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={() => {
                editQueuedItem(item.id);
                router.push(routes.scanDetail);
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
              {queuedItems.length > 1 ? (
                <Pressable
                  onPress={() => removeQueuedItem(item.id)}
                  hitSlop={8}
                >
                  <Trash2 color="#dc3737" size={18} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}

        <Pressable style={styles.addAnother} onPress={addAnother}>
          <Text style={styles.addAnotherText}>+ Scan another item</Text>
        </Pressable>

        <VisibilitySelector
          value={sessionVisibility}
          onChange={(visibility: BatchVisibility) => patchSession({ sessionVisibility: visibility })}
        />

        <Pressable
          style={[styles.submit, submitGrouped.isPending && styles.submitDisabled]}
          onPress={onSubmit}
          disabled={submitGrouped.isPending}
        >
          {submitGrouped.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              Submit {queuedItems.length} item{queuedItems.length === 1 ? '' : 's'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#13171f' },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#e1e5ec' },
  cardBody: { flex: 1 },
  itemIndex: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6b7280' },
  itemTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#13171f', marginTop: 2 },
  itemMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardActions: { alignItems: 'flex-end', gap: 8 },
  editLink: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0a4a2f' },
  addAnother: {
    borderWidth: 1,
    borderColor: '#0a4a2f',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addAnotherText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0a4a2f' },
  submit: {
    marginTop: 8,
    backgroundColor: '#0a4a2f',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
