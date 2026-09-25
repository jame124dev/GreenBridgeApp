/**
 * `requiredFields` — the fields a detected item must carry before it can be
 * ACCEPTED, and the labels that name them to the seller.
 *
 * A direct port of the web's gate:
 * `nextjs-port/src/valuation/pages/new-submission-upload/components/scanv2/reviewBulk.ts:1131`
 * (`missingRequiredFields`) and `:1102` (`REQUIRED_FIELD_LABELS`). Same seven
 * fields, same ORDER — the order is load-bearing, because "take me to the first
 * error" means the first entry of this list, and the editor lays its required
 * block out in exactly this sequence so "first missing" is always the topmost
 * one on screen.
 *
 * ── WHY EACH ONE IS HERE (the web's reasoning, kept) ───────────────────────
 *
 * The seven mirror the manual `/upload` flow's `getMissingFields`, with two
 * deliberate omissions:
 *   · PRICE — the Valuation step sets it AFTER Accept, and `/upload` does not
 *     require it either.
 *   · QUANTITY — a scan always yields an effective quantity of ≥1, so it is
 *     never empty here.
 *
 * PHOTOS are required for the same reason LOCATION is: an item read out of a
 * DOCUMENT has no photograph at all, and those items were previously
 * acceptable and publishable with nothing for a buyer to look at.
 *
 * ⚠️ AND THAT IS ONLY SAFE BECAUSE THE EDITOR SHIPS A WORKING "ADD PHOTO".
 * The web shipped this gate while its add-photo control was broken for the
 * least-privileged user who reached it, which made every document-sourced item
 * permanently unacceptable — a dead end introduced by the gate itself (root
 * `CLAUDE.md`, "Making a field REQUIRED is only half the change"). `photos`
 * stays in this list only for as long as `app/v2/scan/item.tsx` can FILL it;
 * if that control is ever removed, this entry goes with it.
 *
 * ── ⚠️ THIS PREDICATE NEEDS A FULL ITEM, NOT A LIST ROW ────────────────────
 *
 * The server's list projection (`helper/draftItemsQuery.js` — `LIST_ATTRIBUTES`
 * + `LIST_JSON_PROJECTIONS`) carries brand/model/year/condition/location/qty
 * and the valuation figures, and **neither `description` nor
 * `operation_status`**. Handed a lean list row this function therefore reports
 * those two missing on an item that has them. The web does exactly that in its
 * row-level Accept (`ScanV2ReviewGrid.tsx:685-694` reads `itemsRef.current`),
 * which is why row-Accept there can never accept directly.
 *
 * So every caller here loads the item first (`getDraftItem`) and gates on the
 * FULL row — `app/v2/scan/items.tsx` awaits it before deciding, and
 * `app/v2/scan/item.tsx` already holds one. See `MISTAKES.md` 2026-09-23.
 *
 * Pure module: no React, no i18n instance, no network. Labels carry an
 * `i18nKey` with English inline, matching `spine.ts` and the web.
 */

/** The fields a listing must carry BEFORE it can be accepted for review. */
export type RequiredField =
  | 'title'
  | 'category'
  | 'condition'
  | 'operationStatus'
  | 'description'
  | 'location'
  | 'photos';

/**
 * THE ORDER. First entry that is missing is the one the editor scrolls to.
 * Keep it in step with the field order in `app/v2/scan/item.tsx`.
 */
export const REQUIRED_FIELDS: readonly RequiredField[] = [
  'title',
  'category',
  'condition',
  'operationStatus',
  'description',
  'location',
  'photos',
];

/** Human i18n keys + English fallbacks for each required field, for the UI. */
export const REQUIRED_FIELD_LABELS: Record<
  RequiredField,
  { i18nKey: string; label: string }
> = {
  title: { i18nKey: 'mobile.scanv2.item.fieldTitle', label: 'Title' },
  category: { i18nKey: 'mobile.scanv2.item.fieldCategory', label: 'Category' },
  condition: { i18nKey: 'mobile.scanv2.item.fieldCondition', label: 'Condition' },
  operationStatus: {
    i18nKey: 'mobile.scanv2.item.fieldOperationStatus',
    label: 'Installation',
  },
  description: { i18nKey: 'mobile.scanv2.item.fieldDescription', label: 'Description' },
  location: { i18nKey: 'mobile.scanv2.item.fieldLocation', label: 'Location' },
  photos: { i18nKey: 'mobile.scanv2.item.fieldPhotos', label: 'Photos' },
};

/* ------------------------------------------------------------------ reading */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * A scalar as a trimmed string; an ARRAY → its first non-empty entry; an object
 * → `''`.
 *
 * The array case is not a nicety: `operation_status` is a `string[]` in the
 * mobile store (`DEFAULT_OPERATION_STATUS = ['working']`), `condition` is a
 * `string[]` too, and the vision lane writes `locations: []`. Reading any of
 * them with `String(v)` yields `"working"` for one element and `"a,b"` for two.
 */
export function scalarStr(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = scalarStr(x);
      if (s) return s;
    }
    return '';
  }
  if (typeof v === 'object') return '';
  return String(v).trim();
}

/** First non-empty scalar of the given candidates. */
function firstStr(...vals: unknown[]): string {
  for (const v of vals) {
    const s = scalarStr(v);
    if (s) return s;
  }
  return '';
}

/** `{ id, name }` → name — the taxonomy shape the vision lane writes. */
function nameOf(v: unknown): string {
  return isPlainObject(v) ? scalarStr(v.name) : '';
}

/**
 * LOCATION across lanes, in the BACKEND's own precedence.
 *
 * Copied verbatim from `reviewBulk.ts:722`, including the order, which is
 * `helper/draftToProducts.resolveLocations` — the function that decides where
 * the item actually gets PUBLISHED. Display follows publish, never the other
 * way round, or a row can show one place and publish another.
 */
export const LOCATION_KEYS = ['locations', 'item_location', 'address', 'location'] as const;

/** The item's AI payload: `form_json.data` when present, else the bare blob. */
export function itemData(item: unknown): Record<string, unknown> {
  const fj = isPlainObject(item) ? (item as { form_json?: unknown }).form_json : undefined;
  if (!isPlainObject(fj)) return {};
  return isPlainObject(fj.data) ? fj.data : fj;
}

/** The `form_json` ENVELOPE (`image_objects`, `unit_kind`, …); `{}` for a bare blob. */
export function itemEnvelope(item: unknown): Record<string, unknown> {
  const fj = isPlainObject(item) ? (item as { form_json?: unknown }).form_json : undefined;
  if (!isPlainObject(fj)) return {};
  return isPlainObject(fj.data) ? fj : {};
}

/**
 * First non-empty scalar for `keys`, FLAT on the row first, then in its data.
 *
 * The flat column wins because that is what the server publishes from and what
 * the list screen shows, so the gate cannot disagree with either.
 */
export function rowField(row: unknown, ...keys: readonly string[]): string {
  const r = isPlainObject(row) ? row : {};
  for (const k of keys) {
    const s = scalarStr(r[k]);
    if (s) return s;
  }
  const d = itemData(row);
  for (const k of keys) {
    const s = scalarStr(d[k]);
    if (s) return s;
  }
  return '';
}

/**
 * The category NAME the server itself would show, in the server's own
 * precedence (`deriveDenormFields`: subcategory.name → product_cat.name →
 * category_name), plus the office lane's `parent_category` and the legacy flat
 * `category` as read-only fallbacks.
 */
export function readCategory(item: unknown): string {
  const d = itemData(item);
  const flat = isPlainObject(item) ? scalarStr(item.category_name) : '';
  return (
    firstStr(
      nameOf(d.subcategory),
      nameOf(d.product_cat),
      d.category_name,
      d.parent_category,
      d.category,
    ) || flat
  );
}

/** The item's long description. Extraction writes `equipment_description`. */
export function readDescription(item: unknown): string {
  const d = itemData(item);
  return firstStr(d.equipment_description, d.description);
}

/**
 * The item's photo objects, de-duplicated, in order.
 *
 * ⚠️ THREE PLACES A PHOTO CAN LIVE, and the gate has to accept all of them —
 * the web learned this the expensive way (`reviewBulk.ts:1065`):
 *
 *   · `image_objects_json` — the projected column, the normal case;
 *   · `form_json.image_objects` — where a JUST-ADDED photo lands, because the
 *     editor's patch is `form_json_patch: { image_objects: [...] }` and the
 *     projected column lags one read behind. Reading only the column meant the
 *     thumbnail updated — the seller could SEE their photo — while "Needs a
 *     photo" and the Accept block stayed on, which is the most confusing
 *     possible state;
 *   · `thumbnail_object` — all a LEAN LIST ROW carries.
 *
 * Entries are strings here (a GCS object name on the server lane, a `file://`
 * URI on the local one); `draftItemThumbUri` is what makes either renderable.
 * An `{ objectName }` object is also tolerated, because that is the shape the
 * server's media list uses on some rows.
 */
export function itemPhotoObjects(item: unknown): string[] {
  const row = (isPlainObject(item) ? item : {}) as {
    image_objects_json?: unknown;
    thumbnail_object?: unknown;
  };
  const env = itemEnvelope(item) as { image_objects?: unknown };

  const raw =
    Array.isArray(row.image_objects_json) && row.image_objects_json.length
      ? row.image_objects_json
      : Array.isArray(env.image_objects) && env.image_objects.length
        ? env.image_objects
        : row.thumbnail_object
          ? [row.thumbnail_object]
          : [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of raw) {
    const v =
      typeof o === 'string'
        ? o.trim()
        : isPlainObject(o)
          ? scalarStr(o.objectName ?? o.object ?? o.uri ?? o.url)
          : '';
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/* ------------------------------------------------------------------- gating */

/**
 * The required fields this item does NOT have, in `REQUIRED_FIELDS` order.
 *
 * Hand it a FULL item (`getDraftItem`), not a list row — see the warning at the
 * top of this file.
 */
export function missingRequiredFields(item: unknown): RequiredField[] {
  if (!item) return [];
  const d = itemData(item);
  const missing: RequiredField[] = [];

  if (!rowField(item, 'title', 'name')) missing.push('title');
  if (!readCategory(item)) missing.push('category');
  if (!rowField(item, 'condition')) missing.push('condition');
  if (!scalarStr(d.operation_status)) missing.push('operationStatus');
  if (!readDescription(item)) missing.push('description');
  if (!rowField(item, ...LOCATION_KEYS)) missing.push('location');
  if (itemPhotoObjects(item).length === 0) missing.push('photos');

  return missing;
}

/** Every required field is present. */
export function isAcceptable(item: unknown): boolean {
  return missingRequiredFields(item).length === 0;
}
