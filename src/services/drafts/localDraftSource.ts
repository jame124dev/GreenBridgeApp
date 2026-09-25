/**
 * localDraftSource — a draft that lives on the device, answering the draft-items
 * API's calls with the API's shapes.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Direct port of the web's `nextjs-port/src/rtk/api/guestDraftStore.ts`, whose
 * own docblock (lines 1–34) states the pattern verbatim:
 *
 *   > The seller app's Scan V2 components […] read their data through
 *   > `draftApiSlice`: `GET /drafts/:id/items`, `PATCH /drafts/:id/items/:itemId`,
 *   > `POST /drafts/:id/items:bulk` […] Those endpoints need a real draft row,
 *   > which needs a seller account […] So **this module IS the draft**: it
 *   > answers the same URLs with the same shapes […] Their components are not
 *   > modified — not one line — because **the substitution happens underneath
 *   > them, at the base query**.
 *
 * Mobile has the same problem in a sharper form. Measured 2026-09-23 and
 * recorded in `Docs/v2/v2scanflow/phases/phase-1-one-spine/README.md`: the ONLY
 * writer of `gb_listing_draft_items` rows in the whole backend is
 * `services/recognitionExtractWorker.js`, reachable solely from the durable
 * extract trigger. **No client-callable route creates an item row.** So a fresh
 * scan has no server draft to read, and `app/v2/scan/items.tsx` — which reads
 * `GET /drafts/:id/items` — had nothing to show it.
 *
 * This module is that draft, for a scan that has not been saved to the server.
 * `services/drafts/draftItemsApi.ts` routes a LOCAL draft id here and a server
 * draft id to the network, so `items.tsx` (and `valuation.tsx` and `submit.tsx`,
 * which read the same functions) never learn there are two worlds.
 *
 * ── WHAT IS DELIBERATELY THE SAME AS THE SERVER ────────────────────────────
 *
 *   · `row_version` is bumped on every write and a stale `expected_row_version`
 *     is REJECTED, so an optimistic-concurrency guard is exercised rather than
 *     bypassed. The rejection is thrown as a `LocalDraftError` carrying an
 *     axios-shaped `response.status = 409` and the backend's own body
 *     (`{ code: 'STALE', current_row_version }`), because every caller in this
 *     app reads a failure through `error.response.status` — `items.tsx`'s
 *     `retryUnlessClientError` is the one that matters (it must NOT retry).
 *   · a bulk op returns `{ updated: n }`, and `delete`/`discard` are ONE op — a
 *     soft status change, never a dropped row.
 *   · the item list is filtered, searched, sorted and CURSOR-PAGED here.
 *   · money is never converted except by an explicit `convertCurrency` call.
 *
 * ── THE TWO PLACES IT DEVIATES FROM THE WEB, AND WHY ───────────────────────
 *
 * 1. **`filter: 'all'` INCLUDES discarded rows here; on the web it excludes
 *    them.** This is not a preference — the substitution has to be invisible,
 *    and `items.tsx:413` is built against the server's meaning of `all`:
 *    *"`rows` comes back with `filter: 'all'`, so it includes discarded items"*,
 *    a comment written from a measured bug ("discarding two of eighteen with
 *    nothing accepted rendered TOTALS · 16 ACCEPTED"). Matching the web here
 *    would make that screen's arithmetic disagree with itself on the local lane
 *    only. `itemCounts().total` still excludes discarded, as the web's does, so
 *    the "Found N" chip means what it says after a discard.
 * 2. **The default sort is `seq`, not `confidence_asc`.** The web's grid is a
 *    triage tool for hundreds of rows, so it leads with the uncertain ones.
 *    Mobile's rows come from a document whose ORDER is the seller's own
 *    (spreadsheet row 1, 2, 3…), and re-ordering it silently is the kind of
 *    thing that makes a seller think a row is missing. Every sort key the web
 *    supports still works when asked for by name.
 *
 * ── WHAT IS HONESTLY DIFFERENT ─────────────────────────────────────────────
 *
 *   · ids are local (`local-1`), not database ids. Nothing here is a listing,
 *     and nothing here is a `gb_listing_drafts` row either.
 *   · the ROWS ARE A PROJECTION OF `useScanDraft`, not a second copy of the
 *     data. `applySmartDetection` has just written the real drafts — with
 *     persisted photo files, the resolved marketplace and the §0.5 category
 *     clearing — and `usePublishDraft` publishes from that same store. A second
 *     copy would be a second source of truth for the same listing, which is how
 *     three apps' draft payloads drifted apart before. So each row keeps the
 *     store item's id (`sourceId`) and every field write is mirrored back.
 *   · `status` is the one thing the store has no column for, so it lives here —
 *     exactly the fact `app/v2/scan/detected.tsx` recorded before this module
 *     replaced it ("the store has no per-item status (the server draft does)").
 *   · publish is not implemented here, and must not be: publishing reads the
 *     store (`usePublishDraft.itemsToPublish`), which is the whole point of
 *     projecting rather than copying.
 */
import { convertPrice } from '@/features/scanner/currencyFx';
import {
  useScanDraft,
  type DraftItem as ScanDraftItem,
  type SupportedCurrency,
} from '@/stores/scanDraftStore';
import type { AiPriceTier } from '@/features/scanner/smartDetectionTypes';

// Types only — `draftItemsApi` imports THIS module at runtime, so a value
// import here would close a require cycle.
import type {
  DraftItem as DraftItemRow,
  DraftItemCounts,
  DraftItemFilter,
  DraftItemFull as DraftItemRowFull,
  DraftItemPage,
} from './draftItemsApi';

/** Every local draft id starts with this. Nothing on the server ever does. */
export const LOCAL_DRAFT_PREFIX = 'local-';

/**
 * Is this id ours?
 *
 * Deliberately a prefix test on the STRING, not a `Number.isNaN` test. A server
 * draft id arrives as a number or a numeric string and `Number('local-1')` is
 * `NaN` — so a NaN test would also claim every malformed id, and route a typo
 * into a store that has nothing in it.
 */
export function isLocalDraftId(draftId: number | string | null | undefined): boolean {
  return typeof draftId === 'string' && draftId.startsWith(LOCAL_DRAFT_PREFIX);
}

/** One row: the server's projection, plus what only a local row needs. */
interface LocalRow extends DraftItemRow {
  /**
   * NARROWED from `number | null`. The API types it nullable because a server
   * row can predate the column; a row this module created always has one, and
   * the optimistic-concurrency check below is only honest if it does.
   */
  row_version: number;
  /** The `useScanDraft` item this row projects. Never shown, never sent. */
  sourceId: string;
  /**
   * The editable form bag, in the AI's own key shape (`SmartProductData`),
   * plus the one ENVELOPE key an editor writes.
   *
   * ⚠️ `image_objects` sits BESIDE `data`, not inside it. That is where the
   * server keeps it and where `deriveDenormFields` reads it back from
   * (`101recycle-greenbidz-backend/helper/draftItemsQuery.js:2191`), so
   * mirroring the server's own shape is what lets `app/v2/scan/item.tsx` send
   * ONE patch body down either lane without knowing which it is on.
   */
  form_json: { data: Record<string, unknown>; image_objects?: string[] };
  /** Local photo URIs, in order. The detail shape's media list. */
  image_objects_json: string[];
}

interface LocalDraft {
  id: string;
  title: string;
  rows: LocalRow[];
}

/* One local draft at a time is all a scan session has. */
let draft: LocalDraft | null = null;
let nextDraftSeq = 1;

/**
 * A failure shaped like the one the network path would have produced.
 *
 * `response.status` is what every caller in this app reads —
 * `items.tsx:89` (`retryUnlessClientError`) branches on exactly that, and a
 * plain `Error` would be retried three times against a store that cannot
 * change its mind.
 */
export class LocalDraftError extends Error {
  readonly status: number;
  readonly response: { status: number; data: unknown };

  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.name = 'LocalDraftError';
    this.status = status;
    this.response = { status, data };
  }
}

/* ------------------------------------------------------------------ seeding */

/** A number, or null — never 0 standing in for "we did not find one". */
function positive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A trimmed string, or null. */
function text(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  return s ? s : null;
}

/**
 * An AI price tier → the RANGE STRING the row projection carries.
 *
 * `"1500-2500"`, or `"1800"` when the tier is a point estimate — the exact
 * shape `valuationSummary.parseBand` reads and the shape a real extract row
 * carries (`fmv_used: '1500-2500'`, measured on draft 247).
 *
 * Converted into the ROW's currency, because `items.tsx` formats the band with
 * `item.currency` and the tiers carry their own (`AiPrices.currency`, USD by
 * backend default). `app/v2/scan/detected.tsx` did the same conversion with the
 * same helper — it just hardcoded USD as the source instead of reading it.
 */
function bandString(
  tier: AiPriceTier | undefined,
  from: SupportedCurrency,
  to: SupportedCurrency,
): string | null {
  if (!tier) return null;
  const lo = convertPrice(tier.min, from, to);
  const hi = convertPrice(tier.max, from, to);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo === hi) return String(lo);
  return `${Math.min(lo, hi)}-${Math.max(lo, hi)}`;
}

/**
 * The editable form bag for a row, in the AI's own key names.
 *
 * Keys are `SmartProductData`'s (`features/scanner/smartDetectionTypes.ts`), not
 * the store's camelCase, because that is what a patch from a ported Scan V2
 * editor sends — `{ data: { equipment_description } }`, `{ data: { item_location } }`.
 * `reproject` maps them back onto the row and `storePatchFrom` maps them back
 * onto the store item, so the three stay in step.
 */
function formDataFrom(item: ScanDraftItem): Record<string, unknown> {
  return {
    name: item.title,
    brand: item.brand,
    model: item.model,
    year: item.year,
    weight: item.weight,
    dimensions: item.dimensions,
    co2_emissions: item.co2Emissions,
    serial_number: item.serialNumber,
    equipment_description: item.description,
    condition: item.condition,
    operation_status: item.operationStatus,
    category_name: item.categoryName,
    currency: item.priceCurrency,
    price: item.pricePerUnit,
    quantity: item.quantity,
    item_location: item.locations[0] ?? '',
    country: item.locationCountries[0] ?? '',
    grade: item.grade,
    marketplace: item.marketplace,
    site_type: item.marketplace,
    prices: item.aiPrices
      ? {
          new: bandString(item.aiPrices.new, item.aiPrices.currency, item.priceCurrency),
          used: bandString(item.aiPrices.used, item.aiPrices.currency, item.priceCurrency),
          scrap: bandString(item.aiPrices.scrap, item.aiPrices.currency, item.priceCurrency),
        }
      : undefined,
  };
}

/**
 * One store item → one row, in the shape `GET /drafts/:id/items` returns.
 *
 * ⚠️ `seq` is ZERO-BASED, matching the server DTO (the fixture in
 * `draftItemsApi.test.ts` has `seq: 0`) — `items.tsx` renders `Item ${seq + 1}`
 * as its title fallback, so a 1-based seq here would number a two-row draft
 * "Item 2, Item 3".
 */
function rowFrom(item: ScanDraftItem, index: number): LocalRow {
  const currency = item.priceCurrency;
  const tierCurrency = item.aiPrices?.currency ?? currency;

  return {
    id: index + 1,
    seq: index,
    sourceId: item.id,
    // Nothing arrives accepted: the seller decides, which is what the detected
    // step exists for.
    status: 'needs_review',
    title: text(item.title),
    price: positive(item.pricePerUnit),
    currency,
    marketplace: item.marketplace,
    category_name: item.categoryName,
    /**
     * THREE-VALUED, and the third value matters (see `DraftItem` in
     * `draftItemsApi.ts`). Locally: an id means the marketplace's own tree
     * resolved it; a name with no id means the AI supplied a name nothing
     * matched; neither means there is nothing to judge — NOT "the AI guessed".
     */
    category_resolved: item.categoryId ? true : item.categoryName ? false : null,
    /**
     * A LOCAL URI (`file://…`), not a GCS object name. `draftItemThumbUri` in
     * `draftItemsApi.ts` is what turns either into something renderable; passing
     * a `file://` through `gcsUrlForAnalyze` would build `/gcs/serve?path=file%3A…`
     * and render a permanently broken tile — the same trap the web's `withThumb`
     * guards with "anything else must stay null".
     */
    thumbnail_object: item.photos[0]?.uri ?? null,
    grade: item.grade,
    fmv_used: bandString(item.aiPrices?.used, tierCurrency, currency),
    scrap_value: bandString(item.aiPrices?.scrap, tierCurrency, currency),
    // The mobile payload carries no tier or heat/demand/sell-time facts — they
    // are absent rather than invented. `high_value` is derived from price below,
    // which is the web's own rule.
    value_tier: null,
    heat_tier: null,
    demand_score: null,
    sell_weeks: null,
    needs_clearer_photo: Boolean(item.needsClearerPhoto),
    lot_group_id: null,
    /**
     * A SORT KEY, not a measurement. The mobile payload has no identification
     * confidence (`siteTypeConfidence` is about the marketplace, and is display
     * only by plan §2.1). The web's resume path makes the same substitution from
     * its own flag — `row.flag ? 0.4 : 0.9` — so a `confidence_asc` sort puts the
     * rows the extractor was unsure about first. Nothing displays this number.
     */
    identification_confidence: item.needsClearerPhoto ? 0.4 : 0.9,
    brand: text(item.brand),
    model: text(item.model),
    year: text(item.year),
    /**
     * The AI's paragraph, which the detected list prints under the title.
     *
     * The SERVER lane cannot supply this — its list projection has no
     * description alias at all (see the field's docblock in `draftItemsApi.ts`)
     * — so this is a local-lane-only column for now, and it is `null` rather
     * than `''` when absent so a screen can tell "nothing was written" from
     * "the server did not send it".
     */
    description: text(item.description),
    // A stored KEY (`"usedFunctional"`), never a label — the screens run it
    // through `CONDITION_LABELS`.
    condition: item.condition[0] ?? null,
    location: text(item.locations[0]),
    qty: item.quantity,
    ask: null,
    min_bid: null,
    row_version: 1,
    form_json: { data: formDataFrom(item) },
    image_objects_json: item.photos.map((p) => p.uri),
  };
}

/**
 * Seed the local draft from a set of store items.
 *
 * Exported for tests; production goes through `seedLocalDraftFromScanStore`.
 */
export function seedLocalDraft(
  items: readonly ScanDraftItem[],
  title = 'Scan review',
): string {
  draft = {
    id: `${LOCAL_DRAFT_PREFIX}${nextDraftSeq++}`,
    title,
    rows: items.map(rowFrom),
  };
  return draft.id;
}

/**
 * Seed from whatever `useScanDraft` is holding right now, and return the id to
 * hand `items.tsx`.
 *
 * Called immediately after `applySmartDetection`, which has just written either
 * a queue (grouped) or a single `current`. `allItemsForReview()` is the store's
 * own answer to "everything this session is reviewing", so the two shapes do not
 * have to be forked here — and the same call serves the `draft?.ai` re-entry
 * guard, where there is no `mapped` result to read at all.
 *
 * ⚠️ IT DOES NOT TOUCH `mergedSingle`. That is the point: the store's
 * "these are actually one product" draft is written by `applySmartDetection`
 * (`scanDraftStore.ts:972`) and read by `collapseToSingleFromSmartDetection`,
 * and Phase 6 removes its current entry point (`app/scan/detection.tsx`).
 * Projecting the queue leaves it exactly where it is; REBUILDING the session
 * from these rows would throw it away, which is why `commitAcceptedRows` below
 * removes rows instead of re-hydrating.
 */
export function seedLocalDraftFromScanStore(title?: string): string {
  return seedLocalDraft(useScanDraft.getState().allItemsForReview(), title);
}

/** The id of the draft currently held, or null. */
export function currentLocalDraftId(): string | null {
  return draft?.id ?? null;
}

/** Throw the local draft away — the scan session is over. */
export function resetLocalDraft(): void {
  draft = null;
}

/* ------------------------------------------------------------------ reading */

/**
 * Hand out COPIES, never the stored rows.
 *
 * The web's reason was Immer's auto-freeze breaking a bulk write; ours is
 * simpler and just as real — a screen holding a reference into this module
 * could mutate a row without going through an op, and the store mirror below
 * would never hear about it.
 */
function copy<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

function rows(): LocalRow[] {
  return draft?.rows ?? [];
}

/** Strip the fields only a local row has, so callers see the API's shape. */
function asRow(row: LocalRow): DraftItemRow {
  const { sourceId, form_json, image_objects_json, ...rest } = row;
  void sourceId;
  void form_json;
  void image_objects_json;
  return copy(rest);
}

const HIGH_VALUE_FLOOR = 10000;

/**
 * ⚠️ `all` MEANS EVERYTHING, DISCARDED INCLUDED — the SERVER's meaning, not the
 * web store's. See deviation 1 in the docblock: `items.tsx` computes
 * `valuation.counted === rows.filter(r => r.status !== 'discarded').length`,
 * which is only meaningful if the discarded rows are in `rows`.
 */
function matchesFilter(row: LocalRow, filter: DraftItemFilter): boolean {
  switch (filter) {
    case 'needs_review':
    case 'accepted':
    case 'discarded':
      return row.status === filter;
    case 'high_value':
      return row.status !== 'discarded' && (row.price ?? 0) >= HIGH_VALUE_FLOOR;
    case 'scrap':
      return row.status !== 'discarded' && row.value_tier === 'scrap';
    case 'all':
    default:
      return true;
  }
}

/**
 * ⚠️ TITLE, BRAND, MODEL — AND DELIBERATELY NOT CATEGORY.
 *
 * This used to include `category_name`, which made the local lane match rows
 * the server never would: `buildQCondition`
 * (`101recycle-greenbidz-backend/helper/draftItemsQuery.js:588-599`) ORs the
 * `title` column with `Q_SEARCH_JSON_ALIASES`, and that constant is exactly
 * `["brand", "model"]` (`:562`). Searching "incubator" on a fresh scan would
 * have returned three rows and the same search on the same draft after saving
 * it returned one — a divergence with no symptom to trace, in a module whose
 * entire contract is that the substitution is invisible.
 *
 * The server's own comment says why its list is short: going through the
 * projection means "a term can never match a key the cell does not show", and
 * the category is shown on mobile's spec line — so the argument for adding it
 * is real, but it belongs on the SERVER first, not as a local-only extra.
 */
function matchesQuery(row: LocalRow, q: string): boolean {
  if (!q) return true;
  const hay = [row.title, row.brand, row.model].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function sortRows(list: LocalRow[], sort: string): LocalRow[] {
  const out = [...list];
  const bySeq = (a: LocalRow, b: LocalRow) => a.seq - b.seq;
  const str = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');

  if (sort === 'seq') return out.sort(bySeq);
  if (sort === 'price_desc') {
    return out.sort((a, b) => (b.price ?? 0) - (a.price ?? 0) || bySeq(a, b));
  }
  if (sort === 'confidence_asc') {
    return out.sort(
      (a, b) =>
        (a.identification_confidence ?? 1) - (b.identification_confidence ?? 1) || bySeq(a, b),
    );
  }

  const column = /^(title|brand|model|year|condition|location)_(asc|desc)$/.exec(sort);
  if (!column) return out.sort(bySeq);

  const key = column[1] as keyof LocalRow;
  const dir = column[2] === 'asc' ? 1 : -1;
  return out.sort((a, b) => {
    const x = str(a[key]);
    const y = str(b[key]);
    // Blanks last in BOTH directions — a column sort is never asking for the
    // empty cells first.
    if (!x && !y) return bySeq(a, b);
    if (!x) return 1;
    if (!y) return -1;
    return dir * x.localeCompare(y, undefined, { numeric: true }) || bySeq(a, b);
  });
}

const MAX_LOCAL_PAGE_SIZE = 100;

/**
 * `GET /drafts/:id/items` — filtered, searched, sorted and CURSOR-PAGED, so a
 * screen written against the real API pages here exactly as it does there.
 *
 * The cursor is an offset rendered as a string, which is opaque to the caller —
 * the same contract the server's is under.
 */
export function listItems(opts: {
  filter?: DraftItemFilter;
  pageSize?: number;
  cursor?: string | null;
  sort?: string;
  q?: string;
} = {}): DraftItemPage {
  const matched = sortRows(
    rows().filter(
      (row) => matchesFilter(row, opts.filter ?? 'all') && matchesQuery(row, opts.q ?? ''),
    ),
    opts.sort ?? 'seq',
  );

  const size = Math.min(Math.max(opts.pageSize ?? 50, 1), MAX_LOCAL_PAGE_SIZE);
  const start = opts.cursor ? Number(opts.cursor) || 0 : 0;
  const page = matched.slice(start, start + size);

  return {
    items: page.map(asRow),
    nextCursor: start + size < matched.length ? String(start + size) : null,
  };
}

/**
 * The counts strip.
 *
 * `total` counts the rows still IN PLAY, as the web's does — "Found 18" that
 * keeps saying 18 after two discards is reporting on a list nobody can see.
 * The three status counts are over everything, which is how `discarded` can be
 * non-zero at all.
 */
export function itemCounts(): DraftItemCounts {
  const all = rows();
  const live = all.filter((r) => r.status !== 'discarded');
  return {
    total: live.length,
    needs_review: all.filter((r) => r.status === 'needs_review').length,
    accepted: all.filter((r) => r.status === 'accepted').length,
    discarded: all.filter((r) => r.status === 'discarded').length,
    high_value: live.filter((r) => (r.price ?? 0) >= HIGH_VALUE_FLOOR).length,
    scrap: live.filter((r) => r.value_tier === 'scrap').length,
  };
}

/** `GET /drafts/:id/items/:itemId`. Throws a 404-shaped error, as the API does. */
export function getItem(itemId: number | string): DraftItemRowFull {
  const row = find(itemId);
  return {
    ...asRow(row),
    draft_id: null,
    form_json: copy(row.form_json),
    image_indexes_json: null,
    image_objects_json: copy(row.image_objects_json),
    created_at: null,
    updated_at: null,
  };
}

function find(itemId: number | string): LocalRow {
  const id = Number(itemId);
  const row = rows().find((r) => r.id === id);
  if (!row) {
    throw new LocalDraftError(404, { success: false, message: 'Item not found' }, 'Item not found');
  }
  return row;
}

/* ------------------------------------------------------------------ writing */

/** Deep-merge, so a patch of `{ data: { weight } }` keeps its siblings. */
function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const prev = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object'
        ? deepMerge(prev as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

/** Keep the projected columns in step with `form_json`, as the server does. */
function reproject(row: LocalRow): void {
  const d = row.form_json.data;

  if (d.name !== undefined) row.title = text(d.name);
  if (d.brand !== undefined) row.brand = text(d.brand);
  if (d.model !== undefined) row.model = text(d.model);
  if (d.year !== undefined) row.year = text(d.year);
  if (d.grade !== undefined) row.grade = text(d.grade);
  // The editor's key is `equipment_description` (`formDataFrom` above, and the
  // key `missingRequiredFields` gates on) — so an edit in the detail screen is
  // reflected on the list row rather than leaving the old paragraph there.
  if (d.equipment_description !== undefined) {
    row.description = text(d.equipment_description);
  }
  if (d.category_name !== undefined) row.category_name = text(d.category_name);
  if (d.item_location !== undefined) row.location = text(d.item_location);
  if (d.marketplace !== undefined) row.marketplace = text(d.marketplace);
  if (d.price !== undefined) row.price = positive(d.price);
  if (d.currency !== undefined) {
    const c = String(d.currency ?? '').toUpperCase();
    if (c === 'USD' || c === 'TWD') row.currency = c;
  }
  if (d.quantity !== undefined) {
    const n = Number(d.quantity);
    if (Number.isSafeInteger(n) && n >= 1) row.qty = n;
  }
  if (d.condition !== undefined) {
    // The store field is an ARRAY and the row column a single stored key.
    row.condition = Array.isArray(d.condition)
      ? (text(d.condition[0]) ?? null)
      : text(d.condition);
  }
  const prices = d.prices;
  if (prices && typeof prices === 'object') {
    const p = prices as Record<string, unknown>;
    if (p.used !== undefined) row.fmv_used = text(p.used);
    if (p.scrap !== undefined) row.scrap_value = text(p.scrap);
  }

  /**
   * MEDIA — the envelope key, re-projected onto the two columns that read it.
   *
   * The server does exactly this in `deriveDenormFields`
   * (`helper/draftItemsQuery.js:2191-2193`): `form_json.image_objects` is the
   * source of truth and `image_objects_json` is derived from it. Without this
   * the local lane would accept a photo patch, store it, and keep reporting
   * "Needs a photo" — the web's own logged failure mode
   * (`reviewBulk.ts:1065`, "the seller could SEE their photo" while the gate
   * stayed on).
   *
   * `thumbnail_object` follows the first entry, because that is what the items
   * list draws (`draftItemThumbUri`) and a row whose gallery has a photo but
   * whose tile is empty reads as a broken image.
   */
  const media = row.form_json.image_objects;
  if (Array.isArray(media)) {
    const objects = media.filter((o): o is string => typeof o === 'string' && o.length > 0);
    row.image_objects_json = objects;
    row.thumbnail_object = objects[0] ?? null;
  }
}

/**
 * Mirror a row's form patch back onto the `useScanDraft` item it projects.
 *
 * Without this a Scan V2 editor could change a title, watch the grid update,
 * and publish the old one — the store is what `usePublishDraft` reads. Only
 * keys the patch actually carried are written, so a patch of one field cannot
 * blank the twenty it did not mention.
 */
function mirrorToScanStore(
  row: LocalRow,
  patched: Record<string, unknown>,
  /**
   * The ENVELOPE half of the same patch (`{ image_objects }`), which does not
   * live under `data` and so cannot be read out of `patched`. Passed
   * separately rather than merged, so "which keys did this patch mention"
   * stays answerable for both halves — that question is the whole reason a
   * one-field patch cannot blank the twenty it did not mention.
   */
  envelope: Record<string, unknown> = {},
): void {
  const d = row.form_json.data;
  const patch: Partial<ScanDraftItem> = {};

  /**
   * MEDIA. `reproject` has already normalised the envelope onto
   * `image_objects_json`, so this reads the row rather than the patch and
   * cannot disagree with what the grid shows.
   *
   * `width: 0, height: 0` follows `services/drafts/pendingAiResume.ts:90` and
   * `openDetectedItem.photosFromServerMedia` — the dimensions are not on a
   * stored media entry and nothing in the review flow reads them.
   */
  if ('image_objects' in envelope) {
    patch.photos = row.image_objects_json.map((uri) => ({ uri, width: 0, height: 0 }));
  }

  if ('name' in patched) patch.title = String(d.name ?? '');
  if ('brand' in patched) patch.brand = String(d.brand ?? '');
  if ('model' in patched) patch.model = String(d.model ?? '');
  if ('year' in patched) patch.year = String(d.year ?? '');
  if ('weight' in patched) patch.weight = String(d.weight ?? '');
  if ('dimensions' in patched) patch.dimensions = String(d.dimensions ?? '');
  if ('serial_number' in patched) patch.serialNumber = String(d.serial_number ?? '');
  if ('equipment_description' in patched) patch.description = String(d.equipment_description ?? '');
  if ('category_name' in patched) patch.categoryName = text(d.category_name);
  if ('price' in patched) patch.pricePerUnit = d.price == null ? '' : String(d.price);
  if ('quantity' in patched && row.qty != null) patch.quantity = row.qty;
  if ('currency' in patched) patch.priceCurrency = row.currency as SupportedCurrency;
  if ('grade' in patched && row.grade) patch.grade = row.grade as ScanDraftItem['grade'];
  if ('condition' in patched) {
    patch.condition = Array.isArray(d.condition)
      ? (d.condition as string[])
      : row.condition
        ? [row.condition]
        : [];
  }
  if ('operation_status' in patched && Array.isArray(d.operation_status)) {
    patch.operationStatus = d.operation_status as string[];
  }
  if ('item_location' in patched) {
    patch.locations = row.location ? [row.location] : [];
  }
  if ('country' in patched) {
    patch.locationCountries = d.country ? [String(d.country)] : [];
  }
  if ('marketplace' in patched || 'site_type' in patched) {
    const m = String(d.marketplace ?? d.site_type ?? '');
    if (m === '101lab' || m === '101machine' || m === '101recycle' || m === '101it') {
      patch.marketplace = m;
    }
  }

  if (Object.keys(patch).length === 0) return;

  const state = useScanDraft.getState();
  const index = state.queuedItems.findIndex((i) => i.id === row.sourceId);
  if (index >= 0) {
    state.patchQueuedItem(index, patch);
    return;
  }
  // The single-product shape: the row projects `current`.
  if (state.current?.id === row.sourceId) state.patch(patch);
}

/**
 * `PATCH /drafts/:id/items/:itemId` — one item, honouring `expected_row_version`.
 *
 * The 409 is real, not decorative: a detail panel reads the stale response to
 * reseed itself, and a store that always accepted the write would leave that
 * path untested. The body matches the backend's `stalePatchResponse`
 * (`{ code: 'STALE', current_row_version }`) so a reconciler written for the
 * server recognises it here.
 */
export function patchItem(args: {
  itemId: number | string;
  form_json_patch?: Record<string, unknown>;
  expected_row_version?: number;
}): DraftItemRowFull {
  const row = find(args.itemId);

  if (
    typeof args.expected_row_version === 'number' &&
    args.expected_row_version !== row.row_version
  ) {
    throw new LocalDraftError(
      409,
      { success: false, code: 'STALE', current_row_version: row.row_version },
      'This item changed while you were editing it',
    );
  }

  const envelope = (args.form_json_patch ?? {}) as Record<string, unknown>;
  const patched = (envelope.data ?? {}) as Record<string, unknown>;
  if (args.form_json_patch) {
    /*
      ⚠️ `image_objects` REPLACES, it does not merge.

      `deepMerge` walks plain objects and assigns anything else whole, and an
      ARRAY is "anything else" — so `{ image_objects: [a, b] }` overwrites the
      stored list rather than index-merging into it. That is the behaviour the
      editor needs (removing a photo must shrink the list) and it matches the
      server's `mergeFormJson`. Written down because the opposite would be the
      obvious guess from the function's name.
    */
    row.form_json = deepMerge(row.form_json, args.form_json_patch) as LocalRow['form_json'];
  }
  reproject(row);
  mirrorToScanStore(row, patched, envelope);
  row.row_version += 1;

  return getItem(row.id);
}

/** Which rows a bulk op addresses — the API's two selection shapes. */
function resolveSelection(select: {
  item_ids?: readonly number[];
  exclude_ids?: readonly number[];
  filter?: DraftItemFilter;
  q?: string;
}): LocalRow[] {
  if (Array.isArray(select?.item_ids)) {
    const wanted = new Set(select.item_ids);
    return rows().filter((r) => wanted.has(r.id));
  }
  const excluded = new Set(select?.exclude_ids ?? []);
  return rows().filter(
    (r) =>
      matchesFilter(r, select?.filter ?? 'all') &&
      matchesQuery(r, select?.q ?? '') &&
      !excluded.has(r.id),
  );
}

export interface LocalBulkResult {
  updated: number;
  lot_group_id?: number;
}

/**
 * `POST /drafts/:id/items:bulk`.
 *
 * ⚠️ `delete` and `discard` are ONE op — a soft status change, never a dropped
 * row — exactly as the server treats them. A row the seller discarded has to
 * stay reachable from its own tab, or Discard looks like it failed.
 */
export function bulk(args: {
  op: string;
  select: Parameters<typeof resolveSelection>[0];
  patch?: Record<string, unknown>;
}): LocalBulkResult {
  const touched = resolveSelection(args.select);
  if (touched.length === 0) {
    throw new LocalDraftError(
      400,
      { success: false, code: 'EMPTY_SELECTION' },
      'Nothing was selected',
    );
  }

  const setField = (key: string, value: unknown) => {
    for (const row of touched) {
      row.form_json = deepMerge(row.form_json, { data: { [key]: value } }) as LocalRow['form_json'];
      reproject(row);
      mirrorToScanStore(row, { [key]: value });
      row.row_version += 1;
    }
  };

  let lotGroupId: number | undefined;

  switch (args.op) {
    case 'accept':
      for (const row of touched) {
        row.status = 'accepted';
        row.row_version += 1;
      }
      break;
    case 'discard':
    case 'delete':
      for (const row of touched) {
        row.status = 'discarded';
        row.row_version += 1;
      }
      break;
    case 'set_location':
      setField('item_location', args.patch?.location);
      break;
    case 'set_condition':
      setField('condition', args.patch?.condition);
      break;
    case 'set_country':
      setField('country', args.patch?.country);
      break;
    case 'set_currency':
      setField('currency', args.patch?.currency);
      break;
    case 'set_operation_status':
      setField('operation_status', args.patch?.operation_status);
      break;
    case 'set_marketplace':
      setField('marketplace', args.patch?.marketplace);
      break;
    case 'merge_to_lot': {
      /*
        A lot cannot span marketplaces — the same refusal the server makes,
        with the values named so a screen can say which ones.

        ⚠️ 400 AND `marketplaces`, matching the controller BYTE FOR BYTE
        (`controller/draftItemsController.js:433-441`:
        `res.status(400).json({ success:false, code:'MIXED_MARKETPLACE',
        message, marketplaces })`). This threw a **409** under a `values` key
        until 2026-09-23, so a screen reading the refusal had to know which
        lane it was on to find the offending codes — which is the one thing
        this module exists to prevent. `draftItemsApi.mixedMarketplaceRefusal`
        is now a single reader for both lanes.

        The status matters beyond the key name: `retryUnlessClientError` lets a
        409 through as recoverable-and-worth-reloading, and a 409 is also what
        `isStaleItemWrite` calls a concurrency conflict. A merge refusal is
        neither — it is a flat no about the selection.

        Raised BEFORE any row is stamped, as the server does, so a refused
        merge leaves the draft exactly as it was.
      */
      const codes = [...new Set(touched.map((r) => r.marketplace).filter(Boolean))];
      if (codes.length > 1) {
        throw new LocalDraftError(
          400,
          {
            success: false,
            code: 'MIXED_MARKETPLACE',
            message: 'A combined lot must be a single marketplace; mixed marketplaces detected',
            marketplaces: codes,
          },
          'A lot cannot span marketplaces',
        );
      }
      lotGroupId = Date.now();
      for (const row of touched) {
        row.lot_group_id = lotGroupId;
        row.row_version += 1;
      }
      break;
    }
    case 'split_lot':
      // Splitting rows that are in no lot is a no-op SUCCESS, as the server's is.
      for (const row of touched) {
        row.lot_group_id = null;
        row.row_version += 1;
      }
      break;
    default:
      throw new LocalDraftError(
        400,
        { success: false, code: 'UNSUPPORTED_OP' },
        `Unsupported bulk op: ${args.op}`,
      );
  }

  return { updated: touched.length, ...(lotGroupId ? { lot_group_id: lotGroupId } : null) };
}

/**
 * Convert every row's money to `to`, FROM EACH ROW'S OWN currency.
 *
 * `rates` is passed in so this module stays free of network calls; the caller
 * hands it the live USD-based map. The server's rounding contract is
 * `max(1, round(…))` and it is copied rather than improved.
 */
export function convertCurrency(
  to: string,
  rates: Record<string, number>,
): { updated: number; rate_note: string } {
  const target = to.toUpperCase();
  const rateOf = (code: string) => (Number(rates[code.toUpperCase()]) > 0 ? Number(rates[code.toUpperCase()]) : 1);
  const conv = (amount: number, from: string) =>
    Math.max(1, Math.round((amount / rateOf(from)) * rateOf(target)));

  const range = (raw: unknown, from: string): unknown => {
    if (typeof raw !== 'string') return raw;
    const nums = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
    if (!nums?.length) return raw;
    const parts = nums.slice(0, 2).map((n) => conv(Number(n), from));
    if (parts.length === 2 && parts[0] > parts[1]) parts.reverse();
    return parts.join('-');
  };

  const sources = new Set<string>();

  for (const row of rows()) {
    const from = (row.currency ?? 'USD').toUpperCase();
    sources.add(from);
    const d = row.form_json.data;

    for (const key of ['price', 'ask', 'min_bid']) {
      const n = Number(d[key]);
      if (Number.isFinite(n) && n > 0) d[key] = conv(n, from);
    }
    const prices = d.prices;
    if (prices && typeof prices === 'object') {
      const p = prices as Record<string, unknown>;
      for (const key of ['new', 'used', 'scrap']) {
        if (typeof p[key] === 'string') p[key] = range(p[key], from);
      }
    }
    d.currency = target;

    reproject(row);
    mirrorToScanStore(row, { price: d.price, currency: target, prices: d.prices });
    row.row_version += 1;
  }

  const trim = (n: number) => (n < 1 ? Number(n.toPrecision(4)) : Number(n.toFixed(2)));
  const pair = Number(rates[target]);
  const list = [...sources];
  const rate_note =
    target !== 'USD' && pair > 0
      ? `1 USD ≈ ${trim(pair)} ${target}`
      : list.length === 1 && Number(rates[list[0]]) > 0
        ? `1 ${list[0]} ≈ ${trim(1 / Number(rates[list[0]]))} USD`
        : 'Converted to USD';

  return { updated: rows().length, rate_note };
}

/* ------------------------------------------- the bridge back to the store */

/**
 * Where a row opens in the review wizard.
 *
 * The SERVER lane fetches the item and rebuilds the session around it
 * (`openDetectedItem`); the local lane must not, because the session is already
 * the right one and rebuilding it would drop the other rows AND `mergedSingle`.
 * So the local answer is an INDEX: the position in `queuedItems`, or `-1` for
 * the single `current` — `useReviewItem`'s own convention
 * (`wizardState.ts:118-122`).
 *
 * `null` means the row no longer projects anything in the store.
 */
export function reviewIndexForItem(itemId: number | string): number | null {
  const row = rows().find((r) => r.id === Number(itemId));
  if (!row) return null;

  const state = useScanDraft.getState();
  const index = state.queuedItems.findIndex((i) => i.id === row.sourceId);
  if (index >= 0) return index;
  return state.current?.id === row.sourceId ? -1 : null;
}

/**
 * Carry the seller's accept/discard decisions into the store, on the way out of
 * the detected step.
 *
 * ⚠️ IT REMOVES, IT DOES NOT REBUILD. The obvious implementation — map the
 * accepted rows back into draft items and `hydrateFromServer` them — is what the
 * SERVER lane has to do, and doing it here would silently lose four things the
 * projection cannot carry: every photo but the first, the `ai` blob behind the
 * "✨ AI" badges, `aiPrices`, and `mergedSingle` — the app's only "these are
 * actually one product" path, whose other entry point Phase 6 deletes
 * (`app/scan/detection.tsx`). Removing the rows the seller rejected leaves all
 * four untouched, and is exactly what `app/v2/scan/detected.tsx` did before this
 * module replaced it.
 *
 * "Kept" means ACCEPTED here, not "not discarded": `items.tsx` will not let the
 * seller continue while any row still says `needs_review`, so by this point the
 * two sets are the same — and if that gate is ever relaxed, dropping an
 * undecided row is the safe reading of "I did not choose this one".
 */
export function commitAcceptedRows(): void {
  const keep = new Set(rows().filter((r) => r.status === 'accepted').map((r) => r.sourceId));
  const state = useScanDraft.getState();

  for (const item of state.queuedItems) {
    if (!keep.has(item.id)) state.removeQueuedItem(item.id);
  }
}
