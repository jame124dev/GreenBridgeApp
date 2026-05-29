import type { DraftItem } from '@/stores/scanDraftStore';

import { detailSchema, type DetailFormInput } from './schema';

// Single source of truth for the Detail screen's "what's still required" state.
// Both the REQUIRED bar and the Submit-disabled gate read from here, so the bar
// can never claim "complete" while `handleSubmit` (which runs the same
// `detailSchema`) silently blocks. Photos live on the draft, not in the form,
// so they're folded in separately.

export const REQUIRED_ROWS = [
  'photos',
  'title',
  'description',
  'category',
  'condition',
  'price',
  'location',
] as const;

export type RequiredRowKey = (typeof REQUIRED_ROWS)[number];

export type RequiredStatus = {
  /** Per-visible-row completion, for the bar's summary rows. */
  rows: Record<RequiredRowKey, boolean>;
  /** Count of visible rows done, for the "in progress (n/total)" header. */
  doneCount: number;
  /** Total visible rows. */
  total: number;
  /**
   * True only when photos are present AND the full `detailSchema` passes.
   * Drives both the "complete" header and `disabled` on Submit, guaranteeing
   * the gate agrees with what `handleSubmit` enforces — including unmapped
   * fields (e.g. operationStatus/quantity) and the buyNow price `superRefine`.
   */
  allComplete: boolean;
};

// Map a zod issue's top-level path to a visible bar row. Fields without a row
// (operationStatus, quantity) return null — they still gate `allComplete` via
// the full schema parse below, they just aren't surfaced as their own row.
function rowForPath(path: PropertyKey[]): RequiredRowKey | null {
  switch (path[0]) {
    case 'title':
      return 'title';
    case 'description':
      return 'description';
    case 'categoryId':
      return 'category';
    case 'condition':
      return 'condition';
    case 'pricePerUnit':
      return 'price';
    // S5.2: multi-location. Both array fields + any per-index issue collapse
    // to the single visible "location" row in the bar.
    case 'locations':
    case 'locationCountries':
      return 'location';
    default:
      return null;
  }
}

/**
 * W6 (scan_v3) — DraftItem → DetailFormInput projection so the same required-
 * status engine can be queried from the grouped-review summary (which works
 * with `DraftItem[]`) without duplicating the schema's validation logic. Keeps
 * `getRequiredStatus` as the single source of truth.
 */
function draftToFormInput(draft: DraftItem): DetailFormInput {
  return {
    title: draft.title,
    description: draft.description,
    categoryId: draft.categoryId ?? '',
    categoryName: draft.categoryName ?? '',
    condition: draft.condition,
    operationStatus: draft.operationStatus,
    priceFormat: draft.priceFormat,
    pricePerUnit: draft.pricePerUnit,
    priceCurrency: draft.priceCurrency,
    quantity: draft.quantity,
    locations: draft.locations,
    locationCountries: draft.locationCountries,
    brand: draft.brand,
    model: draft.model,
    year: draft.year,
    weight: draft.weight,
    dimensions: draft.dimensions,
    co2Emissions: draft.co2Emissions,
    grade: draft.grade,
    serialNumber: draft.serialNumber,
    marketplace: draft.marketplace,
    installation: draft.installation,
    listingDurationDays: draft.listingDurationDays,
  };
}

/**
 * W6 (scan_v3) — convenience wrapper that runs `getRequiredStatus` against a
 * persisted DraftItem. Used by the grouped-review summary screen to compute
 * per-item `quickStatus: 'verified' | 'has_issues'` badges + the submit gate.
 */
export function getDraftRequiredStatus(draft: DraftItem): RequiredStatus {
  return getRequiredStatus(draftToFormInput(draft), draft.photos?.length ?? 0);
}

export function getRequiredStatus(
  values: DetailFormInput,
  photoCount: number,
): RequiredStatus {
  const rows: Record<RequiredRowKey, boolean> = {
    photos: photoCount > 0,
    title: true,
    description: true,
    category: true,
    condition: true,
    price: true,
    location: true,
  };

  const parsed = detailSchema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const row = rowForPath(issue.path);
      if (row) rows[row] = false;
    }
  }

  const doneCount = REQUIRED_ROWS.filter((k) => rows[k]).length;
  const allComplete = rows.photos && parsed.success;

  return { rows, doneCount, total: REQUIRED_ROWS.length, allComplete };
}
