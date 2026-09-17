/**
 * How a draft or a live listing is WORDED in v2. One copy, four surfaces.
 *
 * These started as private helpers inside `SellingPane` (6a Home). The moment a
 * "See all" screen existed they had to be shared: Home's two preview rows and
 * the full list are the same row, and a seller who sees "AI draft · 3 items" on
 * Home and something else one tap later is reading two different apps.
 *
 * Moved here rather than copied — a copy is the one thing that can drift
 * between them without anyone noticing.
 *
 * Nothing here renders. Presentation only: no hooks, no JSX, no navigation.
 */
import { classifyStatus, type StatusTone } from '@/features/scanner/batchStatus';
import type { DraftSummary } from '@/services/drafts/draftApi';
import type { SellerBatch } from '@/types/batch';

/**
 * Only an absolute http(s) URL is something a tile can load. A draft's
 * `thumbnail_object` is often an object KEY, and handing that to an <Image>
 * gives a broken box where the placeholder glyph belongs.
 */
export function photoUri(uri?: string | null): string | undefined {
  return typeof uri === 'string' && /^https?:\/\//.test(uri) ? uri : undefined;
}

/** "23m" / "18h" / "2d" — the canvas has no timestamps, but real drafts need one. */
export function compactAgo(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The canvas draft sub-line is "Needs 2 photos and a price" — a completeness
 * read the list endpoint does not carry (it would need each draft's payload,
 * i.e. one GET per row). What it does carry is how the draft was made and how
 * big it is, so the line says that instead.
 */
export function draftSubtitle(d: DraftSummary): string {
  const flow = d.flow === 'ai' ? 'AI draft' : 'Manual draft';
  const count = Number(d.product_count) || 0;
  return count > 1 ? `${flow} · ${plural(count, 'item', 'items')}` : flow;
}

export function draftTitle(d: DraftSummary): string {
  return d.title || 'Untitled draft';
}

export const STATUS_LABEL: Record<StatusTone, string> = {
  live: 'Live',
  sold: 'Sold',
  pending: 'In review',
  review: 'In review',
  inspect: 'Inspection',
  inactive: 'Inactive',
  submitted: 'Submitted',
};

/**
 * "$14,000 · 42 views · 1 offer" in the canvas. Price and views are not on the
 * seller-batch payload; status, item count and bids are, and bids are the part
 * a seller acts on, so they come last where the eye lands.
 */
export function listingSubtitle(b: SellerBatch): string {
  const parts = [STATUS_LABEL[classifyStatus(b)]];
  const items = Number(b.itemsCount) || 0;
  if (items > 1) parts.push(plural(items, 'item', 'items'));
  const bids = Number(b.bidsCount) || 0;
  if (bids > 0) parts.push(plural(bids, 'offer', 'offers'));
  return parts.join(' · ');
}

export function listingTitle(b: SellerBatch): string {
  return b.titleI18n?.en || b.title || b.category || `Batch #${b.batchId}`;
}

/**
 * "See all 7" — the canvas counts, and a count is the useful part of the link.
 * But both endpoints are paged, so the loaded length is only the whole truth
 * when there is no more to fetch. When there is, the label drops the number
 * rather than under-reporting it.
 */
export function seeAll(loaded: number, hasMore: boolean): string {
  return hasMore ? 'See all' : `See all ${loaded}`;
}
