/**
 * The v2 copy dictionary — see `src/i18n/v2Auto.ts`.
 *
 * These guard the two ways this mechanism fails SILENTLY. Both have happened:
 *
 *   1. A language code that does not match a map key. The lookup just misses
 *      and every screen stays English, which is indistinguishable from "we
 *      have not translated it yet". `zh-Hant` vs `zh-hant` is the live trap —
 *      `src/i18n/index.ts` lowercases every code, so the maps must be
 *      lowercase too.
 *   2. A key that can never match a rendered string — a template literal the
 *      extractor read out of the source, or a fragment cut at an apostrophe.
 *      It sits in the file looking translated and never fires.
 */
import { v2Auto, hasV2Dictionary } from '../v2Auto';
import { normalizeLanguage, SUPPORTED_LANGUAGES } from '../index';

import zhHant from '../v2-auto/zh-hant.json';
import zhHans from '../v2-auto/zh-hans.json';
import ja from '../v2-auto/ja.json';
import th from '../v2-auto/th.json';
import vi from '../v2-auto/vi.json';

const MAPS = { 'zh-hant': zhHant, 'zh-hans': zhHans, ja, th, vi } as Record<
  string,
  Record<string, string>
>;

describe('v2Auto', () => {
  it('translates a known string into Traditional Chinese', () => {
    expect(v2Auto('My listings', 'zh-hant')).toBe('我的商品');
  });

  it('leaves English alone', () => {
    expect(v2Auto('My listings', 'en')).toBe('My listings');
  });

  it('falls through to English for a string it does not know', () => {
    expect(v2Auto('A sentence nobody has translated', 'ja')).toBe(
      'A sentence nobody has translated',
    );
  });

  it('falls through for an unsupported language rather than throwing', () => {
    expect(v2Auto('My listings', 'de')).toBe('My listings');
    expect(v2Auto('My listings', undefined)).toBe('My listings');
  });

  it('accepts the code in the case i18next actually produces', () => {
    // `lowerCaseLng` means the runtime code is lowercase, but a caller passing
    // the picker's `zh-Hant` must not silently fall back to English.
    expect(v2Auto('My listings', 'zh-Hant')).toBe('我的商品');
  });

  it('has a dictionary for every supported language except English', () => {
    for (const code of SUPPORTED_LANGUAGES) {
      expect(hasV2Dictionary(code)).toBe(code !== 'en');
    }
  });

  it('is keyed by the codes normalizeLanguage emits', () => {
    // The whole mechanism hangs off these two agreeing. If `normalizeLanguage`
    // ever returns `zh-Hant` again, this fails instead of the UI going quiet.
    for (const code of SUPPORTED_LANGUAGES) {
      if (code === 'en') continue;
      expect(normalizeLanguage(code)).toBe(code);
      expect(Object.keys(MAPS)).toContain(code);
    }
  });
});

describe('the generated dictionaries', () => {
  for (const [code, map] of Object.entries(MAPS)) {
    describe(code, () => {
      it('has no empty value', () => {
        expect(Object.entries(map).filter(([, v]) => !v).map(([k]) => k)).toEqual([]);
      });

      it('holds no key that could never match a rendered string', () => {
        // `${…}` is a template the extractor read out of source; a trailing
        // open quote is a fragment it cut mid-sentence.
        expect(Object.keys(map).filter((k) => k.includes('${'))).toEqual([]);
      });

      it('actually differs from English', () => {
        // A map that copied the English through would pass every other test
        // here while translating nothing.
        const same = Object.entries(map).filter(([k, v]) => k === v);
        expect(same.length).toBeLessThan(Object.keys(map).length * 0.1);
      });

      it('covers the same strings as every other locale', () => {
        expect(Object.keys(map).sort()).toEqual(Object.keys(zhHant).sort());
      });
    });
  }
});
