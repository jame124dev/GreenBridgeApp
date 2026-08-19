import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

/**
 * ⛔ WHY THIS FILE EXISTS, SEPARATELY FROM RoutingChip.test.tsx
 *
 * The invisible-CTA bug (ask state: white label on the pale amber card, no fill,
 * no padding, 23dp tall on device) could NOT be reproduced by a normal render
 * test, and that is the whole point.
 *
 * NativeWind's babel preset routes every JSX element through
 * `react-native-css-interop`'s `wrapJSX`, which swaps each RN primitive for its
 * `cssInterop` wrapper. That wrapper takes over the INLINE `style` prop as well as
 * `className` (`getNormalizeConfig` sets `inlineProp: 'style'` whenever target
 * !== source), pushes it through `collectInlineRules`, and merges it with
 * `{ ...declaration }`. Spreading a FUNCTION produces `{}` — so
 * `style={({ pressed }) => ({ backgroundColor, minHeight, padding… })}` reaches
 * the host view as an empty object and the button renders with no fill at all.
 *
 * But `wrapJSX` guards the registration with
 *     if (process.env.NODE_ENV !== "test") require("./components");
 * so under jest the primitives are NEVER swapped, the plain RN `Pressable`
 * resolves the callback itself, and the broken code renders perfectly. That is
 * how this shipped past a fully green suite.
 *
 * So this suite re-creates the runtime condition explicitly: it applies the same
 * mapping the library applies to `Pressable`, using nativewind's PUBLIC
 * `cssInterop` export, before anything renders. The registration is global and
 * permanent for this module registry, which is why it lives in its own file
 * rather than being bolted onto the existing RoutingChip suite.
 *
 * If a nativewind upgrade removes `cssInterop` or stops mapping `className` to
 * `style`, the `beforeAll` below throws and this suite goes RED — it does not
 * quietly stop testing anything.
 */
// `require`, not `import`: the registration must be a runtime statement that runs
// before the first render, and an ESM import of a side-effect-free module that we
// then call is exactly what a bundler is free to hoist or drop.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativewind = require('nativewind') as { cssInterop?: unknown };

beforeAll(() => {
  if (typeof nativewind.cssInterop !== 'function') {
    throw new Error(
      'nativewind no longer exports cssInterop — this suite can no longer reproduce the ' +
        'runtime style pipeline. Re-derive how the inline `style` prop is processed before ' +
        'deleting or relaxing this check.',
    );
  }
  const cssInterop = nativewind.cssInterop as (
    c: unknown,
    m: Record<string, string>,
  ) => unknown;
  // Byte-for-byte the mapping in react-native-css-interop's components.js.
  cssInterop(Pressable, { className: 'style' });
  cssInterop(View, { className: 'style' });
  cssInterop(Text, { className: 'style' });
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (typeof opts === 'string') return opts;
      const o = opts as Record<string, unknown> | undefined;
      let out = (o?.defaultValue as string) ?? key;
      if (o) {
        for (const [k, v] of Object.entries(o)) {
          if (k === 'defaultValue') continue;
          out = out.split(`{{${k}}}`).join(String(v));
        }
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/scanner/routing/useSupportedMarketplaces', () => ({
  useSupportedMarketplaces: () => ['101lab', '101machine', '101it'],
}));

import { RoutingChip } from '../RoutingChip';
import { brand } from '@/constants/theme';
import { deriveRoutingState, signalFromDraft } from '@/features/scanner/routing/routingState';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { DraftItem } from '@/stores/scanDraftStore';

const CTA = 'Choose a marketplace to continue';

/**
 * The real ask trigger, not a guessed prop: `routingNeedsAsk` fires on
 * `needsClearerPhoto`, on a `regex_override` / `low_confidence_fallback`
 * siteTypeSource, or on a suggestion this build does not support. `101recycle`
 * is deliberately absent from the mocked supported list above, so this draft is
 * the device case from the screenshot (office chairs → AI said recycle).
 */
const askDraft = (over: Partial<DraftItem> = {}): DraftItem =>
  ({
    id: 'd1',
    photos: [],
    ai: { suggestedMarketplace: '101recycle' },
    brand: '',
    model: '',
    marketplace: '101lab',
    categoryId: null,
    marketplaceConfirmed: false,
    ...over,
  }) as unknown as DraftItem;

function Harness({ item }: { item: DraftItem }) {
  const form = useForm<DetailFormInput>({
    defaultValues: {
      marketplace: '101lab',
      categoryId: '',
      categoryName: '',
      parentCategoryId: '',
      parentCategoryName: '',
      customSubcategory: '',
    } as DetailFormInput,
  });
  return (
    <FormProvider {...form}>
      <RoutingChip draft={item} onConfirm={() => {}} />
    </FormProvider>
  );
}

const flat = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

describe('RoutingChip ask CTA — the seller can actually SEE the only action', () => {
  it('the draft under test really is the ask state (guards the fixture, not the UI)', () => {
    const state = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: signalFromDraft(askDraft()),
      supported: ['101lab', '101machine', '101it'],
    });
    expect(state.kind).toBe('ask');
    // The AI named an unsupported marketplace, so there is no guess to highlight.
    expect(state.suggested).toBeNull();
  });

  it('renders the CTA with a real fill, so white label text is legible', () => {
    const { getByLabelText, getByText } = render(<Harness item={askDraft()} />);
    expect(getByText("We're not sure where this belongs")).toBeTruthy();

    const cta = flat(getByLabelText(CTA).props.style);

    // ⛔ The regression that shipped: this was `{}` — no fill, so #ffffff label
    // text on the amber card (#fffbeb) was invisible.
    expect(cta.backgroundColor).toBe(brand.primary);
    // …and while unstyled it collapsed to the label's line box (~23dp measured).
    expect(cta.minHeight).toBe(48);
    expect(cta.paddingVertical).toBe(10);
    expect(cta.paddingHorizontal).toBe(12);
    expect(cta.borderRadius).toBe(8);
    expect(cta.alignItems).toBe('center');
  });

  it('keeps the label the contrasting foreground colour, not the card ink', () => {
    const { getByText } = render(<Harness item={askDraft()} />);
    expect(flat(getByText(CTA).props.style).color).toBe(brand.primaryForeground);
  });

  it('minHeight rather than height, so a wrapped TH/VI label is not clipped', () => {
    const { getByLabelText } = render(<Harness item={askDraft()} />);
    const cta = flat(getByLabelText(CTA).props.style);
    expect(cta.minHeight).toBe(48);
    expect(cta.height).toBeUndefined();
  });

  it('still gives press feedback — a darker fill while held, restored on release', () => {
    const { getByLabelText } = render(<Harness item={askDraft()} />);
    const node = getByLabelText(CTA);

    fireEvent(node, 'pressIn');
    expect(flat(getByLabelText(CTA).props.style).backgroundColor).toBe(brand.primaryDim);

    fireEvent(node, 'pressOut');
    expect(flat(getByLabelText(CTA).props.style).backgroundColor).toBe(brand.primary);
  });

  it('is still the live control that opens the picker, not a styled decoration', () => {
    const { getByLabelText, queryByText } = render(<Harness item={askDraft()} />);
    expect(queryByText('Choose a marketplace')).toBeNull();
    fireEvent.press(getByLabelText(CTA));
    expect(queryByText('Choose a marketplace')).toBeTruthy();
  });

  it('the ask trigger also fires on needsClearerPhoto, and that CTA is filled too', () => {
    const { getByLabelText } = render(
      <Harness item={askDraft({ ai: null, needsClearerPhoto: true })} />,
    );
    expect(flat(getByLabelText(CTA).props.style).backgroundColor).toBe(brand.primary);
  });

  it('the ask trigger also fires on a low_confidence_fallback route', () => {
    const { getByLabelText } = render(
      <Harness
        item={askDraft({
          ai: { suggestedMarketplace: '101lab' } as never,
          siteTypeSource: 'low_confidence_fallback',
        })}
      />,
    );
    expect(flat(getByLabelText(CTA).props.style).backgroundColor).toBe(brand.primary);
  });

  it('proves the harness is faithful: a callback style IS silently emptied here', () => {
    // The mechanism itself, pinned. If a nativewind upgrade ever starts honouring
    // callback styles this test goes red — and THAT is the signal to relax the
    // rule in RoutingChip, deliberately, rather than by accident.
    const { getByTestId } = render(
      <Pressable testID="probe" style={() => ({ minHeight: 48, backgroundColor: '#14452f' })}>
        <Text>x</Text>
      </Pressable>,
    );
    expect(flat(getByTestId('probe').props.style)).toEqual({});
  });
});
