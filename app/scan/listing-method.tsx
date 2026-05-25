import type { ReactElement } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Layers, Package } from 'lucide-react-native';

import { routes } from '@/lib/routes';
import { useScanDraft, type ListingMode } from '@/stores/scanDraftStore';

function MethodCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: ReactElement;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardIcon}>{icon}</View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{description}</Text>
    </Pressable>
  );
}

export default function ListingMethodScreen() {
  const setListingMode = useScanDraft((s) => s.setListingMode);

  const choose = (mode: ListingMode) => {
    setListingMode(mode);
    router.push(routes.scanCamera);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
        <ChevronLeft color="#13171f" size={24} />
      </Pressable>

      <Text style={styles.title}>Listing method</Text>
      <Text style={styles.subtitle}>How do you want to list this equipment?</Text>

      <MethodCard
        title="Single item"
        description="One piece of equipment — scan, review, and submit as one listing."
        icon={<Package color="#0a4a2f" size={28} />}
        onPress={() => choose('single')}
      />

      <MethodCard
        title="Grouped submission"
        description="Multiple items in one batch — scan each unit, then review and submit together."
        icon={<Layers color="#0a4a2f" size={28} />}
        onPress={() => choose('grouped')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb', paddingHorizontal: 24 },
  back: { marginTop: 8, alignSelf: 'flex-start' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#13171f', marginTop: 16 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#6b7280', marginTop: 8, marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    padding: 20,
    marginBottom: 16,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f4f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#13171f' },
  cardDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginTop: 6, lineHeight: 20 },
});
