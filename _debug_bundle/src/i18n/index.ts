import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { mmkv } from '@/lib/mmkv';

import en from './locales/en.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import th from './locales/th.json';

const SUPPORTED = ['en', 'zh', 'ja', 'th'] as const;
export type SupportedLanguage = (typeof SUPPORTED)[number];

const LANG_KEY = 'i18n.language';

/** Read previously selected language from MMKV; fall back to English.
 *  MMKV throws on Expo web's static prerender (no storage on the server),
 *  so we swallow that and default to English — the real value is read once
 *  the client mounts and `languageChanged` will persist subsequent picks. */
function loadStoredLanguage(): SupportedLanguage {
  try {
    const stored = mmkv.getString(LANG_KEY);
    if (stored && (SUPPORTED as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // SSR / prerender — no storage available yet.
  }
  return 'en';
}

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
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
  if (!(SUPPORTED as readonly string[]).includes(lng)) return;
  try {
    mmkv.set(LANG_KEY, lng);
  } catch {
    // SSR / prerender — nothing to persist.
  }
});

// Dev-only: expose i18n on `window.__i18n` so it's reachable from devtools /
// Playwright-style scripts during manual QA. Skipped in production builds.
if (__DEV__ && typeof globalThis !== 'undefined') {
  (globalThis as unknown as { __i18n: typeof i18n }).__i18n = i18n;
}

export { SUPPORTED as SUPPORTED_LANGUAGES };
export default i18n;
