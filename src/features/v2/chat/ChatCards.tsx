/**
 * Chat cards, in v2 tokens.
 *
 * ── The gap this closes ──
 *
 * `app/v2/chat.tsx` mounted the shipped chat controller correctly — the stream,
 * the turn reducer and the committed history all work — but it reduced
 * `turn.cards` to a BOOLEAN and rendered one line of prose in its place:
 *
 *     "This answer came with a card the redesign has not drawn yet."
 *
 * So a buyer asking "show me used centrifuges" got a sentence saying results
 * existed, and no results. Found on device 2026-09-17.
 *
 * ── What is reused, and what is not ──
 *
 * The WORKING logic comes from the shipped implementation and is imported, not
 * copied: `toProductRow` normalises the several producty payload shapes the
 * wire uses (`product_list` rows, WTB matches, image-search results) and repairs
 * legacy WP mojibake in titles. Re-deriving that here is how the two surfaces
 * would drift.
 *
 * What is NOT reused is the PRESENTATION. `cards.tsx` renders through
 * `useCardStyles()` / `constants/theme`, i.e. the old design tokens, so dropping
 * those components into v2 chrome would put two design systems in one thread.
 * The rows below are the v2 kit's own `Row` / `RowThumb` / `Chip`.
 *
 * ── CHATBOT_RULES (workspace root) is mandatory here ──
 *
 * "Cap inline results to ~3–6 + one 'View all N results →' chip." `INLINE_MAX`
 * is 6, matching the shipped `INLINE_RESULTS_MAX`, so the two surfaces cap
 * identically. A thread is a conversation, not a catalogue.
 *
 * ── Three of 22 types are drawn, and the gap has a second edge ──
 *
 * `product_list`, `product`, `wtb_draft`. The fallback used to NAME the type it
 * could not draw, in the thread, for the reader — removed 2026-09-21 under
 * CHATBOT_RULES §8 (never expose internal names); it warns in `__DEV__` now.
 *
 * ⚠️ The dangerous half is not the missing card, it is `streamSanitizer`:
 * it DELETES a reply's field dump whenever a card is present, on the contract
 * that the card shows those facts. Ten of the types it strips for are types v2
 * does not draw, so the prose was being deleted for a card that then rendered
 * nothing. See `./drawnCards`, which is the guard, and its test.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { QuietAction, Row, RowThumb, RowTrailing, SectionHeader } from '@/features/v2/ui';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';
import { ImageIcon } from 'lucide-react-native';
import { toProductRow, type ProductRow } from '@/features/lab/chat/cards';
/*
  `condLabel` maps the wire's condition enum to a translated label —
  `usedFunctional` → "Used – functional". Without it the raw enum reaches the
  screen, which CHATBOT_RULES forbids ("never leak internals/raw IDs") and which
  is exactly what shipped in the first pass of this file: every result read
  "usedFunctional · UK" on device.

  It lives in `cardKit`, which imports the OLD theme — safe here because only the
  pure function is called, never a component, so no `ChatThemeProvider` is
  needed. `cards.tsx` is already in this module's graph for `toProductRow`.
*/
import { condLabel } from '@/features/lab/chat/cardKit';
import { haptics } from '@/lib/haptics';
import { NoMatchOffer, WantDraftCard } from './WantDraftCard';
// ⚠️ `.../chat/types/card`, not `.../chat/types` — a FILE `chat/types.ts` sits
// beside the DIRECTORY `chat/types/`, and the file wins resolution while
// exporting no `Card`. The directory's `index.ts` does re-export it, but nothing
// can reach that barrel by its folder name.
import type { Card } from '@/features/lab/chat/types/card';

/** Same cap as the shipped `INLINE_RESULTS_MAX`, per CHATBOT_RULES. */
const INLINE_MAX = 6;

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** "Refurbished · Netherlands · $9,400" — whichever of the three exist. */
function rowSubtitle(r: ProductRow): string | undefined {
  const price =
    r.price != null
      ? `${r.currency === 'TWD' ? 'NT$' : '$'}${Number(r.price).toLocaleString()}`
      : undefined;
  const parts = [condLabel(r.condition), r.country, price].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * ⚠️ A DECLARED EXIT FROM v2, like the notification bell.
 *
 * There is no v2 buyer product-detail screen — `/v2/listing/[id]` is the
 * SELLER's batch detail, a different thing entirely. So a result opens the
 * shipped `/(lab)/product/[id]`, which is the same compromise Browse makes by
 * being a WebView. A card that navigates nowhere would be worse.
 *
 * `v2Inventory.test.ts` enumerates v2's exits, so this one has to be declared
 * rather than quietly added.
 */
function openProduct(r: ProductRow) {
  const detailId = r.batchId ?? r.id;
  if (detailId == null) return;
  haptics.tap();
  router.push({
    pathname: '/(lab)/product/[id]',
    params: { id: String(detailId), name: r.name ?? '' },
  });
}

function ProductList({ data }: { data: unknown }) {
  const c = useV2Colors();
  const o = asObj(data);
  const rows = asArr(o.results ?? o.items ?? (Array.isArray(data) ? data : [])).map(toProductRow);

  if (rows.length === 0) {
    // The real save-a-want offer is `WantDraftCard`, dispatched on the assistant's
    // own `wtb_draft` frame. This is the fallback for an empty result set that
    // arrives WITHOUT one — it points at the composer rather than inventing a
    // want from the query, which is the shape the WTB data-quality review found
    // unusable. See `WantDraftCard`'s header.
    return <NoMatchOffer />;
  }

  const inline = rows.slice(0, INLINE_MAX);
  const overflow = rows.length - inline.length;

  return (
    <View style={styles.block}>
      {/* The named prose→evidence boundary, same voice as the shipped card. */}
      <SectionHeader title="Results" chip={String(rows.length)} />
      {inline.map((r, i) => (
        <Row
          key={`${r.id ?? 'x'}-${i}`}
          title={r.name || 'Untitled listing'}
          subtitle={rowSubtitle(r)}
          leading={
            <RowThumb uri={typeof r.image === 'string' && /^https?:\/\//.test(r.image) ? r.image : undefined}>
              <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
            </RowThumb>
          }
          trailing={<RowTrailing />}
          onPress={() => openProduct(r)}
          testID={`v2-chat-result-${r.id ?? i}`}
        />
      ))}
      {overflow > 0 ? (
        /*
          One chip, not a second wall of rows — CHATBOT_RULES again.
          ⚠️ It opens BROWSE rather than a pager: the shipped card pushes a
          `ProductPagerSheet` built on the old tokens, and v2 has no sheet of its
          own drawn. Browse is the honest destination for "all results" and
          stays inside v2. TODO(v2-design): a v2 results pager, if one is drawn.
        */
        <QuietAction
          label={`View all ${rows.length} results`}
          style={styles.overflow}
          onPress={() => {
            haptics.tap();
            router.push('/v2/browse');
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * The drawn-type set and its filter live in `./drawnCards` — a JSX-free module,
 * so the sanitizer contract can be tested against the REAL sanitizer without
 * importing the v2 UI barrel (which reaches an unlinkable native module in
 * Jest). Re-exported here because this switch is what defines the set.
 */
export { V2_DRAWN_CARD_TYPES, drawnCards } from './drawnCards';

/**
 * One card. An undrawn type is INVISIBLE to the reader and loud to us.
 *
 * ⚠️ This used to render *"This answer included a 'catalog_summary' card, which
 * v2 does not draw yet."* — into the conversation, for the buyer to read. The
 * intent was good (a vague "a card" tells nobody what to build next) but the
 * audience was wrong, and `CHATBOT_RULES` §8 is explicit: never expose internal
 * IDs or tool names. `catalog_summary` is a wire format. Seen on device
 * 2026-09-21 in a real answer.
 *
 * Losing it costs the reader nothing here: the assistant's prose already
 * carries the substance and the card is supplementary — in the observed case
 * the text said "1000 products, top categories …, mostly UK and US" and the
 * card would only have repeated it. If a type ever arrives whose card IS the
 * answer, draw that type; do not go back to narrating the gap.
 *
 * The signal moves to the console, where the person who can act on it is.
 */
function ChatCard({ card }: { card: Card }) {
  switch (card.type) {
    case 'product_list':
    case 'product':
      return <ProductList data={card.data} />;
    // CHATBOT_RULES §2: a no-match LEADS with the save-a-want offer. Until this
    // case existed the offer fell to `default` and the buyer read a sentence
    // written for a developer.
    case 'wtb_draft':
      return <WantDraftCard data={card.data} />;
    default:
      if (__DEV__) {
        console.warn(`[v2 chat] no card renderer for type "${card.type}" — falling through silently`);
      }
      return null;
  }
}

export function ChatCards({ cards }: { cards?: Card[] }) {
  if (!cards?.length) return null;
  return (
    <View style={styles.stack}>
      {cards.map((card, i) => (
        <ChatCard key={`${card.type}-${i}`} card={card} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `width: '100%'` on BOTH, and it is the whole reason the rows render.
   *
   * The thread's `rowLeft` is `{ alignItems: 'flex-start', width: '100%' }`, so
   * a child is SHRINK-WRAPPED to its intrinsic width unless it says otherwise —
   * which is why `prose` carries `width: '100%'` too. Without it here, `Row`'s
   * flex text column collapsed to about 100px and every result rendered as a
   * thumbnail, one character ("H…"), and a chevron. The accessibility label held
   * the full title the whole time, so a dump looked correct while the screen did
   * not: read the pixels, not the tree.
   */
  stack: { gap: space['5xl'], width: '100%' },
  /**
   * NO horizontal margin, and that is load-bearing.
   *
   * The thread's `rowLeft` is `width: '100%'` with NO padding — each child
   * applies its own (`prose` carries `paddingHorizontal: GUTTER`). `Row` already
   * carries its own gutter, so it is correct here full-bleed.
   *
   * ⚠️ It was `marginHorizontal: -GUTTER`, copied from Home's full-bleed
   * sections where the parent DOES pad. Against an unpadded parent that pulled
   * the rows 24dp off the left edge and took 48dp out of the text column, which
   * collapsed every title and subtitle to nothing: on device the thumbnails were
   * sliced by the screen edge and the rows rendered as image + chevron with no
   * words at all. A negative margin is only ever correct against a known padding.
   */
  block: { width: '100%' },
  /** The overflow chip is not a `Row`, so it needs the thread's own gutter. */
  overflow: { paddingHorizontal: GUTTER },
});
