import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { REQUIRED_ROWS } from '@/features/scanner/requiredStatus';

/**
 * M-8 / M-9 — the seam between the screen and the pieces it ships.
 *
 * The required-progress strip and the jump-to-the-offending-card behaviour are
 * both unit-tested at the component level (`RequiredProgressStrip.test.tsx`,
 * `DetailFooter.required.test.tsx`, `useDetailController.submit.test.tsx`), but
 * every one of those mounts its piece DIRECTLY. Nothing proved that the one
 * screen which actually ships them still wires them up: a revert test
 * (2026-08-18) deleted each of the three wiring points from `app/scan/detail.tsx`
 * in turn and the full suite stayed green at 102 suites / 892 tests.
 *
 *   (a) `required={required}` + `onPressRow={scrollToRow}` on `<DetailFooter>` —
 *       the footer renders the strip ONLY when `required` is passed (DetailFooter
 *       Props: "when provided, the footer renders the sticky required-progress
 *       strip"), so deleting these removes the strip from the shipped product
 *       entirely, and `onPressRow` is what makes its chips tappable.
 *   (b) `useDetailController({ scrollToRow })` — the invalid-submit alert scrolls
 *       via `opts?.scrollToRow?.(first)` (useDetailController.ts), an optional
 *       call on an optional option. Drop the argument and the alert still fires,
 *       still names the missing field, and silently goes nowhere.
 *   (c) an `onLayout={registerRow('<key>')}` wrapper per row — an unregistered row
 *       has no recorded `y`, and `scrollToRow` returns early on `y == null`
 *       (useRowScroller.ts), so that one chip becomes a silent no-op while every
 *       other chip keeps working.
 *   (d) `ref={scrollRef}` on the scroll view — same seam, same silence: with no
 *       ref attached, `scrollRef.current?.scrollTo` is a no-op for EVERY row.
 *
 * WHAT THIS FILE PROVES, AND WHAT IT DOES NOT. These are assertions over the
 * screen's SOURCE TEXT. They prove the wiring is still WRITTEN; they do not prove
 * it WORKS. A `registerRow` that recorded the wrong `y`, a ref that failed to
 * attach at runtime, a strip that rendered off-screen — all of that would pass
 * here. The trade-off is deliberate: rendering this route under jest means
 * standing up expo-router, the scan draft store, React Query, KeyboardProvider
 * and six card subtrees, and even then the thing under test (scroll offsets fed
 * by native `onLayout`, consumed by a native `scrollTo`) produces no
 * JS-observable result in the test environment — there is nothing to assert on.
 * So: behaviour lives in the component tests, and the seam between them lives
 * here, which is precisely what an unrelated refactor deletes by accident. Same
 * trade-off and same reasoning as `keyboardStickyFooter.test.ts` and the third
 * case of `marketplaceOptions.test.ts` (both source assertions, both documented).
 *
 * The row list is derived from `REQUIRED_ROWS`, the exported source of truth, so
 * adding a row without wiring it fails HERE rather than shipping a dead chip.
 *
 * If the strip ever moves off this screen, delete this file along with it — do not
 * weaken an assertion to keep it green.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCREEN = 'app/scan/detail.tsx';

/**
 * Source with comments stripped — a docblock quoting `required={required}` is not
 * a prop. Same helper as `keyboardStickyFooter.test.ts`; duplicated rather than
 * exported because a shared test-util module would be one more thing to keep in
 * sync for two callers.
 */
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

/**
 * The opening tag of `<Tag …>` including all of its props, brace-balanced so a
 * `>` inside an attribute expression (an arrow function, a comparison) does not
 * end the tag early.
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

/**
 * Every `onLayout={…}` attribute body in the file, one string per handler,
 * brace-balanced (the category/condition wrapper is a block-bodied arrow, so a
 * regex to the first `}` would truncate it).
 *
 * Balancing is naive about braces inside string literals; every row key here is a
 * plain identifier, so that limit costs nothing today. If a handler ever needs a
 * brace inside a string, this needs a real parser.
 */
function onLayoutHandlers(code: string): string[] {
  const marker = 'onLayout={';
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = code.indexOf(marker, from);
    if (at === -1) return out;
    let depth = 0;
    let i = at + marker.length - 1; // sits on the opening '{'
    for (; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push(code.slice(at + marker.length, i));
    from = i + 1;
  }
}

const code = codeOf(fs.readFileSync(path.join(ROOT, SCREEN), 'utf8'));
/** Row keys registered by each onLayout handler, in source order. */
const keysByHandler = onLayoutHandlers(code).map((body) =>
  [...body.matchAll(/registerRow\('([A-Za-z]+)'\)/g)].map((m) => m[1]),
);

describe('app/scan/detail.tsx still wires the required strip + row jump (M-8/M-9)', () => {
  it('(a) <DetailFooter> receives BOTH required={required} and onPressRow={scrollToRow}', () => {
    const footer = openingTag(code, 'DetailFooter');
    expect(footer).not.toBe('');
    // `\b` keeps `allRequired={required.allComplete}` from satisfying either one.
    expect(footer).toMatch(/\brequired=\{required\}/);
    expect(footer).toMatch(/\bonPressRow=\{scrollToRow\}/);
  });

  it('(b) the controller is constructed as useDetailController({ scrollToRow })', () => {
    expect(code).toMatch(/useDetailController\(\s*\{[^}]*\bscrollToRow\b[^}]*\}\s*\)/);
  });

  it('(c) every REQUIRED_ROWS key is registered by an onLayout wrapper', () => {
    const registered = [...new Set(keysByHandler.flat())].sort();
    // Derived from the exported source of truth on purpose: a row added to
    // REQUIRED_ROWS with no wrapper ships a chip that does nothing, and a wrapper
    // for a key that is no longer a row is dead code. Both fail here.
    expect(registered).toEqual([...REQUIRED_ROWS].sort());
  });

  it('(c) category + condition share ONE wrapper, and they are the only pair', () => {
    // They live in the same CategoryConditionCard, so one wrapper is correct —
    // nesting two would give the inner a y of 0 relative to the outer and the jump
    // would be a no-op. Splitting that card is M-2's job, in another phase.
    const shared = keysByHandler.filter((keys) => keys.length > 1).map((keys) => [...keys].sort());
    expect(shared).toEqual([['category', 'condition']]);
  });

  it('(c) every other required row owns its own wrapper, exactly once', () => {
    const solo = keysByHandler.filter((keys) => keys.length === 1).map((keys) => keys[0]);
    const expected = REQUIRED_ROWS.filter((k) => k !== 'category' && k !== 'condition');
    expect(solo.sort()).toEqual([...expected].sort());
  });

  it('(d) the row scroller ref is attached to the scroll view', () => {
    const scroll = openingTag(code, 'KeyboardAwareScrollView');
    expect(scroll).toMatch(/\bref=\{scrollRef\}/);
  });
});
