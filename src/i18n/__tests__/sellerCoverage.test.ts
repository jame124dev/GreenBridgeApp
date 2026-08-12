/**
 * `mobile.seller` must be fully translated in every shipped locale.
 *
 * This namespace is the seller-upgrade flow: the "apply to sell" form
 * (`app/(lab)/sell/apply.tsx`) and the status card that tells a user whether
 * they may list yet (`src/features/seller/SellerStatusCard.tsx`). It is the only
 * thing standing between a buyer and the sell path, so a raw
 * `mobile.seller.apply.*` key showing through reads as a broken gate rather than
 * an explanation.
 *
 * It is also brand new: every string arrived with Phase 3 behind a
 * `t(key, { defaultValue: 'English' })` fallback, which renders English silently
 * rather than failing. Nothing else in the suite would have noticed the gap.
 *
 * Expectations are derived from en.json, so a new seller string added to en
 * without translations fails this automatically — the same shape as
 * authCoverage, labCoverage and updateCoverage.
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
 * Values that are correctly identical to English. Empty on purpose: every
 * seller string is prose, a form label or a fictional example, and all of them
 * translate. Add an entry only for a genuine loanword — never to silence a gap.
 */
const INTENTIONALLY_SAME = new Set<string>([]);

/** Flatten to `a.b` -> string. */
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

const sellerOf = (bundle: unknown) => flatten((bundle as any)?.mobile?.seller ?? {});

const EN_SELLER = sellerOf(en);

describe('mobile.seller translation coverage', () => {
  it('en defines both seller sub-namespaces', () => {
    // Guards against the suite silently passing if the namespace moved.
    expect(Object.keys((en as any).mobile.seller.apply).length).toBeGreaterThan(30);
    expect(Object.keys((en as any).mobile.seller.status).length).toBeGreaterThan(10);
  });

  for (const [locale, bundle] of Object.entries(TRANSLATED)) {
    const localeSeller = sellerOf(bundle);

    it(`${locale}: defines every seller key that en does`, () => {
      const missing = Object.keys(EN_SELLER).filter(
        (k) => typeof localeSeller[k] !== 'string',
      );
      expect(missing).toEqual([]);
    });

    it(`${locale}: no seller string is left as the English text`, () => {
      const untranslated = Object.keys(EN_SELLER).filter(
        (k) =>
          !INTENTIONALLY_SAME.has(k.split('.').pop() as string) &&
          localeSeller[k] === EN_SELLER[k],
      );
      expect(untranslated).toEqual([]);
    });

    it(`${locale}: keeps every interpolation placeholder from en`, () => {
      // `apply.missing` carries {{count}} and `apply.progress` {{filled}}/{{total}};
      // dropping one renders a sentence with a hole in it.
      const broken: string[] = [];
      for (const [k, enV] of Object.entries(EN_SELLER)) {
        const want = (enV.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) => s.replace(/\s/g, ''));
        const got = (localeSeller[k]?.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) =>
          s.replace(/\s/g, ''),
        );
        if ([...want].sort().join() !== [...got].sort().join()) broken.push(k);
      }
      expect(broken).toEqual([]);
    });
  }
});
