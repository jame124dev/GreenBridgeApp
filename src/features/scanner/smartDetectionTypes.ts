import type { ConditionKey } from './constants';
import type { AiResult, ListingMode } from '@/stores/scanDraftStore';

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
  condition?: string | string[];
  operation_status?: string | string[];
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
  /** Cosmetic mirror that drives the "✨ AI" badges on Detail. */
  ai: AiResult;
};

export type MappedProduct = {
  /** Global indexes into the uploaded files[] (images-only ⇒ line up with Photo[]). */
  imageIndexes: number[];
  fields: SmartItemFields;
};

export type MappedSmartDetection = {
  mode: ListingMode;
  meta: { summary: string; confidence: number };
  /** One per detected product (single mode ⇒ length 1). */
  products: MappedProduct[];
  /** Fields for the "it's actually one product" override. */
  mergedSingleFields: SmartItemFields;
};
