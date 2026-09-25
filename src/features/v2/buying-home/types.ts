/**
 * Buying home — "What needs my attention right now?"
 *
 * This is a COMPOSITION, built last on purpose (`README.md`): it surfaces
 * rows the four screens already built this session (`bids/`, `watchlist/`,
 * `inspections/`, `requests/`) define — never invented twice. Its own types
 * are therefore thin: derivations over data those modules already type, not
 * a new contract.
 *
 * Source: `nextjs-port/src/shared/pages/buyer/BuyerDashboard.tsx` (1,103
 * lines). Per the plan's own instruction — "Leave these: the 1,103-line
 * layout, almost none of it is decision-making. Take these: which three
 * things the web decided are worth surfacing first" — this ports the
 * EDITORIAL JUDGEMENT (what to put first, and why), not the file.
 *
 * ── WHAT WAS TAKEN ──
 *
 * `ActionRequired` (`BuyerDashboard.tsx:330-405`) — three kinds of urgency,
 * verbatim thresholds: a won bid at `batch_step === 6` (payment not yet
 * confirmed), a won bid at `batch_step === 7` (payment confirmed, ready for
 * pickup), and an inspection within the next 7 days that has not been
 * attended. `BATCH_STEPS`/`isPending` are reused from `bids/types.ts` rather
 * than redeclared — same vocabulary, same source of truth.
 *
 * ── WHAT WAS DELIBERATELY NOT TAKEN, AND WHY ──
 *
 * **The AI-assistant hero and its prompt bar** (`DashboardHero`,
 * `InlineAssistant`, `:527-536`). Opening a chat surface IS this app's
 * `/v2/chat` — duplicating an entry point to it here would be a second front
 * door to the same room, and no v2 dashboard screen wires the assistant in.
 *
 * **Want-To-Buy ("Open requests", the THIRD stat tile, `:559-565`).** The web
 * counts `wants` from a completely separate WTB feature
 * (`shared/components/ai/wtbApi.ts`) — nothing to do with the "Orders &
 * requests" screen this session built, despite the near-identical name. No
 * v2 WTB screen exists, so there is nothing to link that tile to. Renamed
 * the summary row to what this app actually has: **Orders & requests**
 * (Buy Now + Offers), pointing at `requests.tsx`.
 *
 * **"Won lots" as its own stat tile** (`:576-577`). It is a filtered view of
 * "Active bids" (`status: accepted`) that `bids.tsx`'s own Won tab already
 * is — a fourth tile duplicating a filter one tap away inside the third.
 * Replaced with **Inspections**, which this session DID build and the web's
 * own tile row omits entirely.
 *
 * **The 450-line tabbed "Recent Activity" section** (`:611-1049`) — a
 * SECOND, inline, paginated reimplementation of the bids/inspections/offers
 * lists this dashboard is supposed to be pointing AT. Porting it would be
 * exactly the "inventing those rows twice" the plan's own README warns
 * against. The count rows below do that job instead — each is a link to the
 * real, full screen.
 *
 * **Browse categories at the foot of the page** (`:1096`). Home
 * (`/v2`) already owns browsing entry points; repeating them here dilutes a
 * screen whose only job is "what needs my attention."
 */
import { isPending, type BuyerBidItem } from '@/features/v2/bids/types';
import type { InspectionItem } from '@/features/v2/inspections/types';

/** One line in the Action Required list. */
export type ActionItem = {
  key: string;
  kind: 'payment_due' | 'pickup_ready' | 'inspection_soon';
  batchId: number;
  label: string;
};

/**
 * `BuyerDashboard.tsx:337-343`, verbatim thresholds. Bids and inspections are
 * independent lists (no shared id space), so this takes both and returns one
 * merged, capped list — capped because Action Required is meant to be
 * scanned in a glance, not paginated; the full lists are one tap away on
 * their own screens.
 */
export function buildActionItems(
  bids: readonly BuyerBidItem[],
  inspections: readonly InspectionItem[],
): ActionItem[] {
  const items: ActionItem[] = [];

  for (const b of bids) {
    if (b.batch_step === 6) {
      items.push({ key: `pay-${b.batch_id}`, kind: 'payment_due', batchId: b.batch_id, label: `Payment required — Batch #${b.batch_id}` });
    } else if (b.batch_step === 7) {
      items.push({ key: `pickup-${b.batch_id}`, kind: 'pickup_ready', batchId: b.batch_id, label: `Ready for pickup — Batch #${b.batch_id}` });
    }
  }

  const now = Date.now();
  for (const i of inspections) {
    if (!i.inspection_date || i.status?.toLowerCase() === 'attended') continue;
    const diffDays = (new Date(i.inspection_date).getTime() - now) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= 7) {
      items.push({
        key: `insp-${i.batch_id}`,
        kind: 'inspection_soon',
        batchId: i.batch_id,
        label: `Inspection ${inspectionRelativeLabel(diffDays)} — Batch #${i.batch_id}`,
      });
    }
  }

  return items;
}

/** `BuyerDashboard.tsx:376`'s `getRelativeDate` — same three bands, written fresh (that helper is not exported). */
function inspectionRelativeLabel(diffDays: number): string {
  if (diffDays < 1) return 'today';
  if (diffDays < 2) return 'tomorrow';
  return `in ${Math.round(diffDays)} days`;
}

/** Re-exported so the screen imports one module for the bids vocabulary it needs. */
export { isPending };
