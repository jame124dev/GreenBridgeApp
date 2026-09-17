/**
 * Read a draft that came from the guest valuation flow on greenbidz.com.
 *
 * ── WHY THIS FILE EXISTS ──
 *
 * THREE apps write `gb_listing_drafts.payload`, in three different shapes, and
 * the backend stores it as an opaque LONGTEXT with no validation. Mobile knew
 * two of them:
 *
 *   form-blob   `{ persistedScan }`            — the mobile scan flow
 *   lab draft   `{ mode, labDraft }`           — the assistant composer
 *   valuation   `{ source, created_at, scanv2: { items, file_urls } , … }`
 *                                              — greenbidz.com/valuation  ← NOT READ
 *
 * So on a real seller account every draft row failed with
 * `draft payload missing persistedScan` and the user got "Could not open this
 * draft". Found 2026-09-15 on an account with 24 drafts, all of them this shape.
 *
 * The web hit the identical bug first and fixed it in
 * `nextjs-port/src/scanflow/pages/new-submission-upload/utils/valuationDraftPayload.ts`
 * — whose header records that for them it was worse: the payload fell through
 * to their form-blob branch and "opening ?resumeDraftId for any
 * valuation-sourced draft was a white screen". This file is the mobile
 * counterpart of that mapper. The field choices below mirror it deliberately,
 * so a lot resumed on the phone and the same lot resumed on the web agree.
 *
 * ── WHAT IT IS NOT ──
 *
 * READ-ONLY. It maps a payload the server already has into the local draft
 * store. It writes nothing, uploads nothing and publishes nothing.
 *
 * ── WHERE THE FIELDS COME FROM ──
 *
 * Each item carries a `row` fact bag — the valuation's own per-item record,
 * which is what its review table renders. Anything the seller typed or
 * corrected on the website lives there, so `row` WINS over the item's
 * top-level copy. That is the web's rule and there is no reason for the phone
 * to disagree with it.
 */
import type { AiPrices, AiPriceTier } from '@/features/scanner/smartDetectionTypes';
import {
  draftItemFrom,
  type AiResult,
  type DraftItem,
  type ListingMode,
  type PersistedScan,
  type Photo,
} from '@/stores/scanDraftStore';

/** A price band — the valuation's `{ low, high }` estimate. */
type Band = { low?: unknown; high?: unknown } | null | undefined;

type ValuationRow = Record<string, unknown>;

type ValuationItem = {
  row?: ValuationRow;
  scrap?: Band;
  newBand?: Band;
  title?: unknown;
  description?: unknown;
  ask?: unknown;
  fmv?: Band;
  discarded?: unknown;
};

type ValuationPayload = {
  scanv2?: { items?: unknown; file_urls?: unknown };
};

/**
 * A trimmed string, with the website's BLANK MARKERS treated as blank.
 *
 * ⚠️ The valuation payload stores a literal em-dash for "we do not know this".
 * That is fine in its own review TABLE, where a dash reads as an empty cell —
 * but carried into a form field it becomes a VALUE. Caught on device: 7c's YEAR
 * rendered "—" in `ink`, not in the placeholder grey, so `e.g. 2018` never
 * showed and pressing Submit would have published a year of "—".
 *
 * Anything that is only dashes (hyphen, en, em, figure, horizontal bar) or a
 * lone "n/a" is the website saying nothing, so it arrives here as nothing and
 * the field shows its placeholder.
 */
function str(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (/^[-‐-―\s]+$/.test(s)) return '';
  if (/^n\/?a$/i.test(s)) return '';
  return s;
}

/** The low end of a band, rounded, as the string the form fields expect. */
function bandLow(band: Band): string {
  const n = Number((band as { low?: unknown } | null)?.low);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '';
}

/**
 * A band as a price TIER.
 *
 * `{low, high}` and `{min, max}` are the same idea under two names — the
 * valuation's and the scan pipeline's. A point estimate (one end missing)
 * becomes `min === max`, which is what the Profit Intelligence card already
 * expects: it renders a single figure rather than "$5,000 – $5,000".
 */
function tier(band: Band): AiPriceTier | undefined {
  const lo = Number((band as { low?: unknown } | null)?.low);
  const hi = Number((band as { high?: unknown } | null)?.high);
  const min = Number.isFinite(lo) && lo > 0 ? Math.round(lo) : null;
  const max = Number.isFinite(hi) && hi > 0 ? Math.round(hi) : null;
  if (min === null && max === null) return undefined;
  return { min: min ?? (max as number), max: max ?? (min as number) };
}

/**
 * Is this a payload the valuation site wrote?
 *
 * Deliberately the same test the web uses: a non-empty `scanv2.items`. NOT
 * `source === 'greenbidz.com/valuation'` — the source string is free text and
 * has already changed once; the items array is the thing this mapper actually
 * needs, so testing for it cannot be true when the mapper would fail.
 */
export function isValuationDraftPayload(payload: unknown): boolean {
  const items = (payload as ValuationPayload | null)?.scanv2?.items;
  return Array.isArray(items) && items.length > 0;
}

/**
 * A remote image as a `Photo`.
 *
 * ⚠️ `width`/`height` are 0. The valuation payload carries URLs and no
 * dimensions, and the alternative — fetching every image to measure it — would
 * make opening a draft a network storm. Nothing on the review screens lays out
 * from these numbers (they drive UPLOAD sizing, and these images are already
 * uploaded); `expo-image` measures the real bitmap itself. Documented rather
 * than guessed at, so nobody later reads 0 as a bug.
 */
function remotePhoto(uri: string): Photo {
  return { uri, width: 0, height: 0 };
}

function itemToDraft(item: ValuationItem, index: number, fileUrls: string[]): DraftItem {
  const row = (item.row ?? {}) as ValuationRow;

  // The seller's own ask wins; the fmv band's low end is the AI's estimate and
  // only stands in when they never set one.
  const ask = Number(item.ask);
  const price = Number.isFinite(ask) && ask > 0 ? String(Math.round(ask)) : bandLow(item.fmv);

  const location = str(row.location);
  const country = str(row.country);
  const qty = Number(row.qty);

  // The item's own image, else the upload at the same index, else nothing.
  // An item can genuinely have no photo, and a wrong photo is worse than none.
  const image = str(row.image) || fileUrls[index] || '';

  const condition = str(row.condition);

  const title = str(row.title) || str(item.title);
  const description = str(row.description) || str(item.description);

  /*
   * THE VALUATION ALREADY RAN THE AI — say so.
   *
   * Without an `ai` result, `resumeRouteForItem` sends the draft to
   * `scanProcessing`, i.e. it ANALYSES AGAIN a lot that the website has already
   * analysed and the seller has already reviewed. On device that is exactly
   * what happened: tapping a draft opened "Analyzing your items…". It costs an
   * API call, it can overwrite the seller's own corrections, and it is untrue —
   * these fields ARE the AI's output, carried in the payload.
   *
   * Populating it from the payload is both the fix and the honest record.
   */
  const ai: AiResult | null =
    title || description || price
      ? {
          name: title,
          description,
          condition: condition ? [condition] : [],
          operationStatus: [],
          suggestedPrice: price || null,
          currency: 'USD',
        }
      : null;

  /*
   * THE RESALE BANDS THE PAYLOAD ALREADY CARRIES.
   *
   * Without this the Pricing step showed "No price estimate — we did not get a
   * resale range for this item", while the payload held `fmv`, `scrap` and
   * `newBand` all along. Seen on device: a lot with a real $2,000 price and a
   * card claiming there was no estimate for it. The first pass used `fmv.low`
   * for the PRICE and threw the rest away.
   */
  const scrap = tier(item.scrap);
  const used = tier(item.fmv);
  const brandNew = tier(item.newBand);
  const aiPrices: AiPrices | null =
    scrap || used || brandNew
      ? { ...(scrap ? { scrap } : null), ...(used ? { used } : null),
          ...(brandNew ? { new: brandNew } : null), currency: 'USD' }
      : null;

  return draftItemFrom(image ? [remotePhoto(image)] : [], {
    ai,
    aiPrices,
    // The seller reviewed these on the website; resuming should land on the
    // edit step, not send them back through detection.
    lastStep: 'detail',
    title,
    description,
    brand: str(row.brand),
    model: str(row.model),
    year: str(row.year),
    weight: str(row.weight),
    serialNumber: str(row.serial),
    pricePerUnit: price,
    quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1,
    condition: condition ? [condition] : [],
    locations: location ? [location] : [],
    locationCountries: location && country ? [country] : [],
    // No category travels in a valuation payload — its items carry a
    // marketplace, not a category id. Left empty so 7c ASKS instead of
    // inventing one. `draftItemFrom` already defaults the rest.
  });
}

/**
 * Map a valuation payload into a `PersistedScan` the draft store can hydrate.
 *
 * Discarded items are dropped: the seller already said no to them on the
 * website, and resurrecting them here would make them say it twice.
 *
 * `mode` follows the item count, because that is what the mobile review flow
 * branches on — one item goes down the single path (7b→7e), several go to the
 * grouped path. The payload's own `mode: "multi"` is the WEB's grid mode and
 * does not mean the same thing.
 */
export function persistedScanFromValuation(payload: unknown): PersistedScan {
  const scanv2 = (payload as ValuationPayload | null)?.scanv2;
  const raw = Array.isArray(scanv2?.items) ? (scanv2?.items as ValuationItem[]) : [];

  const fileUrls = (Array.isArray(scanv2?.file_urls) ? scanv2?.file_urls : [])
    .map((u) => str(u))
    .filter(Boolean) as string[];

  const items = raw.filter((it) => it?.discarded !== true);
  if (items.length === 0) throw new Error('valuation draft has no items left after discards');

  const drafts = items.map((it, i) => itemToDraft(it, i, fileUrls));
  const mode: ListingMode = drafts.length > 1 ? 'grouped' : 'single';

  return {
    mode,
    // The single path reads `current`; the grouped path reads `queuedItems`.
    current: mode === 'single' ? drafts[0] : null,
    queuedItems: mode === 'single' ? [] : drafts,
    sessionVisibility: 'PUBLIC',
    networkSellers: [],
  };
}
