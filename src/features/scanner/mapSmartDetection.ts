import { DEFAULT_OPERATION_STATUS, defaultCurrencyForSite } from './constants';
import { normalizeCondition, normalizeOperationStatus } from './normalize';
import type {
  MappedProduct,
  MappedSmartDetection,
  SmartDetectionResponse,
  SmartItemFields,
  SmartProductData,
} from './smartDetectionTypes';
import type { ListingMode } from '@/stores/scanDraftStore';

// Pure mapper: smart-detection response → field bundles the store can assemble
// into DraftItems. No store / filesystem / network dependency — unit-tested
// against fixtures. See Docs/SMART_DETECTION_FLOW.md §3.1.

// Mirror of the backend MAX_PRODUCTS cap — defend against a server that ever
// returns more (the contract says ≤10 but we don't assume it downstream).
const MAX_PRODUCTS = 10;

/**
 * The AI `price` field is unpredictable: a number, a numeric string, or a
 * nested object (e.g. `{ reselling_price, buy_now, ... }`, already rounded
 * server-side). Reduce any of those to a single string, or null when absent.
 */
export function pickPrice(price: unknown): string | null {
  if (price == null) return null;
  if (typeof price === 'number') {
    return Number.isFinite(price) ? String(Math.round(price)) : null;
  }
  if (typeof price === 'string') {
    const t = price.trim();
    return t.length ? t : null;
  }
  if (typeof price === 'object') {
    const obj = price as Record<string, unknown>;
    // Preference order: most specific "sell" prices first, generic last.
    const keys = [
      'reselling_price',
      'resell_price',
      'buy_now',
      'buyNow',
      'suggested_price',
      'price',
      'amount',
      'value',
    ];
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'number' && Number.isFinite(v)) return String(Math.round(v));
      if (typeof v === 'string' && v.trim().length) return v.trim();
    }
  }
  return null;
}

function taxonomyId(ref: SmartProductData['product_cat']): string | null {
  if (!ref) return null;
  const id = String(ref.id ?? '');
  return id.length ? id : null;
}

/**
 * Map one AI product `data` block to the DraftItem fields the AI fills.
 * Location is intentionally NOT mapped — `item_location`/`auc-location` is a
 * taxonomy, not the Detail form's free-text address/country (see plan §3.1).
 * Currency overrides the server's hardcoded "USD" with the site default.
 */
export function mapProductData(data: SmartProductData, siteType: string): SmartItemFields {
  const price = pickPrice(data.price);
  const condition = normalizeCondition(data.condition);
  const opStatusRaw = normalizeOperationStatus(data.operation_status);
  const operationStatus = opStatusRaw.length ? opStatusRaw : [...DEFAULT_OPERATION_STATUS];
  const currency = defaultCurrencyForSite(siteType);

  const categoryId = taxonomyId(data.product_cat);
  const categoryName = categoryId ? (data.product_cat?.name ?? null) : null;

  const name = String(data.name ?? '');
  const description = String(data.equipment_description ?? '');

  return {
    title: name,
    description,
    condition,
    operationStatus,
    categoryId,
    categoryName,
    pricePerUnit: price ?? '',
    priceFormat: price ? 'buyNow' : 'offer',
    priceCurrency: currency,
    ai: {
      name,
      description,
      condition,
      operationStatus,
      suggestedPrice: price,
      currency,
    },
  };
}

export function mapSmartDetection(
  res: SmartDetectionResponse,
  siteType: string,
): MappedSmartDetection {
  const rawProducts = Array.isArray(res.products) ? res.products : [];

  const products: MappedProduct[] = rawProducts.slice(0, MAX_PRODUCTS).map((p) => ({
    imageIndexes: (Array.isArray(p.image_indexes) ? p.image_indexes : []).filter(
      (i) => Number.isInteger(i) && i >= 0,
    ),
    fields: mapProductData(p.data ?? {}, siteType),
  }));

  // Treat as multiple only when the server says so AND there's genuinely more
  // than one product — a "multiple" verdict with one product is just single.
  const isMultiple = res.detection?.suggested_mode === 'multiple' && products.length > 1;
  const mode: ListingMode = isMultiple ? 'grouped' : 'single';

  const mergedSingleFields = mapProductData(
    res.merged_single ?? rawProducts[0]?.data ?? {},
    siteType,
  );

  const rawConfidence = res.detection?.confidence;
  const confidence =
    typeof rawConfidence === 'number' ? Math.min(1, Math.max(0, rawConfidence)) : 0.75;

  return {
    mode,
    meta: {
      summary: typeof res.detection?.summary === 'string' ? res.detection.summary : '',
      confidence,
    },
    // Single mode ⇒ keep just the first product (canonical source per §3).
    products: mode === 'single' ? products.slice(0, 1) : products,
    mergedSingleFields,
  };
}
