import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { RecentSubmissionsList } from '@/components/scanner/RecentSubmissionsList';

export default function ActivityHistoryScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color="#13171f" size={24} />
        </Pressable>
        <Text style={styles.title}>Activity history</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.subtitle}>Your recent batch submissions.</Text>
      <RecentSubmissionsList
        limit={30}
        title=""
        emptyHint="No submissions yet. Scan equipment to create your first listing."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb', paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#13171f' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginVertical: 12 },
});
