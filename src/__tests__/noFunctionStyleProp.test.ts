import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ⛔ `style={({ pressed }) => …}` must never appear on a component again.
 *
 * NativeWind's interop SPREADS the style prop; spreading a FUNCTION yields `{}`,
 * so the style is dropped at runtime with no warning. On 2026-08-21 this had made
 * TWO buttons invisible — `(auth)/pending.tsx`'s primary CTA and
 * `(lab)/processing.tsx`'s Retry — because each lost its background while its
 * white label (a plain style) survived.
 *
 * ⚠️ THIS TEST EXISTS BECAUSE NO RENDER TEST CAN CATCH IT. The interop is not
 * registered when `NODE_ENV === 'test'`, so under Jest the callback runs and the
 * styles look correct. 1274 tests passed while both buttons were invisible on a
 * real device. A source-level assertion is the only thing that works.
 *
 * The fix is `usePressed()` / `usePressedKey()` from `src/lib/pressState.ts`.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['app', 'src'];
const SKIP = /__tests__|node_modules/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('no function-form style prop (NativeWind deletes it)', () => {
  it('never passes a callback to style=', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const src = fs.readFileSync(file, 'utf8');
        src.split('\n').forEach((line, i) => {
          // Only real JSX usage — the guidance comments in RoutingChip and
          // friends deliberately quote the pattern and must not fail this.
          const isComment = /^\s*(\/\/|\*|\/\*)/.test(line);
          if (!isComment && /style=\{\(\s*\{/.test(line)) {
            offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
