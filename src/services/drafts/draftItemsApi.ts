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
 *
 * ── ⚑ TWO SOURCES BEHIND ONE SET OF FUNCTIONS (Phase 1, 2026-09-23) ────────
 *
 * A **local** draft id (`local-1`) is answered by `./localDraftSource`; a
 * **server** id goes to the network. Nothing above this file knows which — that
 * is the whole point, copied from the web's `guestDraftStore`: *"Their
 * components are not modified — not one line — because the substitution happens
 * underneath them, at the base query."*
 *
 * It has to live here rather than in the screen because FOUR callers read these
 * functions with the same id — `app/v2/scan/items.tsx`, `valuation.tsx`,
 * `submit.tsx` and `features/v2/scan/openDetectedItem.ts` — and a fork in one of
 * them is a fork the other three do not have.
 *
 * The reason there is a local source at all: **no client-callable route creates
 * a `gb_listing_draft_items` row.** The only writer in the backend is
 * `services/recognitionExtractWorker.js`, reached solely from the durable
 * extract trigger (`controller/gcsResumableController.js:653`). Measured
 * 2026-09-23 — see `Docs/v2/v2scanflow/phases/phase-1-one-spine/README.md`.
 */
import { greenbidz } from '@/api/greenbidzClient';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';

import * as localDraftSource from './localDraftSource';

export { isLocalDraftId, LOCAL_DRAFT_PREFIX } from './localDraftSource';

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
 * Every bulk op this app sends, status ones included.
 *
 * ⚠️ ALL FIVE ARE UNFLAGGED ON THE SERVER. `VALID_BULK_OPS`
 * (`helper/draftItemsQuery.js:1087`) lists fourteen; four of them —
 * `split_lot`, `set_route`, `reset_price`, `set_category` — are behind flags
 * that are OFF on dev, and an op the flag has switched off is rejected as a
 * plain `BAD_OP` 400, indistinguishable from a typo. None of those four is
 * here, which is why this union is five and not fourteen.
 *
 * The consequence for the UI: **`merge_to_lot` is one-way on dev**, because
 * `split_lot` is the op that would undo it. Do not offer an undo.
 */
export type DraftItemBulkOpName =
  | DraftItemBulkOp
  | 'merge_to_lot'
  | 'set_location'
  | 'set_condition';

/**
 * The sorts this app offers, out of the server's fifteen.
 *
 * `VALID_SORTS` is `confidence_asc`, `seq`, `price_desc` plus `_asc`/`_desc`
 * for six columns (`helper/draftItemsQuery.js:86-91`). Fifteen entries is a
 * desktop grid's column headers, not a phone control, so four are surfaced —
 * but every one of them is a literal from that list, checked against it rather
 * than invented.
 *
 * ⚠️ AN UNKNOWN VALUE DOES NOT ERROR. `normalizeSort` falls back to the
 * default (`confidence_asc`) in silence, so a typo here ships as a control
 * that reorders nothing and looks merely unhelpful. The acceptance test for
 * anything added to this union is "the returned ORDER changed", never "the
 * control responded" — `MISTAKES.md` 2026-09-22 is one of these that shipped.
 */
export type DraftItemSort = 'seq' | 'price_desc' | 'confidence_asc' | 'title_asc';

/** The server's cap on `q` (`draftItemsQuery.js:33`). Longer is truncated there. */
export const MAX_Q_LEN = 100;

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
  /**
   * The AI's description paragraph — the web's grid prints it under the title.
   *
   * ⚠️ OPTIONAL, AND THAT IS A STATEMENT ABOUT THE SERVER, NOT A CONVENIENCE.
   * The list endpoint is a lean projection and it does **not** carry a
   * description: `LIST_JSON_PROJECTIONS` in
   * `101recycle-greenbidz-backend/helper/draftItemsQuery.js` declares 16
   * aliases (`grep -n 'alias: "' helper/draftItemsQuery.js`) and none of them
   * is `description` / `equipment_description`. The text lives in
   * `form_json.data.equipment_description`, which that projection "NEVER
   * includes".
   *
   * So: the LOCAL lane fills this (`localDraftSource.rowFrom`) and the SERVER
   * lane leaves it `undefined` until the backend adds the alias. It is typed
   * optional rather than `string | null` precisely so nobody reads an absent
   * paragraph as an empty one — same distinction `missingRequiredFields`
   * already draws with `hasFormData()`, and the same trap recorded in
   * `MISTAKES.md` 2026-09-23 ("nearly ported a gate its own data source cannot
   * answer").
   */
  description?: string | null;

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

/**
 * ONE item, opened — everything `DraftItem` has plus what the server loads only
 * when a row is actually opened (`toItemFull`, `helper/draftItemsQuery.js`).
 *
 * ⚠️ `image_objects_json` is the reason this type exists. The LIST row carries
 * only `thumbnail_object`, a single key, and the review flow requires photos to
 * publish at all (`requiredStatus.ts` — `allComplete = rows.photos && …`). So
 * mapping a list row into a local draft produces an item the seller can walk to
 * the end and never submit. The server's own comment on this field: *"The full
 * ordered media list (photos + any video the seller added), so the detail panel
 * renders the whole gallery — not just the first `thumbnail_object`."*
 *
 * Shapes are left as `unknown` on purpose: these three columns are stored JSON
 * and the extractor has been observed writing the same logical field as a
 * string on one row and a number on another. The mapper narrows them; typing a
 * guess here would make the narrowing look unnecessary.
 */
export interface DraftItemFull extends DraftItem {
  draft_id: number | null;
  form_json: unknown;
  image_indexes_json: unknown;
  image_objects_json: unknown;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Open one item. `GET /drafts/:draftId/items/:id`.
 *
 * Mounted behind `requireScanV2ReviewScale` like the rest of the items routes
 * (`routes/draftRoutes.js:144`), so it 404s wherever `SCANV2_REVIEW_SCALE` is
 * unset — which is not an error to report as "item not found".
 */
export async function getDraftItem(
  draftId: number | string,
  itemId: number | string,
): Promise<DraftItemFull> {
  if (localDraftSource.isLocalDraftId(draftId)) return localDraftSource.getItem(itemId);
  const res = await greenbidz.get(`/drafts/${draftId}/items/${itemId}`);
  return res.data.data as DraftItemFull;
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
    sort?: DraftItemSort;
    q?: string;
  } = {},
): Promise<DraftItemPage> {
  /*
    TRIMMED AND CAPPED ON THE WAY OUT, on both lanes.

    The server does exactly this (`buildQCondition`: `String(q).trim().slice(0,
    MAX_Q_LEN)`), so doing it here is not defensive duplication — it is what
    keeps the two lanes answering the same question. A 140-character paste
    would otherwise match nothing locally and match its first 100 characters on
    the server, which is a divergence nobody would think to look for.
  */
  const q = (opts.q ?? '').trim().slice(0, MAX_Q_LEN);

  if (localDraftSource.isLocalDraftId(draftId)) {
    return localDraftSource.listItems({
      ...opts,
      q,
      filter: opts.filter ?? 'all',
      pageSize: Math.min(opts.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
    });
  }
  const res = await greenbidz.get(`/drafts/${draftId}/items`, {
    params: {
      filter: opts.filter ?? 'all',
      pageSize: Math.min(opts.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
      ...(opts.cursor ? { cursor: opts.cursor } : {}),
      ...(opts.sort ? { sort: opts.sort } : {}),
      ...(q ? { q } : {}),
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
  opts: {
    filter?: DraftItemFilter;
    maxPages?: number;
    /**
     * ⚠️ THESE TWO WERE ACCEPTED BY `listDraftItems` AND DROPPED HERE until
     * 2026-09-23. Every screen goes through this function, so a Sort or Search
     * control wired to it changed the query key, refetched, and got the
     * identical list back — the exact defect shape of `MISTAKES.md`
     * 2026-09-22, and doubly invisible because `normalizeSort` /
     * `normalizeFilter` fail silently to their defaults rather than 400ing.
     */
    sort?: DraftItemSort;
    q?: string;
  } = {},
): Promise<DraftItem[]> {
  const maxPages = opts.maxPages ?? 20;
  const out: DraftItem[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < maxPages; i += 1) {
    const page: DraftItemPage = await listDraftItems(draftId, {
      filter: opts.filter,
      sort: opts.sort,
      q: opts.q,
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
  if (localDraftSource.isLocalDraftId(draftId)) return localDraftSource.itemCounts();
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
  return (await bulkDraftItems(draftId, itemIds, op)).updated;
}

/** What `POST …/items:bulk` hands back. */
export interface DraftItemBulkResult {
  /** Rows changed, or `null` when the server took the work off-thread (202). */
  updated: number | null;
  /** Only `merge_to_lot` returns one. A uuid on the server, a number locally. */
  lot_group_id?: string | number | null;
}

/**
 * Any bulk op, one call — the general form `setDraftItemsStatus` is now a
 * shorthand for.
 *
 * ── ⚠️ A STALE PLAN NOTE SAID "APPLY TO SELECTED HAS TO FAN OUT N PATCHes" ──
 *
 * It does not, and building it that way would have been N round-trips, N
 * `expected_row_version` reads and N chances of a 409 for something the server
 * does in ONE indexed UPDATE. `set_location` and `set_condition` are bulk ops
 * in `VALID_BULK_OPS` (`helper/draftItemsQuery.js:1087`), unflagged, taking
 * `patch.location` / `patch.condition` (`SET_OP_MAP`, `:1244-1251`). The note
 * was read off mobile's own TS union — which said `'accept' | 'discard'` —
 * rather than off the server. A union is the frontend's opinion; the
 * controller is the contract.
 *
 * ── THE ONE REFUSAL A CALLER MUST HANDLE ───────────────────────────────────
 *
 * `merge_to_lot` over a mixed-marketplace selection is a **400** carrying
 * `{ code: 'MIXED_MARKETPLACE', marketplaces: [...] }`, raised BEFORE anything
 * is stamped (`controller/draftItemsController.js:433-441`) — so a refused
 * merge has changed nothing at all. Read it with `mixedMarketplaceRefusal`.
 *
 * ⚠️ `res.data.data.updated`, NOT `res.data.updated`. The body is
 * `{ success, data: { updated, lot_group_id } }` (`:517-521`); the old reader
 * took `undefined`, failed `Number.isFinite`, and returned `null` — the
 * sentinel this function uses for "202, not applied yet". So every successful
 * synchronous accept on the SERVER lane reported itself as maybe-not-applied.
 * Nothing read the value, so nothing broke; it would have the moment anything
 * did.
 */
export async function bulkDraftItems(
  draftId: number | string,
  itemIds: readonly number[],
  op: DraftItemBulkOpName,
  patch?: Record<string, unknown>,
): Promise<DraftItemBulkResult> {
  const select = { item_ids: [...itemIds] };

  if (localDraftSource.isLocalDraftId(draftId)) {
    const res = localDraftSource.bulk({ op, select, patch });
    return { updated: res.updated, lot_group_id: res.lot_group_id ?? null };
  }

  const res = await greenbidz.post(`/drafts/${draftId}/items:bulk`, {
    op,
    select,
    ...(patch ? { patch } : {}),
  });
  if (res.status === 202) return { updated: null };

  const body = res.data?.data ?? {};
  const updated = Number(body.updated);
  return {
    updated: Number.isFinite(updated) ? updated : null,
    lot_group_id: body.lot_group_id ?? null,
  };
}

/**
 * Was this failure "a lot cannot span marketplaces"? Returns the offending
 * codes so the screen can name them, or `null` for anything else.
 *
 * Both lanes answer the same shape on purpose: `localDraftSource` raises the
 * backend's own status, code and `marketplaces` key rather than an
 * approximation of them, so this one reader serves both.
 */
export function mixedMarketplaceRefusal(err: unknown): string[] | null {
  const data = (err as { response?: { data?: { code?: string; marketplaces?: unknown } } })
    ?.response?.data;
  if (data?.code !== 'MIXED_MARKETPLACE') return null;
  const values = Array.isArray(data.marketplaces) ? data.marketplaces : [];
  return values.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * Edit ONE item's fields. `PATCH /drafts/:draftId/items/:id`.
 *
 * ── THE FOUR THINGS THIS ROUTE INSISTS ON ─────────────────────────────────
 *
 * Read off `routes/draftRoutes.js:174-179` and
 * `controller/draftItemsController.js:690-800` rather than inferred:
 *
 *  1. **`expected_row_version` is REQUIRED.** Omitting it is a 400
 *     (`BAD_ROW_VERSION`), not a silent overwrite — this is a field autosave
 *     with optimistic concurrency, which is exactly why accept/discard goes
 *     through the BULK route instead (see `setDraftItemsStatus`).
 *  2. **A stale version is a 409** carrying `{ code: 'STALE',
 *     current_row_version }`. The caller reseeds from the fresh row rather
 *     than retrying blind — an auto-retry would overwrite whatever the other
 *     writer just stored.
 *  3. **`form_json_patch` is DEEP-MERGED** (`mergeFormJson`), so a patch of
 *     `{ data: { title } }` keeps its twenty siblings. Send only what changed.
 *  4. **There is no field whitelist**, but there IS write validation behind
 *     `SCANV2_ITEM_VALIDATION` (`draftItemsController.js:743`) judged on the
 *     MERGED document — price/year/condition/operation_status/site_type/
 *     subcategory. A rejection is a 400 with a message, not a partial write.
 *
 * ⚠️ `image_objects` goes at the ENVELOPE level, not under `data`. The server
 * re-derives the projected `image_objects_json` column from
 * `form_json.image_objects` (`helper/draftItemsQuery.js:2191-2193`); a patch
 * under `data` would store the array where nothing reads it, and the row's
 * photos would never change.
 *
 * Returns the FRESH full row, which carries the bumped `row_version` — hold on
 * to it, or the next patch 409s against the version you just superseded.
 */
export async function patchDraftItem(
  draftId: number | string,
  itemId: number | string,
  body: {
    form_json_patch: Record<string, unknown>;
    expected_row_version: number;
  },
): Promise<DraftItemFull> {
  if (localDraftSource.isLocalDraftId(draftId)) {
    return localDraftSource.patchItem({ itemId, ...body });
  }
  const res = await greenbidz.patch(`/drafts/${draftId}/items/${itemId}`, body);
  return res.data.data as DraftItemFull;
}

/**
 * Is this the server saying "someone else changed this row"?
 *
 * A 409 is the one failure a detail editor can RECOVER from by itself — reload
 * the row and let the seller re-apply. Every other status is a real failure and
 * has to be reported. `localDraftSource.LocalDraftError` is shaped to match, so
 * this reads the same on both lanes.
 */
export function isStaleItemWrite(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 409;
}

/**
 * The row's photo, as something an `<Image>` can actually load.
 *
 * ⚠️ `thumbnail_object` does NOT mean the same thing on both sources, and the
 * difference is invisible until a tile renders broken:
 *
 *   · a SERVER row carries a GCS object NAME (`drafts/247/1/thumb.jpg`), which
 *     has to go through `/gcs/serve` — the unproxied route the web's `DraftCard`
 *     uses, not behind auth (`gcsRoute.js:84`);
 *   · a LOCAL row carries the device URI of the photo the seller just took
 *     (`file://…`). Handing that to `gcsUrlForAnalyze` builds
 *     `/gcs/serve?path=file%3A%2F%2F…` and asks the server for a path on the
 *     phone — a 404 and a permanently broken tile.
 *
 * So the scheme decides. The web guards the same hazard from the other side
 * (`guestDraftStore.withThumb`: a full https URL passes through untouched,
 * "anything else must stay null, or the grid fires a request at a guessed path").
 *
 * Lives here, beside the substitution, because it is part of the same contract —
 * a screen should not have to know which source its row came from.
 */
export function draftItemThumbUri(item: Pick<DraftItem, 'thumbnail_object'>): string | undefined {
  const value = item.thumbnail_object;
  if (!value) return undefined;
  // Already addressable by the image loader: a local file, an in-memory asset,
  // an inline data URI, or a URL the backend already resolved for us.
  if (/^(?:https?|file|content|data|asset|ph):/i.test(value)) return value;
  return gcsUrlForAnalyze({ objectName: value });
}
