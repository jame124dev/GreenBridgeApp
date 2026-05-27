import { differenceInDays, format, isToday, isYesterday } from 'date-fns';

// Centralized date formatting. Screens never call `date-fns` directly — they
// use one of the named formatters below. Benefits:
//
//   - one place to swap formats when design / locale changes
//   - guarantees consistent "today / yesterday / 3 days ago / Mar 12" rhythm
//   - week-boundary correctness (date-fns handles it; the hand-rolled version
//     in history.tsx broke around DST and across-week edges)
//   - future i18n: switch to date-fns locale imports + i18next.t() in one file
//
// All helpers tolerate `null` / `undefined` / unparseable strings — they return
// `''` or `'—'` instead of throwing.

function parse(raw?: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Compact relative time used in list rows: "today, 3:24 PM" / "yesterday" /
 * "3 days ago" / "Mar 12".
 */
export function relativeDate(raw?: string | null): string {
  const d = parse(raw);
  if (!d) return '';
  if (isToday(d)) return `today, ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return 'yesterday';
  const days = differenceInDays(new Date(), d);
  if (days >= 0 && days < 7) return `${days} days ago`;
  return format(d, 'MMM d');
}

/**
 * Long-form date used in detail screens / metadata strips: "Mar 12, 2026".
 * Returns the raw input if it can't be parsed (so backend strings still show).
 */
export function formatBatchDate(raw?: string | null): string {
  const d = parse(raw);
  if (!d) return raw ?? '—';
  return format(d, 'MMM d, yyyy');
}

/**
 * Date + time used for bidding start/end, inspection slots, etc.
 * "Mar 12, 2026 · 3:24 PM".
 */
export function formatBatchDateTime(raw?: string | null): string {
  const d = parse(raw);
  if (!d) return raw ?? '—';
  return format(d, 'MMM d, yyyy · h:mm a');
}
