import type { Href } from 'expo-router';

/** Typed-route-safe paths (regenerate with `npx expo start` if routes change). */
export const routes = {
  /**
   * Where "done / go home" lands. Was the seller shell `/(tabs)`; that fork was
   * deleted (the app is customer-only now), so this is the lab home.
   */
  scanHome: '/(lab)/(tabs)/home' as Href,
  /** (lab) full "my listings" view — reached from Home Recent listings "See all". */
  labListings: '/(lab)/(tabs)/listings' as Href,
  /** (lab) dedicated notifications page — reached from the header bell. */
  labNotifications: '/(lab)/notifications' as Href,
  /**
   * (lab) seller application + application-status screen. The ONLY destination
   * of the sell gate in `launchSellerScan()` — listing requires an approved
   * seller-upgrade request, and this is where an unapproved user is sent.
   */
  labSellApply: '/(lab)/sell/apply' as Href,
  scanListingMethod: '/scan/listing-method' as Href,
  scanGroupedReview: '/scan/grouped-review' as Href,
  // Round 2 R1/R2 — per-item editor reached from the review-hub. New route
  // (decision recorded per R-5): a dedicated file rather than adapting
  // detail.tsx, since the per-item editor binds to `queuedItems[index]` via
  // `patchQueuedItem` while detail.tsx still owns the single-product `current`
  // semantics + 4 submit modes. Both screens share `formMapping.ts` so the
  // form↔draft mapping has one source of truth.
  scanGroupedEdit: (index: number) =>
    ({
      pathname: '/scan/grouped-edit',
      params: { index: String(index) },
    }) as unknown as Href,
  scanCamera: '/scan/camera' as Href,
  scanDetection: '/scan/detection' as Href,
  /**
   * 6a — v2's own Home. **Every "go home" / "start over" inside v2 must use
   * this, never `scanHome`.**
   *
   * All four review steps used to send their empty state to
   * `scanHome` (`/(lab)/(tabs)/home`) with `router.replace` — so cold-opening a
   * review step dropped you on the OLD home with v2 gone from the back stack
   * and no way back. Reported by the user as "it goes into the previous
   * version while using it". The constant did not exist, which is why four
   * separate screens reached for the shipped one.
   */
  v2Home: '/v2' as Href,
  /** 7b — the first v2 review step. The scan flow's destination once a
   *  detection has been applied to the draft store. */
  v2ReviewPhotos: '/v2/scan/review/photos' as Href,
  /** 3b — v2's own camera. Every scan entry point INSIDE v2 must use this and
   *  not `scanCamera`: the shipped camera is a different screen in old tokens,
   *  and sending someone there mid-flow drops them out of v2 entirely. */
  v2Camera: '/v2/scan/camera' as Href,
  /** 3b in APPEND mode — shoot and add to the draft already under review,
   *  instead of starting a new scan. 7b's ADD tile is the only caller; see
   *  the `append` branch in `app/v2/scan/camera.tsx`. */
  v2CameraAppend: () =>
    ({ pathname: '/v2/scan/camera', params: { mode: 'append' } }) as unknown as Href,
  /**
   * The two "See all" surfaces behind 6a Home, and a listing's detail.
   *
   * ⚠️ These MUST be used instead of `scanDrafts` / `labListings` /
   * `listingDetail` from anywhere inside v2. Those three are OLD-UI screens —
   * `labListings` in particular lives in the `(lab)` tab group, so reaching it
   * from v2 swaps the whole tab bar (measured 2026-09-17: it reads "Chat" with
   * `99+` badges). The old routes stay for the old UI, which still uses them.
   */
  v2Drafts: '/v2/drafts' as Href,
  v2Listings: '/v2/listings' as Href,
  v2ListingDetail: (batchPk: number) => `/v2/listing/${batchPk}` as Href,
  // 3a `v2Voice: '/v2/voice'` was REMOVED 2026-09-17 with `app/v2/voice.tsx`.
  // The screen was a static mock with four controls that only fired a haptic,
  // and nothing navigated to it. The constant went too rather than being left
  // pointing at a route that no longer exists — a dangling Href compiles under
  // typed routes until someone regenerates types, then fails somewhere else.
  // Voice is `/v2/chat` with a different composer when it is rebuilt for real.
  scanReorderPhotos: '/scan/reorder-photos' as Href,
  scanReorderPhotosEdit: () =>
    ({ pathname: '/scan/reorder-photos', params: { mode: 'edit' } }) as unknown as Href,
  scanProcessing: '/scan/processing' as Href,
  scanProcessingV2: '/scan/processing-v2' as Href,
  activityHistory: '/activity/history' as Href,
  scanDetail: '/scan/detail' as Href,
  /** Saved-drafts list ("Your drafts" / Home "View all drafts"). */
  scanDrafts: '/scan/drafts' as Href,
  listingDetail: (batchPk: number) => `/listing/${batchPk}` as Href,
  scanSuccess: (
    batchPk: number,
    batchNumber: number,
    itemCount?: number,
    groupId?: number,
    /**
     * Per-item rows for the success screen list (multi-product submissions).
     * Each entry carries the data we already have from the backend's
     * grouped-listing response; the success screen renders one row per item
     * and lets the user tap into any of them, not just the first.
     */
    items?: { title: string; batchPk: number; batchNumber?: number }[],
  ) =>
    ({
      pathname: '/scan/success',
      params: {
        batchPk: String(batchPk),
        batchNumber: String(batchNumber),
        itemCount: itemCount != null ? String(itemCount) : undefined,
        // W1 (scan_v3) — grouped submits now carry an auction_group id; the
        // success screen surfaces it alongside the canonical batch number.
        // Singles call this without the arg, so the param is conditional.
        groupId: groupId != null ? String(groupId) : undefined,
        // JSON-encoded compact items list. Capped at a few hundred bytes per
        // submission (≤10 products × ~50 char title) — well under URL limits.
        items: items && items.length ? JSON.stringify(items) : undefined,
      },
    }) as unknown as Href,
};
