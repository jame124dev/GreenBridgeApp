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

export function defaultCurrencyForSite(siteType: string): 'USD' | 'TWD' {
  return siteType === '101it' ? 'TWD' : 'USD';
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
