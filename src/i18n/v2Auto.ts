/**
 * English-as-the-key translation for the v2 UI.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Switching the app to 繁體中文 translated the Home selling pane and nothing
 * else. The cause is not i18n configuration — `zh-hant` resolves correctly,
 * which is exactly why that one pane works. It is that the v2 UI was written
 * with English in the source: of the ten screens under `app/v2`, only
 * `drafts` and `listings` call `t()` at all, and the shared tab bar, the
 * Selling/Buying tabs and the brand bar have none either.
 *
 * Properly internationalising eight screens plus the kit is a large job. This
 * is the small one that makes the app usable in Chinese today: the kit's
 * `Text` looks its literal child up in a map keyed by the ENGLISH SENTENCE.
 * Because `PrimaryAction`, `Row`, `Chip` and the rest all render their
 * `label`/`title` through that same `Text`, one interception reaches almost
 * every visible string without touching a single screen.
 *
 * The maps are generated — `scripts/extract-v2-strings.js` finds the hardcoded
 * copy, `scripts/build-v2-dictionary.js` fills what the shipped locale files
 * already translate. Re-run both after adding UI copy.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 *
 * A stopgap, not the destination. It cannot handle interpolation
 * (`{{count}} products`), plurals, or strings built at runtime — those still
 * need real `t()` calls. As screens are internationalised properly their
 * strings stop reaching this map, and it shrinks to nothing.
 *
 * An empty value means "not translated yet" and falls through to English, so
 * a half-filled dictionary is always safe to ship.
 */
import { useTranslation } from 'react-i18next';

import zhHant from './v2-auto/zh-hant.json';
import zhHans from './v2-auto/zh-hans.json';
import ja from './v2-auto/ja.json';
import th from './v2-auto/th.json';
import vi from './v2-auto/vi.json';

type Dict = Record<string, string>;

/**
 * Keyed by the same lowercase codes `src/i18n/index.ts` normalises to — see
 * the note there about `zh-Hant` vs `zh-hant`. Getting this wrong is silent:
 * the lookup just misses and everything stays English.
 */
const MAPS: Record<string, Dict> = {
  'zh-hant': zhHant as Dict,
  'zh-hans': zhHans as Dict,
  ja: ja as Dict,
  th: th as Dict,
  vi: vi as Dict,
};

/**
 * Translate one literal. Returns the input unchanged for English, for an
 * unknown language, for a miss, and for an empty (untranslated) entry — so
 * the worst case is the English we already show today.
 */
export function v2Auto(text: string, language: string | undefined): string {
  if (!text || !language) return text;
  const map = MAPS[language.toLowerCase()];
  if (!map) return text;
  const hit = map[text];
  return hit ? hit : text;
}

/** True when this language has a dictionary at all — lets callers skip work. */
export function hasV2Dictionary(language: string | undefined): boolean {
  return !!language && !!MAPS[language.toLowerCase()];
}

/**
 * The same lookup, for copy that CANNOT go through the kit's `Text`.
 *
 * ⚠️ A `TextInput` PLACEHOLDER is a string prop rendered by the native input,
 * not a `Text` child, so the interception in `Text.tsx` never sees it. Found
 * on device 2026-10-01: the assistant screen was fully Chinese except its
 * composer, which still read "What are you selling?".
 *
 * Returns a translate function and, through `useTranslation`, subscribes the
 * caller to `languageChanged` — without that the placeholder would only
 * update on remount.
 */
export function useV2Copy(): (text: string) => string {
  const { i18n } = useTranslation();
  return (text: string) => v2Auto(text, i18n.language);
}
