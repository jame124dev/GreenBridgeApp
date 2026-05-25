import { useEffect } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2 } from 'lucide-react-native';

import { invalidateRecentSubmissions } from '@/features/scanner/invalidateRecentSubmissions';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

export default function SuccessScreen() {
  const { batchPk, batchNumber, itemCount } = useLocalSearchParams<{
    batchPk?: string;
    batchNumber?: string;
    itemCount?: string;
  }>();
  const count = itemCount ? Number(itemCount) : 1;
  const displayNumber = batchNumber ?? batchPk;
  const pk = batchPk ? Number(batchPk) : NaN;
  const reset = useScanDraft((s) => s.reset);

  useEffect(() => {
    reset();
    void invalidateRecentSubmissions();
  }, [reset]);

  return (
    <SafeAreaView style={styles.container}>
      <CheckCircle2 color="#0a4a2f" size={72} />
      <Text style={styles.title}>Listing submitted!</Text>
      <Text style={styles.subtitle}>
        Your listing is awaiting approval. Our team will review it shortly.
      </Text>
      {displayNumber ? (
        <>
          <Text style={styles.batch}>Batch #{displayNumber}</Text>
          {count > 1 ? (
            <Text style={styles.batch}>{count} items submitted together</Text>
          ) : null}
          <Text style={styles.batchHint}>
            Track approval in the seller dashboard on the website.
          </Text>
        </>
      ) : null}

      {Number.isFinite(pk) && pk > 0 ? (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push(routes.listingDetail(pk))}
        >
          <Text style={styles.secondaryBtnText}>View batch summary</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.primaryBtn}
        onPress={() => router.replace(routes.scanHome)}
      >
        <Text style={styles.primaryBtnText}>Scan another</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#13171f', marginTop: 20 },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
  },
  batch: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0a4a2f', marginTop: 16 },
  batchHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  primaryBtn: {
    marginTop: 32,
    backgroundColor: '#0a4a2f',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0a4a2f',
    borderRadius: 8,
  },
  secondaryBtnText: { color: '#0a4a2f', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
