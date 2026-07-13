// Response cards for the (lab) chat thread — RN ports of the web
// `aiChatShared.tsx` / `WtbCards.tsx` / `IdentifyConfirmCard.tsx` cards, adapted
// to the mobile tokens + recipes. Each card is defensive: a malformed payload
// renders the fields that parsed and never throws (05-mobile-ux §4, "never crash
// the thread on a bad frame"). Interactive cards fire follow-up turns via the
// `onSend` callback (mirrors the web Save/Confirm/View actions which send a
// natural-language message so the agent calls the tool).
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Gavel,
  ImagePlus,
  Layers,
  PencilLine,
  PartyPopper,
  Sparkles,
} from 'lucide-react-native';

import { AppImage } from '@/components/ui';
import {
  brand,
  elevation,
  fonts,
  greenDark,
  greenDarkest,
  greenMedium,
  radius,
  spacing,
  warnAmber,
} from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { usePressScale, useProgress } from '@/animations/recipes';
import {
  batchStatusTint,
  bidStatusTint,
  CardShell,
  Chip,
  condLabel,
  countryLabel,
  formatValue,
  isBlankValue,
  num,
  relTime,
  StatusChip,
} from './cardKit';
import type {
  GroupChoiceData,
  QueueData,
  QueueItem,
} from '@/features/lab/streaming/labStreamTypes';
import type { PublishBatchResult, SkippedItem } from '@/features/lab/data/batchProductApi';

/* Every card takes the same envelope: the raw `data` payload + an `onSend` used
 * for follow-up turns and a `mode` for buyer/seller framing. */
export type CardProps = {
  data: unknown;
  mode?: 'buyer' | 'seller';
  onSend?: (text: string) => void;
  /** Optional — opens the native picker action sheet for the entry-options card's
   *  "Upload photos / documents" button. Additive: cards that don't use it keep
   *  working unchanged. */
  onUploadPress?: () => void;
  /** Optional — opens the native "Edit listing" sheet for a listing_draft card.
   *  Additive: cards that don't use it keep working unchanged. */
  onEditDraft?: (data: unknown) => void;
  /* ── Multi-product batch callbacks (additive; only the queue/group_choice/
   *    batch_result cards use them). All optional so every existing card keeps
   *    working unchanged, and they're passed only behind DETECT_STREAM_ENABLED. */
  /** Jump the pager to a specific 1-based item (random-access). */
  onJumpProduct?: (index: number) => void;
  /** Move the pager forward/back from its current position. */
  onAdvanceProduct?: (dir: 'prev' | 'next', currentIndex: number, total: number) => void;
  /** Collapse the multi-product batch into one combined listing. */
  onCombineProducts?: () => void;
  /** Split a combined draft back into N separate products. */
  onSplitProducts?: () => void;
  /** Publish every ready item (DESTRUCTIVE — the card confirms first). */
  onPublishBatch?: () => void;
  /** True while a batch request is in flight (disables pager + CTAs). */
  batchBusy?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/* ── ProductCard + list (shared, most-reused) ─────────────────────────────── */

type ProductRow = {
  id?: number | string;
  batchId?: number | string | null;
  name?: string;
  image?: string | null;
  condition?: string | null;
  country?: string | null;
  price?: number | null;
  currency?: string | null;
};

/** Normalize the many producty payload shapes (product_list rows, wtb matches). */
export function toProductRow(v: unknown): ProductRow {
  const o = asObj(v);
  return {
    id: (o.id ?? o.product_id) as ProductRow['id'],
    batchId: (o.batch_id ?? o.batchId) as ProductRow['batchId'],
    name: (o.name ?? o.title ?? o.product_name) as string | undefined,
    image: (o.image ?? o.image_url ?? o.imageUrl) as string | null | undefined,
    condition: (o.condition ?? o.item_condition) as string | null | undefined,
    country: o.country as string | null | undefined,
    price: (o.price ?? o.price_per_unit) as number | null | undefined,
    currency: o.currency as string | null | undefined,
  };
}

export function LabProductCard({ row, onPress }: { row: ProductRow; onPress?: () => void }) {
  const { t } = useTranslation();
  const { style, onPressIn, onPressOut } = usePressScale();
  const priceText =
    typeof row.price === 'number' && row.price > 0
      ? `${row.currency ? `${row.currency} ` : ''}${row.price.toLocaleString()}`
      : t('mobile.labCards.priceOnRequest');
  return (
    <AnimatedPressable style={style} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <View style={styles.product}>
        <View style={styles.thumb}>
          {row.image ? (
            <AppImage source={{ uri: row.image }} style={styles.thumbImg} />
          ) : (
            <Sparkles size={22} color={brand.primaryAccent} />
          )}
        </View>
        <View style={styles.productBody}>
          <Text numberOfLines={2} style={styles.productName}>
            {row.name || t('mobile.labCards.untitledListing')}
          </Text>
          <View style={styles.rowChips}>
            {row.condition ? <Chip tone="emerald">{condLabel(row.condition)}</Chip> : null}
            {row.country ? <Chip>{countryLabel(row.country)}</Chip> : null}
          </View>
          <Text style={styles.productPrice}>{priceText}</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function LabProductCardList({ data, mode, onSend }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const rows = asArr(o.results ?? o.items ?? (Array.isArray(data) ? data : [])).map(toProductRow);
  const identified = asObj(o.identified);
  const showActions = mode === 'buyer';

  if (rows.length === 0) {
    // Image search recognised an item but nothing is in stock → identify-confirm.
    if (identified.name) {
      return (
        <LabIdentifyConfirmCard name={String(identified.name)} onSend={onSend} />
      );
    }
    return (
      <CardShell title={t('mobile.labCards.results')}>
        <Text style={styles.muted}>{t('mobile.labCards.noMatchingItems')}</Text>
      </CardShell>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row, i) => (
        <LabProductCard
          key={`${row.id ?? 'x'}-${i}`}
          row={row}
          onPress={
            showActions && row.name
              ? () => {
                  haptics.tap();
                  onSend?.(t('mobile.labCards.tellMeMore', { name: row.name }));
                }
              : undefined
          }
        />
      ))}
    </View>
  );
}

/* ── IdentifyConfirmCard (buyer image search) ─────────────────────────────── */

export function LabIdentifyConfirmCard({
  name,
  onSend,
}: {
  name: string;
  onSend?: (text: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.softCard}>
      <View style={styles.identifyRow}>
        <Sparkles size={16} color={greenDark} />
        <Text style={styles.identifyText}>
          {t('mobile.labCards.identifyLead')} <Text style={styles.bold}>{name}</Text>
          {t('mobile.labCards.identifyTail')}
        </Text>
      </View>
      <View style={styles.btnRow}>
        <PrimaryButton
          label={t('mobile.labCards.yesThatsIt')}
          onPress={() => onSend?.(t('mobile.labCards.confirmItemMsg'))}
        />
        <GhostButton
          label={t('mobile.labCards.somethingElse')}
          onPress={() => onSend?.(t('mobile.labCards.notQuiteMsg'))}
        />
      </View>
    </View>
  );
}

/* ── ProductDetail ────────────────────────────────────────────────────────── */

function LabProductDetailCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  if (o.found === false) {
    return (
      <CardShell title={t('mobile.labCards.listing')}>
        <Text style={styles.muted}>{t('mobile.labCards.listingNotFound')}</Text>
      </CardShell>
    );
  }
  const title = (o.title ?? o.name) as string | undefined;
  const desc = (o.description ?? o.post_content) as string | undefined;
  const tint = o.batch_status ? batchStatusTint(String(o.batch_status)) : null;
  return (
    <CardShell title={t('mobile.labCards.listing')}>
      <Text style={styles.detailTitle}>{title || t('mobile.labCards.untitledListing')}</Text>
      {desc ? (
        <Text numberOfLines={3} style={styles.detailDesc}>
          {desc}
        </Text>
      ) : null}
      {tint ? (
        <View style={styles.rowChips}>
          <StatusChip {...tint} />
        </View>
      ) : null}
    </CardShell>
  );
}

/* ── Overview / Catalog ───────────────────────────────────────────────────── */

function LabOverviewCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  return (
    <CardShell title={t('mobile.labCards.marketplaceOverview')}>
      <View style={styles.statGrid}>
        <StatTile label={t('mobile.labCards.activeLots')} value={num(o.live_lots as number)} accent />
        <StatTile label={t('mobile.labCards.completed')} value={num(o.sold_lots as number)} />
      </View>
    </CardShell>
  );
}

function LabCatalogSummaryCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const facet = (label: string, items: unknown) => {
    const rows = asArr(items) as { name?: string; count?: number }[];
    if (rows.length === 0) return null;
    return (
      <View style={{ marginTop: spacing.md }}>
        <Text style={styles.facetLabel}>{label}</Text>
        <View style={styles.rowChipsWrap}>
          {rows.map((it, i) => (
            <View key={`${it.name}-${i}`} style={styles.facetChip}>
              <Text style={styles.facetChipText}>{it.name}</Text>
              <Text style={styles.facetChipCount}>{num(it.count)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
  return (
    <CardShell title={t('mobile.labCards.catalogSummary')}>
      <View style={styles.catalogTotal}>
        <Text style={styles.bigStat}>{num(o.total_products as number)}</Text>
        <Text style={styles.facetLabel}>{t('mobile.labCards.totalItemsListed')}</Text>
      </View>
      {facet(t('mobile.labCards.topCategories'), o.top_categories)}
      {facet(t('mobile.labCards.countries'), o.countries)}
      {facet(t('mobile.labCards.conditions'), o.conditions)}
    </CardShell>
  );
}

/* ── BatchList / SellerActivity ───────────────────────────────────────────── */

function LabBatchListCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const rows = asArr(o.batches ?? o.items ?? (Array.isArray(data) ? data : [])) as Record<
    string,
    unknown
  >[];
  if (rows.length === 0) {
    return (
      <CardShell title={t('mobile.labCards.auctions')}>
        <Text style={styles.muted}>{t('mobile.labCards.noMatchingAuctions')}</Text>
      </CardShell>
    );
  }
  const visible = rows.slice(0, 5);
  return (
    <CardShell title={t('mobile.labCards.auctionsCount', { count: rows.length })}>
      <View style={{ gap: spacing.sm }}>
        {visible.map((b, i) => {
          const tint = batchStatusTint(b.status as string);
          const closes = relTime(b.end_date as string);
          return (
            <View key={i} style={styles.listRow}>
              <View style={styles.listRowTop}>
                <Text numberOfLines={1} style={styles.listRowTitle}>
                  {(b.name as string) ||
                    t('mobile.labCards.batchNumber', {
                      number: b.batch_number ?? b.batch_id ?? i + 1,
                    })}
                </Text>
                <StatusChip {...tint} />
              </View>
              <Text style={styles.listRowMeta}>
                {[
                  b.product_count != null
                    ? t('mobile.labCards.itemsCount', { count: num(b.product_count as number) })
                    : null,
                  b.country ? countryLabel(b.country as string) : null,
                  closes
                    ? b.status === 'live_for_bids'
                      ? t('mobile.labCards.closes', { time: closes })
                      : closes
                    : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>
          );
        })}
      </View>
      {rows.length > 5 ? (
        <Text style={styles.moreLine}>{t('mobile.labCards.moreLine', { count: rows.length - 5 })}</Text>
      ) : null}
    </CardShell>
  );
}

function LabSellerActivityCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const rows = asArr(o.listings ?? o.items ?? (Array.isArray(data) ? data : [])) as Record<
    string,
    unknown
  >[];
  if (rows.length === 0) {
    return (
      <CardShell title={t('mobile.labCards.yourListings')}>
        <Text style={styles.muted}>{t('mobile.labCards.noListingsYet')}</Text>
      </CardShell>
    );
  }
  const visible = rows.slice(0, 5);
  return (
    <CardShell title={t('mobile.labCards.yourListingsCount', { count: rows.length })}>
      <View style={{ gap: spacing.sm }}>
        {visible.map((b, i) => {
          const tint = batchStatusTint(b.status as string);
          return (
            <View key={i} style={styles.listRow}>
              <View style={styles.listRowTop}>
                <Text numberOfLines={1} style={styles.listRowTitle}>
                  {((b.name ?? b.title) as string) ||
                    t('mobile.labCards.batchNumber', { number: b.batch_id ?? i + 1 })}
                </Text>
                <StatusChip {...tint} />
              </View>
              <Text style={styles.listRowMeta}>
                {[
                  b.product_count != null
                    ? t('mobile.labCards.itemsCount', { count: num(b.product_count as number) })
                    : null,
                  b.bid_count != null
                    ? t('mobile.labCards.bidsCount', { count: num(b.bid_count as number) })
                    : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>
          );
        })}
      </View>
      {rows.length > 5 ? (
        <Text style={styles.moreLine}>{t('mobile.labCards.moreLine', { count: rows.length - 5 })}</Text>
      ) : null}
    </CardShell>
  );
}

/* ── Bids (buyer own / seller received) ───────────────────────────────────── */

function bidRows(data: unknown): Record<string, unknown>[] {
  const o = asObj(data);
  return asArr(o.bids ?? o.items ?? (Array.isArray(data) ? data : [])) as Record<
    string,
    unknown
  >[];
}

function BidRowsCard({ data, title, empty }: { data: unknown; title: string; empty: string }) {
  const { t } = useTranslation();
  const o = asObj(data);
  if (o.status === 'login_required') {
    return <LabGateCard data={{ reason: 'login' }} />;
  }
  const rows = bidRows(data);
  if (rows.length === 0) {
    return (
      <CardShell title={title}>
        <Text style={styles.muted}>{empty}</Text>
      </CardShell>
    );
  }
  const visible = rows.slice(0, 5);
  return (
    <CardShell title={`${title} (${rows.length})`}>
      <View style={{ gap: spacing.sm }}>
        {visible.map((b, i) => {
          const tint = bidStatusTint((b.bid_status ?? b.status) as string);
          const when = relTime((b.submitted_at ?? b.placed_at) as string);
          const amount = (b.bid_amount ?? b.amount) as number | undefined;
          return (
            <View key={i} style={styles.listRow}>
              <View style={styles.listRowTop}>
                <Text numberOfLines={1} style={styles.listRowTitle}>
                  {((b.batch_name ?? b.product_name) as string) || t('mobile.labCards.listing')}
                </Text>
                <StatusChip {...tint} />
              </View>
              <Text style={styles.listRowMeta}>
                {[amount != null ? num(amount) : null, when].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          );
        })}
      </View>
      {rows.length > 5 ? (
        <Text style={styles.moreLine}>{t('mobile.labCards.moreLine', { count: rows.length - 5 })}</Text>
      ) : null}
    </CardShell>
  );
}

function LabBidListCard({ data }: CardProps) {
  const { t } = useTranslation();
  return (
    <BidRowsCard
      data={data}
      title={t('mobile.labCards.yourBids')}
      empty={t('mobile.labCards.noBidsPlaced')}
    />
  );
}
function LabReceivedBidsCard({ data }: CardProps) {
  const { t } = useTranslation();
  return (
    <BidRowsCard
      data={data}
      title={t('mobile.labCards.bidsOnYourListings')}
      empty={t('mobile.labCards.noBidsReceived')}
    />
  );
}

/* ── PlatformInfo ─────────────────────────────────────────────────────────── */

function LabPlatformInfoCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const steps = asArr(o.steps) as { title?: string; detail?: string }[];
  const points = asArr(o.points) as { label?: string; detail?: string }[];
  return (
    <CardShell title={(o.title as string) || t('mobile.labCards.aboutGreenBidz')}>
      {o.intro ? <Text style={styles.detailDesc}>{String(o.intro)}</Text> : null}
      {steps.length > 0 ? (
        <View style={{ gap: 10, marginTop: o.intro ? spacing.sm : 0 }}>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                {s.detail ? <Text style={styles.stepDetail}>{s.detail}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {points.length > 0 ? (
        <View style={{ gap: 8, marginTop: o.intro ? spacing.sm : 0 }}>
          {points.map((p, i) => (
            <View key={i}>
              <Text style={styles.stepTitle}>{p.label}</Text>
              {p.detail ? <Text style={styles.stepDetail}>{p.detail}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </CardShell>
  );
}

/* ── Listing draft (seller centerpiece) ───────────────────────────────────── */

const REQUIRED_FIELDS = [
  'product_title',
  'item_condition',
  'location',
  'price_currency',
  'price_per_unit',
  'category',
  'images',
];
// Known draft field labels live under `mobile.labCards.field.<field_name>`;
// unknown keys fall back to a Title-Cased version of the raw field name.
const KNOWN_FIELDS = new Set([
  'product_title',
  'item_condition',
  'location',
  'price_currency',
  'price_per_unit',
  'category',
  'images',
  'brand',
  'model',
  'year',
  'operation_status',
  'serial_number',
  'quantity',
]);
const fieldLabel = (k: string, t: (key: string) => string) =>
  KNOWN_FIELDS.has(k)
    ? t(`mobile.labCards.field.${k}`)
    : k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function LabListingDraftCard({ data, onSend, onEditDraft }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const fields = asObj(asObj(o.draft).fields ?? o.fields);
  const imageUrls = asArr(asObj(o.draft).image_urls ?? o.image_urls) as string[];
  const image = imageUrls.find(Boolean);
  const missing = asArr(o.missing_required) as string[];
  const readyToCreate = o.ready_to_create === true;

  const valOf = (k: string) => asObj(fields[k]).value;
  const has = (k: string) => !isBlankValue(valOf(k));
  const hasImage = imageUrls.some(Boolean);

  const filled = REQUIRED_FIELDS.filter((k) => (k === 'images' ? hasImage : has(k))).length;
  const pct = Math.round((filled / REQUIRED_FIELDS.length) * 100);
  // A fully-filled draft is publish-ready even if the assistant hasn't yet set
  // `ready_to_create` — flip the pill to "Ready" and surface the Publish CTA at
  // 100% so the seller doesn't have to type "publish" to reveal it. Publish
  // still sends the same 'CONFIRM CREATE' the assistant gates the write on.
  const ready = readyToCreate || filled === REQUIRED_FIELDS.length;

  const title = (valOf('product_title') as string) || t('mobile.labCards.untitledListing');
  const price = valOf('price_per_unit');
  const hasPrice = price != null && !isBlankValue(price);
  const currency = (valOf('price_currency') as string) || 'USD';
  const KEY_FIELDS = ['brand', 'model', 'location', 'year', 'operation_status', 'serial_number'];
  const keyVisible = KEY_FIELDS.filter((k) => has(k));

  // Animated completion fill (PROGRESS recipe): drive to the filled ratio and
  // let the fill warm from amber → green only once the meter reaches 100%.
  const { style: fillStyle, animateTo } = useProgress(filled / REQUIRED_FIELDS.length);
  useEffect(() => {
    animateTo(filled / REQUIRED_FIELDS.length);
  }, [filled]); // eslint-disable-line react-hooks/exhaustive-deps
  const meterColor = pct < 100 ? warnAmber : greenMedium;

  return (
    <View style={styles.draftCard}>
      <View style={styles.draftHeader}>
        <View style={styles.draftHeaderLead}>
          <Sparkles size={13} color={greenDark} />
          <Text style={styles.draftHeaderTitle}>{t('mobile.labCards.listingDraft')}</Text>
        </View>
        <StatusChip
          label={ready ? t('mobile.labCards.ready') : t('mobile.labCards.draft')}
          color={ready ? greenDark : brand.mutedForeground}
          bg={ready ? brand.successBg : brand.surfaceMuted}
        />
      </View>

      <View style={styles.draftHero}>
        <View style={styles.draftThumb}>
          {image ? (
            <AppImage source={{ uri: image }} style={styles.thumbImg} />
          ) : (
            <Sparkles size={26} color={greenDark} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={styles.draftHeroTitle}>
            {title}
          </Text>
          <View style={styles.rowChips}>
            {has('category') ? <Chip tone="emerald">{formatValue(valOf('category'))}</Chip> : null}
            {has('item_condition') ? (
              <Chip>{condLabel(valOf('item_condition') as string)}</Chip>
            ) : null}
          </View>
        </View>
      </View>

      {/* Price — a constant-height band with a 3px accent rail: green "success"
          when a price exists, amber "+ Add price" (full-width, left-aligned) when
          not. PRESERVE the rule: green band only when priced. */}
      <View style={[styles.priceBar, !hasPrice && styles.priceBarNeed]}>
        {hasPrice ? (
          <Text style={styles.priceText}>
            {typeof price === 'number' ? price.toLocaleString() : formatValue(price)}{' '}
            <Text style={styles.priceCurrency}>{currency}</Text>
          </Text>
        ) : (
          <Text style={styles.needChipText}>{t('mobile.labCards.addPrice')}</Text>
        )}
      </View>

      {/* Key details */}
      {keyVisible.length > 0 ? (
        <View style={styles.detailList}>
          <Text style={styles.detailListLabel}>{t('mobile.labCards.details')}</Text>
          {keyVisible.map((k, i) => (
            <View
              key={k}
              style={[styles.detailRow, i === keyVisible.length - 1 && { borderBottomWidth: 0 }]}
            >
              <Text style={styles.detailKey}>{fieldLabel(k, t)}</Text>
              <Text numberOfLines={2} style={styles.detailVal}>
                {formatValue(valOf(k))}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Completion meter — animated warm→green fill; the Needs line wraps onto
          its own full-width row below the count so it never truncates mid-word. */}
      <View style={styles.meter}>
        <View style={styles.meterTop}>
          <Text style={styles.meterLabel}>
            <Text style={styles.meterCount}>{filled}</Text> / {REQUIRED_FIELDS.length}{' '}
            {t('mobile.labCards.required')}
          </Text>
        </View>
        {missing.length > 0 ? (
          <Text numberOfLines={2} style={styles.meterNeeds}>
            {t('mobile.labCards.needs', {
              fields: missing.map((m) => fieldLabel(m, t).toLowerCase()).join(', '),
            })}
          </Text>
        ) : (
          <Text numberOfLines={1} style={styles.meterReady}>
            {t('mobile.labCards.allSet')}
          </Text>
        )}
        <View style={styles.meterTrack}>
          <Animated.View style={[styles.meterFill, fillStyle, { backgroundColor: meterColor }]} />
        </View>
      </View>

      {/* Edit details — an always-visible secondary affordance (gated on neither
          `ready` nor sign-in) that opens the native "Edit listing" sheet. Sits
          just above the Publish footer band so the primary CTA stays dominant. */}
      {onEditDraft ? (
        <View style={styles.draftEditWrap}>
          <GhostButton
            label={t('mobile.labCards.editDetails')}
            icon={<PencilLine size={15} color={greenDark} />}
            onPress={() => {
              haptics.tap();
              onEditDraft(data);
            }}
          />
        </View>
      ) : null}

      {/* Actions — an earned final step: a tinted footer band with a full-width
          Publish CTA. PRESERVE: haptics.impact() + onSend('CONFIRM CREATE'). */}
      {ready ? (
        <View style={styles.draftFooter}>
          <View style={styles.draftPublishWrap}>
            <PrimaryButton
              label={t('mobile.labCards.publishListing')}
              icon={<Check size={16} color="#fff" />}
              onPress={() => {
                haptics.impact();
                onSend?.('CONFIRM CREATE');
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function LabListingCreatedCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const url = o.url as string | undefined;
  const productId = o.product_id;
  return (
    <View style={styles.createdCard}>
      <View style={styles.createdHead}>
        <View style={styles.createdCoin}>
          <Check size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.createdEyebrow}>{t('mobile.labCards.listingPublished')}</Text>
          <Text style={styles.createdTitle}>
            {((o.name ?? o.title) as string) || t('mobile.labCards.listingLive')}
          </Text>
          {productId != null ? (
            <Text style={styles.createdMeta}>
              {t('mobile.labCards.productNumber', { id: String(productId) })}
            </Text>
          ) : null}
        </View>
      </View>
      {url ? (
        <Pressable
          onPress={() => {
            haptics.tap();
            Linking.openURL(url).catch(() => undefined);
          }}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>{t('mobile.labCards.viewListing')}</Text>
          <ArrowUpRight size={14} color={greenDark} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Multi-product batch cards (document/multi-photo → N drafts) ───────────── */

/** Coerce a raw QueueItem-ish payload defensively (never throw on a bad frame). */
function toQueueItem(v: unknown): QueueItem {
  const o = asObj(v);
  return {
    index: typeof o.index === 'number' ? o.index : 0,
    // Blank when absent; the render site localizes the "Untitled item" fallback.
    title: (o.title as string) || '',
    image_url: (o.image_url ?? null) as string | null,
    missing: typeof o.missing === 'number' ? o.missing : 0,
  };
}

/**
 * `listing_queue` — the multi-product OVERVIEW pager. Header reads "ITEM {index}
 * OF {total}" (index is the CURRENT active position from the frame). Each row is
 * a tappable QueueItem (jump-to-item); footer chevrons page prev/next; a
 * confirm-gated "Publish all ready" CTA fires the batch publish. All actions
 * disable while `batchBusy`. Reuses CardShell/StatusChip/PrimaryButton — no new
 * hexes. Read-only (no callbacks) when the flag is off.
 */
function LabListingQueueCard({
  data,
  onJumpProduct,
  onAdvanceProduct,
  onPublishBatch,
  batchBusy,
}: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data) as Partial<QueueData>;
  const total = typeof o.total === 'number' ? o.total : 0;
  const index = typeof o.index === 'number' ? o.index : 1;
  const items = asArr(o.items).map(toQueueItem);
  const readyCount = items.filter((it) => it.missing === 0).length;
  const [confirmPublish, setConfirmPublish] = useState(false);

  const canPrev = !!onAdvanceProduct && index > 1 && !batchBusy;
  const canNext = !!onAdvanceProduct && index < total && !batchBusy;

  return (
    <CardShell
      title={t('mobile.labCards.itemOfTotal', { index, total })}
      action={
        onAdvanceProduct ? (
          <View style={styles.queuePager}>
            <PagerChevron
              dir="prev"
              disabled={!canPrev}
              onPress={() => {
                haptics.tap();
                onAdvanceProduct('prev', index, total);
              }}
            />
            <PagerChevron
              dir="next"
              disabled={!canNext}
              onPress={() => {
                haptics.tap();
                onAdvanceProduct('next', index, total);
              }}
            />
          </View>
        ) : null
      }
    >
      <View style={{ gap: spacing.sm }}>
        {items.map((it) => {
          const active = it.index === index;
          const row = (
            <View style={[styles.queueRow, active && styles.queueRowActive]}>
              <View style={styles.queueThumb}>
                {it.image_url ? (
                  <AppImage source={{ uri: it.image_url }} style={styles.thumbImg} />
                ) : (
                  <Sparkles size={18} color={brand.primaryAccent} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={styles.queueRowTitle}>
                  {it.title || t('mobile.labCards.untitledItem')}
                </Text>
                <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                  {it.missing === 0 ? (
                    <StatusChip label={t('mobile.labCards.ready')} color={greenDark} bg={brand.successBg} />
                  ) : (
                    <StatusChip
                      label={t('mobile.labCards.needsCount', { count: it.missing })}
                      color={brand.warningText}
                      bg={brand.warningBg}
                    />
                  )}
                </View>
              </View>
              {onJumpProduct ? <ChevronRight size={18} color={brand.mutedForeground} /> : null}
            </View>
          );
          if (!onJumpProduct) return <View key={it.index}>{row}</View>;
          return (
            <Pressable
              key={it.index}
              disabled={batchBusy}
              onPress={() => {
                haptics.tap();
                onJumpProduct(it.index);
              }}
              style={batchBusy ? { opacity: 0.6 } : undefined}
            >
              {row}
            </Pressable>
          );
        })}
      </View>

      {onPublishBatch && readyCount > 0 ? (
        <View style={styles.queuePublishWrap}>
          <PrimaryButton
            label={
              confirmPublish
                ? t('mobile.labCards.tapAgainPublish', { count: readyCount })
                : t('mobile.labCards.publishAllReady', { count: readyCount })
            }
            icon={<Check size={16} color="#fff" />}
            disabled={batchBusy}
            onPress={() => {
              if (!confirmPublish) {
                haptics.tap();
                setConfirmPublish(true);
                return;
              }
              haptics.impact();
              setConfirmPublish(false);
              onPublishBatch();
            }}
          />
        </View>
      ) : null}
    </CardShell>
  );
}

/**
 * `listing_group_choice` — the one-time chooser shown when the assistant finds N
 * products (multi-photo image path). Two EntryOption-style tiles: "Review
 * separately" → split; "Combine into one listing" → combine. The `mode` marks
 * the server-suggested branch. The active item already arrives as its own
 * listing_draft frame, so this card only shows a one-line first_payload preview.
 */
function LabListingGroupChoiceCard({
  data,
  onSplitProducts,
  onCombineProducts,
  batchBusy,
}: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data) as Partial<GroupChoiceData>;
  const total = typeof o.total === 'number' ? o.total : asArr(o.items).length;
  const mode = o.mode;
  const firstFields = asObj(asObj(asObj(o.first_payload).draft).fields ?? asObj(o.first_payload).fields);
  const firstTitle = asObj(firstFields.product_title).value as string | undefined;

  return (
    <View style={styles.softCard}>
      <View style={styles.identifyRow}>
        <Layers size={16} color={greenDark} />
        <Text style={styles.identifyText}>
          {t('mobile.labCards.foundLead')} <Text style={styles.bold}>{total}</Text>{' '}
          {t('mobile.labCards.foundTail')}
        </Text>
      </View>
      {firstTitle ? (
        <Text numberOfLines={1} style={[styles.muted, { marginTop: 6 }]}>
          {t('mobile.labCards.firstUp', { title: firstTitle })}
        </Text>
      ) : null}
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <EntryOption
          icon={<Layers size={18} color={greenDark} />}
          title={t('mobile.labCards.reviewSeparately', { count: total })}
          subtitle={t('mobile.labCards.reviewSeparatelySub')}
          badge={mode === 'separate_default' ? t('mobile.labCards.suggested') : undefined}
          disabled={batchBusy || !onSplitProducts}
          onPress={() => onSplitProducts?.()}
        />
        <EntryOption
          icon={<Bookmark size={18} color={greenDark} />}
          title={t('mobile.labCards.combineListing')}
          subtitle={t('mobile.labCards.combineListingSub')}
          badge={mode === 'combined_default' ? t('mobile.labCards.suggested') : undefined}
          disabled={batchBusy || !onCombineProducts}
          onPress={() => onCombineProducts?.()}
        />
      </View>
    </View>
  );
}

/**
 * `listing_batch_result` — client-mapped from the publish-batch response (not a
 * server frame). A celebratory head with the published count, a roster of the
 * items that still need details (amber, each tappable → jump back to fix), and a
 * "Fix N remaining" CTA when there are skips. Never swallows `skipped_count`.
 */
function LabBatchResultCard({ data, onJumpProduct, batchBusy }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data) as Partial<PublishBatchResult>;
  const publishedCount = typeof o.published_count === 'number' ? o.published_count : asArr(o.published).length;
  const skippedCount = typeof o.skipped_count === 'number' ? o.skipped_count : asArr(o.skipped).length;
  const total = typeof o.total === 'number' ? o.total : publishedCount + skippedCount;
  const skipped = asArr(o.skipped) as SkippedItem[];

  return (
    <View style={styles.createdCard}>
      <View style={styles.createdHead}>
        <View style={styles.createdCoin}>
          <PartyPopper size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.createdEyebrow}>{t('mobile.labCards.batchPublished')}</Text>
          <Text style={styles.createdTitle}>
            {total === 1
              ? t('mobile.labCards.listingLiveOne', { published: publishedCount, total })
              : t('mobile.labCards.listingLiveOther', { published: publishedCount, total })}
          </Text>
        </View>
      </View>

      {skippedCount > 0 ? (
        <View style={styles.skipWrap}>
          <View style={styles.skipHead}>
            <AlertCircle size={14} color={brand.warningText} />
            <Text style={styles.skipHeadText}>
              {skippedCount === 1
                ? t('mobile.labCards.needDetailsOne', { count: skippedCount })
                : t('mobile.labCards.needDetailsOther', { count: skippedCount })}
            </Text>
          </View>
          <View style={{ gap: spacing.xs }}>
            {skipped.map((s, i) => {
              const item = asObj(s);
              const idx = typeof item.index === 'number' ? item.index : i + 1;
              const title = (item.title as string) || t('mobile.labCards.untitledItem');
              const needs = asArr(item.needs) as string[];
              const rowInner = (
                <View style={styles.skipRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.skipRowTitle}>
                      {title}
                    </Text>
                    {needs.length > 0 ? (
                      <Text numberOfLines={1} style={styles.skipRowNeeds}>
                        {t('mobile.labCards.needs', { fields: needs.join(', ') })}
                      </Text>
                    ) : null}
                  </View>
                  {onJumpProduct ? <ChevronRight size={16} color={brand.warningText} /> : null}
                </View>
              );
              if (!onJumpProduct) return <View key={idx}>{rowInner}</View>;
              return (
                <Pressable
                  key={idx}
                  disabled={batchBusy}
                  onPress={() => {
                    haptics.tap();
                    onJumpProduct(idx);
                  }}
                >
                  {rowInner}
                </Pressable>
              );
            })}
          </View>
          {onJumpProduct && skipped.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <PrimaryButton
                label={t('mobile.labCards.fixRemaining', { count: skippedCount })}
                icon={<PencilLine size={15} color="#fff" />}
                disabled={batchBusy}
                onPress={() => {
                  haptics.tap();
                  const first = asObj(skipped[0]);
                  const idx = typeof first.index === 'number' ? first.index : 1;
                  onJumpProduct(idx);
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function LabListingEntryOptionsCard({ onSend, onUploadPress }: CardProps) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      <EntryOption
        icon={<ImagePlus size={18} color={greenDark} />}
        title={t('mobile.labCards.uploadPhotos')}
        subtitle={t('mobile.labCards.uploadPhotosSub')}
        onPress={() => onUploadPress?.()}
      />
      <EntryOption
        icon={<PencilLine size={18} color={greenDark} />}
        title={t('mobile.labCards.enterManually')}
        subtitle={t('mobile.labCards.enterManuallySub')}
        onPress={() => onSend?.(t('mobile.labCards.enterManuallyMsg'))}
      />
    </View>
  );
}

/* ── Gates ────────────────────────────────────────────────────────────────── */

function LabGateCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const reason = o.reason as string | undefined;
  const isSeller = reason === 'seller_access';
  return (
    <View style={styles.gateCard}>
      <Text style={styles.gateTitle}>
        {isSeller
          ? t('mobile.labCards.sellerAccessRequired')
          : t('mobile.labCards.createAccount')}
      </Text>
      <Text style={styles.gateSub}>
        {isSeller ? t('mobile.labCards.sellerAccessSub') : t('mobile.labCards.createAccountSub')}
      </Text>
    </View>
  );
}

/* ── Want-To-Buy cards ────────────────────────────────────────────────────── */

function LabWtbDraftCard({ data, onSend }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const f = asObj(o.draft);
  const keywords = asArr(f.keywords) as string[];
  const preview = asArr(o.preview_matches ?? o.immediate_matches);
  const [saved, setSaved] = useState(false);

  return (
    <View style={styles.softCard}>
      <View style={styles.wtbHeader}>
        <Bookmark size={14} color={greenDark} />
        <Text style={styles.wtbHeaderText}>{t('mobile.labCards.wantToBuy')}</Text>
      </View>
      <Text style={styles.detailTitle}>{(f.title as string) || t('mobile.labCards.untitledWant')}</Text>
      {f.category_name || keywords.length > 0 ? (
        <View style={styles.rowChipsWrap}>
          {f.category_name ? <Chip tone="emerald">{String(f.category_name)}</Chip> : null}
          {keywords.map((k) => (
            <Chip key={k}>{k}</Chip>
          ))}
        </View>
      ) : null}
      <View style={styles.wtbTeaser}>
        <Sparkles size={14} color={greenDark} />
        <Text style={styles.wtbTeaserText}>
          {preview.length > 0
            ? preview.length === 1
              ? t('mobile.labCards.wtbTeaserMatchesOne', { count: preview.length })
              : t('mobile.labCards.wtbTeaserMatchesOther', { count: preview.length })
            : t('mobile.labCards.wtbNoMatchesYet')}
        </Text>
      </View>
      <View style={styles.btnRow}>
        <PrimaryButton
          label={saved ? t('mobile.labCards.saved') : t('mobile.labCards.saveAlertMe')}
          icon={saved ? <Check size={16} color="#fff" /> : <Bell size={16} color="#fff" />}
          disabled={saved}
          onPress={() => {
            if (saved) return;
            setSaved(true); // idempotent: fire once (05-mobile-ux §3.4 guard)
            haptics.success();
            onSend?.(t('mobile.labCards.saveWantMsg'));
          }}
        />
      </View>
    </View>
  );
}

function LabWtbRequestCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const req = asObj(o.request);
  const title = (req.title ?? o.title) as string | undefined;
  const matches = asArr(o.matches ?? o.immediate_matches).map(toProductRow);
  return (
    <View style={styles.createdCard}>
      <View style={styles.identifyRow}>
        <Check size={16} color={greenDark} />
        <Text style={[styles.createdTitle, { flex: 1 }]}>
          {t('mobile.labCards.savedAlertAbout', { title: title || t('mobile.labCards.yourWant') })}
        </Text>
      </View>
      <Text style={styles.muted}>
        {matches.length > 0
          ? matches.length === 1
            ? t('mobile.labCards.matchesNowOne', { count: matches.length })
            : t('mobile.labCards.matchesNowOther', { count: matches.length })
          : t('mobile.labCards.noMatchesYetNotify')}
      </Text>
      {matches.length > 0 ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {matches.map((m, i) => (
            <LabProductCard key={`${m.id ?? 'x'}-${i}`} row={m} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LabWtbListCard({ data, onSend }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const items = asArr(o.items ?? o.requests) as Record<string, unknown>[];
  if (items.length === 0) {
    return (
      <CardShell title={t('mobile.labCards.myWants')}>
        <Text style={styles.muted}>{t('mobile.labCards.noWantsSaved')}</Text>
      </CardShell>
    );
  }
  return (
    <CardShell title={t('mobile.labCards.myWantsCount', { count: o.total ?? items.length })}>
      <View style={{ gap: spacing.sm }}>
        {items.map((it, i) => {
          const count = (it.match_count ?? it.matches_count ?? 0) as number;
          return (
            <View key={(it.id as number) ?? i} style={styles.listRow}>
              <View style={styles.listRowTop}>
                <Text numberOfLines={1} style={styles.listRowTitle}>
                  {it.title as string}
                </Text>
                <GhostButton
                  label={t('mobile.labCards.viewMatches')}
                  small
                  onPress={() => {
                    haptics.tap();
                    onSend?.(t('mobile.labCards.showMatchesMsg', { title: it.title as string }));
                  }}
                />
              </View>
              <Text style={styles.listRowMeta}>
                {count === 1
                  ? t('mobile.labCards.matchCountOne', { count })
                  : t('mobile.labCards.matchCountOther', { count })}
              </Text>
            </View>
          );
        })}
      </View>
    </CardShell>
  );
}

function LabWtbMatchesCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const matches = asArr(o.items ?? o.matches).map(toProductRow);
  return (
    <CardShell title={t('mobile.labCards.matchesCount', { count: o.total ?? matches.length })}>
      {matches.length === 0 ? (
        <Text style={styles.muted}>{t('mobile.labCards.noMatchesForWant')}</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {matches.map((m, i) => (
            <LabProductCard key={`${m.id ?? 'x'}-${i}`} row={m} />
          ))}
        </View>
      )}
    </CardShell>
  );
}

/* ── Handoff (live-agent) ─────────────────────────────────────────────────── */

function LabHandoffCard({ data }: CardProps) {
  const { t } = useTranslation();
  const o = asObj(data);
  const msg = (o.message as string) || t('mobile.labCards.connectingPerson');
  return (
    <View style={styles.softCard}>
      <View style={styles.identifyRow}>
        <Gavel size={16} color={greenDark} />
        <Text style={styles.identifyText}>{msg}</Text>
      </View>
    </View>
  );
}

/* ── Small building blocks ────────────────────────────────────────────────── */

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statTile, accent && styles.statTileAccent]}>
      <Text style={[styles.statValue, accent && { color: greenDarkest }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EntryOption({
  icon,
  title,
  subtitle,
  onPress,
  badge,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Optional "Suggested" (or other) badge on the right of the title row. */
  badge?: string;
  disabled?: boolean;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View style={[styles.entryOption, disabled && { opacity: 0.6 }]}>
        <View style={styles.entryIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <View style={styles.entryTitleRow}>
            <Text style={styles.entryTitle}>{title}</Text>
            {badge ? (
              <View style={styles.entryBadge}>
                <Text style={styles.entryBadgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.entrySub}>{subtitle}</Text>
        </View>
        <View style={styles.entryChevron}>
          <ChevronRight size={18} color={greenDark} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

/** A small square chevron button for the queue pager header (prev/next). */
function PagerChevron({
  dir,
  disabled,
  onPress,
}: {
  dir: 'prev' | 'next';
  disabled?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? t('mobile.labCards.prevItem') : t('mobile.labCards.nextItem')}
      style={[styles.pagerChevron, disabled && { opacity: 0.35 }]}
    >
      {dir === 'prev' ? (
        <ChevronLeft size={18} color={greenDark} />
      ) : (
        <ChevronRight size={18} color={greenDark} />
      )}
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[styles.primaryBtn, disabled && { opacity: 0.6 }]}>
        {icon}
        <Text style={styles.primaryBtnText}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

export function GhostButton({
  label,
  onPress,
  small,
  icon,
}: {
  label: string;
  onPress: () => void;
  small?: boolean;
  icon?: React.ReactNode;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[styles.ghostBtn, small && styles.ghostBtnSmall, icon != null && styles.ghostBtnIcon]}>
        {icon}
        <Text style={styles.ghostBtnText}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

/* ── Fallback for unknown card types ──────────────────────────────────────── */

function LabUnknownCard({ type }: { type: string }) {
  const { t } = useTranslation();
  if (!__DEV__) return null; // silent in prod — forward-compatible
  return (
    <CardShell title={t('mobile.labCards.unsupportedCard')}>
      <Text style={styles.muted}>{t('mobile.labCards.noRenderer', { type })}</Text>
    </CardShell>
  );
}

/* ── Card registry (dispatch by data.type) ────────────────────────────────── */

type CardComponent = (p: CardProps) => React.ReactElement | null;

const REGISTRY: Record<string, CardComponent> = {
  product_list: LabProductCardList,
  product: LabProductDetailCard,
  overview: LabOverviewCard,
  catalog_summary: LabCatalogSummaryCard,
  batch_list: LabBatchListCard,
  seller_summary: LabSellerActivityCard,
  seller_activity: LabSellerActivityCard,
  platform_info: LabPlatformInfoCard,
  listing_draft: LabListingDraftCard,
  listing_created: LabListingCreatedCard,
  listing_queue: LabListingQueueCard,
  listing_group_choice: LabListingGroupChoiceCard,
  listing_batch_result: LabBatchResultCard,
  listing_entry_options: LabListingEntryOptionsCard,
  listing_gate: LabGateCard,
  wtb_gate: LabGateCard,
  wtb_draft: LabWtbDraftCard,
  wtb_request: LabWtbRequestCard,
  wtb_request_list: LabWtbListCard,
  wtb_matches: LabWtbMatchesCard,
  handoff: LabHandoffCard,
};

/**
 * Render one card by wire `type` (05-mobile-ux §4 dispatch). `bid_list`
 * disambiguates by `mode` (buyer → own bids, seller → received) per the catalog
 * gotcha. Unknown types render a dev-only fallback (silent in prod). Any render
 * error is caught by the thread's per-card boundary — never crashes the stream.
 */
export function renderCard(
  type: string,
  data: unknown,
  ctx: {
    mode?: 'buyer' | 'seller';
    onSend?: (text: string) => void;
    /** Opens the native picker action sheet from the entry-options card. */
    onUploadPress?: () => void;
    /** Opens the native edit sheet for a listing_draft card (threaded through). */
    onEditDraft?: (data: unknown) => void;
    /* Multi-product batch callbacks (additive; queue/group_choice/batch_result). */
    onJumpProduct?: (index: number) => void;
    onAdvanceProduct?: (dir: 'prev' | 'next', currentIndex: number, total: number) => void;
    onCombineProducts?: () => void;
    onSplitProducts?: () => void;
    onPublishBatch?: () => void;
    batchBusy?: boolean;
  },
): React.ReactElement | null {
  if (type === 'bid_list' || type === 'received_bids') {
    const Comp = ctx.mode === 'seller' || type === 'received_bids' ? LabReceivedBidsCard : LabBidListCard;
    return <Comp data={data} mode={ctx.mode} onSend={ctx.onSend} />;
  }
  const Comp = REGISTRY[type];
  if (!Comp) return <LabUnknownCard type={type} />;
  return (
    <Comp
      data={data}
      mode={ctx.mode}
      onSend={ctx.onSend}
      onUploadPress={ctx.onUploadPress}
      onEditDraft={ctx.onEditDraft}
      onJumpProduct={ctx.onJumpProduct}
      onAdvanceProduct={ctx.onAdvanceProduct}
      onCombineProducts={ctx.onCombineProducts}
      onSplitProducts={ctx.onSplitProducts}
      onPublishBatch={ctx.onPublishBatch}
      batchBusy={ctx.batchBusy}
    />
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.regular, fontSize: 13, color: brand.mutedForeground },
  bold: { fontFamily: fonts.bold },
  rowChips: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  rowChipsWrap: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },

  // Product
  product: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
    padding: spacing.lg,
    ...elevation.sm,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  productBody: { flex: 1, minWidth: 0 },
  productName: { fontFamily: fonts.bold, fontSize: 15, color: brand.foreground },
  productPrice: { fontFamily: fonts.semibold, fontSize: 13, color: greenDark, marginTop: 6 },

  // Identify / soft cards
  softCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
    padding: spacing.lg,
    ...elevation.sm,
  },
  identifyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  identifyText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: brand.foreground, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },

  // Detail
  detailTitle: { fontFamily: fonts.bold, fontSize: 15, color: brand.foreground },
  detailDesc: { fontFamily: fonts.regular, fontSize: 13, color: brand.textMuted, marginTop: 4, lineHeight: 19 },

  // Stats
  statGrid: { flexDirection: 'row', gap: spacing.md },
  statTile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    padding: spacing.md,
  },
  statTileAccent: { borderColor: brand.successBorder, backgroundColor: brand.successBg },
  statValue: { fontFamily: fonts.headingBold, fontSize: 28, color: brand.foreground },
  statLabel: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: brand.mutedForeground, marginTop: 4 },
  bigStat: { fontFamily: fonts.headingBold, fontSize: 28, color: brand.foreground },
  catalogTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  facetLabel: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: brand.mutedForeground },
  facetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  facetChipText: { fontFamily: fonts.semibold, fontSize: 12, color: brand.foreground },
  facetChipCount: { fontFamily: fonts.bold, fontSize: 11, color: brand.mutedForeground },

  // List rows (batch/bid/seller)
  listRow: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.divider,
    padding: spacing.md,
    ...elevation.sm,
  },
  listRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  listRowTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, letterSpacing: -0.1, color: brand.foreground },
  listRowMeta: { fontFamily: fonts.regular, fontSize: 11, color: brand.mutedForeground, marginTop: spacing.xs },
  moreLine: { fontFamily: fonts.semibold, fontSize: 11, color: greenDark, textAlign: 'center', paddingTop: 6 },

  // Steps
  stepRow: { flexDirection: 'row', gap: 10 },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: brand.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: greenDark },
  stepTitle: { fontFamily: fonts.semibold, fontSize: 12, color: brand.foreground },
  stepDetail: { fontFamily: fonts.regular, fontSize: 11, color: brand.mutedForeground, marginTop: 2, lineHeight: 16 },

  // Draft — the seller centrepiece. Keeps overflow:'hidden' for the tinted
  // header band + rounded corners (clips the iOS shadow — accepted; the card
  // still lifts via Android elevation + the successBorder ring). Every block
  // indents from ONE 16px spine (spacing.lg).
  draftCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.surface,
    overflow: 'hidden',
    paddingBottom: spacing.lg,
    ...elevation.md,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: brand.successBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  draftHeaderLead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  draftHeaderTitle: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: greenDark },
  draftHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  draftThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: brand.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  draftHeroTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, color: brand.foreground },
  priceBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: brand.successBg,
    borderLeftWidth: 3,
    borderLeftColor: greenMedium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  // Missing-price variant: same height/padding as the priced band, but amber —
  // a full-width "+ Add price" row (not a floating chip). PRESERVE: green band
  // only when a price exists.
  priceBarNeed: { backgroundColor: brand.warningBg, borderLeftColor: brand.warning },
  priceText: { fontFamily: fonts.headingBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, color: greenDarkest },
  priceCurrency: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.6, color: greenDark },
  needChipText: { fontFamily: fonts.semibold, fontSize: 15, color: brand.warningText },
  detailList: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  detailListLabel: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: greenDark, marginBottom: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: brand.divider },
  detailKey: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: brand.textMuted },
  detailVal: { flex: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: -0.1, color: brand.foreground },
  meter: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.sm, backgroundColor: brand.surfaceMuted, padding: spacing.md },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meterLabel: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, color: brand.mutedForeground },
  meterCount: { fontFamily: fonts.headingBold, fontSize: 15, color: greenDark },
  meterNeeds: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: brand.warningText, textAlign: 'left', marginTop: spacing.xs },
  meterReady: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: greenDark, marginTop: spacing.xs },
  meterTrack: { height: 8, borderRadius: radius.full, backgroundColor: brand.border, marginTop: spacing.sm, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: radius.full },
  draftFooter: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: brand.divider,
    backgroundColor: brand.successBg,
  },
  draftPublishWrap: { alignSelf: 'stretch' },
  // Edit-details affordance band — indents from the same 16px spine as the rest
  // of the card, sits above the Publish footer. Full-width so it reads as a
  // secondary action, not a floating chip.
  draftEditWrap: { marginTop: spacing.md, paddingHorizontal: spacing.lg },

  // Created
  createdCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.successBg,
    padding: spacing.lg,
    ...elevation.md,
  },
  createdHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  createdCoin: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: greenMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createdEyebrow: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: greenDark, marginBottom: 2 },
  createdTitle: { fontFamily: fonts.heading, fontSize: 16, color: brand.foreground },
  createdMeta: { fontFamily: fonts.regular, fontSize: 13, color: brand.mutedForeground, marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.surface,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: greenDark },

  // Entry options
  entryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...elevation.sm,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryChevron: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: { fontFamily: fonts.semibold, fontSize: 14, color: brand.foreground },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  entryBadge: {
    borderRadius: radius.sm,
    backgroundColor: brand.successBg,
    borderWidth: 1,
    borderColor: brand.successBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  entryBadgeText: { fontFamily: fonts.label, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase', color: greenDark },
  entrySub: { fontFamily: fonts.regular, fontSize: 12, color: brand.mutedForeground, marginTop: 2 },

  // Queue overview (multi-product pager)
  queuePager: { flexDirection: 'row', gap: 6 },
  pagerChevron: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.divider,
    backgroundColor: brand.surface,
    padding: spacing.md,
    ...elevation.sm,
  },
  queueRowActive: { borderColor: brand.successBorder, backgroundColor: brand.successBg },
  queueThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  queueRowTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: brand.foreground },
  queuePublishWrap: { marginTop: spacing.md },

  // Batch result — skipped roster
  skipWrap: {
    marginTop: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.warning,
    backgroundColor: brand.warningBg,
    padding: spacing.md,
  },
  skipHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  skipHeadText: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: brand.warningText },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.warning,
    backgroundColor: brand.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipRowTitle: { fontFamily: fonts.semibold, fontSize: 13, color: brand.foreground },
  skipRowNeeds: { fontFamily: fonts.regular, fontSize: 11, color: brand.warningText, marginTop: 2 },

  // Gate
  gateCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.successBg,
    padding: spacing.lg,
    ...elevation.sm,
  },
  gateTitle: { fontFamily: fonts.bold, fontSize: 14, color: brand.foreground },
  gateSub: { fontFamily: fonts.regular, fontSize: 12, color: brand.mutedForeground, marginTop: 4, lineHeight: 18 },

  // WTB
  wtbHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  wtbHeaderText: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: greenDark },
  wtbTeaser: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  wtbTeaserText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: brand.mutedForeground },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: greenDark,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  ghostBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ghostBtnSmall: { paddingHorizontal: 12, paddingVertical: 10 },
  ghostBtnIcon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ghostBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: greenDark },
});
