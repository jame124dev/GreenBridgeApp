/**
 * Where a MULTI-ITEM draft opens in v2.
 *
 * Passed to `useResumeDraft(routeFor, onMultiItem)` by the two v2 surfaces that
 * list drafts — Home's preview rows and the full drafts screen. Defined once so
 * the two cannot drift: a seller who taps the same draft from Home and from
 * "See all" must land in the same place.
 *
 * ⚠️ Deliberately NOT the default inside `useResumeDraft`. That hook is shared
 * with the shipped UI, and a `/v2` push from inside it would walk an old-UI
 * seller into v2 mid-journey — the same defect class as the sign-in ejection
 * fixed on 2026-09-16. The old callers pass nothing and keep their behaviour.
 *
 * ── 2026-09-25: opens `/scan/grouped-review`, NOT `/v2/scan/items` ──────────
 *
 * Owner: "Multiple products → /scan/grouped-review — the screen with Export
 * to Excel." Before this, a multi-item draft opened a SEPARATE screen
 * (`app/v2/scan/items.tsx`) built specifically because grouped-review's store
 * (`useScanDraft.queuedItems`) holds a fully-shaped `DraftItem` per row —
 * matched category, full price form, a real photos array — and a
 * document/spreadsheet-extracted row is a much leaner projection (title,
 * price, condition; explicitly no description, no category match, no photos
 * array — see `draftItemsApi.ts`'s own field-name notes). That gap has not
 * closed: a row hydrated this way can and often will show as "incomplete" in
 * grouped-review until someone fills in what the extract did not capture.
 * Asked, and the owner chose this over keeping the separate screen — a seller
 * gets the SAME review-and-export flow every draft uses, at the cost of some
 * rows needing a tap-in before Submit unlocks, which is the same shape
 * grouped-review already handles for a camera scan missing a required field.
 */
import { router } from 'expo-router';

import type { MultiItemHandler } from '@/features/scanner/useResumeDraft';
import { listAllDraftItems, type DraftItem as ServerDraftItem } from '@/services/drafts/draftItemsApi';
import { draftItemFrom, useScanDraft, type DraftItem, type Photo } from '@/stores/scanDraftStore';
import { CONDITION_LABELS, type ConditionKey } from '@/features/scanner/constants';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner-native';

/** A server row's lone `thumbnail_object`, resolved to something an `<Image>`
 *  can load — mirrors `draftItemThumbUri` in `draftItemsApi.ts`. Inlined
 *  rather than imported so this file doesn't reach for the GCS URL helper
 *  twice; kept in lockstep by both reading the same field. */
function photosFor(row: ServerDraftItem): Photo[] {
  if (!row.thumbnail_object) return [];
  const isAddressable = /^(?:https?|file|content|data|asset|ph):/i.test(row.thumbnail_object);
  const uri = isAddressable
    ? row.thumbnail_object
    : gcsUrlForAnalyze({ objectName: row.thumbnail_object });
  // Real width/height are unknown from a list row — this is a display
  // thumbnail, not a publishable photo, and the missing-photos gate (which
  // DOES require real dimensions before Submit) is exactly the "incomplete"
  // state the owner accepted for a document-extracted row.
  return [{ uri, width: 0, height: 0 }];
}

/** One server row → one mobile `DraftItem`, defaults filled by `draftItemFrom`
 *  for everything the lean extract projection does not carry. */
function toMobileDraftItem(row: ServerDraftItem): DraftItem {
  const conditionLabel = row.condition && CONDITION_LABELS[row.condition as ConditionKey];
  return draftItemFrom(photosFor(row), {
    title: row.title ?? '',
    categoryName: row.category_name,
    condition: conditionLabel ? [row.condition as string] : [],
    pricePerUnit: row.price != null ? String(row.price) : '',
    priceCurrency: row.currency === 'TWD' ? 'TWD' : 'USD',
    quantity: row.qty && row.qty > 0 ? row.qty : 1,
    brand: row.brand ?? '',
    model: row.model ?? '',
    year: row.year ?? '',
    grade: (['A', 'B', 'C', 'D'] as const).includes(row.grade as never)
      ? (row.grade as 'A' | 'B' | 'C' | 'D')
      : 'A',
    needsClearerPhoto: row.needs_clearer_photo,
  });
}

/**
 * `push`, not `replace`: Back should return to the list the seller tapped from,
 * not skip past it to Home.
 */
export const openMultiItemDraft: MultiItemHandler = async (draftId) => {
  try {
    const rows = await listAllDraftItems(draftId, { filter: 'all' });
    const queuedItems = rows.map(toMobileDraftItem);

    if (queuedItems.length === 0) {
      // A real, separate condition from "fetch failed" — the draft exists
      // and answered, it just has nothing in it yet (still being read, or a
      // stray upload). Surfacing this as a normal toast rather than routing
      // into an empty grouped-review, which would render "Review 0 products"
      // and a Submit button with nothing to submit.
      toast.info('This draft has no items yet. Check back once it finishes processing.');
      return;
    }

    await useScanDraft.getState().hydrateFromServer({
      mode: 'grouped',
      current: null,
      queuedItems,
      sessionVisibility: 'PUBLIC',
      networkSellers: [],
      mergedSingle: null,
    });

    router.push(routes.scanGroupedReview);
  } catch {
    haptics.error();
    toast.error('Could not open this draft');
  }
};
