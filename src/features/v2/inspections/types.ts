/**
 * The inspections contract, copied from the web and NOT redesigned.
 *
 * Source: `nextjs-port/src/services/api/slices/buyerApiSlice.ts` — the LIVE
 * copy of three (`src/rtk/slices/` and `src/scanflow/rtk/slices/` hold
 * near-identical twins; `shared/pages/buyer/MyInspections.tsx:21` imports this
 * one). Unlike the watchlist, this endpoint HAS declared types, so they are
 * transcribed rather than reverse-engineered from a mapper.
 */

/** `buyerApiSlice.ts:59-63`, verbatim. */
export type InspectionProduct = {
  title: string;
  images: string[];
  category: string;
};

/** `buyerApiSlice.ts:65-72`, verbatim. */
export type InspectionItem = {
  batch_id: number;
  inspection_number: string;
  inspection_date: string;
  registered_date: string;
  status: string;
  products: InspectionProduct[];
};

/**
 * `buyerApiSlice.ts:74-85`. ⚠️ The rows are at `data.data.data` — the envelope
 * nests `data` twice, and the web reads it defensively
 * (`Array.isArray(inspectionsData?.data?.data)`, `MyInspections.tsx:130`)
 * rather than trusting the type. Keep that shape written down: getting the
 * depth wrong yields an empty list and no error.
 */
export type BuyerInspectionResponse = {
  success: boolean;
  data: {
    data: InspectionItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  };
};

/**
 * `GET /inspection/buyer/{buyerId}` (`buyerApiSlice.ts:332`, URL at `:352`).
 * Params: `page`, `limit`, optional `status`, optional `search`.
 *
 * ⚠️ `status` is SERVER-SIDE here, unlike the bids screen's client filter —
 * the web sends the tab's key straight through (`MyInspections.tsx:120-127`)
 * and resets to page 1. Phase 2 must send it, not filter locally, or the
 * pagination counts will describe a different set than the list shows.
 */
export const INSPECTIONS_LIMIT = 10;

/**
 * The filter tabs, from `MyInspections.tsx:34-37`.
 *
 * ⚠️ THERE ARE ONLY TWO, AND THAT LOOKS LIKE A BUG BUT IS THE WEB'S BEHAVIOUR.
 * `STATUS_CONFIG` (`:41-58`) knows two states, `attended` and `scheduled`, yet
 * the tab row offers only "All" and "Completed" — there is no way to filter
 * down to Scheduled. Copied as-is rather than "fixed": adding a third tab
 * means sending `status=Scheduled`, and no one has shown the server accepts
 * that value. Raise it in phase 2, with a curl, instead of guessing here.
 *
 * Note the casing: the tab sends `"Attended"` capitalised while the status
 * comparison lowercases (`:61`). Both are the web's, kept.
 */
export const INSPECTION_FILTERS = [
  { value: 'all', label: 'All', status: null },
  { value: 'attended', label: 'Completed', status: 'Attended' },
] as const;

export type InspectionFilter = (typeof INSPECTION_FILTERS)[number]['value'];

/** `MyInspections.tsx:41-58`, minus the Tailwind classes. */
export function inspectionStatusLabel(status?: string): string {
  return (status ?? '').toLowerCase() === 'attended' ? 'Completed' : 'Scheduled';
}

/** Completed reads as a positive outcome; scheduled is neutral, not a warning. */
export function inspectionTone(status?: string): 'accent' | 'neutral' {
  return (status ?? '').toLowerCase() === 'attended' ? 'accent' : 'neutral';
}

/**
 * `MyInspections.tsx:25-30`, verbatim including the em-dash fallback.
 *
 * ⚠️ `toLocaleDateString('en-GB')` gives `31/12/2026`. Kept rather than
 * switched to the app's `shortDate` (`18 Sept`) because an inspection is an
 * appointment — a date someone has to be somewhere — and an unambiguous
 * numeric date is the right register for that. It is also what the buyer sees
 * on the web for the same record, and two surfaces disagreeing about a date
 * format is how support tickets start.
 */
export function inspectionDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB');
}
