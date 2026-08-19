import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render } from '@testing-library/react-native';

// Same `t` semantics as the other render suites: a key with no defaultValue
// returns the key, so an assertion on a rendered STRING proves the fallback
// argument is really being passed.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (typeof opts === 'string') return opts;
      const dv = (opts as { defaultValue?: string } | undefined)?.defaultValue;
      return dv ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

// `Sheet` reads the bottom safe-area inset in the primitive. Same stub as
// CategoryPickerSheet.test.tsx:11-15.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import { MarketplaceSheet } from '../MarketplaceSheet';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

const ALL: MarketplaceKey[] = ['101lab', '101machine', '101it', '101recycle'];

const renderSheet = (over: Partial<React.ComponentProps<typeof MarketplaceSheet>> = {}) =>
  render(
    <MarketplaceSheet
      visible
      supported={ALL}
      value="101lab"
      suggested={null}
      onSelect={() => {}}
      onClose={() => {}}
      {...over}
    />,
  );

/**
 * Integration C7 — `MARKETPLACE_OPTIONS[].description` is the ONE home for
 * marketplace description copy, and M-3 is its ONLY consumer.
 *
 * Phase 5 guarded the render site by grepping `MarketplaceCard.tsx`'s SOURCE,
 * because the card returned null while `MARKETPLACE_LOCKED = true` and no render
 * test could reach the line. M-4 flipped that lock: the card renders nothing at
 * all now and the picker lives here, so the guard becomes a real render
 * assertion. `marketplaceOptions.test.ts` keeps the other two halves (the field
 * itself and option↔locale-key parity).
 */
describe('MarketplaceSheet — the description render site (C7)', () => {
  it('renders every supported option with its description', () => {
    const { getByText } = renderSheet();
    for (const opt of MARKETPLACE_OPTIONS) {
      expect(getByText(opt.label)).toBeTruthy();
      // The i18n key resolves to its defaultValue under the stub above, so this
      // asserts the fallback argument really is `opt.description`.
      expect(getByText(opt.description)).toBeTruthy();
    }
  });

  it('shows only the marketplaces the server allows (M-12)', () => {
    const { queryByText } = renderSheet({ supported: ['101lab', '101machine'] });
    expect(queryByText('101LAB')).toBeTruthy();
    expect(queryByText('101MACHINE')).toBeTruthy();
    expect(queryByText('101IT')).toBeNull();
    expect(queryByText('101RECYCLE')).toBeNull();
  });

  // Stitch 4b: the best guess is FIRST. An earlier revision put the runner-up
  // first and it read as a bug.
  it('lists the AI best guess first, badged, and never invents a runner-up', () => {
    const { getByText, queryByText } = renderSheet({ suggested: '101it', value: null });
    expect(getByText('101IT  ·  Best guess')).toBeTruthy();
    // One badge only — the wire carries one site type, not a ranked list.
    expect(queryByText('101LAB  ·  Best guess')).toBeNull();
  });

  it('pre-selects nothing when the caller passes value=null (the ask state)', () => {
    // `Sheet.Option` renders a ✓ only for the active row.
    const { queryAllByText } = renderSheet({ value: null });
    expect(queryAllByText('✓')).toHaveLength(0);
  });

  it('marks exactly the current marketplace when there is one', () => {
    const { queryAllByText } = renderSheet({ value: '101machine' });
    expect(queryAllByText('✓')).toHaveLength(1);
  });
});
