import type { ConditionKey } from './constants';
import type { AiResult, ItemGrade, ListingMode } from '@/stores/scanDraftStore';

// Raw shape returned by POST /api/v1/wp/analyze-smart-detection
// (backend: controller/wordPressSmart.js). Kept loose where the AI output is
// unpredictable (e.g. `price` can be a number, string, or object).

export type SmartTaxonomyRef = { id: string | number; name: string };

export type SmartProductData = {
  name?: string;
  brand?: string;
  model?: string;
  equipment_description?: string;
  co2_emissions?: string;
  weight?: string;
  dimensions?: string;
  year?: string | number;
  currency?: string;
  /** AI-shaped: number | string | nested object — normalize via pickPrice(). */
  price?: unknown;
  /**
   * AI-derived market-tier prices powering the Profit Intelligence card.
   * Backend returns strings ("20000") but tolerate numbers too. All three
   * fields are optional — the AI may emit just `scrap`, just `used`, etc.
   * Interpreted in the same currency as `currency` above.
   */
  prices?: {
    new?: string | number;
    used?: string | number;
    scrap?: string | number;
  };
  condition?: string | string[];
  operation_status?: string | string[];
  // W2 (scan_v3): backend prompt now asks the AI to also return site_type,
  // which the seller-side uses to pre-pick the marketplace.
  site_type?: string;
  // Server replaces these with DB-matched {id,name}; id === '' means "no match".
  product_cat?: SmartTaxonomyRef;
  subcategory?: SmartTaxonomyRef;
  'auc-location'?: SmartTaxonomyRef;
  auction_group?: SmartTaxonomyRef;
};

export type SmartProduct = {
  id: string;
  image_indexes: number[];
  document_indexes: number[];
  data: SmartProductData;
};

export type SmartDetectionResponse = {
  success: boolean;
  language: string;
  detection: {
    suggested_mode: 'single' | 'multiple';
    confidence: number;
    summary: string;
  };
  merged_single: SmartProductData;
  products: SmartProduct[];
  suggested_terms: Record<string, string[]>;
};

// ── Mapped (client) shape ────────────────────────────────────────────────────
// The mapper is PURE — it produces field bundles, not full DraftItems. The
// store's `applySmartDetection` assembles real DraftItems via `emptyDraft()`
// (which owns id generation, photo persistence, site defaults). This keeps the
// mapper testable with plain JSON and no store/filesystem dependency.

/** The subset of DraftItem fields the AI fills. Spread over `emptyDraft()`. */
export type SmartItemFields = {
  title: string;
  description: string;
  condition: ConditionKey[];
  operationStatus: string[];
  categoryId: string | null;
  categoryName: string | null;
  pricePerUnit: string;
  priceFormat: 'buyNow' | 'offer';
  priceCurrency: 'USD' | 'TWD';
  // S4: smart-detect now also fills these spec fields (web parity).
  // Optional empty strings when the AI didn't return them; grade defaults 'A'.
  brand: string;
  model: string;
  year: string;
  weight: string;
  dimensions: string;
  co2Emissions: string;
  grade: ItemGrade;
  // W2 (scan_v3): AI now returns `site_type`; mappers project it to a
  // MarketplaceKey when recognizable. Null means the AI didn't say or said
  // something off-list — the store falls back to env default in that case.
  suggestedMarketplace: '101lab' | '101machine' | '101recycle' | '101it' | null;
  /**
   * AI-derived market-tier prices for ProfitIntelligenceCard. Stored as
   * numbers in `currency` units (USD for now per backend default). Null when
   * the AI didn't return them — the card falls back to a static stub.
   */
  aiPrices: AiPrices | null;
  /** Cosmetic mirror that drives the "✨ AI" badges on Detail. */
  ai: AiResult;
}

/**
 * A single AI-priced tier. The backend may return either a point estimate
 * (`5000`) or a range (`"5000-10000"`); both flow into `{ min, max }`. Point
 * estimates become `min === max` so the rest of the card renders them as a
 * single figure rather than a degenerate "$5,000 – $5,000" range.
 */
export type AiPriceTier = { min: number; max: number };

/**
 * Tier prices the AI returns per product (scrap floor, used baseline, new
 * ceiling). At least one tier is expected when present; consumers must
 * tolerate missing tiers (e.g. scrap-only or used-only). `currency` ties the
 * tiers to a unit so currency toggles in the UI can convert via the FX helper.
 */
export type AiPrices = {
  scrap?: AiPriceTier;
  used?: AiPriceTier;
  new?: AiPriceTier;
  currency: 'USD' | 'TWD';
};

export type MappedProduct = {
  /** Global indexes into the uploaded files[] (images-only ⇒ line up with Photo[]). */
  imageIndexes: number[];
  fields: SmartItemFields;
};

export type MappedSmartDetection = {
  mode: ListingMode;
  meta: {
    summary: string;
    confidence: number;
    /**
     * Raw AI verdict, preserved alongside the client-side `mode`. Used by
     * `shouldSkipDetectionChoice` to mirror the web predicate (which reads
     * `detection.suggested_mode` directly off the response).
     */
    suggestedMode: 'single' | 'multiple';
    /**
     * Number of products in the RAW response (before MAX_PRODUCTS cap or the
     * single-mode `products.slice(0, 1)`). The skip predicate needs the raw
     * count, not the post-slice length, to match web behavior.
     */
    productCount: number;
  };
  /** One per detected product (single mode ⇒ length 1). */
  products: MappedProduct[];
  /** Fields for the "it's actually one product" override. */
  mergedSingleFields: SmartItemFields;
};
