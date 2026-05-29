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
