import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  fetchLabCategories,
  flattenCategoryOptions,
} from '@/services/scanner/fetchCategories';

export function useLabCategories() {
  const { i18n } = useTranslation();

  return useQuery({
    queryKey: ['labCategories', i18n.language],
    queryFn: () => fetchLabCategories(i18n.language),
    staleTime: 5 * 60_000,
    select: (data) => ({
      categories: data,
      options: flattenCategoryOptions(data),
    }),
  });
}
