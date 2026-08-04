/**
 * The customer-fork (`app/(lab)/`) namespaces must be fully translated in every
 * shipped locale.
 *
 * These are the screens the store build actually presents: Home, Browse, the AI
 * chat and its cards, wants, drafts, Messages and the splash/404. 69 keys were
 * English-only across zh-Hans/zh-Hant/ja/th/vi, so a non-English user hit
 * English mid-sentence on the app's core surfaces.
 *
 * Expectations are derived from en.json, so a new key added to en without
 * translations fails this automatically — the same shape as authCoverage and
 * updateCoverage.
 */
import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

const TRANSLATED = { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, th, vi } as const;

/** Namespaces the (lab) customer fork renders. */
const NAMESPACES = [
  'labHome',
  'labCards',
  'labChat',
  'labCommon',
  'labDeal',
  'labEdit',
  'labUpdate',
  'drafts',
  'notFound',
  'splash',
] as const;

/**
 * Values that are correctly identical to English. Everything else matching
 * English is an untranslated string.
 *
 * These are pure format strings, numeric/contact placeholders, brand marks and
 * loanwords — translating them would be wrong, not thorough.
 */
const INTENTIONALLY_SAME = new Set([
  'detail.aiBadge', // "AI"
  'drafts.flowAi', // "🤖 AI"
  'labCards.pagerOf', // "{{current}} / {{total}}"
  'labCards.wtbEdit.budgetChip', // "≤ ${{value}}"
  'labCards.wtbEdit.budgetPrefix', // "≤ $"
  'labCommon.placeholderKicker', // dev-only placeholder string
  'labCards.field.model', // "Model" is the loanword in vi
  'labEdit.model', // "Model" is the loanword in vi
  'labEdit.pricePlaceholder', // "0.00"
  'processing.poweredBy', // brand mark
  'splash.tagline', // brand tagline, kept as part of the lockup
]);

/** Flatten to `a.b.c` -> string. */
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

const nsOf = (bundle: unknown, ns: string) =>
  flatten((bundle as any)?.mobile?.[ns] ?? {}, ns);

const EN = NAMESPACES.reduce<Record<string, string>>(
  (acc, ns) => Object.assign(acc, nsOf(en, ns)),
  {},
);

describe('(lab) customer-fork translation coverage', () => {
  it('en defines a non-trivial set of lab keys', () => {
    // Guards against the suite silently passing if a namespace is renamed away.
    expect(Object.keys(EN).length).toBeGreaterThan(150);
  });

  for (const [locale, bundle] of Object.entries(TRANSLATED)) {
    const LOC = NAMESPACES.reduce<Record<string, string>>(
      (acc, ns) => Object.assign(acc, nsOf(bundle, ns)),
      {},
    );

    it(`${locale} defines every en lab key`, () => {
      const missing = Object.keys(EN).filter((k) => typeof LOC[k] !== 'string');
      expect(missing).toEqual([]);
    });

    it(`${locale} is actually translated, not copied from English`, () => {
      const copied = Object.keys(EN).filter(
        (k) => LOC[k] === EN[k] && !INTENTIONALLY_SAME.has(k),
      );
      expect(copied).toEqual([]);
    });

    it(`${locale} preserves every {{placeholder}}`, () => {
      const broken: string[] = [];
      for (const [k, enVal] of Object.entries(EN)) {
        const want = (enVal.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) => s.replace(/\s/g, ''));
        if (!want.length) continue;
        const got = (LOC[k]?.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) => s.replace(/\s/g, ''));
        if (want.some((w) => !got.includes(w))) broken.push(k);
      }
      expect(broken).toEqual([]);
    });
  }
});
