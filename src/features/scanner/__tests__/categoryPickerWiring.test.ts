import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * M-2 — the seams around the category picker that no render test can reach.
 *
 * WHAT THIS FILE PROVES, AND WHAT IT DOES NOT. These are assertions over SOURCE
 * TEXT. They prove the wiring is still WRITTEN; they do not prove it WORKS. Same
 * deliberate trade-off, and the same reasoning, as `keyboardStickyFooter.test.ts`
 * and `detailScreenWiring.test.ts`.
 *
 * (a) `keyboardShouldPersistTaps="handled"` on `Sheet`'s body scroller. With the
 *     search field focused and the keyboard up, a `ScrollView` at its default
 *     `'never'` spends the FIRST tap dismissing the keyboard, so it never reaches
 *     `Sheet.Option`'s `onPress`: "type `centrif`, tap the row, nothing happens".
 *     `fireEvent.press` bypasses the touch responder chain entirely, so the whole
 *     `CategoryPickerSheet` suite passes with or without this prop — a unit test
 *     CANNOT catch it. The card being replaced set it explicitly on both of its
 *     scrollers; the shared primitive never did, which is why `CountryPicker` has
 *     the same latent bug today. Only a device confirms the behaviour (Step M2.6
 *     check #1: keyboard still up, ONE tap).
 *
 * (b) The card actually mounts the sheet and feeds it the four things it cannot
 *     derive: the tree, the loading/error flags with a retry, and the current
 *     pick. `CategoryConditionCard` is not renderable under jest (it needs a
 *     react-hook-form provider, React Query and the whole detail form), so the
 *     sheet's behaviour lives in `CategoryPickerSheet.test.tsx` and the seam
 *     between them lives here — which is precisely what an unrelated refactor
 *     deletes by accident.
 *
 * (c) The hydrate/bridge effect and its NOTE survive. They are the reason the
 *     AI's auto-filled category is still on screen; M-2 moved the presentation
 *     around them and must not have touched them.
 *
 * If the picker ever stops being a sheet, delete this file along with it — do not
 * weaken an assertion to keep it green.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** Source with comments stripped — a docblock quoting a prop is not a prop. */
function codeOf(src: string): string {
  let inBlock = false;
  return src
    .split('\n')
    .filter((raw) => {
      const line = raw.trim();
      if (inBlock) {
        if (line.includes('*/')) inBlock = false;
        return false;
      }
      if (line.startsWith('/*') || line.startsWith('{/*')) {
        if (!line.includes('*/')) inBlock = true;
        return false;
      }
      return !(line.startsWith('//') || line.startsWith('*'));
    })
    .join('\n');
}

const readRaw = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const read = (rel: string) => codeOf(readRaw(rel));

/**
 * The opening tag of `<Tag …>` including all of its props, brace-balanced so a
 * `>` inside an attribute expression does not end the tag early. Same helper as
 * `detailScreenWiring.test.ts`.
 */
function openingTag(code: string, tag: string): string {
  const start = code.indexOf(`<${tag}`);
  if (start === -1) return '';
  let depth = 0;
  for (let i = start + tag.length + 1; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return code.slice(start, i + 1);
  }
  return code.slice(start);
}

const SHEET = 'src/components/ui/Sheet.tsx';
const CARD = 'src/features/scanner/components/detail/CategoryConditionCard.tsx';
/** Every screen that mounts the card — M-2's real blast radius. */
const SCREENS = ['app/scan/detail.tsx', 'app/scan/grouped-edit.tsx', 'app/(lab)/listing-edit.tsx'];

describe('(a) the shared Sheet does not eat the first tap on a search result', () => {
  it('the body ScrollView carries keyboardShouldPersistTaps="handled"', () => {
    expect(read(SHEET)).toMatch(/keyboardShouldPersistTaps=["']handled["']/);
  });

  it('and it is "handled", never "always" — empty space must still dismiss the keyboard', () => {
    expect(read(SHEET)).not.toMatch(/keyboardShouldPersistTaps=["']always["']/);
  });
});

describe('(b) the card mounts the sheet and feeds it what it cannot derive', () => {
  const tag = () => openingTag(read(CARD), 'CategoryPickerSheet');

  it('mounts it at all', () => {
    expect(tag()).not.toBe('');
  });

  it.each([
    // The tree. Without it the sheet renders an empty list on a 200 response.
    ['categories', /\bcategories=\{parents\}/],
    // Loading + error + retry: the sheet owns the explanatory copy and the
    // recovery tap, but only the card holds the React Query handle.
    ['loading', /\bloading=\{categories\.isLoading\}/],
    ['error', /\berror=\{categories\.isError\}/],
    ['onRetry', /\bonRetry=\{[\s\S]*categories\.refetch\(\)/],
    // The current pick, so the sheet can mark it active and open its parent.
    ['value', /\bvalue=\{categoryId/],
    ['parentId', /\bparentId=\{watchedParentCategoryId/],
    // The only path by which this phase writes the form.
    ['onSelect', /\bonSelect=\{applyPick\}/],
    ['visible', /\bvisible=\{sheetOpen\}/],
    ['onClose', /\bonClose=\{\(\) => setSheetOpen\(false\)\}/],
  ])('passes %s', (_name, pattern) => {
    expect(tag()).toMatch(pattern as RegExp);
  });

  it('names the marketplace it is loading, from MARKETPLACE_OPTIONS', () => {
    // "Loading categories…" is the generic spinner UX_DESIGN_RULES rejects. The
    // label can only come from the card, which is where `marketplace` is watched.
    expect(tag()).toMatch(/\bmarketplaceLabel=\{marketplaceLabel\}/);
    expect(read(CARD)).toMatch(/MARKETPLACE_OPTIONS\.find\(\(o\) => o\.value === marketplace\)/);
  });
});

describe('(c) the hydrate/bridge effect and its warning survived the rewrite', () => {
  it('all four gates of the effect are still there', () => {
    const code = read(CARD);
    // Non-empty-tree gate: React Query briefly yields {categories:[],options:[]},
    // and running against that wipes a valid AI category before the tree lands.
    expect(code).toMatch(/if \(!categories\.data\?\.categories\?\.length\) return;/);
    // EN-bridge settle gate: without it the effect clears the AI's EN id before
    // the EN tree arrives to bridge it.
    expect(code).toMatch(/if \(!enBridgeSettled\) return;/);
    // The Other sentinel is deliberately absent from `options`.
    expect(code).toMatch(/=== OTHER_SUBCATEGORY_ID\) return;/);
    // Parent-only adoption: keeps what the AI DID resolve.
    expect(code).toMatch(/setValue\('parentCategoryId', String\(parent\.id\)/);
  });

  it('the NOTE that stops the next person re-opening the race is still in the file', () => {
    // Read RAW, not comment-stripped: the thing being asserted IS a comment.
    expect(readRaw(CARD)).toContain(
      'NOTE: clearing the category/subcategory + Other fields on a marketplace',
    );
  });

  it('no effect in the card depends on `marketplace` — that IS the trap', () => {
    // §1: a watch-effect keyed on marketplace fires during hydration, when the
    // form's default marketplace flips to the AI's, and wipes the auto-filled
    // category. Clearing on a marketplace switch is MarketplaceCard's onPress.
    const deps = [...read(CARD).matchAll(/\}, \[([\s\S]*?)\]\);/g)].map((m) => m[1]);
    expect(deps.length).toBeGreaterThan(0);
    for (const dep of deps) {
      expect(dep).not.toMatch(/\bmarketplace\b/);
    }
  });
});

describe('(d) all three screens that mount the card still mount it', () => {
  it.each(SCREENS)('%s', (screen) => {
    expect(read(screen)).toContain('<CategoryConditionCard');
  });
});
