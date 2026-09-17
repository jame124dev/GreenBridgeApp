/**
 * The valuation-draft mapper.
 *
 * The fixture below is the REAL payload shape, taken from a live draft on a
 * seller account (keys logged on device 2026-09-15) and cross-checked against
 * the web writer's own contract docblock in
 * `nextjs-port/src/scanflow/pages/new-submission-upload/utils/valuationDraftPayload.ts`.
 * It is not invented — that matters, because the bug this mapper fixes existed
 * precisely because nobody had the shape written down anywhere a reader could
 * check it.
 */
import {
  isValuationDraftPayload,
  persistedScanFromValuation,
} from '../valuationDraft';

/** One item in the valuation's own shape: a `row` fact bag plus bands. */
function item(over: Record<string, unknown> = {}) {
  return {
    ask: 4600,
    fmv: { low: 3800, high: 5200 },
    scrap: { low: 200, high: 400 },
    newBand: { low: 9000 },
    row: {
      title: 'Waters Alliance e2695',
      brand: 'Waters',
      model: 'e2695',
      condition: 'used',
      location: 'Hamburg',
      country: 'Germany',
      qty: 2,
      year: '2014',
      serial: 'SN-1',
      weight: '80kg',
      description: 'Powers on.',
      image: 'https://example.test/a.jpg',
    },
    ...over,
  };
}

const payload = (items: unknown[], fileUrls: unknown[] = []) => ({
  source: 'greenbidz.com/valuation',
  created_at: '2026-09-01T00:00:00Z',
  scanv2: { items, file_urls: fileUrls },
  ready_to_list: true,
});

describe('isValuationDraftPayload', () => {
  it('accepts a payload with items', () => {
    expect(isValuationDraftPayload(payload([item()]))).toBe(true);
  });

  it('rejects the two shapes mobile already handled', () => {
    // Rejecting these is the whole point: a false positive here would send a
    // scan draft or a lab draft down the wrong branch.
    expect(isValuationDraftPayload({ persistedScan: { mode: 'single' } })).toBe(false);
    expect(isValuationDraftPayload({ mode: 'sell', labDraft: {} })).toBe(false);
  });

  it('rejects an empty or absent items array', () => {
    expect(isValuationDraftPayload(payload([]))).toBe(false);
    expect(isValuationDraftPayload({ scanv2: {} })).toBe(false);
    expect(isValuationDraftPayload(null)).toBe(false);
  });
});

describe('persistedScanFromValuation', () => {
  it('maps one item to the SINGLE path, which is what 7b–7e read', () => {
    const scan = persistedScanFromValuation(payload([item()]));
    expect(scan.mode).toBe('single');
    expect(scan.queuedItems).toHaveLength(0);
    expect(scan.current).not.toBeNull();
  });

  it('takes every field from the `row` fact bag', () => {
    const scan = persistedScanFromValuation(payload([item()]));
    const d = scan.current!;
    expect(d.title).toBe('Waters Alliance e2695');
    expect(d.brand).toBe('Waters');
    expect(d.model).toBe('e2695');
    expect(d.year).toBe('2014');
    expect(d.serialNumber).toBe('SN-1');
    expect(d.weight).toBe('80kg');
    expect(d.description).toBe('Powers on.');
    expect(d.quantity).toBe(2);
    expect(d.condition).toEqual(['used']);
    expect(d.locations).toEqual(['Hamburg']);
    expect(d.locationCountries).toEqual(['Germany']);
  });

  it("prefers the seller's ask over the AI's band", () => {
    const scan = persistedScanFromValuation(payload([item()]));
    expect(scan.current!.pricePerUnit).toBe('4600');
  });

  it("falls back to the fmv band's low end when there is no ask", () => {
    const scan = persistedScanFromValuation(payload([item({ ask: 0 })]));
    expect(scan.current!.pricePerUnit).toBe('3800');
  });

  it('leaves price empty when neither exists, rather than inventing one', () => {
    const scan = persistedScanFromValuation(payload([item({ ask: null, fmv: null })]));
    expect(scan.current!.pricePerUnit).toBe('');
  });

  it('leaves the category empty so the review step asks', () => {
    // The valuation payload carries a marketplace, never a category id.
    const scan = persistedScanFromValuation(payload([item()]));
    expect(scan.current!.categoryId).toBeNull();
    expect(scan.current!.categoryName).toBeNull();
  });

  it('carries an AI result, so resume does NOT re-analyse', () => {
    // `resumeRouteForItem` sends a draft with no `ai` to scanProcessing. On
    // device that re-analysed a lot the website had already analysed and the
    // seller had already reviewed. These fields ARE the AI's output.
    const d = persistedScanFromValuation(payload([item()])).current!;
    expect(d.ai).not.toBeNull();
    expect(d.ai!.name).toBe('Waters Alliance e2695');
    expect(d.ai!.suggestedPrice).toBe('4600');
    expect(d.lastStep).toBe('detail');
  });

  it('leaves `ai` null when the payload carried nothing to claim', () => {
    const d = persistedScanFromValuation(
      payload([{ row: {}, ask: 0, fmv: null }]),
    ).current!;
    expect(d.ai).toBeNull();
  });

  it('carries the resale BANDS, so Pricing does not claim there is no estimate', () => {
    // Seen on device: a lot priced at $2,000 with the Profit Intelligence card
    // saying "No price estimate", while fmv/scrap/newBand were all in the
    // payload. `{low,high}` and `{min,max}` are the same idea, two names.
    const d = persistedScanFromValuation(payload([item()])).current!;
    expect(d.aiPrices).toEqual({
      scrap: { min: 200, max: 400 },
      used: { min: 3800, max: 5200 },
      new: { min: 9000, max: 9000 }, // point estimate -> min === max
      currency: 'USD',
    });
  });

  it('leaves aiPrices null when the payload carried no bands at all', () => {
    const d = persistedScanFromValuation(
      payload([{ row: { title: 'x' }, fmv: null, scrap: null, newBand: null }]),
    ).current!;
    expect(d.aiPrices).toBeNull();
  });

  it('two or more items go down the GROUPED path', () => {
    const scan = persistedScanFromValuation(payload([item(), item()]));
    expect(scan.mode).toBe('grouped');
    expect(scan.current).toBeNull();
    expect(scan.queuedItems).toHaveLength(2);
  });

  it('drops discarded items — the seller already said no on the website', () => {
    const scan = persistedScanFromValuation(payload([item(), item({ discarded: true })]));
    expect(scan.mode).toBe('single');
    expect(scan.queuedItems).toHaveLength(0);
  });

  it('throws when every item was discarded, instead of hydrating an empty draft', () => {
    expect(() => persistedScanFromValuation(payload([item({ discarded: true })]))).toThrow(
      /no items left/,
    );
  });

  it('falls back to file_urls at the same index when an item has no image', () => {
    const noImage = item({ row: { ...item().row, image: '' } });
    const scan = persistedScanFromValuation(payload([noImage], ['https://example.test/z.jpg']));
    expect(scan.current!.photos[0]?.uri).toBe('https://example.test/z.jpg');
  });

  it('leaves photos empty rather than attaching a wrong one', () => {
    const noImage = item({ row: { ...item().row, image: '' } });
    const scan = persistedScanFromValuation(payload([noImage], []));
    expect(scan.current!.photos).toEqual([]);
  });

  it("treats the website's blank markers as blank, not as values", () => {
    // Found on device: 7c's YEAR rendered "—" in ink, not placeholder grey —
    // i.e. a real value. The valuation table uses a dash for "unknown"; carried
    // into a form field that would publish a year of "—".
    const dashes = item({
      row: { ...item().row, year: '—', brand: '-', model: '–', serial: 'N/A', weight: '  ' },
    });
    const d = persistedScanFromValuation(payload([dashes])).current!;
    expect(d.year).toBe('');
    expect(d.brand).toBe('');
    expect(d.model).toBe('');
    expect(d.serialNumber).toBe('');
    expect(d.weight).toBe('');
  });

  it('does not eat a legitimate value that merely contains a dash', () => {
    const hyphenated = item({ row: { ...item().row, model: 'HPLC-2000', year: '2014' } });
    const d = persistedScanFromValuation(payload([hyphenated])).current!;
    expect(d.model).toBe('HPLC-2000');
    expect(d.year).toBe('2014');
  });

  it('tolerates a junk row without throwing', () => {
    // The payload is an opaque blob the backend never validates, so a reader
    // that assumes well-formed input is a reader that crashes on real data.
    const scan = persistedScanFromValuation(payload([{ row: null, ask: 'abc' }]));
    expect(scan.current!.title).toBe('');
    expect(scan.current!.quantity).toBe(1);
    expect(scan.current!.pricePerUnit).toBe('');
  });
});
