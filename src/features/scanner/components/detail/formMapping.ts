import { DEFAULT_OPERATION_STATUS } from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { DraftItem } from '@/stores/scanDraftStore';

/**
 * Shared form↔draft mapping for the scan-detail RHF form.
 *
 * Used by both the single-product editor (`useDetailController` ->
 * `app/scan/detail.tsx`) and the multi-product wizard
 * (`app/scan/grouped-review.tsx`). Keeping the mapping in one place avoids
 * forks between the two surfaces (a class of bug the multi-product-wizard
 * plan's pre-coding note #1 specifically calls out).
 *
 * `buildDraftPatch` takes the categories option list as a parameter rather
 * than calling the React Query hook itself, so this module stays pure (no
 * hook calls) and is callable from any submit path.
 */

export function emptyDetailDefaults(): DetailFormInput {
  return {
    title: '',
    description: '',
    categoryId: '',
    customSubcategory: '',
    parentCategoryId: '',
    parentCategoryName: '',
    condition: [],
    operationStatus: [...DEFAULT_OPERATION_STATUS],
    priceFormat: 'buyNow',
    pricePerUnit: '',
    priceCurrency: 'USD',
    quantity: 1,
    locations: [],
    locationCountries: [],
    brand: '',
    model: '',
    year: '',
    weight: '',
    dimensions: '',
    co2Emissions: '',
    grade: 'A',
    serialNumber: '',
    marketplace: '101lab',
    installation: 'deinstalled',
    listingDurationDays: 90,
  };
}

export function draftToFormValues(draft: DraftItem): DetailFormInput {
  return {
    title: draft.title,
    description: draft.description,
    categoryId: draft.categoryId ?? '',
    customSubcategory: draft.customSubcategory ?? '',
    parentCategoryId: draft.parentCategoryId ?? '',
    parentCategoryName: draft.parentCategoryName ?? '',
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

export type CategoryOption = { id: string; name: string };

/**
 * Layer RHF form values onto an existing DraftItem. Categories options come
 * from the caller (typically `useLabCategories(marketplace).data?.options`)
 * so this helper stays free of React Query coupling.
 */
export function buildDraftPatch(
  values: DetailFormInput,
  currentDraft: DraftItem,
  categoryOptions: CategoryOption[] | undefined,
): DraftItem {
  const cat = categoryOptions?.find((o) => o.id === values.categoryId);
  return {
    ...currentDraft,
    title: values.title,
    description: values.description,
    categoryId: values.categoryId,
    categoryName: cat?.name ?? null,
    // Round-trip the "Other" subcategory fields. When Other is chosen,
    // categoryId is the sentinel (not in `categoryOptions`, so categoryName
    // is null) and these carry the parent + typed brand to the submit builder.
    customSubcategory: values.customSubcategory ?? '',
    parentCategoryId: values.parentCategoryId ?? '',
    parentCategoryName: values.parentCategoryName ?? '',
    condition: values.condition,
    operationStatus: values.operationStatus,
    priceFormat: values.priceFormat,
    pricePerUnit: values.pricePerUnit ?? '',
    priceCurrency: values.priceCurrency,
    quantity: values.quantity,
    locations: values.locations,
    locationCountries: values.locationCountries,
    brand: values.brand ?? '',
    model: values.model ?? '',
    year: values.year ?? '',
    weight: values.weight ?? '',
    dimensions: values.dimensions ?? '',
    co2Emissions: values.co2Emissions ?? '',
    grade: values.grade,
    serialNumber: values.serialNumber ?? '',
    marketplace: values.marketplace,
    installation: values.installation,
    listingDurationDays: values.listingDurationDays,
    lastStep: 'detail' as const,
  };
}
