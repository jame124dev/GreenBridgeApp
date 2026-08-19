import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

/**
 * Phase 4 (M-3): the routing chip's 18 keys + the review hub's 2.
 *
 * Every one is passed with a `defaultValue`, so a missing key degrades to English
 * rather than showing a raw key — which is exactly why a locale-only omission is
 * invisible in testing and only shows up as an untranslated screen in production.
 * Hence this file.
 *
 * `confidence`/`confHigh`/`confMedium`/`confLow` are USER-VISIBLE in v1, not
 * dormant: the server has been emitting `site_type_confidence` since S0-2, so the
 * "AI confidence: High · 94%" line renders on the first scan. They get the same
 * scrutiny as the rest.
 */
const ROUTING_KEYS = [
  'willListOn',
  'change',
  'why',
  'whyNameplate',
  'whyNoNameplate',
  'askTitle',
  'askBody',
  'askGuess',
  'askCta',
  'bestGuess',
  'setOnce',
  'sheetTitle',
  'sheetSubtitle',
  'categoryNotSet',
  'confidence',
  'confHigh',
  'confMedium',
  'confLow',
];
const HUB_KEYS = ['pickMarketplace', 'statusMissingMarketplace'];

const LOCALES = { en, zhHant, zhHans, ja, th, vi };
const TRANSLATED = { zhHant, zhHans, ja, th, vi };

describe('phase 4 i18n', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has all 18 routing keys and both hub keys`, () => {
      const routing = (dict as any).mobile?.detail?.routing ?? {};
      for (const k of ROUTING_KEYS) {
        expect(typeof routing[k]).toBe('string');
        expect(routing[k].length).toBeGreaterThan(0);
      }
      const hub = (dict as any).mobile?.reviewHub ?? {};
      for (const k of HUB_KEYS) {
        expect(typeof hub[k]).toBe('string');
        expect(hub[k].length).toBeGreaterThan(0);
      }
      // No stray keys: a 19th would be a string the code never reads.
      expect(Object.keys(routing).sort()).toEqual([...ROUTING_KEYS].sort());
    });

    it(`${name} keeps the interpolation placeholders the code passes`, () => {
      const routing = (dict as any).mobile.detail.routing;
      // A translation that drops {{identity}} renders 'Nameplate reads "".'
      expect(routing.whyNameplate).toContain('{{identity}}');
      expect(routing.askGuess).toContain('{{marketplace}}');
      // Money/percentage rule: the number always carries its unit.
      expect(routing.confidence).toContain('{{word}}');
      expect(routing.confidence).toContain('{{pct}}');
      expect(routing.confidence).toContain('%');
    });
  }

  // The five non-English locales must actually be translated, not English copies.
  // `confHigh`/`confMedium`/`confLow` are single words, so a lazy copy is easy to
  // miss by eye.
  for (const [name, dict] of Object.entries(TRANSLATED)) {
    it(`${name} does not fall back to the English strings`, () => {
      const routing = (dict as any).mobile.detail.routing;
      const enRouting = (en as any).mobile.detail.routing;
      for (const k of ROUTING_KEYS) {
        expect(routing[k]).not.toBe(enRouting[k]);
      }
      const hub = (dict as any).mobile.reviewHub;
      const enHub = (en as any).mobile.reviewHub;
      for (const k of HUB_KEYS) {
        expect(hub[k]).not.toBe(enHub[k]);
      }
    });
  }

  // Integration C7 — the marketplace description has ONE home, Phase 5's
  // `marketplaceOption.<value>.description`. Phase 4 must not resurrect a second
  // namespace for the same sentence.
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has no marketplaceHint namespace (C7)`, () => {
      expect((dict as any).mobile.detail.marketplaceHint).toBeUndefined();
    });
  }

  // The duplicate `mobile.labCommon.close` key is the canary for a
  // json.load/json.dump round-trip: a round-trip deletes one of them. It survives
  // only because these files are edited as TEXT (integration C11).
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} still parses and keeps mobile.labCommon.close`, () => {
      expect((dict as any).mobile.labCommon.close).toBeTruthy();
    });
  }
});
