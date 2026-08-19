import {
  DEFAULT_OPERATION_STATUS,
  defaultCurrencyForSite,
  marketplaceFromSiteType,
} from './constants';
import { fitDescription } from './descriptionLimit';
import { normalizeCondition, normalizeOperationStatus } from './normalize';
import type {
  AiPriceTier,
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
 * Coerce a tier-price value to `{ min, max }`, or null when the AI skipped
 * it. Accepts three shapes the backend may return:
 *   - point number  `5000`          → `{ min: 5000, max: 5000 }`
 *   - point string  `"5000"`        → `{ min: 5000, max: 5000 }`
 *   - range string  `"5000-10000"`  → `{ min: 5000, max: 10000 }`
 *
 * Both bounds must be positive and finite — zero is treated as "no value"
 * (a $0 tier is more likely an upstream serialization bug than real data).
 * Reversed ranges (e.g. `"10000-5000"`) are normalized so `min <= max`.
 */
function coerceTierPrice(value: unknown): AiPriceTier | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return { min: value, max: value };
  }
  const str = String(value).trim();
  if (!str) return null;
  // Range form: "5000-10000" (whitespace around the dash tolerated).
  const rangeMatch = str.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      return null;
    }
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const n = Number(str);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { min: n, max: n };
}

/**
 * Build the AiPrices bundle that powers ProfitIntelligenceCard. Returns null
 * when the AI didn't return any tier; the card then renders its honest empty
 * state ("No price estimate") instead of figures. Currency falls back to USD
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
export function mapProductData(
  data: SmartProductData,
  /**
   * ⚠️ THE DEPLOYMENT'S site type (`getSiteType()`), NEVER `data.site_type`.
   * Plan §6.4: the marketplace does NOT drive the currency on the AI path. The
   * backend always returns USD (prompt at
   * controller/wordPressSmart.js:374/:386/:398/:409) and nothing between
   * `pickPrice` and `defaultCurrencyForSite` converts, so relabelling a USD
   * number as TWD for 101it is a 31.5× under-price written straight to
   * `_product_currency`. TWD-native pricing is a BACKEND change (return TWD
   * prices), not an app-side relabel.
   */
  deploymentSiteType: string,
): SmartItemFields {
  const price = pickPrice(data.price);
  const condition = normalizeCondition(data.condition);
  const opStatusRaw = normalizeOperationStatus(data.operation_status);
  const operationStatus = opStatusRaw.length ? opStatusRaw : [...DEFAULT_OPERATION_STATUS];
  const currency = defaultCurrencyForSite(deploymentSiteType);

  // Prefer the AI's subcategory id when present — it's the more specific
  // leaf and is the value the detail form expects. Fall back to the parent
  // category id (still valid for flat-leaf marketplaces like /machines after
  // the `flattenCategoryOptions` fix). The legacy behavior used `product_cat`
  // exclusively, which silently dropped any subcategory the AI picked.
  const subId = taxonomyId(data.subcategory);
  const subName = subId ? (data.subcategory?.name ?? null) : null;
  const parentId = taxonomyId(data.product_cat);
  const parentName = parentId ? (data.product_cat?.name ?? null) : null;
  const categoryId = subId ?? parentId;
  const categoryName = subId ? subName : parentName;

  const name = String(data.name ?? '');
  // Capped to DESCRIPTION_MAX here, at the boundary where the AI's text becomes
  // form state — the AI generated 543 characters against the 500 limit and the
  // seller was told to shorten it. ONE const feeds both the form field and the
  // `ai` snapshot below, so they cannot disagree about what the AI "said".
  // See descriptionLimit.ts for why the cut is here and not at the field limit.
  const description = fitDescription(data.equipment_description);

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

  // M-6 — carry the routing signal verbatim. No arithmetic, no comparison:
  // `siteTypeConfidence` exists to be DISPLAYED (plan §2.3) and is deliberately
  // not used in any branch (plan §2.1 — no threshold in v1).
  const needsClearerPhoto = data.needs_clearer_photo === true;
  const siteTypeConfidence =
    typeof data.site_type_confidence === 'number' ? data.site_type_confidence : null;
  const siteTypeSource = data.site_type_source ?? null;
  const categorySource = data.category_source ?? null;

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
    needsClearerPhoto,
    siteTypeConfidence,
    siteTypeSource,
    categorySource,
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
      needsClearerPhoto,
      siteTypeConfidence,
      siteTypeSource,
      categorySource,
      prices: aiPrices,
    },
  };
}

export function mapSmartDetection(
  res: SmartDetectionResponse,
  /** ⚠️ THE DEPLOYMENT'S site type — see `mapProductData` above. */
  deploymentSiteType: string,
): MappedSmartDetection {
  const rawProducts = Array.isArray(res.products) ? res.products : [];

  const products: MappedProduct[] = rawProducts.slice(0, MAX_PRODUCTS).map((p) => ({
    imageIndexes: (Array.isArray(p.image_indexes) ? p.image_indexes : []).filter(
      (i) => Number.isInteger(i) && i >= 0,
    ),
    // PDF-derived images: backend may attribute a product to one or more
    // documents (each PDF can yield 3 page-images). We keep these indexes
    // around for any future UI that wants to surface "from page 2 of
    // manual.pdf" — the buildPhotoSlices pipeline already merges PDF-page
    // URLs into the image stream, so we don't have to thread them in for
    // submit purposes.
    documentIndexes: (Array.isArray(p.document_indexes) ? p.document_indexes : []).filter(
      (i) => Number.isInteger(i) && i >= 0,
    ),
    fields: mapProductData(p.data ?? {}, deploymentSiteType),
  }));

  // Treat as multiple only when the server says so AND there's genuinely more
  // than one product — a "multiple" verdict with one product is just single.
  const isMultiple = res.detection?.suggested_mode === 'multiple' && products.length > 1;
  const mode: ListingMode = isMultiple ? 'grouped' : 'single';

  // §6.4 — the backend sets `merged_single` to the FIRST product that has data
  // (controller/wordPressSmart.js:3451-3453), so on a MIXED batch its
  // `site_type` is product 0's marketplace, not the batch's. Anything that
  // falls back to `mergedSingleFields` ("it's actually one product") would then
  // silently adopt the wrong marketplace, wrong category tree and wrong submit
  // target. Strip the routing claim when the batch is mixed; the draft then
  // falls back to the deployment default and, because the routing signal is
  // gone, the chip asks.
  const distinctSiteTypes = new Set(
    rawProducts
      .map((p) => marketplaceFromSiteType(p?.data?.site_type))
      .filter((m): m is NonNullable<typeof m> => m != null),
  );
  const mergedIsMixed = distinctSiteTypes.size > 1;

  const mergedRaw = res.merged_single ?? rawProducts[0]?.data ?? {};
  const mergedSingleFields = mapProductData(
    mergedIsMixed ? { ...mergedRaw, site_type: undefined } : mergedRaw,
    deploymentSiteType,
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
    // Pass-throughs so the call site can synthesize remote Photo objects
    // for PDF-extracted page images. Empty arrays for photo-only flows.
    responseImageUrls: Array.isArray(res.image_urls) ? res.image_urls : [],
    documentPages: Array.isArray(res.document_pages) ? res.document_pages : [],
  };
}
