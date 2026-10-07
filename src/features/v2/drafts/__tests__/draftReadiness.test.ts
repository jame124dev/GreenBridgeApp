/**
 * Which submit control an inventory row shows, pinned per PAYLOAD SHAPE.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * `readinessOf` decides whether a row offers "Submit for listing",
 * "Finish & submit", "Open to submit", or nothing at all. It was wrong twice
 * before a test existed: `pending-ai` was first classified as unsupported,
 * which on a real account meant the submit control appeared on NOTHING — and
 * neither a type-check nor a screenshot caught it. It took a query against the
 * database to find out what drafts actually look like.
 *
 * ── THE FIXTURES ARE REAL ──────────────────────────────────────────────────
 *
 * The four stored shapes below are payloads taken from `greenbidz_test`
 * (2026-10-07, 135 drafts: 65 `pending-ai`, 30 web ScanV2, 22
 * `scanv2-extract-header`, 19 other — zero lab drafts and zero
 * `persistedScan`). URLs and names are left as they were so the fixture keeps
 * the real shape; they are dev rows, not customer data.
 *
 * The two `persistedScan` cases are necessarily hand-built, because no draft
 * of that shape exists on dev to copy. `draftItem()` is typed as `DraftItem`
 * with NO cast, deliberately: the first version used `as DraftItem` and the
 * compiler then let it through five fields short (`serialNumber`,
 * `marketplace`, `installation`, `listingDurationDays`, `aiPrices`) while the
 * tests still passed. A cast here would make this fixture exactly the kind of
 * unrepresentative stand-in it exists to rule out — so if `DraftItem` grows a
 * field, this file must fail to compile.
 */
import { readinessOf, type DraftReadiness } from '../useDraftReadiness';
import type { DraftItem } from '@/stores/scanDraftStore';

// ── Real payloads, copied from greenbidz_test ──────────────────────────────

/** 65 of 135 drafts. Background recognition; items exist only after apply. */
const PENDING_AI = {
  v: 1,
  kind: 'pending-ai',
  mode: 'single',
  language: 'en',
  result: {
    success: true,
    detection: { suggested_mode: 'single' },
    merged_single: { name: 'Keithley 2450 SourceMeter', brand: 'Keithley', model: '2450', quantity: 2 },
    products: [
      {
        id: 'p0',
        image_indexes: [0],
        document_indexes: [],
        data: { name: 'Keithley 2450 SourceMeter', brand: 'Keithley', model: '2450', quantity: 2 },
      },
    ],
    image_urls: ['https://storage.googleapis.com/greenbidz/x/unit_keithley-1.png'],
  },
  imageUrls: ['https://storage.googleapis.com/greenbidz/x/unit_keithley-1.png'],
};

/** 22 of 135. The document-extract header row — no items of its own. */
const EXTRACT_HEADER = { v: 1, kind: 'scanv2-extract-header', mode: 'multi', language: 'en' };

/** 30 of 135. Made by the WEB seller flow; mobile has no reader for it. */
const SCANV2_WEB = {
  source: 'scanv2',
  created_at: '2026-09-30T10:00:00.000Z',
  scanv2: { step: 'review' },
  ready_to_list: false,
};

/** Among the 19 "other" — a bare title, which is what a stub row looks like. */
const BARE_TITLE = { title: 'Something' };

// ── The scan-blob shape, built against the real type ───────────────────────

function draftItem(over: Partial<DraftItem>): DraftItem {
  const base: DraftItem = {
    id: 'i1',
    photos: [{ uri: 'file:///p.jpg', width: 10, height: 10 }],
    ai: null,
    productIds: [],
    title: 'Agilent 1260 HPLC',
    description: 'A working unit.',
    categoryId: '42',
    categoryName: 'Chromatography',
    condition: ['used'],
    operationStatus: ['working'],
    pricePerUnit: '1000',
    priceCurrency: 'USD',
    priceFormat: 'buyNow',
    quantity: 1,
    locations: ['Bangkok'],
    locationCountries: ['TH'],
    documents: [],
    allowedSites: ['LabGreenbidz'],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
    brand: 'Agilent',
    model: '1260',
    year: '2018',
    weight: '50',
    dimensions: '1x1x1',
    co2Emissions: '',
    grade: 'A',
    serialNumber: 'SN-123',
    marketplace: '101lab',
    installation: 'deinstalled',
    listingDurationDays: 14,
    aiPrices: null,
  };
  return { ...base, ...over };
}

const withScan = (item: DraftItem) => ({
  kind: 'form-blob',
  persistedScan: {
    mode: 'single',
    queuedItems: [],
    current: item,
    sessionVisibility: 'PUBLIC',
    networkSellers: [],
  },
});

describe('readinessOf — one row, one control', () => {
  it('a background-recognition draft can be submitted, but only after opening', () => {
    expect(readinessOf(PENDING_AI).state).toBe('open');
  });

  it('a background-recognition draft with no images yet is not offered at all', () => {
    const noImages = { ...PENDING_AI, imageUrls: [], result: { ...PENDING_AI.result, image_urls: [] } };
    expect(readinessOf(noImages).state).toBe('unsupported');
  });

  it('a draft still waiting on its AI result is not offered', () => {
    const noResult = { v: 1, kind: 'pending-ai', mode: 'single', language: 'en' };
    expect(readinessOf(noResult).state).toBe('unsupported');
  });

  it.each([
    ['the document-extract header', EXTRACT_HEADER],
    ['a web ScanV2 draft', SCANV2_WEB],
    ['a bare title row', BARE_TITLE],
    ['an empty object', {}],
    ['null', null],
  ])('%s offers no submit control', (_label, payload) => {
    expect(readinessOf(payload).state).toBe('unsupported');
  });

  it('a complete scan draft is ready to submit outright', () => {
    expect(readinessOf(withScan(draftItem({}))).state).toBe('ready');
  });

  it('a scan draft with no photo reports what it needs, and names the photo', () => {
    const r = readinessOf(withScan(draftItem({ photos: [] })));
    expect(r.state).toBe('incomplete');
    if (r.state !== 'incomplete') throw new Error('unreachable');
    // The sentence is the publish path's own, so the row cannot promise
    // something the submit would then refuse for a different reason.
    expect(r.block.needs.toLowerCase()).toContain('photo');
  });

  it('a scan draft holding no items is not submittable', () => {
    const empty = {
      kind: 'form-blob',
      persistedScan: { mode: 'single', queuedItems: [], current: null },
    };
    expect(readinessOf(empty).state).toBe('unsupported');
  });

  /*
   * The enumerating test. Prose "we handle every case" has twice hidden a
   * shape nobody had thought about, so the suite asserts it reaches all four
   * states rather than trusting the list above to be complete.
   */
  it('covers every readiness state', () => {
    const seen = new Set<DraftReadiness['state']>([
      readinessOf(PENDING_AI).state,
      readinessOf(EXTRACT_HEADER).state,
      readinessOf(withScan(draftItem({}))).state,
      readinessOf(withScan(draftItem({ photos: [] }))).state,
    ]);
    expect([...seen].sort()).toEqual(['incomplete', 'open', 'ready', 'unsupported']);
  });
});
