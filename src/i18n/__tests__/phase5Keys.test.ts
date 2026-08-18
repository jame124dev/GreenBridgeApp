import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

// Phase 5: M-5 (profit-card honesty) + M-10 (marketplace option descriptions).
const DETAIL_KEYS = ['profitAiEstimate', 'profitNoEstimate', 'profitNoEstimateHint'];
const MARKETPLACES = ['101lab', '101machine', '101it', '101recycle'];

const LOCALES = { en, zhHant, zhHans, ja, th, vi };
const TRANSLATED = { zhHant, zhHans, ja, th, vi };

describe('phase 5 i18n', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has the profit-card + marketplace-description keys`, () => {
      const detail = (dict as any).mobile?.detail ?? {};
      for (const k of DETAIL_KEYS) expect(typeof detail[k]).toBe('string');
      for (const m of MARKETPLACES) {
        expect(typeof detail.marketplaceOption?.[m]?.description).toBe('string');
        expect(detail.marketplaceOption[m].description.length).toBeGreaterThan(0);
      }
    });
  }

  // The five non-English locales must actually be translated, not English copies.
  for (const [name, dict] of Object.entries(TRANSLATED)) {
    it(`${name} does not fall back to the English strings`, () => {
      const detail = (dict as any).mobile.detail;
      const enDetail = (en as any).mobile.detail;
      for (const k of DETAIL_KEYS) expect(detail[k]).not.toBe(enDetail[k]);
      for (const m of MARKETPLACES) {
        expect(detail.marketplaceOption[m].description).not.toBe(
          enDetail.marketplaceOption[m].description,
        );
      }
    });
  }

  // The duplicate `mobile.labCommon.close` key (en.json:4298 and :4313) is the
  // canary for a json.load/json.dump round-trip: a round-trip deletes one of them.
  // It survives here only because these files are edited as TEXT.
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} still parses and keeps mobile.labCommon.close`, () => {
      expect((dict as any).mobile.labCommon.close).toBeTruthy();
    });
  }
});
