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
    const { getByText } = render(<Harness item={draft({ marketplaceConfirmed: true })} />);
    expect(getByText("WE'LL LIST THIS ON")).toBeTruthy();
    expect(getByText('101LAB')).toBeTruthy();
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

  it('quotes the nameplate as the WHY, and invents nothing when there is none', () => {
    const withPlate = render(
      <Harness item={draft({ marketplaceConfirmed: true, brand: 'Hsiangtai', model: 'CN-1050' })} />,
    );
    expect(withPlate.getByText('WHY')).toBeTruthy();
    expect(withPlate.getByText('Nameplate reads "Hsiangtai CN-1050".')).toBeTruthy();

    const without = render(<Harness item={draft({ marketplaceConfirmed: true })} />);
    expect(without.queryByText('WHY')).toBeNull();
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
});

describe('RoutingChip — ASK state (Stitch 4b)', () => {
  const asking = draft({ marketplaceConfirmed: false, needsClearerPhoto: true });

  it('asks, names the guess, and its CTA names the action', () => {
    const { getByText } = render(<Harness item={asking} />);
    expect(getByText("We're not sure where this belongs")).toBeTruthy();
    expect(getByText("Pick a marketplace and we'll load the right categories.")).toBeTruthy();
    expect(getByText('Choose a marketplace to continue')).toBeTruthy();
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

  it('the CTA opens the picker rather than being a dead disabled control', () => {
    const { getByText, queryByText } = render(<Harness item={asking} />);
    expect(queryByText('Choose a marketplace')).toBeNull(); // sheet title, closed
    fireEvent.press(getByText('Choose a marketplace to continue'));
    expect(queryByText('Choose a marketplace')).toBeTruthy();
  });

  it('confirming from the sheet reports the chosen marketplace to the screen', () => {
    const picked: string[] = [];
    const { getByText } = render(
      <Harness item={asking} onConfirm={(m) => picked.push(m)} />,
    );
    fireEvent.press(getByText('Choose a marketplace to continue'));
    fireEvent.press(getByText('101MACHINE'));
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
