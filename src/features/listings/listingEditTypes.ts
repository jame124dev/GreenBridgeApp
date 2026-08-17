/**
 * Wire types for the seller "edit my listing" contract.
 *
 *   GET   /api/v1/seller/listings/:productId/edit
 *   PATCH /api/v1/seller/listings/:productId
 *
 * Field names below are the PINNED contract names — do not rename them to the
 * app's camelCase. The camelCase <-> snake_case bridge lives in
 * `listingEditMapping.ts` so exactly one file knows both vocabularies.
 *
 * Everything inbound is typed permissively (`string | number | null`) because
 * the backend for this contract is being written in parallel: a listing whose
 * `quantity` arrives as the string "3" must not blow up the editor. The
 * normalizers in `listingEditMapping.ts` are the single place that coerces.
 */

import type { ListingEditMode } from './listingEditPolicy';

/** The editable field bag. Keys are the pinned contract names. */
export interface ListingEditFields {
  title?: string | null;
  description?: string | null;
  /** Multi-select on mobile; the backend may send one value or a list. */
  condition?: string | string[] | null;
  /** `needDeinstall` | `deinstalled` (see `installationFromOperationStatus`). */
  operation_status?: string | string[] | null;
  quantity?: number | string | null;
  grade?: string | null;
  brand?: string | null;
  category_id?: string | number | null;
  category_name?: string | null;
  price_per_unit?: string | number | null;
  /** `buyNow` | `offer` — same vocabulary the create flow posts. */
  price_format?: string | null;
  price_currency?: string | null;
  /** Single pickup address. Multi-location is NOT part of the v1 edit contract. */
  location?: string | null;
  /** Read-only in v1 — rendered locked, never sent back. */
  marketplace?: string | null;
}

/** A contract field name, e.g. `"price_per_unit"`. */
export type ListingEditFieldName = keyof ListingEditFields | 'images';

export interface ListingEditImage {
  attachment_id: number;
  url: string;
}

export interface ListingPendingEdit {
  edit_id: number;
  status: string;
  submitted_at: string;
  /**
   * Contract shows `changed_fields: {...}` on the seller GET without pinning the
   * value shape (the ADMIN list pins `{ from, to }`). Accept both a bare value
   * and a `{from,to}` pair; `readPendingChange()` normalizes.
   */
  changed_fields: Record<string, unknown>;
}

export type ListingLockReason = 'sold' | 'not_owner' | (string & {});

export interface ListingEditResource {
  product_id: number;
  batch_id?: number | null;
  seller_id?: number | null;
  batch_status?: string | null;
  is_sold?: boolean;
  fields: ListingEditFields;
  images: ListingEditImage[];
  pending_edit: ListingPendingEdit | null;
  editable: boolean;
  lock_reason: ListingLockReason | null;
  /**
   * NOT in the pinned contract. If the backend ever echoes its
   * `LISTING_EDIT_MODE` here the app will honour it; until then the app falls
   * back to its own config (see `resolveEditMode`). Without this the app can
   * only GUESS which fields need approval before the seller taps save.
   */
  edit_mode?: ListingEditMode | null;
}

/** Body of `PATCH /seller/listings/:productId` — only the changed fields. */
export type ListingEditPatchBody = Partial<ListingEditFields> & {
  /**
   * Retained photo IDS, in order. Sent only when a photo was removed.
   *
   * IDs, not `{attachment_id,url}` objects: the server validates this as
   * "the list of photo ids to keep" (`collectChanges` in
   * `services/listingEditService.js` maps each entry through `Number()`), so an
   * object list is rejected as an empty keep-set with a 400.
   */
  images?: number[];
};

export interface ListingEditPatchResult {
  /** Contract field names written live immediately. */
  applied: string[];
  /** Contract field names held for admin review. */
  pending_review: string[];
  edit_id: number | null;
  /** Human sentence from the API. English-only, so it is a fallback, not the headline. */
  message?: string;
}
