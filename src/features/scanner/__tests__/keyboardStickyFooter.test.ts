import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * M-11 — in both scan editors the sticky footer is a SIBLING of
 * `KeyboardAwareScrollView`, which only rescues content INSIDE the scroll. The
 * fix is to wrap that sibling block in `KeyboardStickyView`.
 *
 * This is asserted structurally, from source, and that limit is deliberate: the
 * behaviour is a native window-inset effect with no JS-observable result — there
 * is nothing a jest render can measure, and S1's evidence for branch (a) came
 * from library source, not from a device (see the C-commit message). What CAN be
 * locked down is the topology, which is exactly what someone deletes by accident:
 * after `</KeyboardAwareScrollView>` the very next element must be the
 * `KeyboardStickyView`, and `KeyboardProvider` must be mounted at the root or the
 * wrapper is inert.
 *
 * If a future phase moves the footer inside the scroll view, delete this file
 * along with the wrapper — do not weaken the assertion to keep it passing.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** Source with comments stripped — a docblock naming a component is not a mount. */
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

const EDITORS = ['app/scan/detail.tsx', 'app/scan/grouped-edit.tsx'];

describe('M-11: the footer is lifted above the keyboard in both scan editors', () => {
  it.each(EDITORS)('%s imports KeyboardStickyView from the controller lib', (file) => {
    const code = read(file);
    expect(code).toMatch(
      /import \{[^}]*KeyboardStickyView[^}]*\} from 'react-native-keyboard-controller'/,
    );
  });

  it.each(EDITORS)('%s wraps everything after the scroll view in it', (file) => {
    const code = read(file);
    const afterScroll = code.slice(
      code.lastIndexOf('</KeyboardAwareScrollView>') + '</KeyboardAwareScrollView>'.length,
    );
    // The first JSX element after the scroll view — i.e. the top of the pinned
    // block — must BE the sticky wrapper. Anything else is a footer sitting
    // behind the IME.
    const firstTag = afterScroll.match(/<([A-Za-z][\w.]*)/);
    expect(firstTag?.[1]).toBe('KeyboardStickyView');
  });

  it('detail.tsx keeps the footer + approval notice inside the wrapper', () => {
    const code = read('app/scan/detail.tsx');
    const open = code.indexOf('<KeyboardStickyView');
    const close = code.indexOf('</KeyboardStickyView>');
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    const inside = code.slice(open, close);
    expect(inside).toContain('<DetailFooter');
    expect(inside).toContain('<SellerApprovalNotice />');
  });

  it('KeyboardProvider is mounted at the root, or the wrapper is inert', () => {
    expect(read('app/_layout.tsx')).toContain('<KeyboardProvider');
  });
});
