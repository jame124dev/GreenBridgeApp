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
  /**
   * The per-item editor — the FOUR-STEP review wizard
   * (`app/v2/scan/review/{photos,details,pricing,location}`). Entered at
   * whichever step owns the field a blocked Accept is sending the seller to;
   * `src/features/v2/scan/openDetectedItem.ts` picks it.
   *
   * ⚠️ A ONE-SCREEN EDITOR BRIEFLY REPLACED THIS ON 2026-09-23 and was removed
   * the same day when the owner asked for the previous scan flow back
   * (*"let's bring back previous one, we will adjust that in new endpoint"*).
   * Its route constant — `v2ScanItem`, pointing at `/v2/scan/item` — was
   * deleted with it, because a constant that outlives its screen navigates to
   * "Page not found" and nothing in the type system objects: every path here is
   * cast `as Href`, so a dangling route compiles perfectly.
   *
   * The one-screen editor is preserved on `wip/scan-v2-snapshot-2026-09-23` if
   * it is wanted back:
   * `git checkout wip/scan-v2-snapshot-2026-09-23 -- app/v2/scan/item.tsx`
   */
  v2ReviewPhotos: '/v2/scan/review/photos' as Href,
  /**
   * Step 1 — INTAKE. The door into the v2 scan flow, ported from the web's
   * `/valuation` (`app/v2/scan/intake.tsx`).
   *
   * This is the entry point, not `v2Camera`. A seller's inventory arrives as a
   * spreadsheet or a spec sheet at least as often as it arrives through a
   * lens, and a viewfinder-only door turns those away. The camera is still one
   * press from here, and remains its own route because 7b's ADD tile and the
   * append mode below reach it directly.
   */
  v2Intake: '/v2/scan/intake' as Href,
  /**
   * Step 2 — DETECTED ITEMS (`app/v2/scan/items.tsx`). Where the detector hands
   * off, and where a resumed server draft opens: one row per item found,
   * accept/discard, then into the per-item review or on to Valuation.
   *
   * ⚠️ IT TAKES AN ID, ALWAYS. `app/v2/scan/items.tsx` renders an EmptyState
   * without one. A fresh scan's id is a LOCAL one from
   * `services/drafts/localDraftSource.ts` (`local-1`), a resumed draft's is the
   * server's — the screen cannot tell, on purpose (see its docblock).
   *
   * Replaced `v2Detected: '/v2/scan/detected'` on 2026-09-23. That screen was
   * the local-only twin of this one and was deleted with it: two step-2 screens
   * reading two data models is the fork Phase 1 existed to close. Its constant
   * went too rather than being left pointing at a route that no longer exists —
   * a dangling `Href` compiles under typed routes until someone regenerates
   * them, then fails somewhere else.
   */
  v2ScanItems: (draftId: string) =>
    ({ pathname: '/v2/scan/items', params: { draftId } }) as unknown as Href,
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
  /**
   * My bids — the buyer dashboard's first screen, added 2026-09-23.
   *
   * ⚠️ PHASE 1: it renders a fixture, not the API. The Account row that
   * reaches it is gated on `__DEV__` for that reason; see `app/v2/account.tsx`
   * and `Docs/Dashboard/buyer/my-bids/`.
   */
  v2Bids: '/v2/dashboard/bids' as Href,
  /**
   * Watchlist — the buyer's saved lots, a 2-up image grid.
   *
   * ⚠️ PHASE 1: a fixture. Phase 2 reads `GET /wishlist/{buyerId}`, which is
   * the unauthenticated IDOR in `Docs/v2/SECURITY-WISHLIST.md` — read that
   * before wiring it.
   */
  v2Watchlist: '/v2/dashboard/watchlist' as Href,
  /**
   * Inspections — site visits the buyer registered for, with their dates.
   *
   * ⚠️ PHASE 1: a fixture. Phase 2 reads
   * `GET /inspection/buyer/{buyerId}` and must send `status` to the SERVER,
   * not filter in the client — the pagination totals describe the filtered set.
   */
  v2Inspections: '/v2/dashboard/inspections' as Href,
  /**
   * Orders & requests — Buy Now purchases and Make Offer requests, merged.
   *
   * ⚠️ PHASE 1: two fixtures. Phase 2 is TWO endpoints, not one —
   * `GET /order/buyer/{id}` (orders) and `GET /offer/user?buyer_id={id}`
   * (offers) — merged client-side, exactly as the web does. The plan doc
   * originally described one endpoint; see `src/features/v2/requests/types.ts`.
   */
  v2Requests: '/v2/dashboard/requests' as Href,
  /**
   * Order detail & tracking — checkout status + shipment events, by
   * CHECKOUT id (not the `order_id` a requests.tsx row carries — those are
   * unrelated tables, live-verified 2026-09-24; see the route file).
   *
   * ⚠️ NOT REACHABLE FROM ANYWHERE IN THE APP YET. Built and verified in
   * isolation. Do not wire a request row's `order_id` into this — see
   * `app/v2/dashboard/orders/[id].tsx` for why that was tried and reverted.
   */
  v2OrderDetail: (checkoutId: number) => `/v2/dashboard/orders/${checkoutId}` as Href,
  /**
   * Bids on my listings (seller) — buyers' bids on the SELLER's own batches.
   *
   * ⚠️ PHASE 1: a fixture. Phase 2 is `GET /buyer/bid/seller/{userId}`
   * (`batchApiSlice.ts`) — NOT the plan doc's cited `GET /seller/bids/{id}`,
   * which is real but unused by the live route. See
   * `src/features/v2/seller-bids/types.ts` for the full audit.
   */
  v2SellerBids: '/v2/dashboard/seller-bids' as Href,
  /**
   * Offers received (seller) — the first dashboard screen with a write
   * (accept/reject/mark sold/decline), simulated locally in phase 1.
   *
   * ⚠️ `GET /offer/seller?sellerID={id}` is unauthenticated AND leaks buyer
   * password hashes in a nested `buyer` object — see
   * `Docs/v2/SECURITY-WISHLIST.md`, 2026-09-24 entry, before wiring phase 2.
   * The real mutation is `PATCH /offer/{id}/status` — the plan doc says PUT;
   * PUT is wrong.
   */
  v2SellerOffers: '/v2/dashboard/seller-offers' as Href,
  /**
   * Orders / checkouts (seller). Third seller page with the SAME
   * unauthenticated password-hash leak as offers — `GET
   * /checkouts/seller/{id}` — see `Docs/v2/SECURITY-WISHLIST.md`'s "THIRD
   * occurrence" entry before wiring phase 2. Mutation is `PATCH`, not the
   * plan's `PUT`.
   */
  v2SellerOrders: '/v2/dashboard/seller-orders' as Href,
  /**
   * The dashboard section's entry point.
   *
   * ⚠️ HISTORICAL NOTE, RE-CHECK BEFORE TRUSTING: this constant pointed at
   * `/v2/dashboard/bids` because bare `/v2/dashboard` used to do nothing at
   * all under the Drawer layout (no error, no screen — found by deep-linking
   * twice and landing on Home both times), and `app/v2/dashboard/index.tsx`
   * was a `<Redirect>` stub for anyone who reached it anyway.
   *
   * 2026-09-24: `index.tsx` is no longer a redirect — it is the real Buying
   * home screen (`src/features/v2/buying-home/`). Whether the bare
   * `/v2/dashboard` href now resolves to it under expo-router's typed routes
   * was NOT re-verified when this comment was written; this constant was left
   * pointing at the known-working concrete path rather than assumed fixed.
   * If you need the bare path, test it live first.
   */
  v2Dashboard: '/v2/dashboard/bids' as Href,
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
