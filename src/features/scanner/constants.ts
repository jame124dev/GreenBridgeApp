export const VALID_CONDITION_KEYS = [
  'new',
  'usedFunctional',
  'forParts',
  'wasteDisposal',
  'demolitionRemoval',
] as const;

export type ConditionKey = (typeof VALID_CONDITION_KEYS)[number];

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  new: 'New',
  usedFunctional: 'Used — functional',
  forParts: 'For parts',
  wasteDisposal: 'Waste disposal',
  demolitionRemoval: 'Demolition / removal',
};

export const DEFAULT_OPERATION_STATUS = ['working'];

// S5.1 — Marketplace + Installation options.
// Marketplace drives `allowed_sites[]` at submit (see buildFormData
// marketplaceToAllowedSite). Installation drives the operation_status[] value
// the backend stores ("needDeinstall" when installed, "deinstalled" when
// deinstalled — web parity, see ReviewSubmitScreen.tsx:149).

// Order + labels mirror web (`ReviewSubmitScreen.tsx#MARKETPLACES`) so the
// pill row is visually identical across platforms: 101LAB → 101MACHINE →
// 101IT → 101RECYCLE, all caps, no spaces.
export const MARKETPLACE_OPTIONS: {
  value: '101lab' | '101machine' | '101recycle' | '101it';
  label: string;
}[] = [
  { value: '101lab',     label: '101LAB' },
  { value: '101machine', label: '101MACHINE' },
  { value: '101it',      label: '101IT' },
  { value: '101recycle', label: '101RECYCLE' },
];

export const INSTALLATION_OPTIONS: {
  value: 'installed' | 'deinstalled';
  label: string;
  hint: string;
}[] = [
  { value: 'installed',   label: 'Installed',   hint: 'Buyer needs to deinstall + ship' },
  { value: 'deinstalled', label: 'Deinstalled', hint: 'Ready to ship today' },
];

/**
 * Maps an installation choice to the value the backend stores in
 * `operation_status[]`. Mirrors web's submit-time override at
 * `GreenBridgeSeller/.../ReviewSubmitScreen.tsx:149`. The user's `operationStatus`
 * choice from the AI is overridden by this value at submit time — installation
 * IS the canonical operation status, not a separate field.
 */
export function operationStatusForInstallation(installation: 'installed' | 'deinstalled'): string[] {
  return installation === 'installed' ? ['needDeinstall'] : ['deinstalled'];
}

export function defaultCurrencyForSite(siteType: string): 'USD' | 'TWD' {
  return siteType === '101it' ? 'TWD' : 'USD';
}

/**
 * W2 (scan_v3) — strict mapper from an AI-returned `site_type` to a known
 * `MarketplaceKey`. Returns null when the input doesn't match a known
 * marketplace so AI-consuming code can distinguish "AI suggested X" from
 * "AI said nothing" and fall back to env-default explicitly.
 *
 * Web parity: `GreenBridgeSeller/.../utils/mapAiToForm.ts:42-47` uses a
 * similar substring-match. Mobile's existing lenient version in
 * `scanDraftStore.ts:marketplaceFromSiteType` always returned `'101lab'`
 * for unknowns; that lenient behavior is preserved at the call site via
 * `?? '101lab'` so callers can opt into a fallback.
 *
 * Accepts both the canonical site_type values returned by AI/backend
 * (`'LabGreenbidz' | 'machines' | '101it' | 'recycle'`) and partial/lowercase
 * variants for robustness.
 */
/**
 * W3 (scan_v3) — inverse of `marketplaceFromSiteType`: project a chosen
 * `MarketplaceKey` to the backend `?type=` query string value. Used by:
 *   - `createProduct.ts` and `createBatch.ts` (single-listing submit URL)
 *   - `submitGroupedListings.ts` (grouped submit URL)
 *
 * Mirrors web's mapping at `NewSubmissionUploadPage.tsx:141-145`:
 *   - `'101lab'`     → `'LabGreenbidz'`
 *   - `'101machine'` → `'machines'`
 *   - `'101it'`      → `'101it'`
 *   - `'101recycle'` → `'recycle'`
 *
 * Hoisted from a local helper in `submitGroupedListings.ts` per the W1→W3
 * TODO. Pure function — no env lookup; callers fall back to env when the
 * marketplace is unset by passing the result through `?? getSiteType()`.
 */
export function marketplaceToPlatform(
  marketplace: '101lab' | '101machine' | '101recycle' | '101it' | undefined,
): string | null {
  if (marketplace === '101lab') return 'LabGreenbidz';
  if (marketplace === '101machine') return 'machines';
  if (marketplace === '101it') return '101it';
  if (marketplace === '101recycle') return 'recycle';
  return null;
}

export function marketplaceFromSiteType(
  siteType: string | null | undefined,
): '101lab' | '101machine' | '101recycle' | '101it' | null {
  if (!siteType || typeof siteType !== 'string') return null;
  const v = siteType.toLowerCase();
  // Order matters: check more-specific substrings first. '101it' is exact;
  // 'lab' / 'LabGreenbidz' map to '101lab'; 'machine(s)' to '101machine';
  // 'recycle' to '101recycle'. Anything else returns null so the caller
  // can decide whether to fall back to env or keep marketplace empty.
  if (v === '101it' || v === 'it') return '101it';
  if (v.includes('recycle')) return '101recycle';
  if (v.includes('machine')) return '101machine';
  if (v.includes('lab')) return '101lab';
  return null;
}

export function toAnalyzeLanguage(i18nLang: string): 'en' | 'zh-hant' {
  if (i18nLang === 'zh' || i18nLang.startsWith('zh')) return 'zh-hant';
  return 'en';
}

/** Defaults when the user skips AI — keeps detail form submittable. */
export function manualEntryDefaults() {
  return {
    title: 'Equipment listing',
    description: '',
    condition: ['usedFunctional'] as ConditionKey[],
    operationStatus: [...DEFAULT_OPERATION_STATUS],
    priceFormat: 'offer' as const,
    pricePerUnit: '',
    aiSkipped: true,
  };
}
