import {
  DEFAULT_OPERATION_STATUS,
  defaultCurrencyForSite,
  marketplaceFromSiteType,
} from './constants';
import { normalizeCondition, normalizeOperationStatus } from './normalize';
import type {
  AiPrices,
  MappedProduct,
  MappedSmartDetection,
  SmartDetectionResponse,
  SmartItemFields,
  SmartProductData,
} from './smartDetectionTypes';
import type { ItemGrade, ListingMode } from '@/stores/scanDraftStore';

// Local helpers — mirrored from `mapAnalyze.ts` so the smart-detect and
// analyze paths produce structurally identical AiResult bundles. AI may return
// `year: 1914` (number) — `.trim()` on that would throw.
function coerceTrimmed(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return String(value).trim();
}

function normalizeGrade(value: unknown): ItemGrade {
  const raw = coerceTrimmed(value).toUpperCase();
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  return 'A';
}

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

/**
 * Coerce a single tier-price value to a positive number, or null when the AI
 * skipped it. Tolerates the backend's string-prices ("20000") and bare
 * numbers; everything else returns null so the consumer falls back to the
 * static stub. Zero is also treated as "no value" — a $0 scrap price is more
 * likely an upstream serialization bug than a real datapoint.
 */
function coerceTierPrice(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Build the AiPrices bundle that powers ProfitIntelligenceCard. Returns null
 * when the AI didn't return any tier so the card can fall back to its static
 * stub (rather than render a half-empty insight). Currency falls back to USD
 * since the backend default is USD; only "TWD" is accepted as an override.
 */
export function pickAiPrices(
  prices: SmartProductData['prices'],
  currencyRaw: string | undefined,
): AiPrices | null {
  if (!prices || typeof prices !== 'object') return null;
  const scrap = coerceTierPrice(prices.scrap);
  const used = coerceTierPrice(prices.used);
  const newP = coerceTierPrice(prices.new);
  if (scrap == null && used == null && newP == null) return null;
  const currency: 'USD' | 'TWD' = currencyRaw === 'TWD' ? 'TWD' : 'USD';
  return {
    ...(scrap != null && { scrap }),
    ...(used != null && { used }),
    ...(newP != null && { new: newP }),
    currency,
  };
}

function taxonomyId(ref: SmartProductData['product_cat']): string | null {
  if (!ref) return null;
  const id = String(ref.id ?? '');
  return id.length ? id : null;
}

/**
 * Map one AI product `data` block to the DraftItem fields the AI fills.
 * Location is intentionally NOT mapped here — the listing's pickup location is
 * NOT a backend/AI value; it comes from the DEVICE's location permission
 * (getDeviceLocation → pickupStore). The store seeds it onto each draft at
 * `draftFromSmartFields` time, and `LocationCard` lets the seller adjust it.
 * (The AI's `item_location`/`auc-location` is an unreliable taxonomy guess and
 * is deliberately ignored.)
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

  // S4: extract spec fields from smart-detect product data (same shape as
  // analyze-process-images). Previously silently dropped — now plumbed
  // through SmartItemFields → DraftItem so the detail-form cards populate.
  const brand        = coerceTrimmed(data.brand);
  const model        = coerceTrimmed(data.model);
  const year         = coerceTrimmed(data.year);
  const weight       = coerceTrimmed(data.weight);
  const dimensions   = coerceTrimmed(data.dimensions);
  const co2Emissions = coerceTrimmed(data.co2_emissions);
  const grade        = normalizeGrade((data as Record<string, unknown>).grade);

  // W2 (scan_v3): backend AI now returns site_type for the smart-detect path
  // too (B3). Project to a MarketplaceKey when recognized; null otherwise
  // so the store's apply layer falls back to env-default.
  const suggestedMarketplace = marketplaceFromSiteType(data.site_type);

  const aiPrices = pickAiPrices(data.prices, data.currency);

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
    brand,
    model,
    year,
    weight,
    dimensions,
    co2Emissions,
    grade,
    suggestedMarketplace,
    aiPrices,
    ai: {
      name,
      description,
      condition,
      operationStatus,
      suggestedPrice: price,
      currency,
      brand,
      model,
      year,
      weight,
      dimensions,
      co2Emissions,
      grade,
      suggestedMarketplace,
      prices: aiPrices,
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
      // Raw AI verdict + raw count (BEFORE MAX_PRODUCTS cap and BEFORE the
      // single-mode slice). The skip predicate relies on these to match web.
      suggestedMode:
        res.detection?.suggested_mode === 'multiple' ? 'multiple' : 'single',
      productCount: rawProducts.length,
    },
    // Single mode ⇒ keep just the first product (canonical source per §3).
    products: mode === 'single' ? products.slice(0, 1) : products,
    mergedSingleFields,
  };
}
