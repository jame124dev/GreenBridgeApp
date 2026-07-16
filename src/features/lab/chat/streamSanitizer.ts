// streamSanitizer — ALL streaming-frame text safety for the (lab) chat, as one
// pure module (zero React/RN/store imports, unit-testable in isolation).
//
// Two jobs:
//  1. The committed-path strips (moved verbatim from ChatMessage.tsx and
//     re-exported there, so its public API and snapshots stay byte-identical):
//     collapse the redundant "**Label:** value" field-dump prose when a card
//     already shows the fields. `resolveBotText` is the single card-aware
//     dispatcher both paths use.
//  2. The streaming-frame guards (`sanitizeStreamTail` / `streamSafeText`):
//     the reveal loop paints an arbitrary PREFIX of the final text every frame,
//     so unclosed markdown tokens ("**bol", "[text](ht…", a fence opener still
//     typing its language) would leak raw syntax mid-stream. We HOLD the viable
//     incomplete trailing token until it closes — every frame is clean, and for
//     any settled/closed text the output converges to exactly the committed
//     `resolveBotText` render (the settle swap is pixel-identical by
//     construction; enforced by the convergence tests).
//
// Applied to the REVEALED substring in StreamingMessage only — never upstream
// of useStreamReveal (its shrink-reset would wipe the bubble when a strip
// shortens the text).

/** Draft cards whose prose the assistant pads with a redundant "**Label:**
 *  value" field dump (already shown in the card itself). */
const DRAFT_CARD_TYPES = new Set(['listing_draft', 'wtb_draft']);
export function messageHasDraftCard(cards?: { type: string }[]): boolean {
  return !!cards?.some((c) => DRAFT_CARD_TYPES.has(c.type));
}

const FIELD_BULLET_RE = /^\s*[-*]\s+\*\*[^*]+:\*\*/; // "- **Label:** value"
/** Collapse the redundant field-dump when a draft card accompanies the prose:
 *  drop the "**Label:** value" bullets and the dangling "…here are the details:"
 *  lead-in, leaving just the opening + closing sentence (e.g. "Your draft is
 *  ready. Please add a location to publish."). The card already shows the
 *  fields. Only invoked when a draft card is present — ordinary prose is never
 *  touched. */
/** A line that is ONLY a markdown image ("![Image](https://…)"). MarkdownLite
 *  renders these as null (the cards carry the photos), but leaving them in the
 *  text keeps their surrounding blank lines apart — each one then paints a gap
 *  View, stacking into a big hole inside the bubble (device-observed). Dropping
 *  them here lets the blank-line collapse actually meet. */
const IMAGE_ONLY_LINE_RE = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/;

export function stripDraftFieldDump(text: string): string {
  return text
    .split('\n')
    .filter((l) => !FIELD_BULLET_RE.test(l) && !IMAGE_ONLY_LINE_RE.test(l))
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\s*here(?:'s| are)?(?: the)?(?: updated)? details:\s*/i, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Drop a trailing "Would you like to save … / add more details?" prompt — the
    // draft card's own editable fields + "Save & alert" button ARE the call to
    // action, so the sentence is redundant. Then clean up a dangling lead-in colon
    // ("Here's a draft …:") the removal can leave behind.
    .replace(/\s*(?:would you like to|do you want to|want to|shall i)\b[^?]*\?\s*$/i, '')
    .replace(/\s*[:：]\s*$/, '')
    .trim();
}

/** Result/info cards that already SHOW the structured fields, so the assistant's
 *  prose field-dump (a bulleted list of "**Name**", "**Condition:** …", etc.) is
 *  pure redundancy next to the card. (The proper fix is prompt-side — a short
 *  recommendation instead of a field list — but until then we strip the dump so
 *  the prose stays conversational and the card is the single source of the data.) */
const INFO_CARD_TYPES = new Set([
  'product_list', 'product', 'wtb_matches', 'wtb_request', 'wtb_request_list',
  'catalog_summary', 'overview', 'seller_summary', 'seller_activity', 'platform_info', 'batch_list',
]);
export function messageHasInfoCard(cards?: { type: string }[]): boolean {
  return !!cards?.some((c) => INFO_CARD_TYPES.has(c.type));
}
// A bulleted/numbered line whose content LEADS WITH BOLD — the field-dump shape
// ("- **Nikon SMZ800N**", "- **Condition:** Refurbished"). Conversational bullets
// (which don't start bold) are left untouched.
const BOLD_BULLET_RE = /^\s*(?:[-*]|\d+\.)\s+\*\*/;
/** Drop the redundant bold field-dump bullets when a result/info card is present,
 *  leaving the conversational lead + closing sentences. */
export function stripCardFieldDump(text: string): string {
  return text
    .split('\n')
    .filter((l) => !BOLD_BULLET_RE.test(l) && !IMAGE_ONLY_LINE_RE.test(l))
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The card-aware bot text both render paths resolve through: a draft card
 *  collapses its field-dump, a result/info card its bold bullets, plain prose
 *  passes through. Extracted from ChatMessage's botText ternary so the
 *  streaming sanitizer can converge on the EXACT committed text. */
export function resolveBotText(text: string, cards?: { type: string }[]): string {
  return messageHasDraftCard(cards)
    ? stripDraftFieldDump(text)
    : messageHasInfoCard(cards)
      ? stripCardFieldDump(text)
      : text;
}

/* ── Streaming-frame tail sanitizing ──────────────────────────────────────── */

/** A fence line exactly the way parseBlocks detects one (line opens with ```). */
const FENCE_LINE_RE = /^```/;
/** A trailing backtick run possibly becoming a fence, or a fence opener still
 *  typing its language ("`", "``", "```", "```py", "``` python", "````").
 *  Held whole — CodeBlock must not mount until the opener line is
 *  newline-terminated, or its language label visibly grows ("p" → "py" →
 *  "python"). The optional whitespace matches parseBlocks' CommonMark-style
 *  info string, and 4+ backtick runs are held too (review MINOR-1: "``` pyt"
 *  previously fell through to the odd-backtick cut and painted a raw "``"). */
const FENCE_OPENER_PARTIAL_RE = /^`+[ \t]*\w*$/;
/** A closing fence forming inside a code body ("`" / "``"). */
const FENCE_CLOSING_PARTIAL_RE = /^`{1,2}$/;
/** A viable in-progress link/image token anchored at the line end — "[tex",
 *  "[text]" (a "(" may still follow), "[text](url-so-far", each with an optional
 *  leading "!". Cutting at the match start is what stops the raw multi-line GCS
 *  image-URL leak. A closed "[text](url)" never matches. */
const LINK_TAIL_RE = /!?\[[^\]]*(?:\](?:\([^)]*)?)?$/;
/** A bare list/heading/quote marker with no content yet ("-", "1.", ">", "##").
 *  Painting it early gives the "-"→"•" indent snap / "#"→heading jump / ">"→
 *  quote remount; drop the whole line until content arrives. */
const MARKER_REMNANT_RE = /^\s*(?:[-*]|\d+\.|>|#{1,3})\s*$/;

/**
 * Hold viable incomplete trailing markdown so no streaming frame ever paints
 * raw syntax (D1/D2). Pure prefix-of-the-final-text in, clean text out.
 * INVARIANT (unit-tested): any text whose tokens/fences are all closed passes
 * through untouched — the last streamed frame equals the committed render.
 */
export function sanitizeStreamTail(text: string): string {
  const lines = text.split('\n');
  const last = lines[lines.length - 1];

  // 1) FENCE PASS. Odd count of fence lines ABOVE the last line = the last line
  // is inside a fence body (mirrors parseBlocks' line walk).
  let fences = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (FENCE_LINE_RE.test(lines[i])) fences++;
  }
  const inFence = fences % 2 === 1;
  if (inFence) {
    // Only a forming closing fence is held; code bodies stream VERBATIM into
    // the mounted block (holding the whole fence would trade flicker for an
    // unbounded single-frame insertion at close).
    if (FENCE_CLOSING_PARTIAL_RE.test(last)) return lines.slice(0, -1).join('\n');
    return text;
  }
  if (FENCE_OPENER_PARTIAL_RE.test(last)) return lines.slice(0, -1).join('\n');

  // 2) INLINE PASS — last line only (inline tokens never span lines; the prose
  // renderer splits per line). Earliest cut among the viable partial tokens:
  let cut = last.length;
  // (a) unpaired "**" → cut at the last (opening) one: "…and **bol" → "…and ".
  if ((last.split('**').length - 1) % 2 === 1) {
    cut = Math.min(cut, last.lastIndexOf('**'));
  }
  // (b) unpaired "`" (a fence opener never reaches here) → cut at the last one.
  if ((last.split('`').length - 1) % 2 === 1) {
    cut = Math.min(cut, last.lastIndexOf('`'));
  }
  // (c) a viable link/image tail → cut at the "[" (or the "!" of "!["). A plain
  // "[sic]" releases one frame later, when the next char shows no "(" follows.
  const link = LINK_TAIL_RE.exec(last);
  if (link) cut = Math.min(cut, link.index);
  // (d) a lone trailing "*" or "!" — a single ambiguous char (could open "**" /
  // "!["); hold it, the next frame disambiguates. ("**" pairs are (a)'s job.)
  if (cut === last.length && last.length > 0) {
    const ch = last[last.length - 1];
    if (ch === '!' || (ch === '*' && !last.endsWith('**'))) cut = last.length - 1;
  }
  const cutLine = last.slice(0, cut);

  // 3) REMNANT PASS — a bare marker (or a line the cut emptied) would paint a
  // premature bullet dot / heading jump / quote bar: drop the line entirely.
  if (MARKER_REMNANT_RE.test(cutLine) || (cut < last.length && cutLine.trim() === '')) {
    return lines.slice(0, -1).join('\n');
  }
  if (cut === last.length) return text; // closed text → untouched
  lines[lines.length - 1] = cutLine;
  return lines.join('\n');
}

/* ── Card-aware streaming text (D4) ───────────────────────────────────────── */

/** Sentence families whose COMPLETED forms the committed strips remove — hold a
 *  partially-typed one so it never paints-then-vanishes at settle. Lowercase
 *  (compared case-insensitively). */
// Every phrase the settled strips remove must ALSO be held while typing, or the
// partial paints then snaps away at completion (review MINOR-2 data gaps:
// 'want to' is in SAVE_PROMPT_TAIL_RE; 'here are the updated details:' is
// matched by stripDraftFieldDump's optional-(updated) branch).
const SAVE_PROMPT_FAMILY = ['would you like to', 'do you want to', 'want to', 'shall i'];
const LEAD_IN_FAMILY = [
  "here's the details:",
  'here are the details:',
  "here's the updated details:",
  'here are the updated details:',
];

/** An in-flight save-prompt tail (draft cards only): the phrase has begun but
 *  its sentence hasn't ended. When "?" completes it, the committed strip removes
 *  the sentence (held-then-stripped = never visible); when "."/"!" arrives
 *  instead the tail stops matching and the sentence paints — exactly matching
 *  committed, which only strips "?"-terminated prompts. */
const SAVE_PROMPT_TAIL_RE = /(?:\bwould you like to|\bdo you want to|\bwant to|\bshall i)\b[^?.!\n]*$/i;

/** A dangling list-marker fragment at the END of the last line ("…ready — - ").
 *  stripDraftFieldDump's lead-in replace consumes the newline BEFORE a
 *  just-started field bullet ("…details:\n- " → "…ready — - "), merging the bare
 *  marker into the prose line where the line-level remnant pass can't drop it —
 *  hold the fragment until the bullet either closes (then the whole line is
 *  filtered) or proves to be prose. */
const MERGED_MARKER_TAIL_RE = /[ \t](?:[-*]|\d+\.)[ \t]*$/;

/** If any suffix of the LAST line is a case-insensitive proper prefix of one of
 *  `phrases`, cut it — a partially-typed strippable phrase never paints. */
function holdIfSuffixIsPrefixOf(text: string, phrases: string[]): string {
  const nl = text.lastIndexOf('\n');
  const last = text.slice(nl + 1).toLowerCase();
  for (let i = 0; i < last.length; i++) {
    const suffix = last.slice(i);
    if (phrases.some((p) => p.length > suffix.length && p.startsWith(suffix))) {
      return text.slice(0, nl + 1 + i);
    }
  }
  return text;
}

/**
 * The streaming bubble's per-frame text: the committed strips applied LIVE to
 * the revealed prefix (D4 — a field-dump bullet is dropped the instant its
 * "**Label:**" closes, and the (a)-hold keeps it invisible while typing, so it
 * NEVER paints), plus the save-prompt/lead-in prefix holds, then the tail
 * sanitizer (D1/D2). `settled` → exactly `resolveBotText`, so the leaf's final
 * frame is byte-identical to the committed render (the D3 swap is invisible).
 */
export function streamSafeText(text: string, cards?: { type: string }[], settled = false): string {
  if (settled) return resolveBotText(text, cards);
  let base = resolveBotText(text, cards);
  const hasDraft = messageHasDraftCard(cards);
  if (hasDraft) {
    const tail = SAVE_PROMPT_TAIL_RE.exec(base);
    if (tail) base = base.slice(0, tail.index);
    base = holdIfSuffixIsPrefixOf(base, SAVE_PROMPT_FAMILY);
    base = holdIfSuffixIsPrefixOf(base, LEAD_IN_FAMILY);
  }
  let safe = sanitizeStreamTail(base);
  if (hasDraft) {
    // After the tail cut, a lead-in-merged bullet leaves a dangling marker
    // ("…ready — - "); hold it too (draft cards only — the merge is a
    // stripDraftFieldDump artifact).
    const merged = MERGED_MARKER_TAIL_RE.exec(safe.slice(safe.lastIndexOf('\n') + 1));
    if (merged) safe = safe.slice(0, safe.lastIndexOf('\n') + 1 + merged.index);
  }
  return safe;
}
