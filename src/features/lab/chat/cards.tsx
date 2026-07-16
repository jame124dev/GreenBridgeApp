// Response cards for the (lab) chat thread — RN ports of the web
// `aiChatShared.tsx` / `WtbCards.tsx` / `IdentifyConfirmCard.tsx` cards, adapted
// to the mobile tokens + recipes. Each card is defensive: a malformed payload
// renders the fields that parsed and never throws (05-mobile-ux §4, "never crash
// the thread on a bad frame"). Interactive cards fire follow-up turns via the
// `onSend` callback (mirrors the web Save/Confirm/View actions which send a
// natural-language message so the agent calls the tool).
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
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
  ImageOff,
  ImagePlus,
  Layers,
  Mail,
  Minus,
  PencilLine,
  PartyPopper,
  Plus,
  Sparkles,
} from 'lucide-react-native';

import { AppImage } from '@/components/ui';
import { fonts, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useWantMutations } from '@/features/lab/hooks/useWantMutations';
import type { WtbRequestData } from '@/features/lab/data/wtbApi';
import { usePressScale, useProgress } from '@/animations/recipes';
import { createThemedStyles, useColor, useTheme } from './theme';
import { CardRegistry } from './registries/cardRegistry';
import {
  CardShell,
  Chip,
  cleanTitle,
  condLabel,
  countryLabel,
  formatValue,
  isBlankValue,
  num,
  relTime,
  StatusChip,
  useStatusTints,
} from './cardKit';
import type { GroupChoiceData, QueueData, QueueItem } from './types/cardPayloads';
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
    // cleanTitle repairs legacy WP mojibake (e.g. U+0097 → '-') so catalog names
    // never render a "tofu" box; `|| undefined` preserves the absent-name semantics.
    name: cleanTitle((o.name ?? o.title ?? o.product_name) as string | undefined) || undefined,
    image: (o.image ?? o.image_url ?? o.imageUrl) as string | null | undefined,
    condition: (o.condition ?? o.item_condition) as string | null | undefined,
    country: o.country as string | null | undefined,
    price: (o.price ?? o.price_per_unit) as number | null | undefined,
    currency: o.currency as string | null | undefined,
  };
}

export function LabProductCard({ row, onPress }: { row: ProductRow; onPress?: () => void }) {
  const { t } = useTranslation();
  const styles = useCardStyles();
  const accentIconMuted = useColor('accent.iconMuted');
  const { style, onPressIn, onPressOut } = usePressScale();
  // price is ~0%-populated across the catalog → keep it QUIET (never the hero,
  // never "$0"): a priced row shows the amount, everything else "Price on request".
  const priced = typeof row.price === 'number' && row.price > 0;
  return (
    <AnimatedPressable style={style} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <View style={styles.card}>
        {/* Image-first media band — a constant 4/3 tile so there is ZERO layout
            shift when the backend image fast-follow lands. Today every row is
            image-less → an on-brand placeholder (image wiring is a separate PR;
            resizeMode:'cover' will crop portrait photos — flag to that PR). */}
        <View style={styles.cardImage}>
          {row.image ? (
            <AppImage source={{ uri: row.image }} style={styles.cardImageFill} resizeMode="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <ImageOff size={26} color={accentIconMuted} />
              <Text style={styles.cardImageCaption}>{t('mobile.labCards.imagePending')}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={styles.cardName}>
            {row.name || t('mobile.labCards.untitledListing')}
          </Text>
          {/* condition + country are the RELIABLE, decision-relevant fields — the
              scannable weight of the card. Each chip renders only when present. */}
          {row.condition || row.country ? (
            <View style={styles.rowChips}>
              {row.condition ? <Chip tone="emerald">{condLabel(row.condition)}</Chip> : null}
              {row.country ? <Chip>{countryLabel(row.country)}</Chip> : null}
            </View>
          ) : null}
          {priced ? (
            <Text style={styles.cardPrice}>
              {`${row.currency ? `${row.currency} ` : ''}${row.price!.toLocaleString()}`}
            </Text>
          ) : (
            <Text style={styles.cardPriceMuted}>{t('mobile.labCards.priceOnRequest')}</Text>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

function LabProductCardList({ data, onSend }: CardProps) {
  const { t } = useTranslation();
  const styles = useCardStyles();
  const router = useRouter();
  const o = asObj(data);
  const rows = asArr(o.results ?? o.items ?? (Array.isArray(data) ? data : [])).map(toProductRow);
  const identified = asObj(o.identified);

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
    <View style={{ gap: spacing.md }}>
      {/* RESULTS eyebrow — the explicit named prose→evidence boundary (mirrors the
          CardShell / SourcesStrip eyebrow voice). Suppressed in the 0-row /
          identify-confirm / no-match branches (handled above). */}
      <Text style={styles.resultsEyebrow}>{t('mobile.labCards.resultsCount', { count: rows.length })}</Text>
      {rows.map((row, i) => {
        // Tapping a product opens the marketplace listing detail (like 101 Lab),
        // NOT an "ask the AI about it" follow-up. Prefer batchId (the buyer
        // marketplace route key); fall back to the product id if that's all we got.
        const detailId = row.batchId ?? row.id;
        return (
          <LabProductCard
            key={`${row.id ?? 'x'}-${i}`}
            row={row}
            onPress={
              detailId != null
                ? () => {
                    haptics.tap();
                    router.push({
                      pathname: '/(lab)/product/[id]',
                      params: { id: String(detailId), name: row.name ?? '' },
                    });
                  }
                : undefined
            }
          />
        );
      })}
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
  const styles = useCardStyles();
  const accentPressed = useColor('accent.pressed');
  return (
    <View style={styles.softCard}>
      <View style={styles.identifyRow}>
        <Sparkles size={16} color={accentPressed} />
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
  const styles = useCardStyles();
  const tints = useStatusTints();
  const o = asObj(data);
  if (o.found === false) {
    return (
      <CardShell title={t('mobile.labCards.listing')}>
        <Text style={styles.muted}>{t('mobile.labCards.listingNotFound')}</Text>
      </CardShell>
    );
  }
  const title = cleanTitle((o.title ?? o.name) as string | undefined);
  const desc = (o.description ?? o.post_content) as string | undefined;
  const tint = o.batch_status ? tints.batch(String(o.batch_status)) : null;
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
  const styles = useCardStyles();
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
  const styles = useCardStyles();
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
  const styles = useCardStyles();
  const tints = useStatusTints();
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
          const tint = tints.batch(b.status as string);
          const closes = relTime(b.end_date as string);
          return (
            <View key={i} style={styles.listRow}>
              <View style={styles.listRowTop}>
                <Text numberOfLines={1} style={styles.listRowTitle}>
                  {cleanTitle(b.name as string) ||
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
  const styles = useCardStyles();
  const tints = useStatusTints();
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
          const tint = tints.batch(b.status as string);
          return (
            <View key={i} style={styles.listRow}>
              <View style={styles.listRowTop}>
                <Text numberOfLines={1} style={styles.listRowTitle}>
                  {cleanTitle((b.name ?? b.title) as string) ||
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
  const styles = useCardStyles();
  const tints = useStatusTints();
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
          const tint = tints.bid((b.bid_status ?? b.status) as string);
          const when = relTime((b.submitted_at ?? b.placed_at) as string);
          const amount = (b.bid_amount ?? b.amount) as number | undefined;
          return (
            <View key={i} style={styles.listRow}>
              <View style={styles.listRowTop}>
                <Text numberOfLines={1} style={styles.listRowTitle}>
                  {cleanTitle((b.batch_name ?? b.product_name) as string) || t('mobile.labCards.listing')}
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
  const styles = useCardStyles();
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
  const styles = useCardStyles();
  // Icon + status-chip tints (D2 semantic tokens); the "not ready" chip and the
  // amber meter read Phase-1 compat bridges where D1 has no token.
  const theme = useTheme();
  const accentPressed = useColor('accent.pressed');
  const textMuted = useColor('text.muted');
  const surfaceAlt = useColor('surface.alt');
  const meterFull = useColor('status.success');
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
  const meterColor = pct < 100 ? theme.compat['accent.meterWarn'] : meterFull;

  return (
    <View style={styles.draftCard}>
      <View style={styles.draftHeader}>
        <View style={styles.draftHeaderLead}>
          <Sparkles size={13} color={accentPressed} />
          <Text style={styles.draftHeaderTitle}>{t('mobile.labCards.listingDraft')}</Text>
        </View>
        <StatusChip
          label={ready ? t('mobile.labCards.ready') : t('mobile.labCards.draft')}
          color={ready ? accentPressed : textMuted}
          bg={ready ? theme.compat['status.successSurface'] : surfaceAlt}
        />
      </View>

      <View style={styles.draftHero}>
        <View style={styles.draftThumb}>
          {image ? (
            <AppImage source={{ uri: image }} style={styles.thumbImg} />
          ) : (
            <Sparkles size={26} color={accentPressed} />
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
            icon={<PencilLine size={15} color={accentPressed} />}
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
  const styles = useCardStyles();
  const accentPressed = useColor('accent.pressed');
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
            {cleanTitle((o.name ?? o.title) as string) || t('mobile.labCards.listingLive')}
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
          <ArrowUpRight size={14} color={accentPressed} />
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
  const styles = useCardStyles();
  const theme = useTheme();
  const accentPressed = useColor('accent.pressed');
  const textMuted = useColor('text.muted');
  const accentIconMuted = useColor('accent.iconMuted');
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
                  <Sparkles size={18} color={accentIconMuted} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={styles.queueRowTitle}>
                  {it.title || t('mobile.labCards.untitledItem')}
                </Text>
                <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                  {it.missing === 0 ? (
                    <StatusChip label={t('mobile.labCards.ready')} color={accentPressed} bg={theme.compat['status.successSurface']} />
                  ) : (
                    <StatusChip
                      label={t('mobile.labCards.needsCount', { count: it.missing })}
                      color={theme.compat['status.warningStrong']}
                      bg={theme.compat['status.warningSurface']}
                    />
                  )}
                </View>
              </View>
              {onJumpProduct ? <ChevronRight size={18} color={textMuted} /> : null}
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
  const styles = useCardStyles();
  const accentPressed = useColor('accent.pressed');
  const o = asObj(data) as Partial<GroupChoiceData>;
  const total = typeof o.total === 'number' ? o.total : asArr(o.items).length;
  const mode = o.mode;
  const firstFields = asObj(asObj(asObj(o.first_payload).draft).fields ?? asObj(o.first_payload).fields);
  const firstTitle = asObj(firstFields.product_title).value as string | undefined;

  return (
    <View style={styles.softCard}>
      <View style={styles.identifyRow}>
        <Layers size={16} color={accentPressed} />
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
          icon={<Layers size={18} color={accentPressed} />}
          title={t('mobile.labCards.reviewSeparately', { count: total })}
          subtitle={t('mobile.labCards.reviewSeparatelySub')}
          badge={mode === 'separate_default' ? t('mobile.labCards.suggested') : undefined}
          disabled={batchBusy || !onSplitProducts}
          onPress={() => onSplitProducts?.()}
        />
        <EntryOption
          icon={<Bookmark size={18} color={accentPressed} />}
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
  const styles = useCardStyles();
  const theme = useTheme();
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
            <AlertCircle size={14} color={theme.compat['status.warningStrong']} />
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
                  {onJumpProduct ? <ChevronRight size={16} color={theme.compat['status.warningStrong']} /> : null}
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
  const accentPressed = useColor('accent.pressed');
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      <EntryOption
        icon={<ImagePlus size={18} color={accentPressed} />}
        title={t('mobile.labCards.uploadPhotos')}
        subtitle={t('mobile.labCards.uploadPhotosSub')}
        onPress={() => onUploadPress?.()}
      />
      <EntryOption
        icon={<PencilLine size={18} color={accentPressed} />}
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
  const styles = useCardStyles();
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

/* Condition option codes (order mirrors the web `CONDITION_OPTIONS`); labels are
 * resolved from the shared `condLabel` map so we don't fork the i18n vocabulary. */
const WTB_CONDITION_CODES = ['new', 'refurbished', 'working'] as const;

/** Round up to a "nice" magnitude (100→100, 4200→5000) — mirrors web `nice()`. */
function niceRound(v: number): number {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

/** Three quick-budget tiers: adaptive around the priced preview matches, else the
 *  static [1k, 5k, 25k] fallback (ported from web `budgetQuickChips`). */
function budgetQuickChips(prices: number[]): number[] {
  const priced = prices.filter((n) => Number.isFinite(n) && n > 0);
  if (priced.length === 0) return [1000, 5000, 25000];
  const top = niceRound(Math.max(...priced) * 1.2);
  const tiers = [niceRound(top * 0.25), niceRound(top * 0.5), top];
  return [...new Set(tiers)].filter((n) => n > 0);
}

/** Compact money label for a budget chip: 25000→"25k", 1500000→"1.5m". */
function fmtBudget(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(2)}m`;
  if (v >= 1000) return `${+(v / 1000).toFixed(2)}k`;
  return String(v);
}

/** A toggle pill for a condition / budget option. Emerald when selected. */
function TogglePill({
  label,
  selected,
  onPress,
  a11yLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  a11yLabel: string;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  const styles = useCardStyles();
  return (
    <AnimatedPressable
      style={style}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel}
      hitSlop={4}
    >
      <View style={[styles.togglePill, selected && styles.togglePillOn]}>
        <Text style={[styles.togglePillText, selected && styles.togglePillTextOn]}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

/** [−] [n] [+] quantity stepper, floored at 1; empty renders the "any" placeholder. */
function QtyStepper({
  value,
  onChange,
}: {
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  const { t } = useTranslation();
  const styles = useCardStyles();
  const accentPressed = useColor('accent.pressed');
  const inputPlaceholder = useColor('input.placeholder');
  const dec = () => {
    haptics.tap();
    onChange(Math.max(1, (value === '' ? 1 : value) - 1));
  };
  const inc = () => {
    haptics.tap();
    onChange(value === '' ? 1 : value + 1);
  };
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={dec}
        style={styles.stepBtn}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labCards.wtbEdit.qtyDecrementA11y')}
      >
        <Minus size={16} color={accentPressed} />
      </Pressable>
      <TextInput
        style={styles.stepInput}
        value={value === '' ? '' : String(value)}
        onChangeText={(txt) => {
          const digits = txt.replace(/[^0-9]/g, '');
          onChange(digits === '' ? '' : Math.max(1, Number(digits)));
        }}
        keyboardType="number-pad"
        placeholder={t('mobile.labCards.wtbEdit.anyPlaceholder')}
        placeholderTextColor={inputPlaceholder}
        accessibilityLabel={t('mobile.labCards.wtbEdit.quantityLabel')}
      />
      <Pressable
        onPress={inc}
        style={styles.stepBtn}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labCards.wtbEdit.qtyIncrementA11y')}
      >
        <Plus size={16} color={accentPressed} />
      </Pressable>
    </View>
  );
}

/** Uppercase field label with a lowercase "(optional)" suffix. */
function FieldLabel({ text }: { text: string }) {
  const { t } = useTranslation();
  const styles = useCardStyles();
  return (
    <Text style={styles.wtbFieldLabel}>
      {text} <Text style={styles.wtbFieldOptional}>{t('mobile.labCards.wtbEdit.optionalSuffix')}</Text>
    </Text>
  );
}

function LabWtbDraftCard({ data }: CardProps) {
  const { t } = useTranslation();
  const styles = useCardStyles();
  // WTB presentation + input tints (D2 / R1 input tokens).
  const accentPressed = useColor('accent.pressed');
  const inputPlaceholder = useColor('input.placeholder');
  const router = useRouter();
  const { createWant, isCreating } = useWantMutations();
  const o = asObj(data);
  const f = asObj(o.draft);
  const keywords = asArr(f.keywords) as string[];
  const preview = asArr(o.preview_matches ?? o.immediate_matches);

  // Editable state, seeded from whatever the AI recognised (05-mobile-ux; mirrors
  // the web `WtbDraftCard` seeds). Empty condition set == "Any".
  const [conditions, setConditions] = useState<string[]>(() =>
    (asArr(f.condition_wanted) as unknown[]).filter((c): c is string => typeof c === 'string'),
  );
  const [maxPrice, setMaxPrice] = useState<string>(f.max_price != null ? String(f.max_price) : '');
  const [qty, setQty] = useState<number | ''>(typeof f.quantity === 'number' ? f.quantity : '');
  const [result, setResult] = useState<WtbRequestData | null>(null);

  // Quick-budget tiers from any priced preview matches (else the 1k/5k/25k fallback).
  const previewPrices = preview.map((m) => {
    const row = toProductRow(m);
    return typeof row.price === 'number' ? row.price : Number(row.price);
  });
  const budgetChips = budgetQuickChips(previewPrices);

  const toggleCond = (code: string) =>
    setConditions((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const handleSave = async () => {
    if (isCreating || result) return;
    haptics.tap();
    // Spread the whole draft, then overlay the edited buyer choices. `site_type`
    // must NEVER go in the body (create schema is `extra='forbid'`) — it's a header.
    const draft = { ...f } as Record<string, unknown>;
    delete draft.site_type;
    try {
      const created = await createWant({
        ...draft,
        title: (f.title as string) ?? '',
        condition_wanted: conditions.length ? conditions : undefined,
        max_price: maxPrice.trim() === '' ? undefined : Number(maxPrice),
        quantity: qty === '' ? undefined : Number(qty),
      });
      haptics.success();
      setResult(created);
    } catch {
      haptics.error();
      toast.error(t('mobile.labCards.wtbEdit.saveError'));
    }
  };

  // ── Post-save: pending-approval affordance (replaces the bare "Saved" state) ──
  if (result) {
    const req = result.request;
    const title = req.title || t('mobile.labCards.yourWant');
    const matches = result.matches.map(toProductRow);
    const status = (req.status ?? '').toLowerCase();
    const pending = status === 'paused' || status === 'pending';
    const body1 = pending
      ? t('mobile.labCards.wtbEdit.pendingBody')
      : matches.length > 0
        ? matches.length === 1
          ? t('mobile.labCards.matchesNowOne', { count: matches.length })
          : t('mobile.labCards.matchesNowOther', { count: matches.length })
        : t('mobile.labCards.noMatchesYetNotify');
    const body2 = pending
      ? t('mobile.labCards.wtbEdit.pendingEmail')
      : t('mobile.labCards.wtbEdit.activeEmail');
    return (
      <View style={styles.createdCard}>
        <View style={styles.identifyRow}>
          <Check size={16} color={accentPressed} />
          <Text style={[styles.createdTitle, { flex: 1 }]}>
            {pending
              ? t('mobile.labCards.wtbEdit.sentForApproval', { title })
              : t('mobile.labCards.savedAlertAbout', { title })}
          </Text>
        </View>
        <Text style={[styles.muted, { marginTop: spacing.sm }]}>{body1}</Text>
        <View style={styles.wtbEmailRow}>
          <Mail size={14} color={accentPressed} />
          <Text style={styles.wtbEmailText}>{body2}</Text>
        </View>
        <Pressable
          style={styles.linkRow}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labCards.wtbEdit.viewInMyWantsA11y')}
          onPress={() => {
            haptics.tap();
            router.push('/(lab)/(tabs)/matches');
          }}
        >
          <Text style={styles.linkText}>{t('mobile.labCards.wtbEdit.viewInMyWants')}</Text>
          <ChevronRight size={15} color={accentPressed} />
        </Pressable>
        {matches.length > 0 ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {matches.map((m, i) => (
              <LabProductCard key={`${m.id ?? 'x'}-${i}`} row={m} />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // ── Edit state: title + tags, then editable condition / budget / quantity ──
  return (
    <View style={styles.softCard}>
      <View style={styles.wtbHeader}>
        <Bookmark size={14} color={accentPressed} />
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

      {/* Condition — multi-select pills + an "Any" clear-all pseudo-option. */}
      <View style={styles.wtbField}>
        <FieldLabel text={t('mobile.labCards.wtbEdit.conditionLabel')} />
        <View style={styles.pillWrap}>
          {WTB_CONDITION_CODES.map((code) => (
            <TogglePill
              key={code}
              label={condLabel(code)}
              selected={conditions.includes(code)}
              onPress={() => toggleCond(code)}
              a11yLabel={t('mobile.labCards.wtbEdit.conditionPillA11y', { label: condLabel(code) })}
            />
          ))}
          <TogglePill
            label={t('mobile.labCards.wtbEdit.conditionAny')}
            selected={conditions.length === 0}
            onPress={() => setConditions([])}
            a11yLabel={t('mobile.labCards.wtbEdit.conditionAnyA11y')}
          />
        </View>
      </View>

      {/* Budget — free "≤ $" input + adaptive quick chips. */}
      <View style={styles.wtbField}>
        <FieldLabel text={t('mobile.labCards.wtbEdit.budgetLabel')} />
        <View style={styles.budgetInputWrap}>
          <Text style={styles.budgetPrefix}>{t('mobile.labCards.wtbEdit.budgetPrefix')}</Text>
          <TextInput
            style={styles.budgetInput}
            value={maxPrice}
            onChangeText={(txt) => setMaxPrice(txt.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={t('mobile.labCards.wtbEdit.anyPlaceholder')}
            placeholderTextColor={inputPlaceholder}
            accessibilityLabel={t('mobile.labCards.wtbEdit.budgetFieldA11y')}
          />
        </View>
        <View style={styles.pillWrap}>
          {budgetChips.map((v) => {
            const label = t('mobile.labCards.wtbEdit.budgetChip', { value: fmtBudget(v) });
            return (
              <TogglePill
                key={v}
                label={label}
                selected={maxPrice !== '' && Number(maxPrice) === v}
                onPress={() => setMaxPrice(String(v))}
                a11yLabel={label}
              />
            );
          })}
        </View>
      </View>

      {/* Quantity — floored-at-1 stepper. */}
      <View style={styles.wtbField}>
        <FieldLabel text={t('mobile.labCards.wtbEdit.quantityLabel')} />
        <QtyStepper value={qty} onChange={setQty} />
      </View>

      <View style={styles.wtbTeaser}>
        <Sparkles size={14} color={accentPressed} />
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
          label={isCreating ? t('mobile.labCards.wtbEdit.saving') : t('mobile.labCards.saveAlertMe')}
          icon={<Bell size={16} color="#fff" />}
          disabled={isCreating}
          onPress={handleSave}
        />
      </View>
    </View>
  );
}

function LabWtbRequestCard({ data }: CardProps) {
  const { t } = useTranslation();
  const styles = useCardStyles();
  const accentPressed = useColor('accent.pressed');
  const o = asObj(data);
  const req = asObj(o.request);
  const title = (req.title ?? o.title) as string | undefined;
  const matches = asArr(o.matches ?? o.immediate_matches).map(toProductRow);
  return (
    <View style={styles.createdCard}>
      <View style={styles.identifyRow}>
        <Check size={16} color={accentPressed} />
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
  const styles = useCardStyles();
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
  const styles = useCardStyles();
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
  const styles = useCardStyles();
  const o = asObj(data);
  const msg = (o.message as string) || t('mobile.labCards.connectingPerson');
  const accentPressed = useColor('accent.pressed');
  return (
    <View style={styles.softCard}>
      <View style={styles.identifyRow}>
        <Gavel size={16} color={accentPressed} />
        <Text style={styles.identifyText}>{msg}</Text>
      </View>
    </View>
  );
}

/* ── Small building blocks ────────────────────────────────────────────────── */

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const styles = useCardStyles();
  const accentColor = useColor('accent');
  return (
    <View style={[styles.statTile, accent && styles.statTileAccent]}>
      <Text style={[styles.statValue, accent && { color: accentColor }]}>{value}</Text>
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
  const styles = useCardStyles();
  const accentPressed = useColor('accent.pressed');
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
          <ChevronRight size={18} color={accentPressed} />
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
  const styles = useCardStyles();
  const accentPressed = useColor('accent.pressed');
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
        <ChevronLeft size={18} color={accentPressed} />
      ) : (
        <ChevronRight size={18} color={accentPressed} />
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
  const styles = useCardStyles();
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
  const styles = useCardStyles();
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
  const styles = useCardStyles();
  if (!__DEV__) return null; // silent in prod — forward-compatible
  return (
    <CardShell title={t('mobile.labCards.unsupportedCard')}>
      <Text style={styles.muted}>{t('mobile.labCards.noRenderer', { type })}</Text>
    </CardShell>
  );
}

/* ── Card registry (A4 §9 — dispatch by data.type via registration) ───────── */

// PR-9: the dispatch table is a formal CardRegistry (register/resolve), not a
// literal switch/map — a new card type is one `register()` call. `bid_list`
// stays a mode-disambiguated special case in `renderCard` (it picks a renderer
// by `ctx.mode`, which a type→renderer map can't express).
export const cardRegistry = new CardRegistry<CardProps>().registerAll({
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
});

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
  const Comp = cardRegistry.resolve(type);
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

// PR-3B-0 plumbing: the shared card stylesheet comes from the reusable
// themed-style builder. Per-family token swaps land one PR at a time; keys not
// yet migrated stay on `theme.ts` constants (still pixel-identical). Migrated so
// far: cardKit primitives (PR-3B-1), listing-draft family (PR-3B-2 — draftCard/
// meter/price + createdCard cluster), product family (PR-3B-3 — product/thumb),
// stat/overview/catalog family (PR-3B-4 — statTile/bigStat/facet), buttons +
// entry options + gate (PR-3B-5), list/batch/seller (PR-3B-6 — listRow/moreLine),
// multi-product (PR-3B-7 — queue/pager/skip), WTB/soft-card cluster (PR-3B-8 —
// soft/detail/steps/muted + WTB presentation). Only the PR-8-reserved WTB input
// controls (lab.* inputs, toggle pill, stepper, field labels) + 2 untokenized
// primaryAccent placeholder icons remain on legacy constants. Each card reads
// `useCardStyles()`.
const useCardStyles = createThemedStyles((t) => ({
  muted: { fontFamily: fonts.regular, fontSize: 13, color: t.color['text.muted'] },
  bold: { fontFamily: fonts.bold },
  rowChips: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  rowChipsWrap: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },

  // ── Image-first product card (redesigned) ──────────────────────────────────
  // RESULTS eyebrow — the named prose→evidence boundary; unified eyebrow voice.
  resultsEyebrow: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: t.color['text.muted'],
    marginBottom: spacing.sm,
  },
  // Vertical tile: media band butts the body (no padding on the container; the
  // body owns padding); overflow clips the media to the rounded corners; the
  // elevation floats it above the flat prose bubble.
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    backgroundColor: t.color['surface.raised'],
    overflow: 'hidden',
    ...t.elevation('raised'),
  },
  // Constant 4/3 media band in BOTH states → zero layout shift when images land.
  cardImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: t.color['surface.alt'] },
  cardImageFill: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  cardImageCaption: {
    fontFamily: fonts.label,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: t.color['text.muted'],
  },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  // Hero of the text zone (matches draftHeroTitle's 17) — fixes "small fonts".
  cardName: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: t.color['text.primary'],
  },
  cardPrice: { fontFamily: fonts.semibold, fontSize: 15, color: t.color['accent.pressed'] },
  cardPriceMuted: { fontFamily: fonts.regular, fontSize: 13, color: t.color['text.muted'] },

  // Legacy thumb keys — STILL used by LabListingQueueCard / LabListingDraftCard.
  // (The old `product`/`productBody`/`productName`/`productPrice` keys were
  // retired with the image-first redesign; thumb/thumbImg are preserved.)
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: t.color['surface.alt'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },

  // Identify / soft cards (PR-3B-8)
  softCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    backgroundColor: t.color['surface.raised'],
    padding: spacing.lg,
    ...t.elevation('raised'),
  },
  identifyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  identifyText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: t.color['text.primary'], lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },

  // Detail (PR-3B-8)
  detailTitle: { fontFamily: fonts.bold, fontSize: 15, color: t.color['text.primary'] },
  detailDesc: { fontFamily: fonts.regular, fontSize: 13, color: t.color['text.secondary'], marginTop: 4, lineHeight: 19 },

  // Stats (PR-3B-4)
  statGrid: { flexDirection: 'row', gap: spacing.md },
  statTile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    padding: spacing.md,
  },
  statTileAccent: { borderColor: t.compat['status.successBorder'], backgroundColor: t.compat['status.successSurface'] },
  statValue: { fontFamily: fonts.headingBold, fontSize: 28, color: t.color['text.primary'] },
  statLabel: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: t.color['text.muted'], marginTop: 4 },
  bigStat: { fontFamily: fonts.headingBold, fontSize: 28, color: t.color['text.primary'] },
  catalogTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  facetLabel: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: t.color['text.muted'] },
  facetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  facetChipText: { fontFamily: fonts.semibold, fontSize: 12, color: t.color['text.primary'] },
  facetChipCount: { fontFamily: fonts.bold, fontSize: 11, color: t.color['text.muted'] },

  // List rows (batch/bid/seller) (PR-3B-6)
  listRow: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.compat['border.divider'],
    padding: spacing.md,
    ...t.elevation('raised'),
  },
  listRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  listRowTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, letterSpacing: -0.1, color: t.color['text.primary'] },
  listRowMeta: { fontFamily: fonts.regular, fontSize: 11, color: t.color['text.muted'], marginTop: spacing.xs },
  moreLine: { fontFamily: fonts.semibold, fontSize: 11, color: t.color['accent.pressed'], textAlign: 'center', paddingTop: 6 },

  // Steps (PR-3B-8)
  stepRow: { flexDirection: 'row', gap: 10 },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: t.compat['status.successSurface'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: t.color['accent.pressed'] },
  stepTitle: { fontFamily: fonts.semibold, fontSize: 12, color: t.color['text.primary'] },
  stepDetail: { fontFamily: fonts.regular, fontSize: 11, color: t.color['text.muted'], marginTop: 2, lineHeight: 16 },

  // Draft — the seller centrepiece. Keeps overflow:'hidden' for the tinted
  // header band + rounded corners (clips the iOS shadow — accepted; the card
  // still lifts via Android elevation + the successBorder ring). Every block
  // indents from ONE 16px spine (spacing.lg).
  draftCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    backgroundColor: t.color['surface.raised'],
    overflow: 'hidden',
    paddingBottom: spacing.lg,
    ...t.elevation('overlay'),
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.compat['status.successSurface'],
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  draftHeaderLead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  draftHeaderTitle: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: t.color['accent.pressed'] },
  draftHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  draftThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: t.compat['status.successSurface'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  draftHeroTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, color: t.color['text.primary'] },
  priceBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: t.compat['status.successSurface'],
    borderLeftWidth: 3,
    borderLeftColor: t.color['status.success'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  // Missing-price variant: same height/padding as the priced band, but amber —
  // a full-width "+ Add price" row (not a floating chip). PRESERVE: green band
  // only when a price exists.
  priceBarNeed: { backgroundColor: t.compat['status.warningSurface'], borderLeftColor: t.color['status.warning'] },
  priceText: { fontFamily: fonts.headingBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, color: t.color['accent'] },
  priceCurrency: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.6, color: t.color['accent.pressed'] },
  needChipText: { fontFamily: fonts.semibold, fontSize: 15, color: t.compat['status.warningStrong'] },
  detailList: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  detailListLabel: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: t.color['accent.pressed'], marginBottom: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.compat['border.divider'] },
  detailKey: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: t.color['text.secondary'] },
  detailVal: { flex: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: -0.1, color: t.color['text.primary'] },
  meter: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.sm, backgroundColor: t.color['surface.alt'], padding: spacing.md },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meterLabel: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, color: t.color['text.muted'] },
  meterCount: { fontFamily: fonts.headingBold, fontSize: 15, color: t.color['accent.pressed'] },
  meterNeeds: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: t.compat['status.warningStrong'], textAlign: 'left', marginTop: spacing.xs },
  meterReady: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: t.color['accent.pressed'], marginTop: spacing.xs },
  meterTrack: { height: 8, borderRadius: radius.full, backgroundColor: t.color['border.subtle'], marginTop: spacing.sm, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: radius.full },
  draftFooter: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.compat['border.divider'],
    backgroundColor: t.compat['status.successSurface'],
  },
  draftPublishWrap: { alignSelf: 'stretch' },
  // Edit-details affordance band — indents from the same 16px spine as the rest
  // of the card, sits above the Publish footer. Full-width so it reads as a
  // secondary action, not a floating chip.
  draftEditWrap: { marginTop: spacing.md, paddingHorizontal: spacing.lg },

  // Created — shared with the WTB-result + batch-result states (same shell).
  // Migrating here makes those render theme-reactive early; pixel-identical since
  // every token resolves to the current value (their own families migrate later).
  createdCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    backgroundColor: t.compat['status.successSurface'],
    padding: spacing.lg,
    ...t.elevation('overlay'),
  },
  createdHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  createdCoin: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: t.color['status.success'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  createdEyebrow: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: t.color['accent.pressed'], marginBottom: 2 },
  createdTitle: { fontFamily: fonts.heading, fontSize: 16, color: t.color['text.primary'] },
  createdMeta: { fontFamily: fonts.regular, fontSize: 13, color: t.color['text.muted'], marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    backgroundColor: t.color['surface.raised'],
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: t.color['accent.pressed'] },

  // Entry options (PR-3B-5)
  entryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...t.elevation('raised'),
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    backgroundColor: t.compat['status.successSurface'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryChevron: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: t.color['surface.alt'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: { fontFamily: fonts.semibold, fontSize: 14, color: t.color['text.primary'] },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  entryBadge: {
    borderRadius: radius.sm,
    backgroundColor: t.compat['status.successSurface'],
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  entryBadgeText: { fontFamily: fonts.label, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase', color: t.color['accent.pressed'] },
  entrySub: { fontFamily: fonts.regular, fontSize: 12, color: t.color['text.muted'], marginTop: 2 },

  // Queue overview (multi-product pager) (PR-3B-7)
  queuePager: { flexDirection: 'row', gap: 6 },
  pagerChevron: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    backgroundColor: t.color['surface.raised'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.compat['border.divider'],
    backgroundColor: t.color['surface.raised'],
    padding: spacing.md,
    ...t.elevation('raised'),
  },
  queueRowActive: { borderColor: t.compat['status.successBorder'], backgroundColor: t.compat['status.successSurface'] },
  queueThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: t.color['surface.alt'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  queueRowTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: t.color['text.primary'] },
  queuePublishWrap: { marginTop: spacing.md },

  // Batch result — skipped roster (PR-3B-7)
  skipWrap: {
    marginTop: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.color['status.warning'],
    backgroundColor: t.compat['status.warningSurface'],
    padding: spacing.md,
  },
  skipHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  skipHeadText: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: t.compat['status.warningStrong'] },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.color['status.warning'],
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipRowTitle: { fontFamily: fonts.semibold, fontSize: 13, color: t.color['text.primary'] },
  skipRowNeeds: { fontFamily: fonts.regular, fontSize: 11, color: t.compat['status.warningStrong'], marginTop: 2 },

  // Gate (PR-3B-5)
  gateCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    backgroundColor: t.compat['status.successSurface'],
    padding: spacing.lg,
    ...t.elevation('raised'),
  },
  gateTitle: { fontFamily: fonts.bold, fontSize: 14, color: t.color['text.primary'] },
  gateSub: { fontFamily: fonts.regular, fontSize: 12, color: t.color['text.muted'], marginTop: 4, lineHeight: 18 },

  // WTB presentation (PR-3B-8)
  wtbHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  wtbHeaderText: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: t.color['accent.pressed'] },
  wtbTeaser: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  wtbTeaserText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: t.color['text.muted'] },
  // WTB editable-draft controls (R1: migrated off lab.*/brand to input.* + D1
  // tokens; light values identical → pixel-identical).
  wtbField: { marginTop: spacing.md, gap: 6 },
  wtbFieldLabel: { fontFamily: fonts.label, fontSize: 11, lineHeight: 14, letterSpacing: 1.0, textTransform: 'uppercase', color: t.color['accent.pressed'] },
  wtbFieldOptional: { fontFamily: fonts.regular, fontSize: 10, letterSpacing: 0, textTransform: 'none', color: t.color['text.muted'] },
  pillWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  togglePill: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    backgroundColor: t.color['surface.alt'],
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  togglePillOn: { borderColor: t.compat['status.successBorder'], backgroundColor: t.compat['status.successSurface'] },
  togglePillText: { fontFamily: fonts.semibold, fontSize: 12.5, color: t.color['text.muted'] },
  togglePillTextOn: { color: t.color['accent.pressed'] },
  budgetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.sm,
    borderWidth: 1.4,
    borderColor: t.color['input.border'],
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 12,
    minHeight: 42,
  },
  budgetPrefix: { fontFamily: fonts.semibold, fontSize: 14, color: t.color['text.muted'] },
  budgetInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: t.color['input.text'], paddingVertical: 8 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderWidth: 1.4,
    borderColor: t.color['input.border'],
    backgroundColor: t.color['surface.raised'],
    overflow: 'hidden',
  },
  stepBtn: { width: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  stepInput: {
    minWidth: 56,
    minHeight: 42,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.color['input.text'],
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: t.color['input.border'],
  },
  wtbEmailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
  wtbEmailText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: t.color['text.muted'] },

  // Buttons (PR-3B-5). primaryBtnText stays '#fff' — no D1 token yet;
  // TODO(Phase 2): map to color['text.onAccent'].
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: t.color['accent.pressed'],
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  ghostBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.compat['status.successBorder'],
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ghostBtnSmall: { paddingHorizontal: 12, paddingVertical: 10 },
  ghostBtnIcon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ghostBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: t.color['accent.pressed'] },
}));
