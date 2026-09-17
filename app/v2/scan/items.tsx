/**
 * Detected items — the review screen for a MULTI-ITEM draft.
 *
 * ── WHY THIS SCREEN EXISTS ─────────────────────────────────────────────────
 *
 * Mobile's review flow reads ONE item (`useReviewItem()` in
 * `features/v2/scan/review/wizardState.ts`), so a draft holding many had no
 * screen at all — tapping one on Home failed with "Could not open this draft"
 * (`useResumeDraft.ts` → `draft payload missing persistedScan`). The document
 * lane added on 2026-09-17 makes that the COMMON case: a 9 MB seller
 * spreadsheet produced a draft with 18 items.
 *
 * This is the mobile half of the web's "Detected items" step. See
 * `Docs/v2/WEB-PARITY.md` #1–#2.
 *
 * ── ROUGH ON PURPOSE ───────────────────────────────────────────────────────
 *
 * Function first, styling second — built to make the flow complete end to end,
 * not to match a canvas. There is no canvas artboard for this screen: the
 * redesign's 7a–7e cover the single-item path only. It composes kit primitives
 * so the eventual visual pass is a change of props, not a rewrite.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
 *
 * No Valuation totals, no Route, no Inspection — the web has all three and
 * mobile is not getting Route/Inspection at all (decided 2026-09-17,
 * `WEB-PARITY.md`). No per-item edit beyond accept/discard: editing a row's
 * title and price belongs in the single-item review, which already exists.
 *
 * ⚠️ The endpoints behind this are NOT on the dev backend. `testapi` returns
 * 404 for `/drafts/:id/items` and `/items/counts` — the code is merged to `dev`
 * but the server runs an older build. Works against a local backend today.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Chip,
  EmptyState,
  Hairline,
  QuietAction,
  Row,
  RowThumb,
  RowTrailing,
  Screen,
  SectionHeader,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { GUTTER, SECTION_GAP, space } from '@/theme/v2';
import {
  getDraftItemCounts,
  listAllDraftItems,
  setDraftItemsStatus,
  type DraftItem,
  type DraftItemBulkOp,
} from '@/services/drafts/draftItemsApi';
import {
  formatBand,
  formatMoney,
  summariseItems,
} from '@/features/v2/scan/valuationSummary';
import { CONDITION_LABELS, type ConditionKey } from '@/features/scanner/constants';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';
import { haptics } from '@/lib/haptics';

/**
 * Retry a flaky connection, never a definite answer.
 *
 * React Query's default retries any failure three times. Measured on the web
 * build 2026-09-17 against a backend without these endpoints: opening this
 * screen fired **four** requests per endpoint, all 404, and the seller watched
 * a spinner for ~7s before being told anything. A 4xx is the server saying "no" — asking
 * three more times cannot change it, and the delay is spent hiding an answer we
 * already have. 5xx and transport errors are worth one more go.
 */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

/**
 * "USD 1,800" — or nothing.
 *
 * A missing price renders as an empty string, never "0" or "—". An extracted
 * spreadsheet row often has no price, and a zero on screen reads as "this is
 * free" rather than "we did not find one".
 */
function priceLabel(item: DraftItem): string {
  if (item.price == null || !Number.isFinite(item.price)) return '';
  const n = Math.round(item.price).toLocaleString('en-US');
  return item.currency ? `${item.currency} ${n}` : n;
}

/**
 * Line 1 — the MONEY. What this line of the document is worth.
 *
 * Quantity belongs here, not with the spec: `USD 14,000` against `×3` is a
 * different sum, and a row of ten reading identically to a row of one is the
 * single most expensive thing this screen could get wrong. `qty: null` means
 * "none recorded", which is 1 — so it is only ever shown above 1, never as a
 * decorative "×1" on every row.
 */
/**
 * The row's photo, or `undefined`.
 *
 * `thumbnail_object` is the GCS object name of the FIRST persisted image for
 * the item (`recognitionExtractWorker.js:2430`) — the uploaded JPG for a photo,
 * the rendered page PNG for a PDF page, and null for a text-only office row.
 * Never the source `.pdf`, which would not render.
 */
function thumbUri(item: DraftItem): string | undefined {
  if (!item.thumbnail_object) return undefined;
  return gcsUrlForAnalyze({ objectName: item.thumbnail_object });
}

function moneyLine(item: DraftItem): string {
  const bits: string[] = [];
  const price = priceLabel(item);
  if (price) bits.push(price);
  if (typeof item.qty === 'number' && item.qty > 1) bits.push(`×${item.qty}`);
  if (item.grade) bits.push(`Grade ${item.grade}`);
  return bits.join(' · ');
}

/**
 * Line 2 — the SPEC. What the thing is, as the extract understood it.
 *
 * `category_resolved === false` means the category was GUESSED rather than
 * matched to the taxonomy, and saying so is the difference between a seller
 * trusting the row and discovering later that it published under the wrong
 * category. `null` is NOT that claim — it means the server could not check —
 * so an unchecked category is shown plain rather than accused.
 *
 * `condition` arrives as a stored KEY (`"usedFunctional"`). It goes through
 * `CONDITION_LABELS`; an unrecognised key is dropped rather than printed, which
 * is the web's rule too ("label it, never print it raw"). Brand and model are
 * deliberately absent: the extract writes them into the title, so repeating
 * them here spends the line on words already on screen.
 */
function specLine(item: DraftItem): string {
  const bits: string[] = [];

  const conditionLabel = item.condition
    ? CONDITION_LABELS[item.condition as ConditionKey]
    : undefined;
  if (conditionLabel) bits.push(conditionLabel);

  if (item.year) bits.push(item.year);
  if (item.location) bits.push(item.location);
  if (item.category_name) {
    bits.push(
      item.category_resolved === false ? `${item.category_name} (guess)` : item.category_name,
    );
  }
  return bits.join(' · ');
}

export default function V2DetectedItems() {
  const params = useLocalSearchParams<{ draftId?: string }>();
  const draftId = typeof params.draftId === 'string' ? params.draftId : '';
  const qc = useQueryClient();

  const counts = useQuery({
    queryKey: ['draftItemCounts', draftId],
    queryFn: () => getDraftItemCounts(draftId),
    enabled: !!draftId,
    retry: retryUnlessClientError,
  });

  /**
   * `listAllDraftItems`, not one page. The totals below are computed over these
   * rows, and a total over page one of an 18-of-140 draft is wrong without ever
   * looking wrong. It also passes `filter: 'all'` — the server defaults to
   * `needs_review`, which would hide every row already accepted.
   */
  const items = useQuery({
    queryKey: ['draftItems', draftId],
    queryFn: () => listAllDraftItems(draftId, { filter: 'all' }),
    enabled: !!draftId,
    retry: retryUnlessClientError,
  });

  /**
   * Accept / discard. Both refetch the counts strip, because the strip is the
   * only feedback that the tap did anything — the row itself keeps its place so
   * a seller working down a list of eighteen does not lose their position.
   *
   * ⚠️ AND IT MUST REPORT A FAILED WRITE. Observed on the web build
   * 2026-09-17: pressing Accept sent `PATCH /drafts/247/items/1`, took a 404,
   * and the screen said **nothing** — same row, same counts, no message. A tap
   * that fails silently is worse than a disabled control, because the seller
   * believes the item is accepted and moves on. `onError` below is the whole
   * point; `onSettled` refetches either way so the list cannot sit showing a
   * state the server never accepted.
   */
  const [writeFailed, setWriteFailed] = useState(false);

  const setStatus = useMutation({
    // The BULK route with a one-item selection — accept/discard is not a PATCH.
    // The per-item PATCH is a field autosave and 400s without an
    // `expected_row_version`. See `draftItemsApi.ts`.
    mutationFn: ({ id, op }: { id: number; op: DraftItemBulkOp }) =>
      setDraftItemsStatus(draftId, [id], op),
    onMutate: () => setWriteFailed(false),
    onError: () => {
      haptics.error();
      setWriteFailed(true);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['draftItems', draftId] });
      void qc.invalidateQueries({ queryKey: ['draftItemCounts', draftId] });
    },
  });

  /** The row currently being written, so its buttons can say so. */
  const pendingId = setStatus.isPending ? setStatus.variables?.id : undefined;

  const act = useCallback(
    (id: number, op: DraftItemBulkOp) => {
      haptics.tap();
      setStatus.mutate({ id, op });
    },
    [setStatus],
  );

  // No id in the route at all — a deep link someone typed, or a stale link.
  if (!draftId) {
    return (
      <Screen>
        <EmptyState
          title="No draft to show"
          body="Open a draft from Home and its items appear here."
          actionLabel="Back to home"
          onAction={() => router.replace('/v2')}
        />
      </Screen>
    );
  }

  const rows = items.data ?? [];
  const n = counts.data;
  // Derived, not fetched — see `valuationSummary.ts`.
  const valuation = summariseItems(rows);

  return (
    <Screen>
      <SectionHeader title="Detected items" />
      <Text variant="body" color="inkMuted" style={styles.lede}>
        Everything the AI found in your document. Accept the ones you want to
        list, discard the rest.
      </Text>

      {/* The counts strip. Rendered only once the numbers exist — a row of
          zeroes while loading reads as "nothing was found". */}
      {n ? (
        <View style={styles.counts}>
          <Chip label={`${n.total} found`} tone="accent" />
          {n.needs_review > 0 ? <Chip label={`${n.needs_review} to review`} /> : null}
          {n.accepted > 0 ? <Chip label={`${n.accepted} accepted`} /> : null}
          {n.discarded > 0 ? <Chip label={`${n.discarded} discarded`} /> : null}
        </View>
      ) : null}

      {/*
        VALUATION TOTALS — `Docs/v2/WEB-PARITY.md` #3.
        Derived from the rows already on screen, so it needs no extra request.
        Absent until there are rows, because a total of nothing is noise.
      */}
      {rows.length > 0 ? (
        <View style={styles.totals}>
          <Text variant="eyebrow" color="inkMuted">
            {valuation.counted === rows.length
              ? 'Totals'
              : `Totals · ${valuation.counted} accepted`}
          </Text>

          {valuation.mixedCurrency ? (
            /*
              Mixed currencies. Saying so is the whole feature: adding USD to
              TWD gives a number that is not money, and a seller would have no
              way to tell from looking at it.

              ⚠️ `mixedCurrency`, NOT `currency === null`. A null currency also
              means "nothing here is priced", and this sentence claimed three
              USD rows were in different currencies because one accepted row had
              no price. See `valuationSummary.ts`.
            */
            <Text variant="body" color="inkMuted" style={styles.totalLine}>
              These items are priced in different currencies, so they cannot be
              totalled. Set one currency to see a total.
            </Text>
          ) : (
            <>
              {valuation.askingTotal !== null ? (
                <Text variant="h2" style={styles.totalLine}>
                  {formatMoney(valuation.askingTotal, valuation.currency)}
                </Text>
              ) : null}
              {valuation.fmv ? (
                <Text variant="caption" color="inkMuted" style={styles.totalLine}>
                  Market estimate {formatBand(valuation.fmv, valuation.currency)}
                </Text>
              ) : null}
              {valuation.scrap ? (
                <Text variant="caption" color="inkMuted" style={styles.totalLine}>
                  Scrap floor {formatBand(valuation.scrap, valuation.currency)}
                </Text>
              ) : null}
            </>
          )}

          {/* A blank price column is unknown, not zero — say how many. */}
          {valuation.missingPrice > 0 ? (
            <Text variant="caption" color="inkMuted" style={styles.totalLine}>
              {valuation.missingPrice} of {valuation.counted} have no price yet.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.gap} />

      {/* The write failed. Says what did NOT happen, and that nothing is lost —
          the row is still there to press again. */}
      {writeFailed ? (
        <SectionNote tone="danger" actionLabel="Dismiss" onAction={() => setWriteFailed(false)}>
          That change was not saved. The item is unchanged — try again.
        </SectionNote>
      ) : null}

      {items.isLoading ? (
        <SectionNote>Reading the items out of your document…</SectionNote>
      ) : items.isError ? (
        <SectionNote tone="danger" actionLabel="Try again" onAction={() => void items.refetch()}>
          We could not load the items. Nothing has been lost — the draft is
          saved.
        </SectionNote>
      ) : rows.length === 0 ? (
        <SectionNote>
          This draft has no items yet. If a document is still being read, they
          appear here when it finishes.
        </SectionNote>
      ) : (
        rows.map((item, i) => (
          <React.Fragment key={item.id}>
            {i > 0 ? <Hairline /> : null}
            <Row
              title={item.title ?? `Item ${item.seq + 1}`}
              titleLines={2}
              subtitle={moneyLine(item)}
              meta={specLine(item)}
              /*
                The photo the extract pulled out of the document — for a
                spreadsheet that is the embedded per-row image, anchored back to
                its row by `officeImages.js`. `thumbnail_object` is a GCS object
                NAME, not a URL; `gcsUrlForAnalyze` turns it into the unproxied
                `/gcs/serve?path=` link, which is the same route the web's
                `DraftCard` uses and is not behind auth (`gcsRoute.js:84`).
                No photo is the normal case for a text-only row, and `RowThumb`
                draws its own tile rather than a broken image.
              */
              leading={<RowThumb uri={thumbUri(item)} />}
              /*
                ⚠️ THE ACTIONS ARE NOT IN `trailing`, AND THAT IS THE WHOLE
                REASON THE EXTRA FIELDS ARE READABLE.

                "Discard  Accept" occupies ~120pt of a 390pt row, and `Row`
                truncates its subtitle and meta to one line each. With the
                buttons inline, the spec line rendered
                "Used — functional · 201…" — the year, the location and the
                category all clipped away, i.e. exactly the fields this change
                added. Measured in the browser 2026-09-17.

                A decided row keeps its chip inline: one short word costs
                nothing, and it holds the right edge steady down the list.
              */
              trailing={
                item.status === 'needs_review' ? undefined : (
                  <RowTrailing chip={item.status === 'accepted' ? 'Accepted' : 'Discarded'} />
                )
              }
            />

            {/*
              The extract could not see this item well enough to price it — the
              one fact on the row that changes what the seller should DO, so it
              gets its own line rather than a `·` at the end of a truncating
              one.

              `captionMedium` + `inkMuted`, not a colour: the palette has no
              warning role (`danger` is for a failure, and this item is still
              perfectly usable) and adding one is a design-system decision, not
              this screen's. `typography.md` R3 — weight and space before colour.
            */}
            {item.needs_clearer_photo ? (
              <Text variant="captionMedium" color="inkMuted" style={styles.flag}>
                Needs a clearer photo — the price may be unreliable
              </Text>
            ) : null}

            {item.status === 'needs_review' ? (
              <View style={styles.actions}>
                {/* One label while the write is in flight, so a slow connection
                    does not read as a dead button and invite a second tap on
                    the other choice. */}
                {pendingId === item.id ? (
                  <Text variant="captionMedium" color="inkMuted">
                    Saving…
                  </Text>
                ) : (
                  <>
                    <QuietAction
                      label="Discard"
                      variant="captionMedium"
                      onPress={() => act(item.id, 'discard')}
                    />
                    <QuietAction
                      label="Accept"
                      variant="captionMedium"
                      onPress={() => act(item.id, 'accept')}
                    />
                  </>
                )}
              </View>
            ) : null}
          </React.Fragment>
        ))
      )}

      <View style={styles.gap} />
      <QuietAction label="Back to home" onPress={() => router.replace('/v2')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { paddingHorizontal: GUTTER, marginTop: space.md },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingHorizontal: GUTTER,
    marginTop: space['3xl'],
  },
  totals: { paddingHorizontal: GUTTER, marginTop: space['5xl'], gap: space.xs },
  totalLine: { marginTop: space.xxs },
  /**
   * Under the row it belongs to, right-aligned so the two choices sit where a
   * thumb reaches and line up down the list. `gap` is `5xl` (22) — these are
   * two distinct, opposite decisions, and `spacing-and-layout.md` R2 puts gaps
   * between distinct controls at the coarse end. Discard and Accept 10pt apart
   * is a mis-tap waiting to happen.
   */
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space['5xl'],
    alignItems: 'center',
    paddingHorizontal: GUTTER,
    paddingBottom: space.xl,
  },
  /** Under its row, on the gutter, above that row's actions. */
  flag: { paddingHorizontal: GUTTER, paddingBottom: space.sm },
  gap: { height: SECTION_GAP },
});
