/**
 * The one place that knows BOTH vocabularies: the pinned edit contract's
 * snake_case field bag and the app's existing `DetailFormInput` (the RHF shape
 * the scan-detail cards in `features/scanner/components/detail/*` already
 * render). Keeping it here means the edit screen reuses those cards unchanged.
 *
 * It also owns dirty-field diffing. The PATCH must carry ONLY changed fields,
 * so `buildListingEditChangeSet` compares a frozen hydration baseline against
 * the live form and emits both the body and the list of contract field names
 * (used to label what went live vs what needs approval).
 */

import { z } from 'zod';

import {
  DEFAULT_OPERATION_STATUS,
  marketplaceFromSiteType,
  operationStatusForInstallation,
} from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { ItemGrade, MarketplaceKey, SupportedCurrency } from '@/stores/scanDraftStore';

import type {
  ListingEditFields,
  ListingEditImage,
  ListingEditPatchBody,
  ListingEditResource,
} from './listingEditTypes';

/* ── inbound normalizers ─────────────────────────────────────────────────── */

export function toStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((s) => s.trim().length > 0);
  if (typeof v === 'string' && v.trim().length > 0) return [v.trim()];
  return [];
}

const GRADES: ItemGrade[] = ['A', 'B', 'C', 'D'];

export function toGrade(v: unknown): ItemGrade {
  const s = String(v ?? '').trim().toUpperCase();
  return (GRADES as string[]).includes(s) ? (s as ItemGrade) : 'A';
}

export function toCurrency(v: unknown): SupportedCurrency {
  return String(v ?? '').trim().toUpperCase() === 'TWD' ? 'TWD' : 'USD';
}

/**
 * `buyNow` | `offer`. Tolerates the aliases other GreenBidz surfaces use for
 * the same two ideas so a listing created on the web still opens correctly.
 */
export function toPriceFormat(v: unknown): 'buyNow' | 'offer' {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'offer' || s === 'make_offer' || s === 'makeoffer') return 'offer';
  return 'buyNow';
}

/**
 * Inverse of `operationStatusForInstallation`: the create flow stores
 * `installed → ["needDeinstall"]` and `deinstalled → ["deinstalled"]`, so the
 * editor has to read it back the same way or the picker would show the wrong
 * side and then "change" a field the seller never touched.
 */
export function installationFromOperationStatus(v: unknown): 'installed' | 'deinstalled' {
  const list = toStringList(v).map((s) => s.toLowerCase());
  if (list.includes('needdeinstall') || list.includes('installed')) return 'installed';
  return 'deinstalled';
}

export function toMarketplace(v: unknown): MarketplaceKey {
  const raw = String(v ?? '').trim();
  return marketplaceFromSiteType(raw) ?? '101lab';
}

function priceToString(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

/* ── hydration: contract → RHF form ──────────────────────────────────────── */

/**
 * Map the API's `fields` into the shape the existing detail cards render.
 *
 * Fields the v1 edit contract does not carry (model, year, weight, dimensions,
 * CO2, serial, documents, multi-location, country) are hydrated EMPTY and the
 * edit screen does not mount the cards that own them — an input the seller can
 * type into that the save silently discards is exactly the "wonders instead of
 * understands" failure the marketplace lock is designed to avoid.
 */
export function listingToFormValues(resource: ListingEditResource): DetailFormInput {
  const f = resource.fields ?? {};
  const operationStatus = toStringList(f.operation_status);
  return {
    title: f.title ?? '',
    description: f.description ?? '',
    categoryId: f.category_id != null ? String(f.category_id) : '',
    categoryName: f.category_name ?? '',
    customSubcategory: '',
    parentCategoryId: '',
    parentCategoryName: '',
    condition: toStringList(f.condition),
    operationStatus: operationStatus.length ? operationStatus : [...DEFAULT_OPERATION_STATUS],
    priceFormat: toPriceFormat(f.price_format),
    pricePerUnit: priceToString(f.price_per_unit),
    priceCurrency: toCurrency(f.price_currency),
    quantity: Math.max(1, Number(f.quantity ?? 1) || 1),
    locations: [f.location ?? ''],
    locationCountries: [''],
    brand: f.brand ?? '',
    model: '',
    year: '',
    weight: '',
    dimensions: '',
    co2Emissions: '',
    grade: toGrade(f.grade),
    serialNumber: '',
    marketplace: toMarketplace(f.marketplace),
    installation: installationFromOperationStatus(f.operation_status),
    listingDurationDays: 90,
  };
}

/* ── validation ──────────────────────────────────────────────────────────── */

/**
 * "You can change it, you can't blank it."
 *
 * A published listing may legitimately be missing a field the create form
 * demands (older rows, imports, admin-created listings). Demanding it here
 * would lock the seller out of editing their DESCRIPTION because some unrelated
 * field the server never sent is empty. So each requirement is switched on only
 * when the hydrated listing actually had a value for it.
 */
export function makeListingEditSchema(baseline: DetailFormInput) {
  const had = (s: string | undefined) => (s ?? '').trim().length > 0;
  const requireTitle = had(baseline.title);
  const requireDescription = had(baseline.description);
  const requireCategory = had(baseline.categoryId);
  const requireCondition = baseline.condition.length > 0;
  const requireLocation = had(baseline.locations[0]);

  return z
    .object({
      title: z.string(),
      description: z.string(),
      categoryId: z.string(),
      categoryName: z.string().optional(),
      customSubcategory: z.string().optional(),
      parentCategoryId: z.string().optional(),
      parentCategoryName: z.string().optional(),
      condition: z.array(z.string()),
      operationStatus: z.array(z.string()),
      priceFormat: z.enum(['buyNow', 'offer']),
      pricePerUnit: z.string().optional(),
      priceCurrency: z.enum(['USD', 'TWD']),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      locations: z.array(z.string()),
      locationCountries: z.array(z.string()),
      brand: z.string().optional(),
      model: z.string().optional(),
      year: z.string().optional(),
      weight: z.string().optional(),
      dimensions: z.string().optional(),
      co2Emissions: z.string().optional(),
      grade: z.enum(['A', 'B', 'C', 'D']),
      serialNumber: z.string().optional(),
      marketplace: z.enum(['101lab', '101machine', '101recycle', '101it']),
      installation: z.enum(['installed', 'deinstalled']),
      listingDurationDays: z.number().int().positive(),
    })
    .superRefine((data, ctx) => {
      if (requireTitle && !data.title.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Title is required', path: ['title'] });
      }
      if (requireDescription && !data.description.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Description is required',
          path: ['description'],
        });
      }
      if (requireCategory && !data.categoryId.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Category is required', path: ['categoryId'] });
      }
      if (requireCondition && data.condition.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select at least one condition',
          path: ['condition'],
        });
      }
      if (requireLocation && !(data.locations[0] ?? '').trim()) {
        ctx.addIssue({ code: 'custom', message: 'Address is required', path: ['locations', 0] });
      }
      if (data.priceFormat === 'buyNow' && !(data.pricePerUnit ?? '').trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Price is required for buy now',
          path: ['pricePerUnit'],
        });
      }
    });
}

/* ── diffing ─────────────────────────────────────────────────────────────── */

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ListingEditChangeSet {
  /** Contract field names that changed, in a stable display order. */
  fields: string[];
  /** PATCH body — only the changed fields. Empty object when nothing changed. */
  body: ListingEditPatchBody;
}

/**
 * Display/emit order. Also the order the "what changed" summaries read in, so
 * the seller always sees the same sequence on the badge strip and the receipt.
 */
export const LISTING_EDIT_FIELD_ORDER: string[] = [
  'title',
  'description',
  'brand',
  'category_id',
  'category_name',
  'condition',
  'grade',
  'operation_status',
  'quantity',
  'price_format',
  'price_per_unit',
  'price_currency',
  'location',
  'images',
];

function orderFields(fields: string[]): string[] {
  return [...fields].sort((a, b) => {
    const ia = LISTING_EDIT_FIELD_ORDER.indexOf(a);
    const ib = LISTING_EDIT_FIELD_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

/** Order-insensitive comparison for the multi-select lists. */
function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Emit a list back in the shape the server sent it. If the backend modelled
 * `condition` as a scalar we must not hand it an array (and vice versa).
 */
function shapeLikeOriginal(
  original: string | string[] | null | undefined,
  next: string[],
): string | string[] {
  if (typeof original === 'string') return next[0] ?? '';
  return next;
}

/**
 * `offer` listings carry no unit price — the create flow posts `price_per_unit`
 * as '' whenever the format is not buyNow (`buildFormData.ts`). Mirroring that
 * here keeps "switch to Make offer" from leaving a stale price behind.
 */
function effectivePrice(values: DetailFormInput): string {
  return values.priceFormat === 'buyNow' ? (values.pricePerUnit ?? '').trim() : '';
}

function samePrice(a: string, b: string): boolean {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return false;
}

export function imageIdsOf(images: readonly ListingEditImage[]): number[] {
  return images.map((i) => i.attachment_id);
}

/**
 * Compare a frozen hydration baseline against the live form and produce the
 * minimal PATCH body.
 *
 * `marketplace` is deliberately absent from every branch: v1 rejects it, so the
 * app must never send it even if something upstream mutates the form value.
 */
export function buildListingEditChangeSet(args: {
  baseline: DetailFormInput;
  current: DetailFormInput;
  /** Raw inbound `fields`, used only to echo list/scalar shape back. */
  original?: ListingEditFields;
  baselineImages?: readonly ListingEditImage[];
  keptImages?: readonly ListingEditImage[];
  categoryOptions?: readonly CategoryOption[];
}): ListingEditChangeSet {
  const { baseline, current, original = {}, categoryOptions } = args;
  const baselineImages = args.baselineImages ?? [];
  const keptImages = args.keptImages ?? baselineImages;

  const body: ListingEditPatchBody = {};
  const fields: string[] = [];

  const title = current.title.trim();
  if (title !== baseline.title.trim()) {
    body.title = title;
    fields.push('title');
  }

  const description = current.description.trim();
  if (description !== baseline.description.trim()) {
    body.description = description;
    fields.push('description');
  }

  const brand = (current.brand ?? '').trim();
  if (brand !== (baseline.brand ?? '').trim()) {
    body.brand = brand;
    fields.push('brand');
  }

  if (current.categoryId.trim() !== baseline.categoryId.trim()) {
    body.category_id = current.categoryId.trim();
    fields.push('category_id');
    const resolved = categoryOptions?.find((o) => o.id === current.categoryId.trim());
    if (resolved) {
      body.category_name = resolved.name;
      fields.push('category_name');
    }
  }

  if (!sameList(current.condition, baseline.condition)) {
    body.condition = shapeLikeOriginal(original.condition, current.condition);
    fields.push('condition');
  }

  if (current.grade !== baseline.grade) {
    body.grade = current.grade;
    fields.push('grade');
  }

  const nextOpStatus = operationStatusForInstallation(current.installation);
  const prevOpStatus = operationStatusForInstallation(baseline.installation);
  if (!sameList(nextOpStatus, prevOpStatus)) {
    body.operation_status = shapeLikeOriginal(original.operation_status, nextOpStatus);
    fields.push('operation_status');
  }

  if (Number(current.quantity) !== Number(baseline.quantity)) {
    body.quantity = Number(current.quantity);
    fields.push('quantity');
  }

  if (current.priceFormat !== baseline.priceFormat) {
    body.price_format = current.priceFormat;
    fields.push('price_format');
  }

  const nextPrice = effectivePrice(current);
  if (!samePrice(nextPrice, effectivePrice(baseline))) {
    body.price_per_unit = nextPrice;
    fields.push('price_per_unit');
  }

  if (current.priceCurrency !== baseline.priceCurrency) {
    body.price_currency = current.priceCurrency;
    fields.push('price_currency');
  }

  const nextLocation = (current.locations[0] ?? '').trim();
  if (nextLocation !== (baseline.locations[0] ?? '').trim()) {
    body.location = nextLocation;
    fields.push('location');
  }

  const keptIds = imageIdsOf(keptImages);
  const baseIds = imageIdsOf(baselineImages);
  if (keptIds.length !== baseIds.length || keptIds.some((id, i) => id !== baseIds[i])) {
    // REVIEW FIX: the shipped backend (`services/listingEditService.js`
    // collectChanges → `value.map(Number)`) reads `images` as the list of photo
    // IDS TO KEEP. Sending `[{attachment_id,url}]` coerced to NaN, filtered to
    // an empty keep-list and 400'd every photo deletion with "A listing needs
    // at least one photo" — i.e. deletion never worked. Send ids, in order.
    body.images = keptIds;
    fields.push('images');
  }

  return { fields: orderFields(fields), body };
}

/* ── pending-edit helpers ────────────────────────────────────────────────── */

/**
 * The admin contract pins `changed_fields: { field: { from, to } }`; the seller
 * GET only says `changed_fields: {...}`. Read both.
 */
export function readPendingChange(raw: unknown): { from?: string; to?: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if ('to' in o || 'from' in o) {
      return {
        from: o.from == null ? undefined : String(o.from),
        to: o.to == null ? undefined : String(o.to),
      };
    }
  }
  if (raw == null) return {};
  return { to: String(raw) };
}
