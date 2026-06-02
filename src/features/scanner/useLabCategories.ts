import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  fetchLabCategories,
  flattenCategoryOptions,
} from '@/services/scanner/fetchCategories';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

export function useLabCategories(marketplace?: MarketplaceKey) {
  const { i18n } = useTranslation();

  return useQuery({
    queryKey: ['labCategories', i18n.language, marketplace ?? '101lab'],
    queryFn: () => fetchLabCategories(i18n.language, marketplace),
    staleTime: 5 * 60_000,
    select: (data) => ({
      categories: data,
      options: flattenCategoryOptions(data),
    }),
  });
}

/**
 * Fetch the English category tree for a marketplace. Used by
 * `CategoryConditionCard` as the reference tree when the AI returns a
 * category id from the EN tree and the seller's app is in another locale —
 * `bridgeCategoryId` then maps EN id → locale id by sorted-position. The EN
 * tree is the same regardless of the user's language preference; that's
 * what makes it a stable reference. Skipped (`enabled: false`) when the app
 * is already in English since the user's tree IS the EN tree.
 */
export function useEnLabCategories(marketplace?: MarketplaceKey) {
  const { i18n } = useTranslation();
  const isAlreadyEn = i18n.language === 'en' || i18n.language.startsWith('en');
  return useQuery({
    queryKey: ['labCategories', 'en', marketplace ?? '101lab'],
    queryFn: () => fetchLabCategories('en', marketplace),
    staleTime: 5 * 60_000,
    enabled: !isAlreadyEn,
  });
}
