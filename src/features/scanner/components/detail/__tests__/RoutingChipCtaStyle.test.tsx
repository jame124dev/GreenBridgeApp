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

/** Each option's accessibilityLabel is `${label} — ${description}`. */
const OPTION_LABELS = [
  '101LAB — Lab & scientific equipment',
  '101MACHINE — Industrial & production machinery',
  '101IT — IT hardware & electronics',
];

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

function Harness({
  item,
  onConfirm = () => {},
}: {
  item: DraftItem;
  onConfirm?: (m: string) => void;
}) {
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
      <RoutingChip draft={item} onConfirm={onConfirm as never} />
    </FormProvider>
  );
}

const flat = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

describe('RoutingChip ask options — the seller can actually SEE the choices', () => {
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

  it('renders each OPTION ROW with a real fill and border, not an empty object', () => {
    const { getByLabelText, getByText } = render(<Harness item={askDraft()} />);
    expect(getByText("We're not sure where this belongs")).toBeTruthy();

    // The inline options replaced the "Choose a marketplace to continue" button
    // (one tap instead of two). The NativeWind hazard is identical, so the guard
    // moved with the UI rather than being deleted with it: if these styles ever
    // come back as `{}`, the rows lose their fill, border and height and the
    // picker becomes three invisible tap targets on the amber card.
    for (const label of OPTION_LABELS) {
      const row = flat(getByLabelText(label).props.style);
      expect(row.backgroundColor).toBe(brand.surface);
      expect(row.borderColor).toBe(brand.borderStrong);
      expect(row.borderWidth).toBe(1);
      expect(row.minHeight).toBe(56);
      expect(row.borderRadius).toBe(8);
    }
  });

  it('minHeight rather than height, so a wrapped TH/VI label is not clipped', () => {
    const { getByLabelText } = render(<Harness item={askDraft()} />);
    const row = flat(getByLabelText(OPTION_LABELS[0]).props.style);
    expect(row.minHeight).toBe(56);
    expect(row.height).toBeUndefined();
  });

  it('gives press feedback on the row — tinted while held, restored on release', () => {
    const { getByLabelText } = render(<Harness item={askDraft()} />);
    const node = getByLabelText(OPTION_LABELS[0]);

    fireEvent(node, 'pressIn');
    expect(flat(getByLabelText(OPTION_LABELS[0]).props.style).backgroundColor).toBe(
      brand.primarySurface,
    );

    fireEvent(node, 'pressOut');
    expect(flat(getByLabelText(OPTION_LABELS[0]).props.style).backgroundColor).toBe(brand.surface);
  });

  it('answers in ONE tap — the row itself confirms, with no sheet in between', () => {
    const picked: string[] = [];
    const { getByLabelText } = render(<Harness item={askDraft()} onConfirm={(m) => picked.push(m)} />);
    fireEvent.press(getByLabelText(OPTION_LABELS[1]));
    expect(picked).toEqual(['101machine']);
  });

  it('still styles the rows when the ask came from needsClearerPhoto', () => {
    const { getByLabelText } = render(
      <Harness item={askDraft({ ai: null, needsClearerPhoto: true })} />,
    );
    expect(flat(getByLabelText(OPTION_LABELS[0]).props.style).backgroundColor).toBe(brand.surface);
  });

  it('still styles the rows on a low_confidence_fallback route', () => {
    const { getByLabelText } = render(
      <Harness
        item={askDraft({
          ai: { suggestedMarketplace: '101lab' } as never,
          siteTypeSource: 'low_confidence_fallback',
        })}
      />,
    );
    expect(flat(getByLabelText(OPTION_LABELS[0]).props.style).backgroundColor).toBe(brand.surface);
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
