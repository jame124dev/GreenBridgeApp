/**
 * The Accept gate — which required listing fields an item is still missing.
 *
 * A port of the web's `missingRequiredFields`
 * (`nextjs-port/src/valuation/pages/new-submission-upload/components/scanv2/reviewBulk.ts:1131`),
 * field for field and in the same order, so the two surfaces refuse to accept
 * the same rows for the same reasons. The behaviour it drives is also the
 * web's: a row that is missing anything cannot be accepted, the row NAMES the
 * gaps ("Needs: Operation status, Location"), and pressing Accept opens the
 * editor on the FIRST gap rather than showing a toast.
 *
 * ⚠️ WHAT THE LIST PROJECTION CAN AND CANNOT SEE.
 *
 * The server's list endpoint is a deliberately lightweight projection and
 * "NEVER includes form_json" (`backend/helper/draftItemsQuery.js`, the
 * LIST_JSON_PROJECTIONS docblock). It DOES carry `title`, `category_name`,
 * `condition`, `location`, `qty`, `brand`, `model` and `year`, and mobile's
 * `DraftItem` declares all of them (`draftItemsApi.ts:158-174`) — so five of
 * the seven fields are checkable straight off a list row.
 *
 * It does NOT carry `operation_status` or `equipment_description`: both live in
 * `form_json.data`. So:
 *
 *   · on the LOCAL lane (a fresh scan, `local-N`), `localDraftSource` puts
 *     `form_json: { data: … }` on every row, so all SEVEN fields are checked;
 *   · on a resumed SERVER draft the list rows have no `form_json`, so those two
 *     cannot be asserted from the list and are simply not reported as missing.
 *
 * That is a reporting limit, not a hole in the gate: the editor fetches the
 * full item (`DraftItemFull`), where both fields are present, and the server
 * re-validates on write behind `SCANV2_ITEM_VALIDATION`. `hasFormData()` below
 * exists so a caller can tell the two situations apart instead of reading an
 * absent field as an empty one.
 *
 * ⚠️ PHOTOS ARE REQUIRED, and that is only safe while the editor can ADD one.
 * The web shipped this exact rule with a broken "Add photos" control and made
 * every document-sourced item permanently unacceptable — a real dead end, in
 * the workspace `MISTAKES.md`. A spreadsheet row often has no photograph at
 * all. Before changing where Accept sends the seller, confirm the destination
 * still offers a working way to add one.
 */

/** The required fields, in the order the web reports them. */
export type RequiredListingField =
  | 'title'
  | 'category'
  | 'condition'
  | 'operationStatus'
  | 'description'
  | 'location'
  | 'photos';

/**
 * The shape this reads. Intentionally structural rather than `DraftItem`, so
 * it works on a list row, a full item, and a test fixture without casting.
 */
export interface GateableRow {
  title?: string | null;
  category_name?: string | null;
  condition?: string | null;
  location?: string | null;
  thumbnail_object?: string | null;
  image_objects_json?: unknown;
  form_json?: unknown;
}

/** Non-empty after trimming. Treats a non-string (a number, say) as present. */
function filled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** `form_json.data`, or null when the projection did not carry it. */
function itemData(item: GateableRow): Record<string, unknown> | null {
  const fj = item.form_json;
  if (!fj || typeof fj !== 'object') return null;
  const data = (fj as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  return data as Record<string, unknown>;
}

/**
 * True when this row carries `form_json.data` — i.e. when `operationStatus`
 * and `description` are actually checkable. A caller that wants to say "2 more
 * to publish" honestly should use this rather than assuming an absent field is
 * an empty one.
 */
export function hasFormData(item: GateableRow | null | undefined): boolean {
  return !!item && itemData(item) != null;
}

/** How many photos this row has, counting every place one can be recorded. */
function photoCount(item: GateableRow): number {
  if (Array.isArray(item.image_objects_json)) return item.image_objects_json.length;
  const d = itemData(item);
  const fromData = d?.image_objects;
  if (Array.isArray(fromData)) return fromData.length;
  // A thumbnail is a photo: the local lane sets it from the row's first image,
  // and a document row that yielded an embedded picture has one.
  return filled(item.thumbnail_object) ? 1 : 0;
}

/**
 * The fields this item still needs before it can be accepted.
 * Empty array ⇒ acceptable.
 */
export function missingRequiredFields(
  item: GateableRow | null | undefined,
): RequiredListingField[] {
  if (!item) return [];
  const d = itemData(item);
  const missing: RequiredListingField[] = [];

  if (!filled(item.title)) missing.push('title');
  if (!filled(item.category_name) && !filled(d?.category_name) && !filled(d?.subcategory)) {
    missing.push('category');
  }
  if (!filled(item.condition) && !filled(d?.condition)) missing.push('condition');
  // Only assertable when the projection carried form_json — see the docblock.
  if (d && !filled(d.operation_status)) missing.push('operationStatus');
  if (d && !filled(d.equipment_description) && !filled(d.description)) missing.push('description');
  if (!filled(item.location) && !filled(d?.item_location)) missing.push('location');
  if (photoCount(item) === 0) missing.push('photos');

  return missing;
}

/** i18n key + English fallback for each field, for the row chip and the editor. */
export const REQUIRED_FIELD_LABELS: Record<
  RequiredListingField,
  { i18nKey: string; label: string }
> = {
  title: { i18nKey: 'mobile.scanv2.required.title', label: 'Title' },
  category: { i18nKey: 'mobile.scanv2.required.category', label: 'Category' },
  condition: { i18nKey: 'mobile.scanv2.required.condition', label: 'Condition' },
  operationStatus: {
    i18nKey: 'mobile.scanv2.required.operationStatus',
    label: 'Operation status',
  },
  description: { i18nKey: 'mobile.scanv2.required.description', label: 'Description' },
  location: { i18nKey: 'mobile.scanv2.required.location', label: 'Location' },
  photos: { i18nKey: 'mobile.scanv2.required.photos', label: 'Photos' },
};
