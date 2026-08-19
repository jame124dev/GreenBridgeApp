import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

/**
 * Device pass 2026-08-19 — the three `mobile.detail` keys added for the two
 * honesty fixes on the review form:
 *   - the description counter's over-limit line + its screen-reader sentence
 *     (`DescriptionCard.tsx`), and
 *   - the collapsed category row's offline fallback (`CategoryConditionCard.tsx`),
 *     which used to claim "Not set — pick a category" while a category WAS set.
 *
 * Same reasoning as `categoryPickerKeys.test.ts`: every one is called with a
 * `defaultValue`, so a missing key degrades to English rather than to a raw
 * `mobile.detail.descriptionTooLong` on screen — which is exactly why the set is
 * otherwise deletable from five locales with a green suite, and why the component
 * tests (which assert the English copy the defaultValue reproduces verbatim)
 * would not notice.
 */
const REQUIRED = [
  'descriptionTooLong',
  'descriptionOverLimitA11y',
  'categoryNamesUnavailable',
];

/**
 * Keys whose copy MUST carry its interpolations through translation. A translator
 * dropping `{{over}}` does not fail to render — it renders "characters over the
 * limit", i.e. the red number with no next step, which is the whole point of the
 * line.
 */
const INTERPOLATED: Record<string, string[]> = {
  descriptionTooLong: ['{{over}}', '{{max}}'],
  descriptionOverLimitA11y: ['{{length}}', '{{over}}', '{{max}}'],
};

const LOCALES = { en, zhHant, zhHans, ja, th, vi };

const detailOf = (dict: unknown) =>
  (dict as { mobile?: { detail?: Record<string, string> } }).mobile?.detail ?? {};

describe('detail-form limit + offline i18n', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has all ${REQUIRED.length} keys, non-empty`, () => {
      const detail = detailOf(dict);
      for (const k of REQUIRED) {
        expect(typeof detail[k]).toBe('string');
        expect((detail[k] ?? '').trim().length).toBeGreaterThan(0);
      }
    });

    it(`${name} keeps every placeholder`, () => {
      const detail = detailOf(dict);
      for (const [k, placeholders] of Object.entries(INTERPOLATED)) {
        for (const ph of placeholders) {
          expect(detail[k]).toContain(ph);
        }
      }
    });
  }

  // zh-Hans has been served Traditional characters before (byte-identical to
  // zh-Hant) — a known, separate content problem on the server's category tree.
  // These are APP strings, so at least keep them from being identical by
  // accident, which is how that class of bug hides.
  it('zh-Hans and zh-Hant are not byte-identical for these keys', () => {
    const hans = detailOf(zhHans);
    const hant = detailOf(zhHant);
    expect(REQUIRED.some((k) => hans[k] !== hant[k])).toBe(true);
  });
});
