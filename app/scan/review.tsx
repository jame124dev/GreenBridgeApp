import { useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { routes } from '@/lib/routes';
import { CONDITION_LABELS, type ConditionKey } from '@/features/scanner/constants';
import { useAnalyzeImages } from '@/features/scanner/useAnalyzeImages';
import { useScanDraft } from '@/stores/scanDraftStore';

export default function ReviewScreen() {
  const { i18n } = useTranslation();
  const draft = useScanDraft((s) => s.current);
  const setAi = useScanDraft((s) => s.setAi);
  const patch = useScanDraft((s) => s.patch);
  const analyze = useAnalyzeImages();
  const setLastStep = useScanDraft((s) => s.setLastStep);

  useEffect(() => {
    setLastStep('review');
  }, [setLastStep]);

  if (!draft) {
    router.replace(routes.scanHome);
    return null;
  }

  const regenerate = () => {
    analyze.mutate(
      { photos: draft.photos, language: i18n.language },
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
          });
        },
      },
    );
  };

  const conditionLabel = draft.condition
    .map((c) => CONDITION_LABELS[c as ConditionKey] ?? c)
    .join(', ');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Review AI results</Text>
        <Text style={styles.subtitle}>Check the extracted details before editing.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
          {draft.photos.map((p) => (
            <Image key={p.uri} source={{ uri: p.uri }} style={styles.photo} />
          ))}
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{draft.title || 'Untitled'}</Text>
          <Text style={styles.cardBody} numberOfLines={4}>
            {draft.description || 'No description'}
          </Text>
          {conditionLabel ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{conditionLabel}</Text>
            </View>
          ) : null}
          {draft.pricePerUnit ? (
            <Text style={styles.price}>
              Suggested: {draft.priceCurrency} {draft.pricePerUnit}
            </Text>
          ) : null}
        </View>

        {draft.photos.length > 1 ? (
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push(routes.scanReorderPhotosEdit())}
          >
            <Text style={styles.secondaryBtnText}>Rearrange photos</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.secondaryBtn}
          onPress={regenerate}
          disabled={analyze.isPending}
        >
          {analyze.isPending ? (
            <ActivityIndicator color="#0a4a2f" />
          ) : (
            <Text style={styles.secondaryBtnText}>Regenerate</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            setLastStep('detail');
            router.push(routes.scanDetail);
          }}
        >
          <Text style={styles.primaryBtnText}>Looks good — edit details</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  scroll: { padding: 24, paddingBottom: 40 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#13171f' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#6b7280', marginTop: 6, marginBottom: 16 },
  photos: { marginBottom: 16 },
  photo: { width: 120, height: 120, borderRadius: 12, marginRight: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    marginBottom: 20,
  },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#13171f' },
  cardBody: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginTop: 8 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f4f7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  chipText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#0a4a2f' },
  price: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0a4a2f', marginTop: 10 },
  primaryBtn: { backgroundColor: '#0a4a2f', padding: 16, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#0a4a2f',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#0a4a2f', fontFamily: 'Inter_600SemiBold' },
});
