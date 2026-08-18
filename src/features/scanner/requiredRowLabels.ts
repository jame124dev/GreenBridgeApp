import { useTranslation } from 'react-i18next';

import type { RequiredRowKey } from './requiredStatus';

/**
 * One translated label per required-checklist row.
 *
 * Extracted verbatim from the `labelForKey` switch inside `HubRow`
 * (`app/scan/grouped-review.tsx`, the `missingLabel` IIFE) so the review hub's
 * "Missing: price, condition" chip, the detail footer's missing-field chips
 * (`RequiredProgressStrip`) and the single-item editor's invalid-submit alert all
 * name a field the same way.
 *
 * These keys ship in all six locales (verified 2026-08-18); the `defaultValue`s
 * are the English fallbacks — and they are what Jest sees, because react-i18next
 * is not initialised in the test environment.
 */
export function useRequiredRowLabel(): (key: RequiredRowKey) => string {
  const { t } = useTranslation();
  return (key: RequiredRowKey): string => {
    switch (key) {
      case 'photos':
        return t('mobile.detail.colPhotos', { defaultValue: 'Photos' });
      case 'title':
        return t('mobile.detail.sectionTitle', { defaultValue: 'Title' });
      case 'description':
        return t('mobile.detail.sectionDescription', { defaultValue: 'Description' });
      case 'category':
        return t('mobile.detail.sectionCategory', { defaultValue: 'Category' });
      case 'condition':
        return t('mobile.detail.sectionCondition', { defaultValue: 'Condition' });
      case 'price':
        return t('mobile.detail.sectionPrice', { defaultValue: 'Price' });
      case 'location':
        return t('mobile.detail.sectionLocation', { defaultValue: 'Location' });
    }
  };
}
