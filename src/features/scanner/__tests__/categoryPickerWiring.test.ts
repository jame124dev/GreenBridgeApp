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

const read = (rel: string) => codeOf(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const SHEET = 'src/components/ui/Sheet.tsx';

describe('(a) the shared Sheet does not eat the first tap on a search result', () => {
  it('the body ScrollView carries keyboardShouldPersistTaps="handled"', () => {
    expect(read(SHEET)).toMatch(/keyboardShouldPersistTaps=["']handled["']/);
  });

  it('and it is "handled", never "always" — empty space must still dismiss the keyboard', () => {
    expect(read(SHEET)).not.toMatch(/keyboardShouldPersistTaps=["']always["']/);
  });
});
