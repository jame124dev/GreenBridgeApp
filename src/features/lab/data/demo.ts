// Static demo data for the (lab) customer-app screens (Phase 1: static-first).
// Seeded 1:1 from the prototype state block (101LAB Mobile.dc.html lines ~490–597).
// Screens import from here; Phase 2 swaps these for React Query / Socket data
// while keeping the shapes identical. Values are keyed by composer mode where
// the prototype varies copy by sell/buy.
import type { ComposerMode } from '@/features/lab/stores/composerStore';

/* -------------------------------------------------------------------------- */
/*  Composer (Home) — mode-varied copy & chips                                 */
/* -------------------------------------------------------------------------- */

export type QuickChip = { icon: string; title: string; sub: string; prompt: string };

export type ComposerCopy = {
  placeholder: string;
  sendLabel: string;
  chipsLabel: string;
  chips: [QuickChip, QuickChip];
  /* Gemini-first home: centered hero greeting, split into a leading part and an accented trailing word. */
  greeting: string;
  greetingAccent: string;
  /* Short fill-only prompt pills shown under the hero (tap to prefill the composer). */
  suggestions: { label: string; prompt: string }[];
};

export const COMPOSER_COPY: Record<ComposerMode, ComposerCopy> = {
  sell: {
    placeholder: 'Describe your equipment — brand, model, condition, city',
    sendLabel: 'List it',
    chipsLabel: 'OR START FROM AN EXAMPLE',
    chips: [
      {
        icon: '📷',
        title: 'Snap a photo of your equipment',
        sub: 'AI reads the label & writes the listing',
        prompt: 'Photo: Thermo −80°C freezer, working, Bangkok',
      },
      {
        icon: '📄',
        title: 'Upload a spec sheet or invoice (PDF)',
        sub: 'Bulk-draft a whole batch at once',
        prompt: 'Spec sheet PDF: lab equipment batch',
      },
    ],
    greeting: 'What are you',
    greetingAccent: 'selling?',
    suggestions: [
      { label: 'Snap a photo', prompt: 'I have a Thermo −80°C freezer, working, in Bangkok' },
      { label: 'Upload a spec sheet', prompt: 'I have a spec sheet PDF with several lab items to list' },
      { label: 'Just describe it', prompt: 'Selling an Agilent 1260 HPLC with DAD, good condition' },
    ],
  },
  buy: {
    placeholder: 'e.g. Need an Agilent 1260 HPLC with DAD, budget $18k…',
    sendLabel: 'Find it',
    chipsLabel: 'OR START FROM AN EXAMPLE',
    chips: [
      {
        icon: '🔬',
        title: 'Agilent or Waters HPLC + DAD',
        sub: 'pharma QC · budget up to $18,000',
        prompt: 'Agilent or Waters HPLC + DAD, pharma QC, budget $18k',
      },
      {
        icon: '❄️',
        title: '−80°C ultra-low freezer, upright',
        sub: 'qty 1 · grant-funded · Bangkok',
        prompt: '−80°C ultra-low freezer, upright, qty 1, Bangkok',
      },
    ],
    greeting: 'What are you',
    greetingAccent: 'looking for?',
    suggestions: [
      { label: 'HPLC + DAD', prompt: 'Need an Agilent or Waters HPLC with DAD, budget $18k' },
      { label: '−80°C freezer', prompt: 'Looking for a −80°C ultra-low upright freezer, qty 1, Bangkok' },
      { label: 'Describe my need', prompt: 'I need a 3-axis CNC mill delivered to Vietnam, budget $20k' },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  Processing — 3-step choreography copy                                      */
/* -------------------------------------------------------------------------- */

export type ProcessingCopy = { title: string; steps: [string, string, string] };

export const PROCESSING_COPY: Record<ComposerMode, ProcessingCopy> = {
  sell: {
    title: 'Reading your equipment…',
    steps: [
      'Identified: −80°C ultra-low freezer',
      'Pulled specs, condition & fair price',
      'Checking live buyer demand…',
    ],
  },
  buy: {
    title: 'Posting your request…',
    steps: ['Understood: Agilent/Waters HPLC + DAD', 'Created your Wanted request', 'Scanning sellers for matches…'],
  },
};

/** Prototype auto-advance delay (static placeholder; tie to real response in Phase 2). */
export const PROCESSING_DURATION_MS = 2600;

/* -------------------------------------------------------------------------- */
/*  Draft — AI-generated listing / request                                     */
/* -------------------------------------------------------------------------- */

export type Spec = { k: string; v: string };

export type DraftData = {
  headline: string;
  market: string;
  source: string;
  title: string;
  location: string;
  specs: Spec[];
  priceLabel: string;
  price: string;
  priceHint: string;
  demandTitle: string;
  demandSub: string;
  publishLabel: string;
};

export const DRAFT_DATA: Record<ComposerMode, DraftData> = {
  sell: {
    headline: 'Your listing is ready to publish.',
    market: '101LAB',
    source: 'from your photo',
    title: 'Thermo Scientific TSX −80°C Freezer',
    location: 'Bangkok, Thailand · ready to ship',
    specs: [
      { k: 'Condition', v: 'Working · Good' },
      { k: 'Year', v: '2018' },
      { k: 'Capacity', v: '−86°C · 728 L' },
      { k: 'Category', v: 'Cold storage' },
    ],
    priceLabel: 'SUGGESTED PRICE',
    price: '$4,200',
    priceHint: 'Based on 12 recent comparable sales',
    demandTitle: '3 buyers already want this',
    demandSub: "You'll match the moment you publish",
    publishLabel: 'Publish listing',
  },
  buy: {
    headline: 'Your request is ready to post.',
    market: '101LAB',
    source: 'from your text',
    title: '−80°C Ultra-Low Freezer (upright)',
    location: 'Deliver to Bangkok · 101LAB network',
    specs: [
      { k: 'Quantity', v: '1 unit' },
      { k: 'Type', v: 'Upright, −80°C' },
      { k: 'Use case', v: 'Sample biobank' },
      { k: 'Timeline', v: 'Within 30 days' },
    ],
    priceLabel: 'YOUR BUDGET',
    price: 'up to $5,000',
    priceHint: "We'll only surface sellers under this",
    demandTitle: '4 sellers can supply this',
    demandSub: "You'll match the moment you post",
    publishLabel: 'Post request',
  },
};

/* -------------------------------------------------------------------------- */
/*  Published — celebration copy                                               */
/* -------------------------------------------------------------------------- */

/** Overlapping country-avatar chip on the Published match card (spec 04 §2.4). */
export type PublishedAvatar = { code: string; bg: string };

/**
 * Country-avatar stack shared by both modes (spec 04 §5 — SG/TW/VN, deep-forest
 * fills). Phase 2: derive from real `countries: ISO[]` in the publish result.
 */
export const PUBLISHED_AVATARS: PublishedAvatar[] = [
  { code: 'SG', bg: '#1f6b4a' },
  { code: 'TW', bg: '#2a7d59' },
  { code: 'VN', bg: '#36916a' },
];

export type PublishedData = {
  title: string;
  sub: string;
  matchLabel: string;
  matchCount: string;
  managedNote: string;
  avatars: PublishedAvatar[];
};

export const PUBLISHED_DATA: Record<ComposerMode, PublishedData> = {
  sell: {
    title: "You're live — and already matched.",
    sub: 'AI routed your listing to 101LAB and instantly found buyers who want it.',
    matchLabel: 'BUYERS MATCHED',
    matchCount: '3',
    managedNote:
      "As a managed marketplace, 101LAB verifies every counterparty and only pings you when there's a real match.",
    avatars: PUBLISHED_AVATARS,
  },
  buy: {
    title: 'Request posted — matches found.',
    sub: 'AI scanned the 101 network and found sellers that fit your spec.',
    matchLabel: 'SELLERS MATCHED',
    matchCount: '4',
    managedNote:
      "As a managed marketplace, 101LAB verifies every counterparty and only pings you when there's a real match.",
    avatars: PUBLISHED_AVATARS,
  },
};

/* -------------------------------------------------------------------------- */
/*  Matches feed                                                               */
/* -------------------------------------------------------------------------- */

export type MatchCard = {
  id: string;
  tag: string;
  time: string;
  tagColor: string;
  tagBg: string;
  sell: string;
  sellSub: string;
  pct: number; // 0–100
  want: string;
  wantSub: string;
};

export const MATCHES: MatchCard[] = [
  {
    id: 'm1',
    tag: 'New match',
    time: '2h ago',
    tagColor: '#16A35A',
    tagBg: '#EAF6EE',
    sell: 'Agilent 1260 HPLC',
    sellSub: 'Singapore · $13.4k',
    pct: 96,
    want: 'HPLC + DAD',
    wantSub: 'pharma QC · $18k',
  },
  {
    id: 'm2',
    tag: 'New match',
    time: '5h ago',
    tagColor: '#16A35A',
    tagBg: '#EAF6EE',
    sell: 'Haas VF-2 Mill',
    sellSub: 'Taiwan · $18.9k',
    pct: 94,
    want: '3-axis CNC mill',
    wantSub: 'Vietnam · $20k',
  },
  {
    id: 'm3',
    tag: 'Worth a look',
    time: '1d ago',
    tagColor: '#C58A1E',
    tagBg: '#FBF1DD',
    sell: 'Mixed Copper · 22t',
    sellSub: 'Kaohsiung',
    pct: 91,
    want: 'Bare bright copper',
    wantSub: '20 t/mo · recurring',
  },
];

/* -------------------------------------------------------------------------- */
/*  Match detail                                                               */
/* -------------------------------------------------------------------------- */

export type MatchDetail = {
  id: string;
  pct: number;
  forSale: { label: string; title: string; sub: string; price: string };
  wanted: { label: string; title: string; sub: string; price: string };
  reasons: string[];
  trust: string[];
  cta: string;
  ctaNote: string;
};

export const MATCH_DETAIL: MatchDetail = {
  id: 'm1',
  pct: 96,
  forSale: {
    label: 'FOR SALE · WTS',
    title: 'Agilent 1260 Infinity II HPLC',
    sub: 'Asia Surplus · Singapore',
    price: '$13,400',
  },
  wanted: {
    label: 'WANTED · WTB',
    title: 'Agilent / Waters HPLC + DAD',
    sub: 'You · pharma QC',
    price: 'up to $18,000',
  },
  reasons: [
    "Model & detector (DAD) match the buyer's exact spec.",
    "$13,400 sits 26% under the buyer's $18k budget.",
    'Singapore → ships APAC, both verified accounts.',
  ],
  trust: ['Verified seller', '101LAB escrow'],
  cta: 'Confirm interest — talk to seller',
  ctaNote: 'No commitment yet. 101LAB introduces you and manages the deal.',
};

/* -------------------------------------------------------------------------- */
/*  Match detail — structured fixture (Run B, spec 06-match-detail)            */
/* -------------------------------------------------------------------------- */
// Enriched, structured shape for the Match Detail screen. Kept SEPARATE from the
// flat `MATCH_DETAIL` above (which other screens/placeholders still read) —
// APPEND-ONLY per the Run-B contract. The "You ·" / "Buyer ·" attribution is
// NOT stored here; it's derived at render time from the composer `mode`.
// Phase 2: replace with `useMatchDetail(id)` (TanStack Query).

export interface MatchDetailFixture {
  id: string;
  dealId: string; // → Deal Room route, e.g. '4821'
  confidence: number; // 0–100 (ring); >=95 green, 91–94 amber
  tag: 'new' | 'worth-a-look';
  wts: { id: string; title: string; org: string; location: string; priceLabel: string; sellerId?: number | null };
  wtb: { id: string; title: string; context: string; budgetLabel: string };
  reasons: string[];
  trust: { verifiedSeller: boolean; escrow: boolean };
}

export const MATCH_DETAIL_FIXTURE: MatchDetailFixture = {
  id: 'm-1',
  dealId: '4821',
  confidence: 96,
  tag: 'new',
  wts: {
    id: 'wts-agilent-1260',
    title: 'Agilent 1260 Infinity II HPLC',
    org: 'Asia Surplus',
    location: 'Singapore',
    priceLabel: '$13,400',
  },
  wtb: {
    id: 'wtb-hplc-dad',
    title: 'Agilent / Waters HPLC + DAD',
    context: 'pharma QC', // sub prefix ("You ·" / "Buyer ·") derived from mode at render
    budgetLabel: 'up to $18,000',
  },
  reasons: [
    "Model & detector (DAD) match the buyer's exact spec.",
    "$13,400 sits 26% under the buyer's $18k budget.",
    'Singapore → ships APAC, both verified accounts.',
  ],
  trust: { verifiedSeller: true, escrow: true },
};

/* -------------------------------------------------------------------------- */
/*  Deal room chat                                                             */
/* -------------------------------------------------------------------------- */

export type DealMessage =
  | { kind: 'day'; text: string }
  | { kind: 'system'; text: string }
  | { kind: 'them'; text: string; meta: string }
  | { kind: 'me'; text: string; meta: string }
  | { kind: 'concierge'; who: string; text: string };

export type DealRoom = {
  id: string;
  counterparty: string;
  initials: string;
  subtitle: string;
  managedNote: string;
  composerPlaceholder: string;
  messages: DealMessage[];
};

export const DEAL_ROOM: DealRoom = {
  id: '4821',
  counterparty: 'Asia Surplus',
  initials: 'AS',
  subtitle: 'Agilent 1260 HPLC · deal #4821',
  managedNote: '101LAB is managing this deal — inspection, logistics & escrow handled for you.',
  composerPlaceholder: 'Message Asia Surplus…',
  messages: [
    { kind: 'day', text: 'Introduced by 101LAB · Today' },
    { kind: 'system', text: 'You confirmed interest at 96% match' },
    {
      kind: 'them',
      text: 'Hi Ravi — yes, the 1260 is available with the DAD detector, 2019, ~6k injection hours. Happy to share the service log.',
      meta: 'Asia Surplus · 10:24',
    },
    {
      kind: 'me',
      text: 'Great. Can 101LAB arrange inspection before I commit the $13,400?',
      meta: 'You · 10:26',
    },
    {
      kind: 'concierge',
      who: '101LAB Concierge:',
      text: 'Inspection can be booked for Thu. Escrow holds funds until you approve on delivery. Want me to schedule it?',
    },
  ],
};

// Canned concierge reply — pushed ~900ms after every user send in Phase 1
// (mandatory, see spec 07 §4) so the static thread feels alive. The send
// handler assigns a fresh unique id on each push so React keys never collide.
// TODO(Phase 2): retire once server-pushed `concierge` events arrive over the
// Socket.io subscription; this whole canned-reply mechanism goes away.
export const DEAL_CANNED_REPLY: Extract<DealMessage, { kind: 'concierge' }> = {
  kind: 'concierge',
  who: '101LAB Concierge:',
  text: "On it — I'll confirm the inspection slot and hold escrow until you approve.",
};

// Deal Room one-off prototype hexes NOT covered by @/constants/theme tokens.
// (NOTE: #0E3B2E=greenDarkest, #16A35A=greenMedium, #34D08C=greenLight are
//  foundation tokens in @/constants/theme — reference those, not these.)
// Appended for spec 07 (Deal Room); other screens do not read this key.
export const DEAL_COLORS = {
  headerBorder: '#EBF0EC',
  avatarTo: '#1f6b4a',
  avatarInk: '#CFF0DD',
  titleInk: '#10201A',
  subtitleInk: '#8A988F',
  bannerBg: '#FFF6E6',
  bannerBorder: '#F4E2BC',
  bannerInk: '#8A6418',
  bannerIcon: '#B27A12',
  divider: '#A5B1A9',
  confirmBg: '#EAF3EC',
  confirmInk: '#0E6B3F',
  sellerBg: '#ffffff',
  sellerBorder: '#EBF0EC',
  sellerInk: '#1c2a24',
  metaInk: '#A5B1A9',
  userInk: '#EAF3EC',
  userMeta: '#7FAE97',
  conciergeBg: '#F0F4F1',
  conciergeBorder: '#CBD8CF',
  conciergeInk: '#445049',
  inputBorder: '#E1E8E3',
  placeholder: '#9AA89F',
  inputInk: '#1c2a24',
} as const;
