import { getCountryCode, getEmojiFlag } from 'countries-list';

/**
 * Country NAME -> flag emoji, for the country row in `LocationCard` and the
 * rows of `CountryPicker` — the convention every phone-number / address picker
 * uses, and what this form was missing.
 *
 * SOURCED, NOT HAND-ROLLED (UI_SOURCING_RULES level 3): the hard part is the
 * name -> ISO 3166-1 alpha-2 lookup, and `countries-list` (MIT, dependency-free)
 * already ships it with the English, native and historical-alias spellings
 * folded in. Hand-writing that map for ~250 countries is exactly the kind of
 * data table that rots silently when a geocoder hands back a spelling nobody
 * anticipated.
 *
 * WHY THE NAME AND NOT A CODE: `COUNTRY_OPTIONS` and the stored draft field are
 * both plain country NAMES (see `constants/countries.ts`), and the address row
 * above is reverse-geocoded free text, so a name that was never in our list can
 * reach this function. That is the normal case, not the edge case.
 *
 * ⚠️ `getCountryCode` returns `false` — not `null`/`undefined` — when it cannot
 * resolve a name, which is why the guard below is a plain falsy check rather
 * than a `== null`.
 *
 * Renders as a real flag on the device: Android ships `NotoColorEmojiFlags.ttf`
 * (verified on the SM-G781B test device) and iOS has them in the system font.
 * Callers must still handle `null` — an unresolvable name has no flag, and the
 * caller falls back to a monochrome glyph rather than showing a blank gutter.
 */
export function countryFlagEmoji(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const code = getCountryCode(trimmed);
  if (!code) return null;
  return getEmojiFlag(code);
}
