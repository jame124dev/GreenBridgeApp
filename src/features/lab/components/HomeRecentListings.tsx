// HomeRecentListings — the (lab) Home sell-mode "Your items" section: one place
// for a seller's stuff, presented as image-forward HORIZONTAL RAILS you scan by
// picture rather than read. When drafts are enabled it leads with a "Pick up
// where you left off" rail (unfinished drafts — highest intent to act), then a
// published-listings rail. A draft is fenced off from a live listing (amber
// accent + DRAFT chip + Resume overlay, vs. the listing's status/offer badge)
// so an unfinished draft never reads as something already live.
//
// Each group owns ONE "See all" in its own header (consistent position) — there
// is no section-level "See all" and no bottom "View all drafts" link (both were
// confusing). Data: useRecentSubmissions (listings) + useListDrafts (drafts);
// resume routing is the shared useResumeDraft (identical to /scan/drafts).
//
// Flag: the DRAFTS rail only appears when `draftsEnabled()` — with the flag off
// this is just the listings rail titled "Recent listings". Sell-mode only (see
// home.tsx); hidden entirely when signed-out / empty / errored.
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Package, RotateCw, Sparkles } from 'lucide-react-native';

import { AppImage, Badge, Text } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui/Badge';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { classifyStatus, type StatusTone } from '@/features/scanner/batchStatus';
import { HomeEmptyState } from '@/features/lab/components/HomeEmptyState';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import { useListDrafts } from '@/services/drafts/draftHooks';
import type { DraftSummary } from '@/services/drafts/draftApi';
import { draftsEnabled } from '@/lib/flags';
import { routes } from '@/lib/routes';
import { greenDarkest, lab } from '@/constants/theme';
import { useAuth } from '@/stores/authStore';
import type { SellerBatch } from '@/types/batch';

/** How many of each to load into the rail (the rest live behind "See all"). */
const PREVIEW_LIMIT = 8; // published listings
const PREVIEW_DRAFTS = 8; // drafts

const CARD_W = 150;
const IMG_H = 108;

// Draft "in progress" accent — amber sits apart from the app's green (live)
// world, the common convention for pending / needs-attention. Muted so it
// doesn't fight the brand. Inline (only used here).
const AMBER = '#d99413';
const AMBER_TINT = '#fbf1da';
const AMBER_LINE = '#f0dca0';
const AMBER_INK = '#8a5d09';

function pickTitle(item: SellerBatch): string {
  return item.titleI18n?.en || item.title || item.category || `Batch #${item.batchId}`;
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

/** One badge per listing: offers take priority (more actionable), else status. */
function badgeFor(item: SellerBatch): { variant: BadgeVariant; offers?: number; statusKey?: string } {
  const bids = item.bidsCount ?? 0;
  if (bids > 0) return { variant: 'warning', offers: bids };
  const tone = classifyStatus(item);
  return { variant: tone, statusKey: STATUS_KEY[tone] };
}

/** Compact universal relative time for the card meta ("23m" / "18h" / "2d"). */
function compactAgo(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const m = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function DraftRailCard({
  draft,
  onResume,
  resuming,
  anyResuming,
}: {
  draft: DraftSummary;
  onResume: () => void;
  resuming: boolean;
  anyResuming: boolean;
}) {
  const { t } = useTranslation();
  const flowLabel =
    draft.flow === 'ai'
      ? t('mobile.drafts.flowAi', { defaultValue: '🤖 AI' })
      : t('mobile.drafts.flowManual', { defaultValue: '✏️ Manual' });
  const ago = compactAgo(draft.updated_at);
  const meta = [flowLabel, ago].filter(Boolean).join(' · ');
  const thumb =
    typeof draft.thumbnail_object === 'string' && /^https?:\/\//.test(draft.thumbnail_object)
      ? draft.thumbnail_object
      : null;

  return (
    <Pressable
      onPress={onResume}
      // Lock EVERY draft while any resume is in flight (parity with the
      // /scan/drafts full-screen overlay) so a second tap can't double-navigate.
      disabled={anyResuming}
      accessibilityRole="button"
      accessibilityState={{ busy: resuming, disabled: anyResuming }}
      accessibilityLabel={`${draft.title}. ${t('mobile.labHome.resume', { defaultValue: 'Resume' })}`}
      style={{ width: CARD_W }}
      className="active:opacity-90"
    >
      <View
        style={{
          width: CARD_W,
          height: IMG_H,
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: AMBER,
          backgroundColor: AMBER_TINT,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {thumb ? (
          <AppImage source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Sparkles size={26} color={AMBER} strokeWidth={1.7} />
        )}

        {/* DRAFT chip — state lives on the image */}
        <View
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            backgroundColor: AMBER,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: '#fff' }}>
            {t('mobile.labHome.draftChip', { defaultValue: 'DRAFT' })}
          </Text>
        </View>

        {/* Resume affordance (or spinner while resuming) */}
        {resuming ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              paddingVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <RotateCw size={12} color="#fff" strokeWidth={2.4} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
              {t('mobile.labHome.resume', { defaultValue: 'Resume' })}
            </Text>
          </View>
        )}
      </View>

      <Text variant="bodySm" tone="primary" className="font-semibold mt-xs" numberOfLines={1}>
        {draft.title}
      </Text>
      {meta ? (
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ListingRailCard({ item, anyResuming }: { item: SellerBatch; anyResuming: boolean }) {
  const { t } = useTranslation();
  const badge = badgeFor(item);
  const badgeLabel =
    badge.offers != null
      ? t(badge.offers === 1 ? 'mobile.labHome.offerOne' : 'mobile.labHome.offerOther', { count: badge.offers })
      : t(`mobile.labHome.status.${badge.statusKey}`);
  return (
    <Pressable
      onPress={() => router.push(routes.listingDetail(item.batchPk))}
      // Locked while a draft resume is navigating, so a stray tap can't
      // double-navigate (parity with the drafts-list overlay).
      disabled={anyResuming}
      accessibilityRole="button"
      accessibilityState={{ disabled: anyResuming }}
      accessibilityLabel={`${pickTitle(item)}. ${badgeLabel}`}
      style={{ width: CARD_W }}
      className="active:opacity-90"
    >
      <View
        style={{
          width: CARD_W,
          height: IMG_H,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: lab.pillBg,
          borderWidth: 1,
          borderColor: '#e4e9e4',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.thumbnailUrl ? (
          <AppImage source={{ uri: item.thumbnailUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Package size={26} color={greenDarkest} strokeWidth={1.7} />
        )}
        {/* Status / offers badge — top-right on the image. maxWidth so a long
            localized status can't extend past the card's clipped left edge. */}
        <View style={{ position: 'absolute', top: 6, right: 6, maxWidth: CARD_W - 12 }}>
          <Badge variant={badge.variant} label={badgeLabel} size="sm" />
        </View>
      </View>

      <Text variant="bodySm" tone="primary" className="font-semibold mt-xs" numberOfLines={1}>
        {pickTitle(item)}
      </Text>
      {item.category ? (
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {item.category}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Group header: label (+ optional amber count) on the left, one "See all" right. */
function GroupHeader({
  label,
  count,
  onSeeAll,
}: {
  label: string;
  count?: number;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between mb-sm mt-md">
      <View className="flex-row items-center gap-xs">
        <Text
          variant="caption"
          tone="tertiary"
          className="font-bold uppercase"
          style={{ letterSpacing: 0.8 }}
          accessibilityRole="header"
        >
          {label}
        </Text>
        {count != null && count > 0 ? (
          <View
            style={{ backgroundColor: AMBER_TINT, borderColor: AMBER_LINE, borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}
            accessibilityLabel={t('mobile.labHome.draftCount', { defaultValue: '{{count}} drafts', count })}
          >
            <Text variant="caption" style={{ color: AMBER_INK, fontWeight: '700' }}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      <Pressable
        className="flex-row items-center active:opacity-70"
        hitSlop={8}
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labHome.seeAll')}
      >
        <Text variant="bodySm" className="font-semibold" style={{ color: greenDarkest }}>
          {t('mobile.labHome.seeAll')}
        </Text>
        <ChevronRight size={16} color={greenDarkest} />
      </Pressable>
    </View>
  );
}

function Rail({ children }: { children: React.ReactNode }) {
  return (
    // Full-bleed: break out of the Home's 22px horizontal padding so cards
    // reach the screen edges and "peek" (signals there's more to scroll),
    // while the content still aligns to the 22px gutter. -22 mirrors
    // home.tsx's contentContainerStyle.paddingHorizontal.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -22 }}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 22 }}
    >
      {children}
    </ScrollView>
  );
}

type HomeRecentListingsProps = {
  /** Start the photo->listing flow from the empty state. From home.tsx, which
   *  owns the gated launcher; omit it and the section stays hidden. */
  onStartListing?: () => void;
};

export function HomeRecentListings({ onStartListing }: HomeRecentListingsProps) {
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  const { resume, resumingId } = useResumeDraft();

  const {
    data: listingsData,
    isLoading: listingsLoading,
    isError: listingsError,
    isRefetching: listingsRefetching,
    refetch: refetchListings,
  } = useRecentSubmissions(PREVIEW_LIMIT);
  // Gated on the flag + sign-in so it never fires when it can't be used / 401s.
  const draftsGateOn = draftsEnabled() && !!profile?.id;
  const { data: draftsData, isLoading: draftsLoading } = useListDrafts({
    enabled: draftsGateOn,
    // Fail fast: a down/404 /drafts must not delay the (healthy) listings paint.
    retry: 0,
  });

  const allDrafts = draftsGateOn ? (draftsData?.drafts ?? []) : [];
  const drafts = allDrafts.slice(0, PREVIEW_DRAFTS);
  const listings = listingsError ? [] : (listingsData ?? []);

  // Wait for BOTH queries before first paint (when drafts are gated on) so the
  // header doesn't flip "Recent listings" → "Your items" and the drafts rail
  // doesn't pop in above the listings after the fact.
  const draftsPending = draftsGateOn && draftsLoading;
  if (listingsLoading || draftsPending) {
    return (
      <View className="mt-2xl">
        <ActivityIndicator color={greenDarkest} />
      </View>
    );
  }
  // Load failed with nothing else to show: surface a compact retry instead of
  // silently vanishing the section (the seller would just see their items gone).
  // A genuinely empty account (no error) still renders nothing.
  if (listingsError && !allDrafts.length) {
    return (
      <View className="mt-2xl">
        <Text variant="body" tone="primary" className="font-bold px-[2px]" accessibilityRole="header">
          {t('mobile.labHome.yourItems', { defaultValue: 'Your items' })}
        </Text>
        <View className="mt-sm flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-lg py-md">
          <Text variant="bodySm" tone="secondary" className="flex-1 mr-md">
            {t('mobile.labHome.listingsError', { defaultValue: "Couldn't load your items." })}
          </Text>
          <Pressable
            onPress={() => refetchListings()}
            disabled={listingsRefetching}
            hitSlop={8}
            className="flex-row items-center gap-xs active:opacity-70"
            accessibilityRole="button"
            accessibilityState={{ busy: listingsRefetching }}
            accessibilityLabel={t('mobile.labHome.retry', { defaultValue: 'Retry' })}
          >
            {listingsRefetching ? (
              <ActivityIndicator size="small" color={greenDarkest} />
            ) : (
              <RotateCw size={15} color={greenDarkest} strokeWidth={2.2} />
            )}
            <Text variant="bodySm" className="font-semibold" style={{ color: greenDarkest }}>
              {t('mobile.labHome.retry', { defaultValue: 'Retry' })}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }
  // ⚠️ Was `return null`, which is why a brand-new seller's Home was blank below
  // the composer -- no listings, no drafts, nothing explaining the app. Teach the
  // AI flow instead. Reached only after the loading + error branches above.
  if (!listings.length && !allDrafts.length) {
    return onStartListing ? (
      <HomeEmptyState mode="sell" onStartListing={onStartListing} onSuggestion={() => {}} />
    ) : null;
  }

  const hasDraftGroup = drafts.length > 0;
  // "Your items" once drafts share the section; else the familiar "Recent listings".
  const title = hasDraftGroup
    ? t('mobile.labHome.yourItems', { defaultValue: 'Your items' })
    : t('mobile.labHome.recentListings', { defaultValue: 'Recent listings' });

  return (
    <View className="mt-2xl">
      <Text variant="body" tone="primary" className="font-bold px-[2px]" accessibilityRole="header">
        {title}
      </Text>

      {/* Drafts rail — "pick up where you left off". Leads the section. */}
      {hasDraftGroup ? (
        <>
          <GroupHeader
            label={t('mobile.labHome.draftsGroup', { defaultValue: 'Pick up where you left off' })}
            count={allDrafts.length}
            onSeeAll={() => router.push(routes.scanDrafts)}
          />
          <Rail>
            {drafts.map((d) => (
              <DraftRailCard
                key={d.id}
                draft={d}
                onResume={() => resume(d.id)}
                resuming={resumingId === d.id}
                anyResuming={resumingId != null}
              />
            ))}
          </Rail>
        </>
      ) : null}

      {/* Listings rail. A group header only when the drafts rail is also present
          (otherwise the section title already names them) — but it still gets a
          "See all" via the header when grouped; when solo, the title stands in
          and "See all" rides on the listings header below. */}
      {listings.length > 0 ? (
        <>
          {hasDraftGroup ? (
            <GroupHeader
              label={t('mobile.labHome.listingsGroup', { defaultValue: 'Listings' })}
              onSeeAll={() => router.push(routes.labListings)}
            />
          ) : (
            <View className="flex-row items-center justify-end mb-sm mt-md">
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
          )}
          <Rail>
            {listings.map((item) => (
              <ListingRailCard key={item.batchPk} item={item} anyResuming={resumingId != null} />
            ))}
          </Rail>
        </>
      ) : null}
    </View>
  );
}
