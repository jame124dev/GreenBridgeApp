/**
 * `mobile.auth` must be fully translated in every shipped locale.
 *
 * The auth namespace is the login, approval-pending and password-reset flow —
 * the first screens every user sees, and the only screens App Review can reach
 * without a demo account. It was ~40 keys short across zh-Hans/zh-Hant/ja/th/vi,
 * so a non-English reviewer saw a half-English sign-in page.
 *
 * The invariant is derived from en.json rather than a hardcoded key list, so a
 * new auth string added to en without translations fails this automatically.
 */
import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

const TRANSLATED = { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, th, vi } as const;

/**
 * Values that are intentionally identical to English — an email example and
 * brand/product nouns. Anything else matching English is untranslated.
 */
const INTENTIONALLY_SAME = new Set([
  'emailPlaceholderCompany', // you@company.com
  'emailPlaceholder', // you@example.com
  'passwordPlaceholder', // ••••••••
  'email', // "Email" is the standard term in several of these locales
  'emailLabel', // ditto — Vietnamese uses "Email" verbatim (register step 1)
]);

/** Flatten to `a.b.c` -> string, skipping i18next plural siblings. */
function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}) {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') out[path] = v;
      else flatten(v, path, out);
    }
  }
  return out;
}

const authOf = (bundle: unknown) =>
  flatten((bundle as any)?.mobile?.auth ?? {});

const EN_AUTH = authOf(en);

describe('mobile.auth translation coverage', () => {
  it('en defines a non-trivial auth namespace', () => {
    // Guards against the suite silently passing if the namespace moved.
    expect(Object.keys(EN_AUTH).length).toBeGreaterThan(40);
  });

  for (const [locale, bundle] of Object.entries(TRANSLATED)) {
    const localeAuth = authOf(bundle);

    it(`${locale}: defines every auth key that en does`, () => {
      const missing = Object.keys(EN_AUTH).filter((k) => typeof localeAuth[k] !== 'string');
      expect(missing).toEqual([]);
    });

    it(`${locale}: no auth string is left as the English text`, () => {
      const untranslated = Object.keys(EN_AUTH).filter(
        (k) =>
          !INTENTIONALLY_SAME.has(k.split('.').pop() as string) &&
          localeAuth[k] === EN_AUTH[k],
      );
      expect(untranslated).toEqual([]);
    });

    it(`${locale}: keeps every interpolation placeholder from en`, () => {
      // A dropped {{email}} / {{count}} renders a sentence with a hole in it.
      const broken: string[] = [];
      for (const [k, enV] of Object.entries(EN_AUTH)) {
        const want = (enV.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) => s.replace(/\s/g, ''));
        const got = (localeAuth[k]?.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) => s.replace(/\s/g, ''));
        if ([...want].sort().join() !== [...got].sort().join()) broken.push(k);
      }
      expect(broken).toEqual([]);
    });
  }
});
