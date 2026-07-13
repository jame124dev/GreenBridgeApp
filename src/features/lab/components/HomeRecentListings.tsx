// HomeRecentListings — the (lab) Home "Recent listings" section (mockup: a mini
// seller dashboard under the composer). Real data via the seller
// `useRecentSubmissions` hook (same source as the History tab); each row shows
// the listing's thumbnail/icon, title, price · category, and a status/offers
// badge. Tap a row → listing detail; "See all" → submission history.
//
// Rendered only in SELL mode (see home.tsx) — "my listings" is a seller concept.
// Hidden entirely when signed-out / empty / errored so the Home stays calm for a
// brand-new user (the composer is the focus).
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Package } from 'lucide-react-native';

import { AppImage, Badge, Text } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui/Badge';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { classifyStatus, type StatusTone } from '@/features/scanner/batchStatus';
import { routes } from '@/lib/routes';
import { greenDarkest, lab } from '@/constants/theme';
import type { SellerBatch } from '@/types/batch';

/** How many listings to preview on Home (the rest live behind "See all"). */
const PREVIEW_LIMIT = 4;

function pickTitle(item: SellerBatch): string {
  return (
    item.titleI18n?.en ||
    item.title ||
    item.category ||
    `Batch #${item.batchId}`
  );
}

/** Price (runtime `priceLabel`, not on the typed shape) · category. */
function metaLine(item: SellerBatch): string {
  const priceLabel = (item as { priceLabel?: string }).priceLabel;
  return [priceLabel, item.category].filter(Boolean).join(' · ');
}

// tone → i18n key suffix under mobile.labHome.status.*
const STATUS_KEY: Record<StatusTone, string> = {
  live: 'active',
  sold: 'sold',
  pending: 'inReview',
  review: 'inReview',
  inspect: 'inspection',
  inactive: 'inactive',
  submitted: 'submitted',
};

/** One badge per row: offers take priority (more actionable), else status.
 *  Returns the offer COUNT (label resolved via t()) or a status key. */
function badgeFor(item: SellerBatch): { variant: BadgeVariant; offers?: number; statusKey?: string } {
  const bids = item.bidsCount ?? 0;
  if (bids > 0) return { variant: 'warning', offers: bids };
  const tone = classifyStatus(item);
  return { variant: tone, statusKey: STATUS_KEY[tone] };
}

function ListingRow({ item }: { item: SellerBatch }) {
  const { t } = useTranslation();
  const badge = badgeFor(item);
  const badgeLabel =
    badge.offers != null
      ? t(badge.offers === 1 ? 'mobile.labHome.offerOne' : 'mobile.labHome.offerOther', {
          count: badge.offers,
        })
      : t(`mobile.labHome.status.${badge.statusKey}`);
  return (
    <Pressable
      className="flex-row items-center gap-md bg-white rounded-2xl border border-neutral-200 shadow-sm p-md mb-md active:opacity-90"
      onPress={() => router.push(routes.listingDetail(item.batchPk))}
      accessibilityRole="button"
      accessibilityLabel={`${pickTitle(item)}. ${badgeLabel}`}
    >
      {/* Icon / thumbnail tile */}
      <View
        className="w-11 h-11 rounded-xl overflow-hidden items-center justify-center"
        style={{ backgroundColor: lab.pillBg }}
      >
        {item.thumbnailUrl ? (
          <AppImage
            source={{ uri: item.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Package size={20} color={greenDarkest} strokeWidth={1.8} />
        )}
      </View>

      {/* Title + meta */}
      <View className="flex-1">
        <Text variant="subtitle" tone="primary" className="font-semibold" numberOfLines={1}>
          {pickTitle(item)}
        </Text>
        {metaLine(item) ? (
          <Text variant="bodySm" tone="tertiary" numberOfLines={1} className="mt-[2px]">
            {metaLine(item)}
          </Text>
        ) : null}
      </View>

      <Badge variant={badge.variant} label={badgeLabel} size="sm" />
    </Pressable>
  );
}

export function HomeRecentListings() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useRecentSubmissions(PREVIEW_LIMIT);

  // Silent while loading the first time (a spinner under the composer would be
  // noisier than just letting the section pop in). Hide on error/empty/signed-out
  // so the Home stays clean — nothing actionable to show.
  if (isError) return null;
  if (isLoading) {
    return (
      <View className="mt-2xl">
        <ActivityIndicator color={greenDarkest} />
      </View>
    );
  }
  if (!data?.length) return null;

  return (
    <View className="mt-2xl">
      <View className="flex-row items-center justify-between mb-md">
        <Text variant="body" tone="primary" className="font-bold">
          {t('mobile.labHome.recentListings')}
        </Text>
        <Pressable
          className="flex-row items-center active:opacity-70"
          hitSlop={8}
          onPress={() => router.push(routes.labListings)}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labHome.seeAll')}
        >
          <Text variant="bodySm" className="font-semibold" style={{ color: greenDarkest }}>
            {t('mobile.labHome.seeAll')}
          </Text>
          <ChevronRight size={16} color={greenDarkest} />
        </Pressable>
      </View>

      {data.map((item) => (
        <ListingRow key={item.batchPk} item={item} />
      ))}
    </View>
  );
}
