import { useLocalSearchParams, router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';

import { useBatchDetail } from '@/features/scanner/useBatchDetail';
import { getSellerListingWebUrl } from '@/lib/env';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const batchPk = id ? Number(id) : NaN;
  const { data, isLoading, isError, refetch } = useBatchDetail(
    Number.isFinite(batchPk) ? batchPk : undefined,
  );

  const webUrl = getSellerListingWebUrl(Number.isFinite(batchPk) ? batchPk : undefined);

  const openWeb = () => {
    if (!webUrl) {
      return;
    }
    void Linking.openURL(webUrl);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color="#13171f" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Batch detail</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#0a4a2f" style={{ marginTop: 24 }} />
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.error}>Could not load this batch.</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.link}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Batch #{data.batchNumber}</Text>
          <Text style={styles.meta}>
            {[
              data.approvalStatus === 'pending' ? 'Pending approval' : data.approvalStatus,
              data.status,
              data.visibility,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>

          <Text style={styles.sectionLabel}>Products ({data.productCount})</Text>
          {data.productTitles.length ? (
            data.productTitles.map((title, i) => (
              <Text key={`${title}-${i}`} style={styles.productLine}>
                • {title}
              </Text>
            ))
          ) : (
            <Text style={styles.muted}>No product titles returned.</Text>
          )}

          <Text style={styles.hint}>
            Bids, inspection, and full editing are on the 101 Lab web dashboard.
          </Text>

          {webUrl ? (
            <Pressable style={styles.webBtn} onPress={openWeb}>
              <ExternalLink color="#fff" size={18} />
              <Text style={styles.webBtnText}>Open on website</Text>
            </Pressable>
          ) : (
            <Text style={styles.muted}>
              Set WEB_APP_URL in .env to enable a one-tap link to the seller dashboard.
            </Text>
          )}
        </ScrollView>
      )}
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
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#13171f' },
  center: { padding: 24, alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#13171f' },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginTop: 8 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#13171f', marginTop: 20 },
  productLine: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#13171f', marginTop: 6 },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginTop: 8 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginTop: 20, lineHeight: 20 },
  error: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#dc3737' },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0a4a2f', marginTop: 12 },
  webBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a4a2f',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  webBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
