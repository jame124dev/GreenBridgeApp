/**
 * COPIED from the Obytes template and adjusted in place.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/components/post-card.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * The structure is theirs and is unchanged: a pressable wrapping one bordered,
 * rounded, overflow-hidden card; a cover image across the top; a padded block
 * beneath with a title line and a truncated secondary line. What was adjusted:
 *
 * | Theirs | Ours | Why |
 * |---|---|---|
 * | `type Props = Post` | `BuyerBidItem` | our data, from `buyerApiSlice.ts:34` |
 * | `@/components/ui` | `@/features/v2/ui` | their kit is NativeWind; ours is the v2 kit |
 * | `className="..."` | `StyleSheet` + tokens | `v2Adherence.test.ts` fails the build on raw hex and on off-scale radius/spacing, so Tailwind classes cannot stay |
 * | a random Unsplash image | `products[0].images[0]` | they had no data; we do |
 * | `<Link href={/feed/${id}}>` | no link yet | a batch id is not a listing id — pressing it landed on the scan INTAKE screen, so the card is not pressable until a batch-detail screen exists |
 * | `body`, 3 lines | the money line + the meta line | what the screen is for: your bid against the top bid |
 *
 * ⚠️ The dark-mode half of their card (`dark:bg-neutral-900`) is not ported as
 * a variant — `useV2Colors()` already returns the right ground for the scheme,
 * so there is nothing to branch on.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/features/v2/ui';
import { radius, space, useV2Colors } from '@/theme/v2';

import {
  BATCH_STEPS,
  batchStepIndex,
  bidStatusLabel,
  isPending,
  isWon,
  type BuyerBidItem,
} from './types';

/** `12400` → `USD 12,400`. The API sends a string; never do arithmetic on it. */
function money(amount: string | undefined): string {
  if (!amount) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return `USD ${n.toLocaleString('en-US')}`;
}

/** `13250` → `13,250`. The currency is already said once on the same line. */
function shortMoney(amount: string | undefined): string {
  if (!amount) return '—';
  const n = Number(amount);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : amount;
}

/** `2026-09-18T09:12:00Z` → `18 Sep`. */
function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function BidCard(bid: BuyerBidItem) {
  const c = useV2Colors();
  /**
   * ⚠️ A URL IS NOT A PICTURE. Their card assumed `source={{uri}}` always
   * resolves; on the device a dead URL rendered as a silent empty grey box —
   * no error, no placeholder, just a hole where the machine should be. Real
   * listings carry dead and slow image URLs constantly, so a failed load has
   * to fall back to the same placeholder as a missing one.
   */
  const [failed, setFailed] = useState(false);

  const first = bid.products?.[0];
  const extra = Math.max(0, (bid.products?.length ?? 0) - 1);
  const batchRef = `Batch #${bid.batch_id}`;
  const title = first?.title ?? batchRef;
  const cover = first?.images?.[0];

  /**
   * Outbid is only meaningful while the bid is STILL LIVE. Testing
   * `!isWon(...)` made a rejected bid read "Outbid" instead of "Lost" — found
   * by reading the device's view tree.
   */
  const outbid =
    isPending(bid.status) &&
    bid.top_bid != null &&
    Number(bid.top_bid) > Number(bid.bid_amount);

  const chipLabel = outbid ? 'Outbid' : bidStatusLabel(bid.status);

  const stageIndex = batchStepIndex(bid.batch_step);
  const stage = stageIndex >= 0 ? BATCH_STEPS[stageIndex].label : null;
  /**
   * The batch reference is DROPPED from the meta line when the title already
   * is it. A product with no title falls back to `Batch #1029`, and the meta
   * line then repeated it verbatim one line below — seen on device, on the Won
   * tab. Two identical strings stacked read as a rendering fault, not as data.
   */
  const meta = [
    title === batchRef ? null : batchRef,
    extra > 0 ? `+${extra} more` : null,
    stage,
    shortDate(bid.bid_date),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    // flat: a content card, not a control — it is not pressable yet.
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairlineStrong }]}>
      {cover && !failed ? (
        <Image
          style={styles.cover}
          resizeMode="cover"
          source={{ uri: cover }}
          onError={() => setFailed(true)}
        />
      ) : (
        // Their card assumed an image always existed. Ours must not: the API
        // returns `images: []` regularly, and a card that collapses to a
        // borderless strip looks broken rather than image-less.
        // flat: a placeholder where a photograph would be, not a control.
        <View style={[styles.cover, styles.coverEmpty, { backgroundColor: c.fill }]}>
          <Text variant="caption" color="inkSubtle">
            No photo
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {/* `minWidth: 0` or a 90-character title pushes the chip off-screen. */}
          <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          <Chip label={chipLabel} tone={isWon(bid.status) ? 'accent' : 'neutral'} />
        </View>

        <Text variant="body" color="inkMuted" numberOfLines={1}>
          {outbid
            ? `Your bid ${money(bid.bid_amount)} · top ${shortMoney(bid.top_bid)}`
            : `Your bid ${money(bid.bid_amount)}`}
        </Text>
        <Text variant="caption" color="inkSubtle" numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Their `m-2 rounded-xl border overflow-hidden`, on our scale. */
  card: {
    marginBottom: space['3xl'],
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /**
   * Their `h-56` is 224dp — a browsing format, for a feed you scroll through
   * looking at pictures. This list is a CHECKING format: the question is "am
   * I still winning", and the photo is only there to say which machine. At
   * 170dp two bids filled the screen; at 102 you get three and a half, and
   * the money line is still the loudest thing on the card.
   */
  cover: { width: '100%', height: space['8xl'] * 3 },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  /** Their `p-2`, at our gutter. */
  body: { padding: space['4xl'], gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space['3xl'] },
  title: { flex: 1, minWidth: 0 },
});
