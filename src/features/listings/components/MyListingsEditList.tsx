import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Image as ImagePlaceholder, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage, Badge, Button, Text } from '@/components/ui';
import { classifyStatus, type StatusTone } from '@/features/scanner/batchStatus';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import type { SellerBatch } from '@/types/batch';
import { brand } from '@/constants/theme';

import { listingEditHref } from '../listingEditRoute';

/**
 * "My listings" with an Edit action per row.
 *
 * This is the seller's management view, so unlike the read-only
 * `RecentSubmissionsList` used on Home and History, each row carries a second
 * action. Tapping the row still opens the listing (unchanged expectation);
 * Edit is an explicit, labelled button rather than a hidden long-press, so the
 * next action is obvious rather than discoverable.
 *
 * Sold rows show the badge and no Edit button — the contract makes a sold
 * listing a 409, and offering a control that can only fail is worse than not
 * offering it.
 */

const edgeBgClass: Record<StatusTone, string> = {
  live: 'bg-success',
  pending: 'bg-warning',
  sold: 'bg-success',
  review: 'bg-warning',
  inspect: 'bg-info',
  inactive: 'bg-neutral-400',
  submitted: 'bg-info',
};

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
  if (lang.startsWith('zh')) return i?.zh || i?.en || item.title || '';
  if (lang === 'ja') return i?.ja || i?.en || item.title || '';
  if (lang === 'th') return i?.th || i?.en || item.title || '';
  return i?.en || item.title || '';
}

function itemCode(batchId: number): string {
  return `ITM-${String(batchId).padStart(6, '0')}`;
}

function ListingRow({ item }: { item: SellerBatch }) {
  const { t, i18n } = useTranslation();
  const tone = classifyStatus(item);
  const title = pickTitle(item, i18n.language) || item.category || `Batch #${item.batchId}`;
  const count = item.itemsCount ?? 0;
  const priceLabel = (item as { priceLabel?: string }).priceLabel;
  const canEdit = tone !== 'sold';

  return (
    <View className="bg-white rounded-2xl border border-neutral-200 shadow-sm mb-lg overflow-hidden">
      <Pressable
        className="flex-row items-center py-lg pr-xl pl-0 gap-lg active:opacity-90"
        onPress={() => router.push(routes.listingDetail(item.batchPk))}
        accessibilityRole="button"
        accessibilityLabel={title}
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
          {count > 0 ? (
            <View className="absolute -right-1 -bottom-1 min-w-[18px] h-[18px] px-[4px] rounded-full bg-neutral-900 justify-center items-center border-2 border-white">
              <Text className="font-bold text-[9px] text-white">{count}</Text>
            </View>
          ) : null}
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
          </View>
        </View>

        {priceLabel ? (
          <Text variant="title" tone="primary" className="font-bold" numberOfLines={1}>
            {priceLabel}
          </Text>
        ) : null}
      </Pressable>

      {canEdit ? (
        <View className="border-t border-neutral-100 px-lg py-sm flex-row justify-end">
          <Button
            label={t('mobile.listingEdit.editAction')}
            variant="ghost"
            size="sm"
            leftIcon={<Pencil color={brand.primary} size={14} />}
            accessibilityLabel={t('mobile.listingEdit.editA11y', { title })}
            onPress={() => {
              haptics.tap();
              router.push(listingEditHref({ batchPk: item.batchPk, title }));
            }}
          />
        </View>
      ) : (
        <View className="border-t border-neutral-100 px-lg py-sm">
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.listingEdit.soldRowHint')}
          </Text>
        </View>
      )}
    </View>
  );
}

export function MyListingsEditList({ limit = 30 }: { limit?: number }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useRecentSubmissions(limit);

  if (isLoading) {
    return (
      <View className="mt-3xl items-center" style={{ gap: 10 }}>
        <ActivityIndicator color={brand.primary} />
        <Text variant="bodySm" tone="tertiary">
          {t('mobile.listingEdit.listLoading')}
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="mt-3xl items-center" style={{ gap: 10 }}>
        <Text variant="body" tone="tertiary" className="text-center">
          {t('mobile.listingEdit.listLoadFailed')}
        </Text>
        <Button
          label={t('mobile.listingEdit.retry')}
          variant="secondary"
          size="sm"
          onPress={() => void refetch()}
        />
      </View>
    );
  }

  if (!data?.length) {
    return (
      <View className="mt-3xl">
        <Text variant="body" tone="tertiary" className="text-center">
          {t('mobile.listingEdit.listEmpty')}
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-2xl">
      {/* Count only — the screen's own "My listings" heading sits directly
          above, so a second section title here would just repeat it. */}
      <View className="mb-lg">
        <Text variant="caption" tone="tertiary" className="font-bold uppercase tracking-wider">
          {t('mobile.listingEdit.listCount', { n: data.length })}
        </Text>
      </View>
      {data.map((item) => (
        <ListingRow key={item.batchPk} item={item} />
      ))}
    </View>
  );
}
