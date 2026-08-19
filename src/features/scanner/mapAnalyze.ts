import { normalizeCondition, normalizeOperationStatus } from './normalize';
import { DEFAULT_OPERATION_STATUS, marketplaceFromSiteType } from './constants';
import { fitDescription } from './descriptionLimit';
import { pickAiPrices, pickPrice } from './mapSmartDetection';
import type { SmartProductData } from './smartDetectionTypes';
import type { AiResult, ItemGrade } from '@/stores/scanDraftStore';

/**
 * Coerce an AI-returned value to a trimmed string. AI may return numbers
 * (e.g. `year: 1914`) where `.trim()` would throw — mirror web's
 * `coerceTrimmed` from `GreenBridgeSeller/.../mapAiToForm.ts:7-12`.
 */
function coerceTrimmed(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return String(value).trim();
}

/**
 * Coerce an AI-returned grade to the valid A/B/C/D union. Default 'A' for
 * anything missing/invalid — mirrors web's `normalizeGrade` (mapAiToForm.ts:36-40).
 */
function normalizeGrade(value: unknown): ItemGrade {
  const raw = coerceTrimmed(value).toUpperCase();
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  return 'A';
}

/**
 * Map the `/wp/analyze-process-images` response data block to the
 * `AiResult` shape stored in the draft. Includes the S1-expanded spec fields
 * (brand / model / year / weight / dimensions / co2Emissions / grade) — these
 * were previously silently dropped despite the AI returning them.
 *
 * Web parity: `mapAiToForm` in `GreenBridgeSeller/.../mapAiToForm.ts`.
 */
export function mapAnalyzeResponse(data: Record<string, unknown>): AiResult {
  const currencyRaw = data.currency as string | undefined;

  const operationStatus = normalizeOperationStatus(
    data.operation_status as string | string[] | undefined,
  );

  // W2 (scan_v3): backend AI prompt now mandates a single-integer `price`
  // (B5) — the legacy `data.price?.reselling_price` extractor would silently
  // drop that. Delegate to `pickPrice` from mapSmartDetection.ts which
  // already handles number | string | object shapes uniformly.
  const suggestedPrice = pickPrice(data.price);

  // W2 (scan_v3): extract site_type when present (B3). Map to a marketplace
  // when it matches; null otherwise (processing.tsx falls back to env default).
  const siteTypeRaw = coerceTrimmed(data.site_type);
  const suggestedMarketplace = marketplaceFromSiteType(siteTypeRaw);

  // M-6 — same routing signal on the /analyze-process-images path. The backend
  // runs the same `normalizeIdentityAndConfidence` choke point
  // (controller/wordPressSmart.js:828-829) so `needs_clearer_photo` is present
  // here too; the other three arrive with S0-2 / S0-3a. Carried, never compared
  // (plan §2.1 — no threshold in v1).
  const d = data as SmartProductData;
  const needsClearerPhoto = d.needs_clearer_photo === true;
  const siteTypeConfidence =
    typeof d.site_type_confidence === 'number' ? d.site_type_confidence : null;
  const siteTypeSource = d.site_type_source ?? null;
  const categorySource = d.category_source ?? null;

  // ProfitIntelligenceCard tier prices (scrap/used/new). The analyze endpoint
  // returns the same shape as smart-detect, so share the parser. Null when
  // the AI didn't include `prices` — the card shows its "no estimate" state.
  const aiPrices = pickAiPrices(
    (data as SmartProductData).prices,
    currencyRaw,
  );

  // Category id — mirror mapSmartDetection.mapProductData: prefer the AI's
  // subcategory id (more specific leaf), fall back to the parent category id.
  // The cross-locale bridge in CategoryConditionCard maps EN ids to the
  // seller's locale tree at hydrate time, so we don't have to do that here.
  const subRef = (data as SmartProductData).subcategory;
  const subIdRaw = subRef ? String(subRef.id ?? '') : '';
  const subId = subIdRaw.length ? subIdRaw : null;
  const subName = subId ? (subRef?.name ?? null) : null;
  const parentRef = (data as SmartProductData).product_cat;
  const parentIdRaw = parentRef ? String(parentRef.id ?? '') : '';
  const parentId = parentIdRaw.length ? parentIdRaw : null;
  const parentName = parentId ? (parentRef?.name ?? null) : null;
  const categoryId = subId ?? parentId;
  const categoryName = subId ? subName : parentName;

  return {
    name: String(data.name ?? ''),
    // Capped to DESCRIPTION_MAX here, at the boundary where the AI's text becomes
    // form state — the AI generated 543 characters against the 500 limit and the
    // seller was told to shorten it. See descriptionLimit.ts for why the cut is
    // here and not at the field limit or at submit.
    description: fitDescription(data.equipment_description),
    condition: normalizeCondition(data.condition as string | string[] | undefined),
    operationStatus: operationStatus.length ? operationStatus : [...DEFAULT_OPERATION_STATUS],
    suggestedPrice,
    currency: currencyRaw === 'TWD' ? 'TWD' : 'USD',
    // S4: previously dropped — now extracted from the AI response per web parity.
    // All optional in `AiResult`; consumers (processing.tsx) thread them
    // through `patch()` so the detail-form cards populate.
    brand:        coerceTrimmed(data.brand),
    model:        coerceTrimmed(data.model),
    year:         coerceTrimmed(data.year),
    weight:       coerceTrimmed(data.weight),
    dimensions:   coerceTrimmed(data.dimensions),
    co2Emissions: coerceTrimmed(data.co2_emissions),
    grade:        normalizeGrade(data.grade),
    // S5.2: AI may return one or more pickup locations + a country.
    // Filter blanks server-side so downstream consumers can rely on
    // `locations.every(s => s.trim().length > 0)`.
    locations:    extractLocations(data.locations),
    country:      coerceTrimmed(data.country),
    suggestedMarketplace,
    needsClearerPhoto,
    siteTypeConfidence,
    siteTypeSource,
    categorySource,
    prices:       aiPrices,
    categoryId,
    categoryName,
  };
}

function extractLocations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(coerceTrimmed).filter((s) => s.length > 0);
}
