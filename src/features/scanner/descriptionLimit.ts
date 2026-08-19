/**
 * ⛔ THE ONE HOME for the description length limit.
 *
 * THE BUG THIS EXISTS FOR (device pass 2026-08-19): the AI's OWN generated
 * description arrived at 543 characters against a 500 limit (measured: lab
 * 415/500 ok, ASUS 364/500 ok, AOI machine 543/500 over), so `DescriptionCard`
 * greeted the seller with a red counter and "43 characters over the 500 limit —
 * please shorten it." The seller was handed a chore for something they did not
 * do and cannot be blamed for. The AI wrote it; the AI's output must fit.
 *
 * WHY TRUNCATE AT THE MAPPER, and not the two alternatives:
 *   - Raise the field limit — 500 is a PRODUCT convention shared with the web
 *     seller flow (`LabListingEditSheet.tsx:817` uses the same 500) not a column
 *     width (`post_content` is LONGTEXT). Raising it only in mobile makes the
 *     same listing legal on one client and flagged on the other, and picking the
 *     new number is a product+backend call, not a bug fix.
 *   - Cap it at submit time / server side — too late to help: the seller is
 *     already staring at a red field they must edit. And `buildFormData` is a
 *     1:1 web-parity path (`appendSpecsToDescription` deliberately mirrors web
 *     line for line), so quietly changing what mobile SENDS would put the two
 *     platforms out of step in the payload rather than in the UI.
 *   - Disabling the counter/validation was explicitly ruled out — the limit is
 *     real for a seller who types, and the warning still has to work for them.
 *
 * So the fix is at the boundary where the AI's text BECOMES form state: both
 * mappers (`mapProductData` for smart-detect, `mapAnalyzeResponse` for analyze)
 * run their `equipment_description` through `fitDescription`. A draft can then
 * never be born over the limit, while a seller who types past it still gets the
 * warning — `maxLength` on the input stops them at 500 anyway.
 *
 * NOT changed on purpose: `appendSpecsToDescription` appends a `--- Brand: …`
 * spec block at SUBMIT time, so the submitted `product_content` can still exceed
 * 500. That is web-parity behaviour on the payload, invisible to the seller, and
 * a separate decision.
 */

/**
 * The seller-facing limit. Read by `DescriptionCard`'s `maxLength`, its counter
 * and its over-limit line, and by both AI mappers via `fitDescription`.
 */
export const DESCRIPTION_MAX = 500;

/** One UTF-16 code unit, so an ellipsised result still fits `max` exactly. */
const ELLIPSIS = '…';

/**
 * `.` `!` `?` and their CJK forms count as a sentence end ONLY when followed by
 * whitespace or the end of the slice — otherwise "12.5 kg" and "No. 3" read as
 * sentence ends and the description gets cut mid-clause.
 */
const TERMINATORS = '.!?。！？';

/** Index just AFTER the last usable sentence terminator, or -1. */
function lastSentenceEnd(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    if (!TERMINATORS.includes(s[i])) continue;
    if (i === s.length - 1 || /\s/.test(s[i + 1])) return i + 1;
  }
  return -1;
}

/** Index OF the last whitespace run's start, or -1. */
function lastWordBoundary(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    if (/\s/.test(s[i])) return i;
  }
  return -1;
}

/**
 * Never leave a dangling high surrogate: a hard cut through an emoji or a
 * supplementary-plane character would otherwise emit half a code point.
 */
function dropLoneSurrogate(s: string): string {
  const last = s.charCodeAt(s.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? s.slice(0, -1) : s;
}

/**
 * Coerce an AI-supplied description to a string that FITS `max`, cutting at the
 * cleanest boundary available.
 *
 * Order of preference:
 *   1. Already short enough → returned trimmed, untouched.
 *   2. A sentence end at ≥60% of `max` → cut there, NO ellipsis: the result
 *      reads as finished prose rather than as a truncation.
 *   3. A word boundary at ≥50% of `max` → cut there and append `…`.
 *   4. Otherwise a hard cut + `…`. This is the zh/ja/th path — those languages
 *      have no spaces, so steps 2 and 3 find nothing and a threshold-only
 *      implementation would return an empty string.
 *
 * Length is counted in UTF-16 code units, the same unit `String.length`,
 * `<TextInput maxLength>` and the "n/500" counter use, so all four agree.
 */
export function fitDescription(raw: unknown, max: number = DESCRIPTION_MAX): string {
  const text = String(raw ?? '').trim();
  if (max <= 0) return '';
  if (text.length <= max) return text;

  const head = text.slice(0, max);

  const sentence = lastSentenceEnd(head);
  if (sentence >= Math.floor(max * 0.6)) return head.slice(0, sentence).trimEnd();

  // Budget one unit for the ellipsis so the result is <= max, never max + 1.
  const budget = max - ELLIPSIS.length;
  const word = lastWordBoundary(text.slice(0, budget + 1));
  if (word >= Math.floor(max * 0.5)) {
    return `${text.slice(0, word).trimEnd()}${ELLIPSIS}`;
  }

  return `${dropLoneSurrogate(text.slice(0, budget)).trimEnd()}${ELLIPSIS}`;
}
