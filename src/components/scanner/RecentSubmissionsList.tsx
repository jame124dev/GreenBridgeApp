import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Image as ImagePlaceholder, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage, Badge, Text } from '@/components/ui';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { classifyStatus, type StatusTone } from '@/features/scanner/batchStatus';
import { routes } from '@/lib/routes';
import type { SellerBatch } from '@/types/batch';

function statusLabel(tone: StatusTone, t: (k: string) => string): string {
  switch (tone) {
    case 'live':
      return t('mobile.status.live');
    case 'pending':
      return t('mobile.status.pending');
    case 'sold':
      return t('mobile.status.sold');
    case 'review':
      return t('mobile.status.review');
    case 'inspect':
      return t('mobile.status.inspect');
    case 'inactive':
      return t('mobile.status.inactive');
    default:
      return t('mobile.status.submitted');
  }
}

function pickTitle(item: SellerBatch, lang: string): string {
  const i = item.titleI18n;
  if (lang === 'zh') return i?.zh || i?.en || item.title || '';
  if (lang === 'ja') return i?.ja || i?.en || item.title || '';
  if (lang === 'th') return i?.th || i?.en || item.title || '';
  return i?.en || item.title || '';
}

function itemCode(batchId: number): string {
  return `ITM-${String(batchId).padStart(6, '0')}`;
}

const edgeBgClass: Record<StatusTone, string> = {
  live: 'bg-success',
  pending: 'bg-warning',
  sold: 'bg-success',
  review: 'bg-warning',
  inspect: 'bg-info',
  inactive: 'bg-neutral-400',
  submitted: 'bg-info',
};

function BatchRow({ item }: { item: SellerBatch }) {
  const { t, i18n } = useTranslation();
  const tone = classifyStatus(item);
  const title = pickTitle(item, i18n.language) || item.category || `Batch #${item.batchId}`;
  const count = item.itemsCount ?? 0;
  const aiAssisted = (item as { aiAssisted?: boolean }).aiAssisted;
  const priceLabel = (item as { priceLabel?: string }).priceLabel;

  return (
    <Pressable
      className="flex-row items-center bg-white rounded-2xl border border-neutral-200 shadow-sm py-lg pr-xl pl-0 mb-lg gap-lg overflow-hidden active:opacity-90"
      onPress={() => router.push(routes.listingDetail(item.batchPk))}
    >
      <View className={`w-[3px] self-stretch ${edgeBgClass[tone] || 'bg-neutral-400'}`} />

      <View className="w-12 h-12 ml-[9px] relative">
        {item.thumbnailUrl ? (
          <AppImage
            source={{ uri: item.thumbnailUrl }}
            style={{ width: '100%', height: '100%', borderRadius: 12 }}
          />
        ) : (
          <View className="w-full h-full rounded-xl bg-neutral-100 border border-neutral-200 justify-center items-center">
            <ImagePlaceholder color="#9CA3AF" size={18} />
          </View>
        )}
        {count > 0 && (
          <View className="absolute -right-1 -bottom-1 min-w-[18px] h-[18px] px-[4px] rounded-full bg-neutral-900 justify-center items-center border-2 border-white">
            <Text className="font-bold text-[9px] text-white">{count}</Text>
          </View>
        )}
      </View>

      <View className="flex-1 gap-[3px]">
        <Text variant="subtitle" tone="primary" className="font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySm" tone="tertiary" className="tracking-wider" numberOfLines={1}>
          {itemCode(item.batchId)}
        </Text>
        <View className="flex-row items-center flex-wrap gap-xs mt-[2px]">
          <Badge variant={tone} label={statusLabel(tone, t)} size="sm" />
          {aiAssisted && (
            <Badge
              variant="ai"
              label="AI"
              size="sm"
              leftIcon={<Sparkles color="#F59E0B" size={10} />}
            />
          )}
        </View>
      </View>

      {priceLabel ? (
        <Text variant="title" tone="primary" className="font-bold" numberOfLines={1}>
          {priceLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

type Props = {
  limit?: number;
  title?: string;
  emptyHint?: string;
};

export function RecentSubmissionsList({
  limit = 10,
  title,
  emptyHint = 'Your listed batches will appear here.',
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useRecentSubmissions(limit);

  const headerCount = data?.length ?? 0;
  const sectionTitle = title ?? t('mobile.home.recentUploads');

  if (isLoading) {
    return (
      <View className="mt-3xl">
        <SectionHeader title={sectionTitle} />
        <View className="mt-xl">
          <ActivityIndicator color="#10B981" />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="mt-3xl">
        <SectionHeader title={sectionTitle} />
        <Pressable onPress={() => refetch()}>
          <Text variant="body" tone="brand" className="font-semibold text-center mt-md">
            {t('mobile.common.couldNotLoad')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!data?.length) {
    return (
      <View className="mt-3xl">
        <SectionHeader title={sectionTitle} />
        <Text variant="body" tone="tertiary" className="text-center mt-xl">
          {emptyHint}
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-3xl">
      <SectionHeader
        title={sectionTitle}
        countLabel={t('mobile.home.itemsCount', { count: headerCount })}
      />
      <View className="min-h-[120px]">
        {data.map((item) => (
          <BatchRow key={item.batchPk} item={item} />
        ))}
      </View>
    </View>
  );
}

function SectionHeader({ title, countLabel }: { title: string; countLabel?: string }) {
  return (
    <View className="flex-row items-center justify-between mb-lg">
      <Text variant="caption" tone="secondary" className="font-bold uppercase tracking-wider">
        {title}
      </Text>
      {countLabel ? (
        <View className="bg-success/10 rounded-full px-lg py-[3px]">
          <Text variant="caption" className="font-bold text-success text-[11px] uppercase tracking-widest">
            {countLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
