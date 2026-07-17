import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';

import { createRenderTracker } from '@/test-utils/renderCounter';

// PR-3B-0: card snapshot harness. Captures a baseline for representative card
// families on the CURRENT code, then re-runs after the shared-stylesheet
// plumbing conversion to prove it is pixel-identical. Per-family exhaustive
// snapshots are added by each PR-3B-1+ family PR.

// ── Mocks: heavy card dependencies stubbed so cards render deterministically ──
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return { __esModule: true, default: { createAnimatedComponent: (c: unknown) => c, View: RN.View } };
});
jest.mock('@/animations/recipes', () => ({
  usePressScale: () => ({ style: {}, onPressIn: () => {}, onPressOut: () => {}, scale: { value: 1 } }),
  useProgress: () => ({ style: {}, animateTo: () => {}, pct: { value: 0 } }),
}));
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});
jest.mock('sonner-native', () => ({ toast: { error: () => {}, success: () => {} } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: () => {} }) }));
jest.mock('@/components/ui', () => {
  const React_ = require('react');
  const { Image } = require('react-native');
  return { AppImage: (props: object) => React_.createElement(Image, props) };
});
jest.mock('@/features/lab/hooks/useWantMutations', () => ({
  useWantMutations: () => ({ createWant: async () => ({}), isCreating: false }),
}));

import { renderCard } from '../cards';
import { cleanTitle } from '../cardKit';

const ctx = { mode: 'buyer' as const, onSend: () => {} };
const draw = (type: string, data: unknown, extra: Record<string, unknown> = {}) =>
  render(<>{renderCard(type, data, { ...ctx, ...extra })}</>);

// Representative payloads exercising the shared stylesheet across families:
// product rows, the draft centerpiece (meter/price/status/buttons), stat tiles +
// CardShell, and a soft card.
const PRODUCT_LIST = {
  results: [
    { id: 1, name: 'CNC Lathe', condition: 'working', country: 'TW', price: 12000, currency: 'USD' },
  ],
};
// PR-3B-3: an image-bearing product row — exercises the AppImage/thumbImg branch
// (the no-image placeholder icon is already covered by PRODUCT_LIST above).
const PRODUCT_LIST_IMAGE = {
  results: [
    {
      id: 2,
      name: 'Haas VF-2 Vertical Machining Center',
      image: 'https://greenbidz.com/img/vf2.jpg',
      condition: 'likeNew',
      country: 'TW',
      price: 25000,
      currency: 'USD',
    },
  ],
};
const LISTING_DRAFT = {
  draft: {
    fields: {
      product_title: { value: 'Haas VF-2' },
      item_condition: { value: 'working' },
      price_per_unit: { value: 25000 },
      price_currency: { value: 'USD' },
      category: { value: 'CNC' },
      brand: { value: 'Haas' },
      model: { value: 'VF-2' },
      location: { value: 'Taiwan' },
    },
    image_urls: [],
  },
  missing_required: [],
  ready_to_create: false,
};
const OVERVIEW = { live_lots: 42, sold_lots: 128 };
// PR-3B-4: catalog_summary — the stat family's big-stat + facet-chip path
// (bigStat, facetLabel, facetChip*), not exercised by the overview golden.
const CATALOG_SUMMARY = {
  total_products: 1284,
  top_categories: [
    { name: 'CNC', count: 320 },
    { name: 'Lathes', count: 210 },
  ],
  countries: [{ name: 'Taiwan', count: 540 }],
  conditions: [{ name: 'Working', count: 900 }],
};
const HANDOFF = { message: 'Connecting you to a person.' };
// PR-3B-5: entry-options card (two EntryOption tiles → entryOption/entryIcon/
// entryChevron/entryTitle/entrySub) and the gate card (gateCard/gateTitle/gateSub).
const ENTRY_OPTIONS = {};
const GATE = { reason: 'seller_access' };
// PR-3B-6: list/batch/seller family. Date fields omitted so relTime() returns
// null (snapshots stay deterministic — no Date.now()-derived strings). 6 batches
// trigger the "+N more" line; statuses/bid-statuses exercise the tint maps.
const BATCH_LIST = {
  batches: [
    { name: 'Lot A', status: 'live_for_bids', product_count: 12, country: 'TW' },
    { name: 'Lot B', status: 'sold', product_count: 8, country: 'TW' },
    { name: 'Lot C', status: 'upcoming', product_count: 5, country: 'TW' },
    { name: 'Lot D', status: 'pending', product_count: 3, country: 'TW' },
    { name: 'Lot E', status: 'draft', product_count: 7, country: 'TW' },
    { name: 'Lot F', status: 'closed', product_count: 2, country: 'TW' },
  ],
};
const BID_LIST = {
  bids: [
    { batch_name: 'CNC Lathe', bid_status: 'pending', bid_amount: 5000 },
    { batch_name: 'Milling Machine', bid_status: 'winning', bid_amount: 8000 },
    { batch_name: 'Press Brake', bid_status: 'outbid', bid_amount: 3000 },
  ],
};
// PR-3B-7: multi-product family. image_url null → the primaryAccent placeholder
// (queueThumb); mixed `missing` exercises ready/needs StatusChips + skip roster.
const QUEUE = {
  total: 3,
  index: 1,
  items: [
    { index: 1, title: 'CNC Lathe', image_url: null, missing: 0 },
    { index: 2, title: 'Milling Machine', image_url: null, missing: 2 },
    { index: 3, title: 'Press Brake', image_url: null, missing: 1 },
  ],
};
const GROUP_CHOICE = {
  total: 3,
  mode: 'separate_default',
  first_payload: { draft: { fields: { product_title: { value: 'CNC Lathe' } } } },
};
const BATCH_RESULT = {
  published_count: 2,
  skipped_count: 1,
  total: 3,
  published: [{ index: 1 }, { index: 2 }],
  skipped: [{ index: 3, title: 'Press Brake', needs: ['price', 'condition'] }],
};
// Callbacks make the pager / publish CTA / jump affordances render (their
// presence is what gates that UI); identity-stable so they don't perturb memo.
const noop = () => {};
const MULTI_CTX = {
  onJumpProduct: noop,
  onAdvanceProduct: noop,
  onCombineProducts: noop,
  onSplitProducts: noop,
  onPublishBatch: noop,
};
// PR-3B-8: WTB / soft-card cluster. product detail (detailTitle/detailDesc +
// batchStatusTint), platform info (steps), and the WTB draft centerpiece
// (softCard/wtbHeader/teaser + reserved inputs rendered but unmigrated).
const PRODUCT_DETAIL = {
  title: 'Haas VF-2',
  description: 'A vertical machining center in working condition.',
  batch_status: 'live_for_bids',
};
const PLATFORM_INFO = {
  title: 'About GreenBidz',
  intro: 'GreenBidz is a marketplace for industrial equipment.',
  steps: [
    { title: 'List', detail: 'Post your item.' },
    { title: 'Bid', detail: 'Buyers place bids.' },
  ],
};
const WTB_DRAFT = {
  draft: {
    title: 'CNC Lathe Wanted',
    category_name: 'CNC',
    keywords: ['lathe', 'cnc'],
    condition_wanted: ['working'],
    max_price: 15000,
    quantity: 2,
    site_type: 'labgreenbidz',
  },
  preview_matches: [{ id: 1, name: 'Used CNC Lathe', price: 12000, currency: 'USD' }],
};
// PR-3B-2: the "Draft Created" card (listing_created) — the second member of the
// listing-draft family. Captures the published-coin head + view-listing link row.
const LISTING_CREATED = {
  name: 'Haas VF-2 CNC Mill',
  product_id: 12345,
  url: 'https://greenbidz.com/product/12345',
};

describe('cards — characterization (representative families)', () => {
  it('product_list: >6 rows renders a capped grid + a "View all N" opener (results redesign)', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      id: i + 1, name: `Machine ${i + 1}`, condition: 'working', country: 'TW',
    }));
    const { getByText, queryByText } = draw('product_list', { results: rows });
    // Cap: items 1-6 inline, 7+ live in the pager only.
    expect(getByText('Machine 6')).toBeTruthy();
    expect(queryByText('Machine 7')).toBeNull();
    // The opener carries the TRUE total.
    expect(getByText('mobile.labCards.viewAllResults')).toBeTruthy();
  });
  it('product_list: 2-6 rows render as a grid WITHOUT the opener', () => {
    const rows = [
      { id: 1, name: 'Mill A', condition: 'working', country: 'TW' },
      { id: 2, name: 'Mill B', condition: 'working', country: 'TW' },
    ];
    const { getByText, queryByText } = draw('product_list', { results: rows });
    expect(getByText('Mill A')).toBeTruthy();
    expect(getByText('Mill B')).toBeTruthy();
    expect(queryByText('mobile.labCards.viewAllResults')).toBeNull();
  });

  it('product_list golden', () => {
    expect(draw('product_list', PRODUCT_LIST).toJSON()).toMatchSnapshot();
  });
  it('product_list golden (with image)', () => {
    expect(draw('product_list', PRODUCT_LIST_IMAGE).toJSON()).toMatchSnapshot();
  });
  it('listing_draft golden', () => {
    expect(draw('listing_draft', LISTING_DRAFT, { mode: 'seller' }).toJSON()).toMatchSnapshot();
  });
  it('listing_created golden', () => {
    expect(draw('listing_created', LISTING_CREATED).toJSON()).toMatchSnapshot();
  });
  it('overview golden (CardShell + StatTile)', () => {
    expect(draw('overview', OVERVIEW).toJSON()).toMatchSnapshot();
  });
  it('catalog_summary golden (bigStat + facets)', () => {
    expect(draw('catalog_summary', CATALOG_SUMMARY).toJSON()).toMatchSnapshot();
  });
  it('handoff golden (soft card)', () => {
    expect(draw('handoff', HANDOFF).toJSON()).toMatchSnapshot();
  });
  it('listing_entry_options golden (EntryOption + buttons)', () => {
    expect(draw('listing_entry_options', ENTRY_OPTIONS).toJSON()).toMatchSnapshot();
  });
  it('listing_gate golden', () => {
    expect(draw('listing_gate', GATE).toJSON()).toMatchSnapshot();
  });
  it('batch_list golden (list rows + moreLine + tints)', () => {
    expect(draw('batch_list', BATCH_LIST).toJSON()).toMatchSnapshot();
  });
  it('bid_list golden (bid tints)', () => {
    expect(draw('bid_list', BID_LIST).toJSON()).toMatchSnapshot();
  });
  it('listing_queue golden (pager + queue rows + publish)', () => {
    expect(draw('listing_queue', QUEUE, MULTI_CTX).toJSON()).toMatchSnapshot();
  });
  it('listing_group_choice golden', () => {
    expect(draw('listing_group_choice', GROUP_CHOICE, MULTI_CTX).toJSON()).toMatchSnapshot();
  });
  it('listing_batch_result golden (skip roster)', () => {
    expect(draw('listing_batch_result', BATCH_RESULT, MULTI_CTX).toJSON()).toMatchSnapshot();
  });
  it('product detail golden (detailTitle/detailDesc + status)', () => {
    expect(draw('product', PRODUCT_DETAIL).toJSON()).toMatchSnapshot();
  });
  it('platform_info golden (steps)', () => {
    expect(draw('platform_info', PLATFORM_INFO).toJSON()).toMatchSnapshot();
  });
  it('wtb_draft golden (soft card + header + teaser + reserved inputs)', () => {
    expect(draw('wtb_draft', WTB_DRAFT).toJSON()).toMatchSnapshot();
  });
});

describe('cards — render neutrality (PR-3B-0)', () => {
  it('a memoized card boundary mounts once and holds through host re-renders', () => {
    const tracker = createRenderTracker();
    const Boundary = React.memo(function Boundary() {
      return <tracker.Tracker>{renderCard('overview', OVERVIEW, ctx)}</tracker.Tracker>;
    });
    function Host() {
      const [n, setN] = React.useState(0);
      const { Pressable, Text } = require('react-native');
      return (
        <>
          <Pressable accessibilityRole="button" onPress={() => setN((v: number) => v + 1)}>
            <Text>tick {n}</Text>
          </Pressable>
          <Boundary />
        </>
      );
    }
    const { getByText } = render(<Host />);
    expect(tracker.renders).toBe(1);
    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1);
  });

  it('a memoized LabProductCard renders once and holds through host re-renders (PR-3B-3)', () => {
    const { LabProductCard } = require('../cards');
    const tracker = createRenderTracker();
    const row = { id: 9, name: 'CNC Lathe', condition: 'working', country: 'TW', price: 12000, currency: 'USD' };
    const Boundary = React.memo(function Boundary() {
      return (
        <tracker.Tracker>
          <LabProductCard row={row} />
        </tracker.Tracker>
      );
    });
    function Host() {
      const [n, setN] = React.useState(0);
      const { Pressable, Text } = require('react-native');
      return (
        <>
          <Pressable accessibilityRole="button" onPress={() => setN((v: number) => v + 1)}>
            <Text>tick {n}</Text>
          </Pressable>
          <Boundary />
        </>
      );
    }
    const { getByText } = render(<Host />);
    expect(tracker.renders).toBe(1);
    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1);
  });

  it('a memoized entry-options card renders once and holds (PR-3B-5 — useColor sites)', () => {
    const tracker = createRenderTracker();
    const Boundary = React.memo(function Boundary() {
      return <tracker.Tracker>{renderCard('listing_entry_options', {}, ctx)}</tracker.Tracker>;
    });
    function Host() {
      const [n, setN] = React.useState(0);
      const { Pressable, Text } = require('react-native');
      return (
        <>
          <Pressable accessibilityRole="button" onPress={() => setN((v: number) => v + 1)}>
            <Text>tick {n}</Text>
          </Pressable>
          <Boundary />
        </>
      );
    }
    const { getByText } = render(<Host />);
    expect(tracker.renders).toBe(1);
    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1);
  });

  it('a memoized queue card renders once and holds (PR-3B-7 — queue/pager useColor sites)', () => {
    const tracker = createRenderTracker();
    const queue = {
      total: 2,
      index: 1,
      items: [
        { index: 1, title: 'A', image_url: null, missing: 0 },
        { index: 2, title: 'B', image_url: null, missing: 1 },
      ],
    };
    const cbs = { onJumpProduct: () => {}, onAdvanceProduct: () => {}, onPublishBatch: () => {} };
    const Boundary = React.memo(function Boundary() {
      return <tracker.Tracker>{renderCard('listing_queue', queue, { ...ctx, ...cbs })}</tracker.Tracker>;
    });
    function Host() {
      const [n, setN] = React.useState(0);
      const { Pressable, Text } = require('react-native');
      return (
        <>
          <Pressable accessibilityRole="button" onPress={() => setN((v: number) => v + 1)}>
            <Text>tick {n}</Text>
          </Pressable>
          <Boundary />
        </>
      );
    }
    const { getByText } = render(<Host />);
    expect(tracker.renders).toBe(1);
    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1);
  });

  it('a memoized wtb_draft card renders once and holds (PR-3B-8 — WTB useColor sites)', () => {
    const tracker = createRenderTracker();
    const draft = {
      draft: { title: 'CNC Lathe Wanted', category_name: 'CNC', condition_wanted: ['working'] },
      preview_matches: [],
    };
    const Boundary = React.memo(function Boundary() {
      return <tracker.Tracker>{renderCard('wtb_draft', draft, ctx)}</tracker.Tracker>;
    });
    function Host() {
      const [n, setN] = React.useState(0);
      const { Pressable, Text } = require('react-native');
      return (
        <>
          <Pressable accessibilityRole="button" onPress={() => setN((v: number) => v + 1)}>
            <Text>tick {n}</Text>
          </Pressable>
          <Boundary />
        </>
      );
    }
    const { getByText } = render(<Host />);
    expect(tracker.renders).toBe(1);
    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1);
  });
});

describe('cleanTitle — legacy WP mojibake repair', () => {
  it('repairs the U+0097 C1 control (a CP1252 em dash) -> hyphen (the tofu bug)', () => {
    expect(cleanTitle('Nikon SMZ800N  Zoom Stereomicroscope')).toBe(
      'Nikon SMZ800N - Zoom Stereomicroscope',
    );
  });
  it('folds the Unicode dash family incl. non-breaking hyphen U+2011', () => {
    expect(cleanTitle('X‑Y')).toBe('X-Y');
    expect(cleanTitle('A–B—C')).toBe('A-B-C');
  });
  it('strips zero-width / replacement / object-replacement chars', () => {
    expect(cleanTitle('A\u200BB\uFFFDC\uFFFCD')).toBe('ABCD');
  });
  it('leaves CJK product names intact (only the mojibake dash is touched)', () => {
    expect(cleanTitle('顕微鏡  テスト')).toBe(
      '顕微鏡 - テスト',
    );
  });
  it('is safe on empty / nullish input', () => {
    expect(cleanTitle('')).toBe('');
    expect(cleanTitle(undefined)).toBe('');
    expect(cleanTitle(null)).toBe('');
  });
});
