import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

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

// The supported list is M-12's; this suite is about the CHIP, so the hook is
// stubbed at its module seam (it would otherwise need a QueryClientProvider and
// would reach the axios transport).
let mockSupported: string[] = ['101lab', '101machine', '101it'];
jest.mock('@/features/scanner/routing/useSupportedMarketplaces', () => ({
  useSupportedMarketplaces: () => mockSupported,
}));

import { RoutingChip } from '../RoutingChip';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';

const draft = (over: Partial<DraftItem> = {}): DraftItem =>
  ({
    id: 'd1',
    photos: [],
    ai: null,
    brand: '',
    model: '',
    marketplace: '101lab',
    categoryId: null,
    ...over,
  }) as unknown as DraftItem;

function Harness({
  item,
  onConfirm = () => {},
  formMarketplace = '101lab',
  categoryId = '',
}: {
  item: DraftItem;
  onConfirm?: (m: MarketplaceKey) => void;
  formMarketplace?: MarketplaceKey;
  categoryId?: string;
}) {
  // Only the fields RoutingChip reads/writes — a full DetailFormInput would add
  // fifteen irrelevant defaults to every case. Cast at the provider boundary.
  const form = useForm<DetailFormInput>({
    defaultValues: {
      marketplace: formMarketplace,
      categoryId,
      categoryName: '',
      parentCategoryId: '',
      parentCategoryName: '',
      customSubcategory: '',
    } as DetailFormInput,
  });
  return (
    <FormProvider {...form}>
      <RoutingChip draft={item} onConfirm={onConfirm} />
    </FormProvider>
  );
}

afterEach(() => {
  mockSupported = ['101lab', '101machine', '101it'];
});

describe('RoutingChip — CONFIRMED state (Stitch 4a)', () => {
  it('states the destination instead of asking, and offers a quiet Change', () => {
    const { getByText, getByLabelText } = render(
      <Harness item={draft({ marketplaceConfirmed: true })} />,
    );
    expect(getByText("WE'LL LIST THIS ON")).toBeTruthy();
    // The destination is now the marketplace's own wordmark rather than text, so
    // assert the accessibilityLabel — that is also what a screen reader announces.
    expect(getByLabelText('101LAB')).toBeTruthy();
    expect(getByText('Change')).toBeTruthy();
    expect(getByText('Lab & scientific equipment')).toBeTruthy();
  });

  it('renders the confidence word AND number only when the server sent one', () => {
    const { queryByText } = render(
      <Harness item={draft({ marketplaceConfirmed: true, siteTypeConfidence: 0.94 })} />,
    );
    expect(queryByText('AI confidence: High · 94%')).toBeTruthy();

    const bare = render(<Harness item={draft({ marketplaceConfirmed: true })} />);
    // A persisted pre-S0-2 draft has null — a made-up percentage is worse than
    // none, so the row is omitted entirely.
    expect(bare.queryByText(/AI confidence/)).toBeNull();
  });

  it('picks the display word by band, and the word is the ONLY thing the number drives', () => {
    for (const [c, word] of [
      [0.94, 'High'],
      [0.7, 'Medium'],
      [0.2, 'Low'],
    ] as const) {
      const { queryByText } = render(
        <Harness item={draft({ marketplaceConfirmed: true, siteTypeConfidence: c })} />,
      );
      expect(queryByText(`AI confidence: ${word} · ${Math.round(c * 100)}%`)).toBeTruthy();
      // ⛔ plan §2.1 — a low number must NOT turn the statement into a question.
      expect(queryByText("We're not sure where this belongs")).toBeNull();
    }
  });

  it('quotes the nameplate as the reason, and invents nothing when there is none', () => {
    const withPlate = render(
      <Harness item={draft({ marketplaceConfirmed: true, brand: 'Hsiangtai', model: 'CN-1050' })} />,
    );
    // The "WHY" label was removed to save a row — a one-word heading over a
    // one-line sentence. The SENTENCE is what matters and it must still be there.
    expect(withPlate.getByText('Nameplate reads "Hsiangtai CN-1050".')).toBeTruthy();
    expect(withPlate.queryByText('WHY')).toBeNull();

    const without = render(<Harness item={draft({ marketplaceConfirmed: true })} />);
    expect(without.queryByText(/Nameplate reads/)).toBeNull();
  });

  it('explains an empty category on an untrusted tree instead of leaving it blank', () => {
    const { getByText } = render(
      <Harness
        item={draft({ marketplaceConfirmed: true, marketplace: '101machine' })}
        formMarketplace="101machine"
      />,
    );
    expect(
      getByText('Category: not set — pick one below. We would rather ask than guess.'),
    ).toBeTruthy();
  });

  it('says nothing about the category once the seller has picked one', () => {
    const { queryByText } = render(
      <Harness
        item={draft({ marketplaceConfirmed: true, marketplace: '101machine' })}
        formMarketplace="101machine"
        categoryId="5300"
      />,
    );
    expect(queryByText(/Category: not set/)).toBeNull();
  });

  // ⛔ FIX 1 (2026-08-20) — the earbuds case, END TO END through the chip. The
  // photo could not be read but 101IT was named and supported, so the card must
  // STATE the destination. Before FIX 1 this exact draft rendered the amber
  // "We're not sure where this belongs" question.
  //
  // `marketplaceConfirmed: false` is LOAD-BEARING and must not be dropped: the
  // chip computes `confirmed` as `draft.marketplaceConfirmed !== false`, so an
  // UNSET field reads as already-confirmed and short-circuits the trigger
  // entirely — the assertions below would then pass no matter what
  // `routingNeedsAsk` says. `false` is also what the store really writes for an
  // unanswered draft (`marketplaceConfirmed: !mustAsk`).
  it('states the destination for an unreadable photo the AI still routed (the earbuds case)', () => {
    const { getByText, queryByText, getByLabelText } = render(
      <Harness
        item={draft({
          marketplace: '101it',
          marketplaceConfirmed: false,
          ai: { suggestedMarketplace: '101it' } as never,
          needsClearerPhoto: true,
        })}
        formMarketplace="101it"
      />,
    );
    expect(queryByText("We're not sure where this belongs")).toBeNull();
    expect(queryByText('Hard to tell from this photo')).toBeNull();
    expect(getByText("WE'LL LIST THIS ON")).toBeTruthy();
    expect(getByLabelText('Change')).toBeTruthy();
    // ...and the unreadable photo is NOT swallowed: the why line says so, on the
    // brand/model fact it is actually about. (IdentityCard carries the same
    // truth onto the fields themselves — IdentityCard.nameplateHint.test.tsx.)
    expect(getByText('No brand or model was legible in the photos.')).toBeTruthy();
  });

  // ⛔ FIX 2 (2026-08-20) — a keyword-scorer pick reads as "not set", not as a
  // confident AI fill. 101LAB is a TRUSTED tree, so `categorySource` is the only
  // thing withholding the pre-fill: before FIX 2 this rendered no line at all
  // and the seller saw a 0/7-accuracy guess under the green AI badge.
  it('explains the blank when the category came from the keyword scorer, not the model', () => {
    const { getByText } = render(
      <Harness
        item={draft({ marketplaceConfirmed: true, marketplace: '101lab', categorySource: 'fuzzy' })}
        formMarketplace="101lab"
      />,
    );
    expect(
      getByText('Category: not set — pick one below. We would rather ask than guess.'),
    ).toBeTruthy();
  });

  it("says nothing about the category when the MODEL itself picked it ('ai')", () => {
    const { queryByText } = render(
      <Harness
        item={draft({ marketplaceConfirmed: true, marketplace: '101lab', categorySource: 'ai' })}
        formMarketplace="101lab"
      />,
    );
    expect(queryByText(/Category: not set/)).toBeNull();
  });

  // "Honest and QUIET" — a fuzzy pick the seller has already replaced must not
  // keep nagging. Same fuzzy draft, but the form now holds a category.
  it('stops mentioning a fuzzy category once the seller has picked one themselves', () => {
    const { queryByText } = render(
      <Harness
        item={draft({ marketplaceConfirmed: true, marketplace: '101lab', categorySource: 'fuzzy' })}
        formMarketplace="101lab"
        categoryId="5375"
      />,
    );
    expect(queryByText(/Category: not set/)).toBeNull();
  });
});

describe('RoutingChip — ASK state (Stitch 4b)', () => {
  const asking = draft({ marketplaceConfirmed: false, needsClearerPhoto: true });

  it('asks, and offers every supported marketplace inline', () => {
    const { getByText, getByLabelText } = render(<Harness item={asking} />);
    expect(getByText('Hard to tell from this photo')).toBeTruthy();
    // One tap, not two: the options are on the card, not behind a button that
    // opens a sheet.
    expect(getByLabelText('101LAB — Lab & scientific equipment')).toBeTruthy();
    expect(getByLabelText('101MACHINE — Industrial & production machinery')).toBeTruthy();
    expect(getByLabelText('101IT — IT hardware & electronics')).toBeTruthy();
  });

  // The ask state has TWO causes and the card must not blame the wrong one. A
  // wide shot of wireless earbuds on a device showed "We're not sure where this
  // belongs" ALONGSIDE "Our best guess is 101IT" — a visible contradiction, when
  // the real problem was an unreadable photo. These two cases pin each wording to
  // its cause, so neither can drift onto the other.
  it('blames the PHOTO when the nameplate could not be read', () => {
    const { getByText, queryByText } = render(
      <Harness item={draft({ marketplaceConfirmed: false, needsClearerPhoto: true })} />,
    );
    expect(getByText('Hard to tell from this photo')).toBeTruthy();
    expect(
      getByText(
        'A closer shot of the nameplate would help. You can also just pick the marketplace yourself.',
      ),
    ).toBeTruthy();
    expect(queryByText("We're not sure where this belongs")).toBeNull();
  });

  it('blames the MARKETPLACE only when the photo was fine', () => {
    const { getByText, queryByText } = render(
      <Harness
        item={draft({
          marketplaceConfirmed: false,
          needsClearerPhoto: false,
          siteTypeSource: 'low_confidence_fallback',
        })}
      />,
    );
    expect(getByText("We're not sure where this belongs")).toBeTruthy();
    expect(getByText("Pick a marketplace and we'll load the right categories.")).toBeTruthy();
    expect(queryByText('Hard to tell from this photo')).toBeNull();
  });

  it('sets the expectation about category and currency', () => {
    const { getByText } = render(<Harness item={asking} />);
    expect(
      getByText("Category and currency are set once you choose — we won't guess them."),
    ).toBeTruthy();
  });

  it('does NOT present a Change affordance — there is nothing confirmed to change', () => {
    const { queryByText } = render(<Harness item={asking} />);
    expect(queryByText('Change')).toBeNull();
    expect(queryByText("WE'LL LIST THIS ON")).toBeNull();
  });

  it('needs no sheet at all — the options are already on screen', () => {
    const { queryByText, getByLabelText } = render(<Harness item={asking} />);
    // No intermediate picker: the sheet title must never appear in the ask state.
    expect(queryByText('Choose a marketplace')).toBeNull();
    expect(getByLabelText('101LAB — Lab & scientific equipment')).toBeTruthy();
  });

  it('a single tap on an option reports the chosen marketplace to the screen', () => {
    const picked: string[] = [];
    const { getByLabelText } = render(
      <Harness item={asking} onConfirm={(m) => picked.push(m)} />,
    );
    fireEvent.press(getByLabelText('101MACHINE — Industrial & production machinery'));
    expect(picked).toEqual(['101machine']);
  });
});

describe('RoutingChip — fail-closed (G15)', () => {
  it('renders NOTHING when only one marketplace is supported', () => {
    mockSupported = ['101lab'];
    const { toJSON } = render(<Harness item={draft({ marketplaceConfirmed: false })} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing on an empty list either', () => {
    mockSupported = [];
    const { toJSON } = render(<Harness item={draft({ marketplaceConfirmed: false })} />);
    expect(toJSON()).toBeNull();
  });
});
