import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { UseQueryResult } from '@tanstack/react-query';

import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { routes } from '@/lib/routes';
import type { SellerBatch } from '@/types/batch';

function statusLabel(batch: SellerBatch) {
  if (batch.approvalStatus === 'pending') return 'Pending approval';
  if (batch.status) return batch.status;
  return 'Submitted';
}

function BatchRow({ item }: { item: SellerBatch }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(routes.listingDetail(item.batchPk))}
    >
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>Batch #{item.batchId}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[item.category, statusLabel(item)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <ChevronRight color="#9ca3af" size={20} />
    </Pressable>
  );
}

type Props = {
  limit?: number;
  title?: string;
  emptyHint?: string;
  /** Pass the parent’s query to avoid a duplicate fetch on the home dashboard. */
  query?: UseQueryResult<SellerBatch[]>;
};

export function RecentSubmissionsList({
  limit = 10,
  title = 'Recent submissions',
  emptyHint = 'Your listed batches will appear here.',
  query: externalQuery,
}: Props) {
  const internalQuery = useRecentSubmissions(limit, { enabled: !externalQuery });
  const { data, isLoading, isError, refetch, isRefetching } = externalQuery ?? internalQuery;

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <ActivityIndicator color="#0a4a2f" style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable onPress={() => refetch()}>
          <Text style={styles.retry}>Could not load — tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data?.length) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.empty}>{emptyHint}</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.listWrap}>
        <FlashList
          data={data}
          keyExtractor={(item) => String(item.batchPk)}
          renderItem={({ item }) => <BatchRow item={item} />}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 32 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#13171f', marginBottom: 8 },
  listWrap: { minHeight: 120, maxHeight: 280 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    padding: 14,
    marginBottom: 8,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#13171f' },
  rowMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6b7280', marginTop: 2 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280' },
  retry: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0a4a2f', marginTop: 8 },
});
