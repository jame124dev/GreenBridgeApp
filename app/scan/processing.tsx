import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { manualEntryDefaults } from '@/features/scanner/constants';
import { routes } from '@/lib/routes';
import { useAnalyzeImages } from '@/features/scanner/useAnalyzeImages';
import { useScanDraft } from '@/stores/scanDraftStore';

export default function ProcessingScreen() {
  const { i18n } = useTranslation();
  const draft = useScanDraft((s) => s.current);
  const setAi = useScanDraft((s) => s.setAi);
  const patch = useScanDraft((s) => s.patch);
  const analyze = useAnalyzeImages();
  const [slowMsg, setSlowMsg] = useState(false);

  useEffect(() => {
    if (!draft?.photos?.length) {
      router.replace(routes.scanCamera);
      return;
    }

    if (draft.ai) {
      router.replace(routes.scanReview);
      return;
    }

    const controller = new AbortController();
    const slowTimer = setTimeout(() => setSlowMsg(true), 30_000);

    analyze.mutate(
      { photos: draft.photos, language: i18n.language, signal: controller.signal },
      {
        onSuccess: (ai) => {
          setAi(ai);
          patch({
            title: ai.name,
            description: ai.description,
            condition: ai.condition,
            operationStatus: ai.operationStatus,
            pricePerUnit: ai.suggestedPrice ?? '',
            priceCurrency: ai.currency,
            priceFormat: ai.suggestedPrice ? 'buyNow' : 'offer',
            lastStep: 'review',
          });
          router.replace(routes.scanReview);
        },
      },
    );

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [draft?.id, draft?.photos, draft?.ai, i18n.language, analyze, setAi, patch]);

  const skipToDetail = () => {
    patch({ ...manualEntryDefaults(), lastStep: 'detail' });
    router.replace(routes.scanDetail);
  };

  const retake = () => {
    router.replace(routes.scanCamera);
  };

  if (!draft) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Analyzing equipment…</Text>
      <Text style={styles.subtitle}>AI is reading your photos</Text>
      {slowMsg ? <Text style={styles.slow}>Still working — large photos can take up to 2 minutes.</Text> : null}

      <ScrollView horizontal style={styles.thumbs} contentContainerStyle={styles.thumbRow}>
        {draft.photos.map((p) => (
          <Image key={p.uri} source={{ uri: p.uri }} style={[styles.thumb, styles.thumbDim]} />
        ))}
      </ScrollView>

      {analyze.isPending ? (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color="#0a4a2f" />
        </View>
      ) : null}

      {analyze.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {(analyze.error as Error)?.message ?? 'AI could not read the photos'}
          </Text>
          <Pressable style={styles.secondaryBtn} onPress={retake}>
            <Text style={styles.secondaryBtnText}>Retake photos</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={skipToDetail}>
            <Text style={styles.primaryBtnText}>Continue without AI</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb', padding: 24 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#13171f' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#6b7280', marginTop: 8 },
  slow: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#f59e0b', marginTop: 12 },
  thumbs: { marginTop: 24, maxHeight: 100 },
  thumbRow: { gap: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  thumbDim: { opacity: 0.5 },
  spinnerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: { marginTop: 24, gap: 12 },
  errorText: { fontFamily: 'Inter_400Regular', color: '#dc3737', fontSize: 15 },
  primaryBtn: { backgroundColor: '#0a4a2f', padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { borderWidth: 1, borderColor: '#e1e5ec', padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryBtnText: { color: '#13171f', fontFamily: 'Inter_600SemiBold' },
});
