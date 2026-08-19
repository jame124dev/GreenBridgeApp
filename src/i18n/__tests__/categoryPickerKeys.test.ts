import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

/**
 * M-2 — the 11 `mobile.detail` keys the collapsed category row and the picker
 * sheet render.
 *
 * Every one is called with a `defaultValue`, so a missing key degrades to English
 * rather than to a raw `mobile.detail.change` on screen. That is exactly why this
 * file exists: without it the whole set is deletable from five locales with a
 * green suite, and the component tests would not notice — they assert the ENGLISH
 * copy, which the defaultValue reproduces verbatim.
 *
 * Three phases edit `mobile.detail` in these same six files (integration doc C11).
 * If one of them clobbers this block, it fails here.
 */
const REQUIRED = [
  'change',
  'choose',
  'categoryNotSet',
  'categoryPickSubcategory',
  'selectCategoryTitle',
  'selectCategorySubtitle',
  'categorySearchPlaceholder',
  'categorySearchEmpty',
  'categorySearchClear',
  'categoriesLoading',
  'categoriesRetry',
];

/** Keys whose copy MUST carry an interpolation placeholder through translation. */
const INTERPOLATED: Record<string, string> = {
  categorySearchEmpty: '{{q}}',
  categoriesLoading: '{{marketplace}}',
};

const LOCALES = { en, zhHant, zhHans, ja, th, vi };

describe('category picker i18n', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has all 11 mobile.detail category-picker keys`, () => {
      const detail =
        (dict as unknown as { mobile?: { detail?: Record<string, unknown> } }).mobile?.detail ?? {};
      for (const k of REQUIRED) {
        expect(detail[k]).toBeTruthy();
      }
    });
  }

  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} keeps the {{q}} / {{marketplace}} placeholders`, () => {
      // A translator dropping the placeholder does not fail to render — it renders
      // "No category matches" with the query silently missing, and "Loading
      // categories…", which is the generic spinner copy this phase replaced.
      const detail = (dict as unknown as { mobile: { detail: Record<string, string> } }).mobile
        .detail;
      for (const [k, token] of Object.entries(INTERPOLATED)) {
        expect(detail[k]).toContain(token);
      }
    });
  }

  it('the sheet copy is distinct from the lab-chat sheet it borrows the pattern from', () => {
    // `mobile.labEdit.selectCategoryTitle` already exists and says the same thing
    // in English. Keeping them separate is deliberate — the lab sheet's subtitle is
    // "Pick a category, then a subcategory" (two steps) while this one is "Search,
    // or browse by group" — so a future copy change to one does not silently move
    // the other.
    const detail = (en as unknown as { mobile: { detail: Record<string, string> } }).mobile.detail;
    const labEdit = (en as unknown as { mobile: { labEdit: Record<string, string> } }).mobile
      .labEdit;
    expect(detail.selectCategorySubtitle).not.toBe(labEdit.selectCategorySubtitle);
  });
});
