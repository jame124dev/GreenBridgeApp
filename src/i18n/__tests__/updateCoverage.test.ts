/**
 * `mobile.labUpdate` must be fully translated in every shipped locale.
 *
 * This namespace is the "update ready — restart to apply" banner and the version
 * footer. It is the app's only feedback that a published OTA fix is waiting, so a
 * raw `mobile.labUpdate.*` key showing through would defeat the very thing it was
 * added to make visible.
 *
 * Expectations are derived from en.json, so a new key added to en without
 * translations fails this automatically.
 */
import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

const TRANSLATED = { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, th, vi } as const;

/** Keys the UI reads directly — pinned so a rename can't quietly orphan one. */
const REQUIRED = [
  'readyTitle',
  'readyBody',
  'restart',
  'restarting',
  'later',
  'builtIn',
  'downloading',
] as const;

const blockOf = (bundle: unknown) =>
  ((bundle as any)?.mobile?.labUpdate ?? {}) as Record<string, string>;

const EN = blockOf(en);

describe('mobile.labUpdate translation coverage', () => {
  it('en defines every key the banner and version line read', () => {
    for (const key of REQUIRED) {
      expect(typeof EN[key]).toBe('string');
      expect(EN[key].length).toBeGreaterThan(0);
    }
  });

  for (const [locale, bundle] of Object.entries(TRANSLATED)) {
    const block = blockOf(bundle);

    it(`${locale} defines every en key`, () => {
      const missing = Object.keys(EN).filter((k) => typeof block[k] !== 'string');
      expect(missing).toEqual([]);
    });

    it(`${locale} is actually translated, not copied from English`, () => {
      const copied = Object.keys(EN).filter((k) => block[k] === EN[k]);
      expect(copied).toEqual([]);
    });
  }
});
