/**
 * Guards the whole class of bug behind the recognitionReady regression.
 *
 * `mobile.labNotif.type.recognitionReady` was missing from every locale, so the
 * Notifications list rendered the literal key path to the user
 * ("mobile.labNotif.type.recognitionReady") on the iOS TestFlight build.
 *
 * Asserting on the ONE key that broke would be worthless — the next type added
 * to META without a translation would fail exactly the same way. So this walks
 * every entry in META and every shipped locale.
 */
import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';
import { notificationMeta, NOTIFICATION_TYPES } from '../notificationMeta';

const LOCALES = { en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, th, vi } as const;

function typeLabels(bundle: unknown): Record<string, string> {
  return (bundle as any)?.mobile?.labNotif?.type ?? {};
}

describe('notification type labels', () => {
  it('exposes the list of known server notification types', () => {
    // If this fails the export was renamed — update the walk below, do not
    // hardcode a type list here.
    expect(NOTIFICATION_TYPES.length).toBeGreaterThan(0);
  });

  for (const [locale, bundle] of Object.entries(LOCALES)) {
    it(`${locale}: every notification type has a translated label`, () => {
      const labels = typeLabels(bundle);
      const missing = NOTIFICATION_TYPES.map((t) => notificationMeta(t).labelKey)
        .concat('default') // the fallback itself must exist, it backs every miss
        .filter((key) => typeof labels[key] !== 'string' || labels[key].trim() === '');
      expect(missing).toEqual([]);
    });

    it(`${locale}: no label is a leaked i18n key path`, () => {
      const leaked = Object.entries(typeLabels(bundle))
        .filter(([, v]) => typeof v === 'string' && v.startsWith('mobile.'))
        .map(([k]) => k);
      expect(leaked).toEqual([]);
    });
  }

  it('falls back to the default meta for an unknown server type', () => {
    // The renderer resolves `mobile.labNotif.type.${labelKey}`, so an unknown
    // type must land on a key that exists rather than inventing one.
    const meta = notificationMeta('some_type_the_server_added_later');
    expect(meta.labelKey).toBe('default');
    expect(typeof typeLabels(en)[meta.labelKey]).toBe('string');
  });
});
