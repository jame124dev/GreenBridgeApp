import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { mmkv } from '@/lib/mmkv';

import en from './locales/en.json';
import zhHant from './locales/zh-Hant.json';
import zhHans from './locales/zh-Hans.json';
import ja from './locales/ja.json';
import th from './locales/th.json';

// Explicit BCP-47 script subtags: zh-Hant = Traditional, zh-Hans = Simplified.
// (The app's original bare `zh` was Traditional — see normalizeLanguage.)
const SUPPORTED = ['en', 'zh-Hant', 'zh-Hans', 'ja', 'th'] as const;
export type SupportedLanguage = (typeof SUPPORTED)[number];

const LANG_KEY = 'i18n.language';

/** Map any stored value or device locale (e.g. `zh`, `zh-TW`, `zh-Hans-CN`,
 *  `en-US`) onto one of our supported languages, or null if unsupported.
 *  Chinese resolves to Traditional for TW/HK/MO (and the legacy bare `zh`),
 *  Simplified for CN/SG/`Hans`. */
export function normalizeLanguage(raw?: string | null): SupportedLanguage | null {
  if (!raw) return null;
  const l = raw.toLowerCase();
  if (l.startsWith('zh')) {
    if (l.includes('hans') || l.includes('cn') || l.includes('sg')) return 'zh-Hans';
    // Hant / TW / HK / MO, and legacy bare `zh` (was Traditional in this app).
    return 'zh-Hant';
  }
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('th')) return 'th';
  if (l.startsWith('en')) return 'en';
  return null;
}

/** Read previously selected language from MMKV; fall back to English.
 *  MMKV throws on Expo web's static prerender (no storage on the server),
 *  so we swallow that and default to English — the real value is read once
 *  the client mounts and `languageChanged` will persist subsequent picks. */
function loadStoredLanguage(): SupportedLanguage {
  try {
    return normalizeLanguage(mmkv.getString(LANG_KEY)) ?? 'en';
  } catch {
    // SSR / prerender — no storage available yet.
    return 'en';
  }
}

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-Hant': { translation: zhHant },
    'zh-Hans': { translation: zhHans },
    ja: { translation: ja },
    th: { translation: th },
  },
  lng: loadStoredLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED as unknown as string[],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
});

// Persist subsequent language changes (e.g. from the Home picker) so the
// choice survives app restarts.
i18n.on('languageChanged', (lng) => {
  const normalized = normalizeLanguage(lng);
  if (!normalized) return;
  try {
    mmkv.set(LANG_KEY, normalized);
  } catch {
    // SSR / prerender — nothing to persist.
  }
});

// Dev-only: expose i18n on `window.__i18n` so it's reachable from devtools /
// Playwright-style scripts during manual QA. Skipped in production builds.
if (__DEV__ && typeof globalThis !== 'undefined') {
  (globalThis as unknown as { __i18n: typeof i18n }).__i18n = i18n;
}

// Short badge shown in the header language chip. Chinese variants get a single
// distinguishing glyph (繁 / 简) since a shared "ZH" would be ambiguous.
const LANGUAGE_BADGES: Record<SupportedLanguage, string> = {
  en: 'EN',
  'zh-Hant': '繁',
  'zh-Hans': '简',
  ja: 'JA',
  th: 'TH',
};

/** Header chip badge for the current language; tolerant of device/legacy codes. */
export function languageBadge(code?: string): string {
  return LANGUAGE_BADGES[normalizeLanguage(code) ?? 'en'];
}

export { SUPPORTED as SUPPORTED_LANGUAGES };
export default i18n;
