// HomeRecentWants — the (lab) Home "Recent wants" section, the BUYER-mode mirror
// of HomeRecentListings (a mini "My Wants" dashboard under the composer). Real
// data via `useWants` (GET /wtb — the same source the Matches tab uses); each row
// shows the want's title, budget · category, and a match-count badge. Tap a row or
// "See all" → the Matches (My Wants) tab.
//
// Rendered only in BUY mode (see home.tsx), gated on WTB_ENABLED via the hook.
// Hidden entirely when signed-out / empty / errored / loading so the Home stays
// calm for a brand-new buyer (the composer is the focus) — same as the seller side.
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bookmark, ChevronRight } from 'lucide-react-native';

import { Badge, Text } from '@/components/ui';
import { useWants } from '@/features/lab/hooks/useWants';
import type { WtbListItem } from '@/features/lab/data/wtbApi';
import { buyBlue, lab } from '@/constants/theme';
import { HomeEmptyState } from '@/features/lab/components/HomeEmptyState';

/** How many wants to preview on Home (the rest live behind "See all"). */
const PREVIEW_LIMIT = 4;

/** Budget (≤ currency price) · category. */
function metaLine(item: WtbListItem): string {
  const budget =
    item.max_price != null
      ? `≤ ${item.price_currency || '$'}${item.max_price.toLocaleString()}`
      : undefined;
  return [budget, item.category_name].filter(Boolean).join(' · ');
}

function WantRow({ item }: { item: WtbListItem }) {
  const { t } = useTranslation();
  const count = item.match_count ?? 0;
  const badgeLabel =
    count > 0
      ? t(count === 1 ? 'mobile.labHome.matchOne' : 'mobile.labHome.matchOther', { count })
      : t('mobile.labHome.noMatchesYet');
  return (
    <Pressable
      className="flex-row items-center gap-md bg-white rounded-2xl border border-neutral-200 shadow-sm p-md mb-md active:opacity-90"
      onPress={() => router.push('/(lab)/(tabs)/matches')}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${badgeLabel}`}
    >
      {/* Icon tile — a saved-want bookmark (buyer-blue). */}
      <View
        className="w-11 h-11 rounded-xl overflow-hidden items-center justify-center"
        style={{ backgroundColor: lab.pillBg }}
      >
        <Bookmark size={20} color={buyBlue} strokeWidth={1.8} />
      </View>

      {/* Title + meta */}
      <View className="flex-1">
        <Text variant="subtitle" tone="primary" className="font-semibold" numberOfLines={1}>
          {item.title}
        </Text>
        {metaLine(item) ? (
          <Text variant="bodySm" tone="tertiary" numberOfLines={1} className="mt-[2px]">
            {metaLine(item)}
          </Text>
        ) : null}
      </View>

      {/* Match count drives re-engagement ("your want has N matches"). */}
      <Badge variant={count > 0 ? 'info' : 'neutral'} label={badgeLabel} size="sm" />
    </Pressable>
  );
}

type Props = {
  /** Run a starter search from the empty state. Supplied by home.tsx, which
   *  owns the composer and the turn; omit it and the section stays hidden. */
  onSuggestion?: (query: string) => void;
};

export function HomeRecentWants({ onSuggestion }: Props) {
  const { t } = useTranslation();
  const { wants, isLoading, isError } = useWants();

  // Same calm handling as the seller section: silent on error/empty/signed-out,
  // a lone spinner while first-loading.
  if (isError) return null;
  if (isLoading) {
    return (
      <View className="mt-2xl">
        <ActivityIndicator color={buyBlue} />
      </View>
    );
  }
  // ⚠️ Was `return null`, which left a brand-new buyer staring at a blank lower
  // half of the Home screen with nothing telling them what the app does. Show
  // starter searches instead. Reached only after isError/isLoading above, so it
  // never flashes over a spinner.
  //
  // The send itself belongs to home.tsx (it owns the composer + the turn), so it
  // arrives as a prop rather than being reimplemented here.
  if (!wants.length) {
    return onSuggestion ? (
      <HomeEmptyState mode="buy" onStartListing={() => {}} onSuggestion={onSuggestion} />
    ) : null;
  }

  return (
    <View className="mt-2xl">
      <View className="flex-row items-center justify-between mb-md">
        <Text variant="body" tone="primary" className="font-bold">
          {t('mobile.labHome.recentWants')}
        </Text>
        <Pressable
          className="flex-row items-center active:opacity-70"
          hitSlop={8}
          onPress={() => router.push('/(lab)/(tabs)/matches')}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labHome.seeAll')}
        >
          <Text variant="bodySm" className="font-semibold" style={{ color: buyBlue }}>
            {t('mobile.labHome.seeAll')}
          </Text>
          <ChevronRight size={16} color={buyBlue} />
        </Pressable>
      </View>

      {wants.slice(0, PREVIEW_LIMIT).map((item) => (
        <WantRow key={item.id} item={item} />
      ))}
    </View>
  );
}
