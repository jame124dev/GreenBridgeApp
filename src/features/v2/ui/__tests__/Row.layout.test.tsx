import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';

/**
 * Reanimated's native side is not initialised under Jest, so importing it
 * throws before a single assertion runs — and `react-native-reanimated/mock`
 * does not help, because in 4.x that file imports the real module first.
 *
 * So this is the minimum surface `theme/v2/motion.ts` and `Row` touch. `Row`'s
 * only use of Reanimated is the press dim, which no layout assertion depends
 * on. Lift this into `src/test-utils/` when a second v2 component needs it.
 */
jest.mock('react-native-reanimated', () => {
  const identity = (v: unknown) => v;
  return {
    __esModule: true,
    default: { createAnimatedComponent: (C: unknown) => C },
    Easing: { bezier: () => identity },
    ReduceMotion: { System: 'system' },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useReducedMotion: () => false,
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    cancelAnimation: () => undefined,
  };
});

import { V2ThemeProvider, badgeDot } from '@/theme/v2';

import { Row } from '../Row';

/**
 * `Row`'s `stamp` and `marker`, which exist because of one specific bug.
 *
 * The inbox drew its unread dot conditionally, so a READ row had no dot and no
 * space where the dot would have been — and every timestamp on a read row sat
 * 21pt further right than the timestamps on unread ones. A column of times
 * that does not line up does not read as "these are read"; it reads as a
 * rendering fault. The fix is to reserve the slot whenever the prop is passed.
 *
 * ⚠️ HONEST LIMITS. This proves the STRUCTURE the styles describe: that a slot
 * is emitted, that the stamp is baseline-aligned to the title, that the title
 * can shrink. It cannot see a phone. It also cannot run in the one place the
 * bug appeared — the signed-in inbox — because a guest has no threads, which
 * is exactly why the structure is pinned here instead.
 */

type Node = { props?: { style?: StyleProp<ViewStyle> }; children?: unknown };

/** `Row` reads the palette from context for the marker colour, as the rest of
 *  the kit does, so it has to render inside the provider. */
function draw(node: React.ReactElement): unknown {
  return render(<V2ThemeProvider>{node}</V2ThemeProvider>).toJSON();
}

/** Every node in the rendered tree, flattened. */
function nodes(tree: unknown): Node[] {
  if (tree === null || typeof tree !== 'object') return [];
  const n = tree as Node & { children?: unknown[] };
  const kids = Array.isArray(n.children) ? n.children.flatMap(nodes) : [];
  return [n, ...kids];
}

function styles(tree: unknown): ViewStyle[] {
  return nodes(tree)
    .map((n) => StyleSheet.flatten(n.props?.style) as ViewStyle | undefined)
    .filter((s): s is ViewStyle => !!s);
}

/** The RESERVED box — the empty one. An unread row also contains the painted
 *  dot, which is the same width, so filtering on width alone counts two. */
const slots = (s: ViewStyle[]) =>
  s.filter((x) => x.width === badgeDot.size && x.backgroundColor === undefined);
const dots = (s: ViewStyle[]) =>
  s.filter((x) => x.width === badgeDot.size && x.backgroundColor !== undefined);
const baselines = (s: ViewStyle[]) => s.filter((x) => x.alignItems === 'baseline');

describe('Row — the unread marker slot', () => {
  it('reserves the slot on a READ row, so the stamp column cannot go ragged', () => {
    const read = styles(draw(<Row title="Waters Alliance" stamp="4h" marker={false} />));
    const unread = styles(draw(<Row title="Waters Alliance" stamp="4h" marker />));

    // One reserved box either way — that is the whole point. The dot appears
    // INSIDE it when unread, so the slot count must not move.
    expect(slots(read)).toHaveLength(1);
    expect(slots(unread)).toHaveLength(1);
  });

  it('emits NOTHING when `marker` is omitted, so rows on the other screens are untouched', () => {
    expect(slots(styles(draw(<Row title="Profile information" />)))).toHaveLength(0);
  });

  it('only paints the dot when unread', () => {
    expect(dots(styles(draw(<Row title="A" marker={false} />)))).toHaveLength(0);
    expect(dots(styles(draw(<Row title="A" marker />)))).toHaveLength(1);
  });
});

describe('Row — the stamp', () => {
  it('sits on the title BASELINE, not the row centre', () => {
    expect(baselines(styles(draw(<Row title="A" subtitle="B" stamp="Tue" />)))).toHaveLength(1);
  });

  it('lets a 90-character title shrink instead of pushing the stamp off-screen', () => {
    const s = styles(
      draw(
        <Row
          title="Waters Alliance e2695 Separations Module with 2998 PDA Detector, refurbished"
          stamp="4h"
        />,
      ),
    );
    // The title column must be both flexible AND allowed to go below its
    // intrinsic width; without minWidth:0 `numberOfLines` never truncates.
    expect(s.some((x) => x.flex === 1 && x.minWidth === 0)).toBe(true);
  });

  it('does not wrap the title when there is no stamp', () => {
    expect(baselines(styles(draw(<Row title="A" stamp="4h" />)))).toHaveLength(1);
    expect(baselines(styles(draw(<Row title="A" />)))).toHaveLength(0);
  });
});
