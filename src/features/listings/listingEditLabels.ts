/**
 * Contract field name → i18n key for the human name shown in the "what
 * changed" strips, the pending-edit list and the save receipt.
 *
 * Unmapped names fall back to the raw key with underscores softened, so a
 * backend that starts returning a field the app has never heard of degrades to
 * something readable instead of a blank bullet.
 */

const KEY_BY_FIELD: Record<string, string> = {
  title: 'mobile.listingEdit.field.title',
  description: 'mobile.listingEdit.field.description',
  brand: 'mobile.listingEdit.field.brand',
  category_id: 'mobile.listingEdit.field.category',
  category_name: 'mobile.listingEdit.field.category',
  condition: 'mobile.listingEdit.field.condition',
  grade: 'mobile.listingEdit.field.grade',
  operation_status: 'mobile.listingEdit.field.operationStatus',
  quantity: 'mobile.listingEdit.field.quantity',
  price_format: 'mobile.listingEdit.field.priceFormat',
  price_per_unit: 'mobile.listingEdit.field.price',
  price_currency: 'mobile.listingEdit.field.currency',
  location: 'mobile.listingEdit.field.location',
  images: 'mobile.listingEdit.field.photos',
  specs: 'mobile.listingEdit.field.specs',
  extra_content: 'mobile.listingEdit.field.specs',
};

export function fieldLabelKey(field: string): string | undefined {
  return KEY_BY_FIELD[field];
}

/**
 * `category_id` and `category_name` are one idea to a seller. Collapse the pair
 * so a category change never reads as two changes.
 */
export function dedupeFieldLabels(
  fields: readonly string[],
  translate: (key: string) => string,
): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const key = fieldLabelKey(f);
    const label = key ? translate(key) : f.replace(/_/g, ' ');
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

/**
 * "A, B and C" without pulling in Intl.ListFormat (Hermes ships it unevenly
 * across the SDK 56 Android/iOS runtimes, and a missing polyfill would throw
 * inside a success screen).
 */
export function joinLabels(labels: readonly string[], and: string): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} ${and} ${labels[labels.length - 1]}`;
}
