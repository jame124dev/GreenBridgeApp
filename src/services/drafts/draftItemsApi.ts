/**
 * Draft ITEMS — the rows inside a multi-item draft.
 *
 * A draft from the document/extract lane or the web holds N items (the 9 MB
 * spreadsheet tested on 2026-09-17 produced 18). Mobile's review flow reads ONE
 * item (`features/v2/scan/review/wizardState.ts` → `useReviewItem`), so until
 * now a multi-item draft had no screen at all and `useResumeDraft` refused it
 * with "Could not open this draft".
 *
 * This is the data layer for the missing screen — the mobile half of the web's
 * "Detected items" step. See `Docs/v2/WEB-PARITY.md` items #1–#3.
 *
 * ── THE CONTRACT IS READ FROM THE BACKEND, NOT INFERRED FROM A 404 ─────────
 *
 * Every route here lives in `101recycle-greenbidz-backend/routes/draftRoutes.js`
 * and is gated by the server flag `SCANV2_REVIEW_SCALE`, which
 * `controller/draftItemsController.js:75` compares as the exact lowercased
 * string `"true"`. With the flag off the routes **404 by design**
 * (`draftRoutes.js:28-29`).
 *
 * ⚠️ WHY `testapi` 404s — BOTH REASONS, CHECKED ON THE SERVER 2026-09-17:
 *
 *   1. `/www/wwwroot/greenbidz-test-backend` has no
 *      `controller/draftItemsController.js` at all. Its HEAD is `5183056`
 *      (2026-09-16), two local-only commits past its `origin/dev`, with eight
 *      modified files uncommitted. The routes are merged on GitHub's `dev`
 *      (`f25b6db`) and `main`; that checkout simply predates them.
 *   2. `SCANV2_REVIEW_SCALE` is not in its `.env`, so even after a pull the
 *      routes stay 404 until it is set to `true`.
 *
 * Fixing one without the other changes nothing, which is the trap: I first
 * wrote "the dev server is running an older build" from the 404 alone without
 * looking, then corrected it to "it is only the flag" without looking either.
 * A 404 is one symptom with two causes here — check the checkout AND the env.
 *
 * The four corrections that came out of finally reading the routes — each one a
 * call that could never have succeeded, and none of them visible to a unit test
 * or to a stubbed screen:
 *
 *   1. The list filter defaults to `needs_review`, NOT to everything
 *      (`draftItemsQuery.js:35`). Asking for a draft's items without
 *      `filter=all` returns only the unreviewed ones, so the list looks short
 *      and the valuation totals quietly omit whatever was already accepted.
 *   2. Paging is `pageSize` + `cursor`, not `limit`/`offset`
 *      (`draftItemsController.js:152-153`). The old params were simply ignored,
 *      capping every request at the default 50 with no way to reach page two.
 *      `MAX_PAGE_SIZE` is 100.
 *   3. Accept/discard is the BULK route, not `PATCH`. The per-item PATCH takes
 *      `{ form_json_patch, expected_row_version }` and 400s without the version
 *      (`draftItemsController.js:711-716`) — it is a field autosave, not a
 *      status change.
 *   4. The bulk path is `…/items:bulk`. The route is registered in param form
 *      (`items:bulkAction`) only because path-to-regexp would treat `:bulk` as
 *      a wildcard, and the controller's first line rejects anything whose path
 *      does not end in the literal `/items:bulk` with a 404
 *      (`draftItemsController.js:375`).
 *
 * ── FIELD NAMES ───────────────────────────────────────────────────────────
 *
 * Checked against `helper/draftItemsQuery.js:980-1053` (the list DTO). The
 * response is `{ success, data: [...] }` — items are in `data` directly, NOT
 * `data.items`.
 */
import { greenbidz } from '@/api/greenbidzClient';

/**
 * Where an item stands in review.
 *
 * ⚠️ THREE, not five. `high_value` and `scrap` look like peers in the counts
 * strip but they are folded from a different column — `value_tier`, not
 * `status` (`draftItemsQuery.js:770-777`). An item can be `accepted` AND
 * `high_value` at once, which is impossible if you model them as one enum.
 */
export type DraftItemStatus = 'needs_review' | 'accepted' | 'discarded';

/** What the counts strip filters on: the three statuses plus the two tiers. */
export type DraftItemFilter = DraftItemStatus | 'high_value' | 'scrap' | 'all';

/** The status-changing bulk operations. The catalogue has more; these are ours. */
export type DraftItemBulkOp = 'accept' | 'discard';

/**
 * One row of a multi-item draft.
 *
 * Optional/nullable throughout because extraction genuinely leaves gaps — a
 * spreadsheet row with no price yields `price: null`, and pretending otherwise
 * is how a "0" ends up on screen as if the seller had typed it.
 */
export interface DraftItem {
  id: number;
  /** Position in the source document. Stable; the list is ordered by it. */
  seq: number;
  status: DraftItemStatus;
  title: string | null;
  price: number | null;
  currency: string | null;
  marketplace: string | null;
  category_name: string | null;
  /**
   * THREE-VALUED, and the third value matters.
   *
   * `true` matched the marketplace taxonomy · `false` the AI guessed · **`null`
   * we could not check** — `deriveCategoryResolved` returns null when the term
   * set for that marketplace is unavailable (`draftItemsQuery.js:965-972`).
   * Typing this `boolean` made null falsy, so an unknown rendered as "(guess)":
   * telling the seller their category is wrong when the server only said it
   * had not looked.
   */
  category_resolved: boolean | null;
  thumbnail_object: string | null;
  /** Letter grade from the valuation pass, e.g. `"C"`. */
  grade: string | null;
  /** Fair market value as a RANGE string, e.g. `"1500-2500"`. Never a point. */
  fmv_used: string | null;
  /** Scrap floor as a range string, e.g. `"100-200"`. */
  scrap_value: string | null;
  /** `"high"` / `"scrap"` — the tier the counts strip reports separately. */
  value_tier: string | null;
  heat_tier: string | null;
  /** The extract could not see the item well enough to price it confidently. */
  needs_clearer_photo: boolean;
  lot_group_id: number | null;
  identification_confidence: number | null;

  // ── Identity and spec ────────────────────────────────────────────────────
  // The web's grid renders these as five sortable, inline-editable columns
  // (`ScanV2ReviewGrid`). Mobile reads them; it does not edit them yet.
  //
  // ⚠️ ALL OF THESE ARE TEXT, DELIBERATELY. `year` in particular arrives as a
  // JSON string on some rows and a JSON number on others from the SAME
  // extractor run, and MySQL's `->>` hands list rows the text form either way
  // (`draftItemsQuery.js:1012-1017`). Parsing them here would make the list and
  // the detail disagree — one saying 2019, the other "2019".
  brand: string | null;
  model: string | null;
  year: string | null;
  /**
   * A STORED KEY (`"usedFunctional"`), never a label. Run it through
   * `CONDITION_LABELS` before it reaches a screen — the web carries the same
   * warning: "Label it, never print it raw."
   */
  condition: string | null;
  /** Pre-resolved server-side from `item_location` → `location` → `locations[0]`. */
  location: string | null;
  /**
   * Quantity on this line. **`null` means "none recorded", which renders as 1**
   * — it is deliberately NOT defaulted by the server, so the FE can tell an
   * explicit 1 from an absent value (`draftItemsQuery.js:1027-1030`).
   */
  qty: number | null;

  // ── Market metrics (range/scalar strings, as extracted) ──────────────────
  /** `market_metrics.demand_score`. */
  demand_score: string | null;
  /** `market_metrics.sell_difficulty.estimated_weeks`, a range string. */
  sell_weeks: string | null;

  // ── The seller's own price ───────────────────────────────────────────────
  // Present for completeness and for the day mobile can edit a row's price.
  // ⚠️ NOT part of any total: the web's `ScanV2ValuationStep` never reads them
  // either — `factsFromRow` sums the row's scalar `price`
  // (`scanv2Valuation.ts:556`). Checked before assuming otherwise.
  ask: number | null;
  min_bid: number | null;
  /**
   * Optimistic-concurrency token. Not used by this screen, which only ever
   * changes status through the bulk route — but any future per-field edit MUST
   * send it back as `expected_row_version` or the PATCH 400s, and a stand-in 0
   * 409s against every row the extract worker has touched.
   */
  row_version: number | null;
}

/** The counts strip above the grid. */
export interface DraftItemCounts {
  total: number;
  needs_review: number;
  accepted: number;
  discarded: number;
  high_value: number;
  scrap: number;
}

export interface DraftItemPage {
  items: DraftItem[];
  /** Opaque; pass back as `cursor` for the next page. `null` at the end. */
  nextCursor: string | null;
}

/** The server's ceiling (`draftItemsQuery.js:32`). Asking for more is capped. */
export const MAX_PAGE_SIZE = 100;

/**
 * List a draft's items.
 *
 * Defaults to `filter: 'all'` DELIBERATELY — the server's own default is
 * `needs_review`, which is the right default for the web's triage grid and the
 * wrong one for a screen that shows the whole draft and totals it.
 */
export async function listDraftItems(
  draftId: number | string,
  opts: {
    filter?: DraftItemFilter;
    pageSize?: number;
    cursor?: string | null;
    sort?: string;
    q?: string;
  } = {},
): Promise<DraftItemPage> {
  const res = await greenbidz.get(`/drafts/${draftId}/items`, {
    params: {
      filter: opts.filter ?? 'all',
      pageSize: Math.min(opts.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
      ...(opts.cursor ? { cursor: opts.cursor } : {}),
      ...(opts.sort ? { sort: opts.sort } : {}),
      ...(opts.q ? { q: opts.q } : {}),
    },
  });
  const data = res.data?.data;
  return {
    items: Array.isArray(data) ? (data as DraftItem[]) : [],
    nextCursor: res.data?.next_cursor ?? null,
  };
}

/**
 * Every item in a draft, following the cursor.
 *
 * A real extract can exceed one page (100), and a totals line computed over the
 * first page only would be wrong without ever looking wrong. Bounded so a
 * server that always returns a cursor cannot spin forever.
 */
export async function listAllDraftItems(
  draftId: number | string,
  opts: { filter?: DraftItemFilter; maxPages?: number } = {},
): Promise<DraftItem[]> {
  const maxPages = opts.maxPages ?? 20;
  const out: DraftItem[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < maxPages; i += 1) {
    const page: DraftItemPage = await listDraftItems(draftId, {
      filter: opts.filter,
      cursor,
    });
    out.push(...page.items);
    if (!page.nextCursor || page.items.length === 0) break;
    cursor = page.nextCursor;
  }
  return out;
}

/** The counts strip. Cheap enough to refetch after every mutation. */
export async function getDraftItemCounts(draftId: number | string): Promise<DraftItemCounts> {
  const res = await greenbidz.get(`/drafts/${draftId}/items/counts`);
  const d = res.data?.data ?? {};
  return {
    total: Number(d.total ?? 0),
    needs_review: Number(d.needs_review ?? 0),
    accepted: Number(d.accepted ?? 0),
    discarded: Number(d.discarded ?? 0),
    high_value: Number(d.high_value ?? 0),
    scrap: Number(d.scrap ?? 0),
  };
}

/**
 * Accept or discard items — one row or many, the same call.
 *
 * ⚠️ THE PATH ENDS IN A COLON SEGMENT: `…/items:bulk`. The route is registered
 * as `items:bulkAction` only to stop path-to-regexp treating `:bulk` as a
 * wildcard that would also swallow `/itemsXYZ`; the controller then enforces the
 * literal and 404s anything else (`draftItemsController.js:375`). So the
 * REGISTERED name and the CALLABLE name differ, and using the registered one —
 * which I did until 2026-09-17 — 404s every time.
 *
 * Returns the number of rows changed, or `null` when the server took the work
 * off-thread (202 + `job_id`, above `SCANV2_BULK_SYNC_MAX`). `null` means
 * "accepted, not yet applied" — the caller must refetch rather than assume.
 */
export async function setDraftItemsStatus(
  draftId: number | string,
  itemIds: readonly number[],
  op: DraftItemBulkOp,
): Promise<number | null> {
  const res = await greenbidz.post(`/drafts/${draftId}/items:bulk`, {
    op,
    select: { item_ids: [...itemIds] },
  });
  if (res.status === 202) return null;
  const updated = Number(res.data?.updated);
  return Number.isFinite(updated) ? updated : null;
}
