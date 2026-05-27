import { greenbidz } from '@/api/greenbidzClient';
import { toAnalyzeLanguage } from '@/features/scanner/constants';

export type LabSubcategory = { id: number; name: string; slug: string };
export type LabCategory = {
  id: number;
  name: string;
  slug: string;
  subcategories: LabSubcategory[];
};

export async function fetchLabCategories(language: string): Promise<LabCategory[]> {
  const lang = toAnalyzeLanguage(language);
  const res = await greenbidz.get(`/product/lab/category?language=${encodeURIComponent(lang)}`, {
    timeout: 60_000,
  });
  return (res.data?.data ?? []) as LabCategory[];
}

export function flattenCategoryOptions(categories: LabCategory[]) {
  const options: { id: string; name: string; label: string }[] = [];
  for (const cat of categories) {
    for (const sub of cat.subcategories ?? []) {
      options.push({
        id: String(sub.id),
        name: sub.name,
        label: `${cat.name} › ${sub.name}`,
      });
    }
  }
  return options;
}
