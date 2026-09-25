/**
 * Open a DETECTED ITEM into the review flow.
 *
 * Task: `todo/SCANV2_V2UI_14_ITEM_ROUTE.md`. This is the missing link the whole
 * conditional-spine work sits behind — `wizardState.ts` says so in the code:
 *
 *   *"mobile cannot copy it yet: `app/v2/scan/items.tsx` has no route into
 *   these four steps, so a batch spine would number a journey nobody can walk.
 *   That link is the prerequisite."*
 *
 * ── TWO TYPES, ONE NAME ────────────────────────────────────────────────────
 *
 * The items screen reads SERVER rows (`DraftItem` from `draftItemsApi`); the
 * review flow reads the LOCAL store item (`DraftItem` from `scanDraftStore`).
 * Different shapes, identical name — the first draft of `valuationView.ts` used
 * the wrong one, compiled cleanly, and returned `null` totals for every batch.
 * Both are imported here under explicit aliases so that cannot repeat.
 *
 * ── WHY IT FETCHES INSTEAD OF MAPPING THE ROW IT ALREADY HAS ───────────────
 *
 * The list row carries one `thumbnail_object`. The review flow cannot publish
 * without photos (`requiredStatus.ts` — `allComplete = rows.photos && …`, and
 * `usePublishDraft` re-checks `photos.length > 0`), so mapping the list row
 * would hand the seller a flow they can walk to the end and never submit — the
 * same dead-end shape as the guest-media trap in the root `CLAUDE.md`.
 *
 * `GET /drafts/:id/items/:id` returns `image_objects_json`, described in the
 * server's own source as "the full ordered media list". One extra request buys
 * a publishable item.
 */
import { router } from 'expo-router';

import { marketplaceFromSiteType } from '@/features/scanner/constants';
import {
  getDraftItem,
  isLocalDraftId,
  type DraftItem as DraftItemRow,
  type DraftItemFull,
} from '@/services/drafts/draftItemsApi';
import { commitAcceptedRows, reviewIndexForItem } from '@/services/drafts/localDraftSource';
import { useServerDraft } from '@/features/v2/scan/review/useSaveDraft';
import { reviewStepHref, type ReviewStep } from '@/features/v2/scan/review/wizardState';
import type { RequiredListingField } from '@/features/v2/scan/missingRequiredFields';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';
import {
  draftItemFrom,
  useScanDraft,
  type DraftItem,
  type PersistedScan,
  type Photo,
} from '@/stores/scanDraftStore';
import { routes } from '@/lib/routes';

/**
 * Server media entries → `Photo[]`.
 *
 * `width: 0, height: 0` follows `services/drafts/pendingAiResume.ts:90`, which
 * already does exactly this for server-persisted GCS images — the dimensions
 * are not on the payload and nothing in the review flow reads them.
 *
 * Entries arrive either as a bare object key or as `{ objectName, url }`;
 * `gcsUrlForAnalyze` resolves both, preferring a raw URL and falling back to
 * the `/gcs/serve` proxy. Anything unrecognisable is dropped rather than turned
 * into a broken `<Image>`.
 */
export function photosFromServerMedia(raw: unknown): Photo[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: Photo[] = [];

  for (const entry of list) {
    let uri: string | null = null;

    if (typeof entry === 'string' && entry.trim()) {
      uri = /^https?:\/\//i.test(entry)
        ? entry
        : gcsUrlForAnalyze({ objectName: entry });
    } else if (entry && typeof entry === 'object') {
      const e = entry as { objectName?: unknown; object?: unknown; url?: unknown };
      const name = typeof e.objectName === 'string' ? e.objectName : typeof e.object === 'string' ? e.object : null;
      const url = typeof e.url === 'string' ? e.url : undefined;
      if (url && /^https?:\/\//i.test(url)) uri = url;
      else if (name) uri = gcsUrlForAnalyze({ objectName: name, url });
    }

    if (uri) out.push({ uri, width: 0, height: 0 });
  }

  return out;
}

/** A trimmed string, or `''` — the local item types these as non-optional strings. */
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

/**
 * Map a server row onto the local draft item.
 *
 * Built through `draftItemFrom`, the store's own factory, so every field the
 * local type requires gets its real default and a new field added to
 * `DraftItem` cannot silently arrive here as `undefined`.
 *
 * ── THE TRAPS, each read off the two type definitions ──────────────────────
 *
 * - **`qty: null` means 1.** The server deliberately does not default it, so
 *   the client can tell an explicit 1 from an absent value
 *   (`draftItemsQuery.js:1027-1030`).
 * - **`condition` is a stored KEY** (`"usedFunctional"`), never a label, and the
 *   local field is an ARRAY. Passed through as a single-element array; the
 *   review screen runs it through `CONDITION_LABELS`, which drops keys it does
 *   not recognise rather than printing them raw.
 * - **`year` stays text.** The same extractor run writes it as a JSON string on
 *   one row and a number on another; parsing here would make the list and the
 *   detail disagree ("2019" vs 2019).
 * - **No category id exists on the row.** Only `category_name`. `categoryId` is
 *   therefore left at its default `null` — the seller confirms the category in
 *   the review step, which is where the id is assigned.
 * - **`marketplaceConfirmed` is NOT set true.** The row carries a marketplace
 *   the AI chose; leaving the flag at its default keeps the routing question in
 *   front of the seller instead of silently answering it for them. Setting it
 *   would let an AI guess publish unreviewed.
 * - **`price`/`currency`** become the local string + currency pair;
 *   `priceFormat` stays at the factory default rather than being invented.
 * - **`location`** is one pre-resolved string on the server and two parallel
 *   arrays locally; the country is not on the row, so only the address is set.
 */
export function draftItemFromServerRow(row: DraftItemFull): DraftItem {
  const photos = photosFromServerMedia(row.image_objects_json);
  const qty = typeof row.qty === 'number' && row.qty > 0 ? row.qty : 1;

  /**
   * The AI's marketplace, and the question it leaves open.
   *
   * `marketplaceFromSiteType` returns null for anything it does not recognise,
   * in which case the factory's own default (this deployment's site) stands
   * rather than an empty marketplace.
   *
   * ⚠️ `marketplaceConfirmed: false` is deliberate and is the opposite of the
   * factory default. That default is `true` for MANUAL entry, where "there is
   * no AI claim to confirm" — here there IS one, made by the extract pipeline,
   * and nothing on this row says how confident it was (`siteTypeConfidence` and
   * `siteTypeSource` are not on the DTO). Publishing an unreviewed guess to the
   * wrong marketplace is the expensive outcome, so the seller is asked.
   *
   * Checked before choosing it, because blocking Submit on a question the flow
   * cannot ask is the dead-end pattern this repo keeps logging: v2's Photos
   * step both asks and answers it — `app/v2/scan/review/photos.tsx:445-458`,
   * "Answering makes `marketplaceConfirmed` true".
   */
  const marketplace = marketplaceFromSiteType(row.marketplace);

  return draftItemFrom(photos, {
    title: str(row.title),
    brand: str(row.brand),
    model: str(row.model),
    year: str(row.year),
    categoryName: row.category_name ?? null,
    condition: row.condition ? [row.condition] : [],
    quantity: qty,
    pricePerUnit: row.price == null ? '' : String(row.price),
    locations: row.location ? [row.location] : [],
    needsClearerPhoto: Boolean(row.needs_clearer_photo),
    ...(marketplace ? { marketplace } : {}),
    marketplaceConfirmed: false,
  });
}

/**
 * The single-item session this row becomes.
 *
 * Shaped exactly like `persistedScanFromValuation` (`services/drafts/valuationDraft.ts:239`),
 * which is how the OTHER server-sourced draft shape enters the store: the
 * single path reads `current`, the grouped path reads `queuedItems`. One row is
 * always the single path.
 */
export function sessionFromServerRow(row: DraftItemFull): PersistedScan {
  return {
    mode: 'single',
    current: draftItemFromServerRow(row),
    queuedItems: [],
    sessionVisibility: 'PUBLIC',
    networkSellers: [],
  };
}

/**
 * Fetch the item, load it into the store as the thing being reviewed, and open
 * the review flow on it.
 *
 * `hydrateFromServer` and not a direct `set`: it is the store's own documented
 * entry point for "a server-fetched draft blob loaded into live state", and it
 * is what all three existing resume shapes use. There is no `setCurrent`.
 *
 * Throws on a failed fetch so the CALLER owns the message — the items screen
 * already has a `SectionNote` for a failed write and should say the same kind
 * of thing here, rather than this module reaching for a toast.
 *
 * ── ⚑ THE LOCAL LANE DOES NOT FETCH, AND MUST NOT HYDRATE ──────────────────
 *
 * A LOCAL draft id (`local-1`, Phase 1) already IS the session: the store holds
 * every item with its real photos, its `ai` blob and — crucially —
 * `mergedSingle`, the app's only "these are actually one product" draft. The
 * server path below REPLACES the whole session with the one row it fetched
 * (`hydrateFromServer(sessionFromServerRow(row))`), which is right when the row
 * came from a database and catastrophic when it came from the store: opening
 * item 2 of 18 would leave a session of one, and `mergedSingle` null.
 *
 * So the local answer is a plain navigation to that item's INDEX — what
 * `app/v2/scan/detected.tsx` did before this took over its job.
 */
/**
 * Which wizard step owns each required field, so a blocked Accept can land the
 * seller ON the missing thing instead of at the top of a four-step form.
 *
 * The web does this by scrolling its single drawer to the field and flashing it
 * (`ScanV2ReviewGrid.tsx`, `flashFirstMissing`). Mobile's editor is four
 * screens, so the nearest honest equivalent is to open the step that holds it.
 */
const STEP_FOR_FIELD: Record<RequiredListingField, ReviewStep> = {
  photos: 'photos',
  title: 'details',
  category: 'details',
  condition: 'details',
  operationStatus: 'details',
  description: 'details',
  location: 'location',
};

/**
 * Open ONE item for editing — in the four-step review wizard.
 *
 * ⚠️ IT POINTED AT `app/v2/scan/item.tsx` FOR PART OF 2026-09-23, AND THAT
 * SCREEN NO LONGER EXISTS. A one-screen editor was built that day and removed
 * again when the owner asked for the previous scan flow back
 * (*"let's bring back previous one, we will adjust that in new endpoint"*).
 * The route constant it used, `routes.v2ScanItem`, went with it. Leaving this
 * line pointing there made a row tap navigate to a path with no screen behind
 * it — which expo-router renders as "Page not found", not as an error anyone
 * would trace back here.
 *
 * So this is back to what it did before: the wizard, reached at the step that
 * owns whatever is missing.
 *
 * `firstGap` — the field a BLOCKED Accept is sending the seller to fix. It
 * picks the STEP (`STEP_FOR_FIELD`), so they land on the thing that is missing
 * rather than at the top of a four-step form. A plain row tap passes nothing
 * and opens on photos, as it always did.
 */
export async function openDetectedItem(
  draftId: number | string,
  itemId: number | string,
  firstGap?: RequiredListingField,
): Promise<void> {
  const step: ReviewStep = firstGap ? STEP_FOR_FIELD[firstGap] : 'photos';

  if (isLocalDraftId(draftId)) {
    const index = reviewIndexForItem(itemId);
    if (index == null) throw new Error('This item is no longer in the scan session');
    router.push(reviewStepHref(step, index));
    return;
  }

  // The SERVER path replaces the session with the one row it fetched, which is
  // right for a database row and wrong for a store one — see the note above.
  const row = await getDraftItem(draftId, itemId);
  await useScanDraft.getState().hydrateFromServer(sessionFromServerRow(row));
  router.push(reviewStepHref(step, -1));
}

/**
 * Carry the seller's accept/discard decisions out of the detected step and into
 * the store that publishes them.
 *
 * The OTHER half of the substitution (`draftItemsApi.ts` is the read half). It
 * is here rather than in `app/v2/scan/items.tsx` for the same reason: that
 * screen must not learn there are two sources. It hands over the rows it has
 * and this decides what "continue" means for the id they came from.
 *
 * ── LOCAL ──  the session is already correct; the rejected rows are REMOVED.
 * Rebuilding it would drop every photo but the first, the `ai` blob, `aiPrices`
 * and `mergedSingle`. See `commitAcceptedRows`.
 *
 * ── SERVER ── the rows are all there is, so the session is rebuilt from them.
 * Moved verbatim from `items.tsx`'s `handleContinue` (2026-09-23), including
 * its `marketplaceConfirmed: true` — which deliberately differs from
 * `draftItemFromServerRow` above (`false`, so the seller is asked). The two have
 * disagreed since both were written; unifying them is a decision about who
 * confirms an AI marketplace guess, not a refactor, and it is not Phase 1's.
 */
export function commitAcceptedItems(
  draftId: number | string,
  rows: readonly DraftItemRow[],
): void {
  if (isLocalDraftId(draftId)) {
    commitAcceptedRows();
    return;
  }

  const accepted = rows.filter((r) => r.status === 'accepted');

  const items = accepted.map((row) => {
    const uri = row.thumbnail_object
      ? gcsUrlForAnalyze({ objectName: row.thumbnail_object })
      : undefined;
    const photos = uri ? [{ uri, width: 0, height: 0 }] : [];
    const qty = typeof row.qty === 'number' && row.qty > 0 ? row.qty : 1;
    const marketplace = marketplaceFromSiteType(row.marketplace);

    return draftItemFrom(photos, {
      title: row.title ?? '',
      brand: row.brand ?? '',
      model: row.model ?? '',
      year: row.year ?? '',
      categoryName: row.category_name ?? null,
      condition: row.condition ? [row.condition] : [],
      quantity: qty,
      pricePerUnit: row.price == null ? '' : String(row.price),
      locations: row.location ? [row.location] : [],
      needsClearerPhoto: Boolean(row.needs_clearer_photo),
      ...(marketplace ? { marketplace } : {}),
      marketplaceConfirmed: true,
    });
  });

  void useScanDraft.getState().hydrateFromServer({
    mode: 'grouped',
    current: null,
    queuedItems: items,
    sessionVisibility: 'PUBLIC',
    networkSellers: [],
  });

  /*
    The server draft this session is editing, so a later "Save as draft" PATCHes
    it instead of creating a second copy (`useSaveDraft.ts:104-129`).

    ⚠️ NOT reached on the local lane, and that is not an oversight: `local-1` is
    not a `gb_listing_drafts` id, and marking it would make the next save PATCH
    a draft that does not exist — turning a working save into a 404 the seller
    reads as "Could not save draft".
  */
  useServerDraft.getState().mark(String(draftId), '');
}
