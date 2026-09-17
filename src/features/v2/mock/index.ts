/**
 * Static fixtures for v2 screens whose data has nowhere to come from yet.
 *
 * ── WHY THIS EXISTS ──
 *
 * The buyer screens (2a listing detail, 2b place a bid) need a public listings
 * endpoint, and there isn't one — the same gap that keeps Browse on a WebView.
 * Waiting for it would have left two drawn screens unbuilt indefinitely, so the
 * layout gets built against a fixture and the data source is swapped in later.
 *
 * ── RULES FOR ANYTHING IN HERE ──
 *
 * 1. **Shaped like the response it stands in for**, not like the screen. When
 *    the endpoint lands, the change should be `useLot(id)` instead of
 *    `MOCK_LOT` — not a re-layout. Money stays in minor-unit-free numbers with
 *    a separate `currency`, dates stay as counts the server would send.
 * 2. **Realistic, not tidy.** A 33-character title and a two-line description
 *    make every screen look good and prove nothing; the fixture carries the
 *    long description and the awkward "1 stack" quantity on purpose.
 * 3. **Never imported by shipped code.** Only `app/v2/` screens that are
 *    explicitly marked as static may read this, and each one says so at the
 *    top of the file. `v2Adherence.test.ts` has no opinion about it, so the
 *    discipline is the naming: everything here is `MOCK_`.
 */
import lot from './lot.json';
import voice from './voice.json';

export type MockSeller = {
  initials: string;
  name: string;
  verified: boolean;
  lotsSold: number;
};

export type MockLot = {
  id: number;
  lotNumber: string;
  title: string;
  category: string;
  country: string;
  city: string;
  photoCount: number;
  photoIndex: number;
  currency: string;
  currentBid: number;
  minimumBid: number;
  bidderCount: number;
  youAreLeading: boolean;
  closesInDays: number;
  buyerFeePct: number;
  collection: string;
  specs: { year: string; condition: string; quantity: string; location: string };
  description: string;
  seller: MockSeller;
  quickBids: number[];
};

/** The one lot both buyer screens are drawn around (`#5402` in the canvas). */
export const MOCK_LOT: MockLot = lot as MockLot;

export type MockTurn = {
  id: string;
  from: 'assistant' | 'user';
  /** `say` is a line of speech; `priced` carries the suggested-ask card. */
  kind: 'say' | 'priced';
  text: string;
  /** A photo the person showed the assistant instead of describing it. */
  photo?: { caption: string };
  /** The span of `text` to bold — the model naming what it recognised. */
  emphasis?: string;
  suggestedAsk?: number;
};

export type MockVoiceSession = {
  status: string;
  speakerOn: boolean;
  turns: MockTurn[];
  replies: string[];
};

/**
 * The exchange 3a is drawn around (`t3-full.html`): the assistant asks, the
 * person shows it a photo and says what is wrong with it, and it comes back
 * with an identification and a price.
 *
 * Three turns, not one, because the screen's whole claim is that a spoken
 * exchange is legible as a transcript — a single bubble would prove nothing
 * about the alternation, the tails, or how a priced answer sits among plain
 * ones.
 */
export const MOCK_VOICE: MockVoiceSession = voice as MockVoiceSession;

/**
 * Money, the way both screens show it: no decimals, thousands separated.
 *
 * Not `Intl.NumberFormat` — Hermes ships a cut-down ICU and currency display
 * has differed between Android and iOS here before. The lot carries its own
 * `currency` string and the screens print it beside the figure, which is also
 * what the drawing does ("USD" sits next to the amount, not a "$" glued to it).
 */
export function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}
