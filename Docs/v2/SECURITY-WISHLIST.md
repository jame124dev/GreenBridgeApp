# Wishlist API — unauthenticated, live on prod

## ⚠️ 2026-09-21 — it is not just the wishlist. It is a CLASS.

This file's own Precedent section said "worth checking whether other `jos_*`-backed
routes follow the same `:userId`-in-path pattern — this is unlikely to be the
only one." Checked. It is not the only one.

**Enumerated by predicate** — every route in `routes/*.js` (75 files) whose path
carries an identity parameter (`:userId`, `:sellerId`, `:buyerId`, `:memberId`,
`:ownerId`): **24 routes. 21 carry no guard** — no inline `protect`, no
router-level `.use(protect)`, and no middleware at the `app.use` mount. The only
three guarded are `adminRbacRoute.js:36-38`.

**Confirmed by request, not by reading.** Five called against `testapi` with
**no Authorization header, no cookie, no system key** — all 200, all returning
real rows. Run against the test seller's OWN id (574) on the DEV backend, so no
third party's data was touched:

| route | result |
|---|---|
| `GET /notifications/574` | 200 — notification rows incl. `user_id`, titles |
| `GET /wishlist/574` | 200 — **58 KB** of wishlist |
| `GET /user-roles/574` | 200 — roles and company assignment |
| `GET /checkouts/buyer/574` | 200 — **18.6 KB**: `checkout_id`, `batch_id`, `product_id`, `seller_id` |
| `GET /batch/seller/574` | 200 — the seller's batches |

**`/checkouts/buyer/:buyerId` is the worst of these.** The wishlist leaks buying
intent; checkouts leak completed transactions — who bought what, from whom.

**Prod is affected too.** `origin/main` — the branch prod deploys — contains zero
occurrences of `protect`, `authGuard` or `verifyToken` in `checkoutRoutes.js`,
`notificationRoutes.js`, `wishlistRoutes.js` or `userRoleRoutes.js`. That is code
evidence, deliberately not a live probe: testing prod would mean reading real
users' records, which is the thing being reported.

⚠️ **Scope caveat.** The 24 is every route matching those five parameter names.
Routes that take an identity as a query string, in a body, or under a different
name are not counted and are not cleared — the number is a floor.

This changes the scheduling calculus in the write-up below: the migration is no
longer "the wishlist plus 12 web call sites", it is a route class. That is more
work, and also more reason to start.

---

**Status:** reported, NOT fixed. No code changed. Found 2026-09-16 while deciding
whether to wire 2a's save heart; widened 2026-09-21.

**Severity:** IDOR (Insecure Direct Object Reference). Any caller can read,
add to, or delete from **any** user's wishlist by changing a number in a URL.
No token, no session, no ownership check.

## What is wrong

`101recycle-greenbidz-backend/routes/wishlistRoutes.js` declares five routes and
attaches **no middleware to any of them**:

```
POST   /api/v1/wishlist/:userId
DELETE /api/v1/wishlist/:userId/:productId
GET    /api/v1/wishlist/:userId
GET    /api/v1/wishlist/:userId/:productId
POST   /api/v1/wishlist/:userId/toggle
```

Mounted at `app.js:439`. The word `protect` does not appear in the routes file
(`grep -c protect` → `0`).

The controller takes the identity straight from the path and checks only that it
is present — never that it belongs to the caller
(`controller/wishlistController.js:13`, and the same shape at `:44`, `:74`,
`:103`):

```js
const { userId } = req.params;
if (!userId) { /* 400 */ }
const result = await getUserWishlist(userId, page, limit);
```

`userId` is the trust boundary, and it is supplied by the attacker.

Data sits in `jos_wishlists`.

## What it exposes

- **Read** anyone's wishlist by iterating `GET /api/v1/wishlist/{n}` — which
  equipment a named buyer is tracking. For a B2B marketplace that is commercial
  intelligence: a competitor learns what a rival is about to bid on.
- **Write/delete** into anyone's wishlist — silently remove the lot a buyer was
  tracking, or stuff someone's list with noise.
- **Enumerate users** — sequential WordPress-derived ids make sweeping cheap.

No authentication is needed for any of it.

## Why it is not fixed yet

The obvious fix — `protect` middleware plus `userId` from the JWT instead of the
path — is a **breaking API change**, not a patch. `nextjs-port` calls this route
family from **12 sites across 8 files**, all passing `userId` in the URL (counted
2026-09-16; these are raw `axios` calls, not RTK hooks, so hook-name greps find
nothing — search the path):

| File | Lines |
|---|---|
| `src/features/buyer/pages/buyer/BuyerWatchlist.tsx` | 38 |
| `src/features/buyer/pages/buyer/MyLots.tsx` | 32 |
| `src/features/buyer/pages/buyer/MyWants.tsx` | 148, 174 |
| `src/features/portal/pages/landing/Landing.tsx` | 195, 213 |
| `src/shared/components/ai/cardActions.tsx` | 104 |
| `src/shared/components/common/MarketplaceCardGrid.tsx` | 162, 177 |
| `src/shared/pages/buyer/BuyerDashboard.tsx` | 487 |
| `src/shared/pages/listing/SellerListingDetail.tsx` | 1014, 1031 |

Change the server alone and the web wishlist breaks; change both and it is a
coordinated release. That scheduling is the user's call, which is why this is a
write-up and not a commit.

## The fix, when it is scheduled

1. Add `protect` to all five routes.
2. Derive the id from the verified token (`req.user.id`), ignore the path
   parameter, and keep the path shape so existing callers keep working during
   the transition.
3. Return `403` when a path `userId` is present and disagrees with the token —
   for one release, log these rather than rejecting, to find stragglers.
4. Update the 12 web call sites to stop sending `userId`.
5. Drop the path parameter.

Steps 1–3 close the hole on their own. 4–5 are cleanup.

Do **not** bolt on `x-system-key` here. It is a shared secret for
service-to-service calls, not per-user auth — the root `CLAUDE.md` says so
explicitly — and a browser-visible wishlist call cannot hold one.

## Precedent

This exact class of bug was already found and fixed once in this workspace, on
`/chat/*`, which had zero auth and leaked an inbox plus email addresses in
production (memory `project_chat_auth_idor_prod`). Worth checking whether other
`jos_*`-backed routes follow the same `:userId`-in-path pattern — this is
unlikely to be the only one.

## Effect on mobile

⚠️ **Corrected 2026-09-16.** This section first said the app was "not currently
exposed, because `GreenBridgeApp` has no wishlist client at all". The first half
is true and the conclusion is false.

There is no **native** wishlist client — nothing in `GreenBridgeApp` calls these
routes in React Native code. But v2's Browse is not native. `app/v2/browse.tsx`
renders `MarketplaceWebView`, which loads **`/buyer-marketplace`** on 101lab
(`features/lab/marketplace/MarketplaceWebView.tsx:307`) with a token injected by
`webAuthBridge.ts`. That page is `BuyerMarketplace.tsx`, which renders
`MarketplaceCardGrid` — and the wishlist calls at
`MarketplaceCardGrid.tsx:162,177` are two of the twelve listed above. The heart
on every card in that grid is visible in the app (screenshotted on device
2026-09-16).

**So the app already exercises these routes, as a signed-in user, today.** Not
through code we wrote, but the traffic is real and the exposure is real. Anyone
assessing blast radius should count mobile, not exclude it.

What removing 2a's heart achieved is narrower than first claimed: it stopped us
adding a **second, native** client to an unauthenticated route, and it removed a
control that saved nothing. It did not make the app unexposed.

**How this was missed:** the conclusion came from a code search of the React
Native tree, which is the right probe for "is there a native client" and the
wrong one for "is this route reached from the app". A WebView is a client that
no grep of this repo will ever show. When a surface is a WebView, ask what the
embedded page calls, not what the host app calls.

---

## ⚠️ 2026-09-24 — a second, WORSE class: unauthenticated routes leaking password hashes

Found while building the mobile "Offers received" (seller) screen —
`Docs/Dashboard/seller/offers/`. This is not the same bug as the routes
above; it stacks with them.

**The route.** `GET /offer/seller?sellerID={id}&page&limit`
(`nextjs-port/src/services/api/slices/bidApiSlice.ts:653-663`), the endpoint
behind `SellerOffer.tsx` — the live screen at
`/dashboard/seller/offers`.

**Unauthenticated, confirmed live:**

```
curl "https://testapi.greenbidz.com/api/v1/offer/seller?sellerID=571&page=1&limit=1" \
  -H "x-platform: LabGreenbidz"
→ HTTP 200, real rows. No Authorization header, no cookie, no x-system-key.
```

Same class as every route enumerated above: `:sellerId`-in-query, no guard.

**What makes this one worse: the response embeds the FULL WordPress `buyer`
user record, unfiltered, including `user_pass` (the password hash) and
`user_activation_key`.** Verified live, seller 571, 2026-09-24:

```json
"buyer": {
  "ID": 574, "user_login": "...", "user_pass": "$P$B...",
  "user_nicename": "...", "user_email": "...", "user_url": "",
  "user_registered": "...", "user_activation_key": "...",
  "user_status": 0, "display_name": "..."
}
```

`SellerOffer.tsx` itself never reads `offer.buyer` at all (grepped — the live
UI only ever reads `offer.user_id`, a bare number) — the backend join returns
the ENTIRE row from whatever table `buyer` comes from with no field
allowlist, and the frontend simply never happened to look at the dangerous
half of what it was sent.

**Combined severity is worse than the wishlist class alone.** That class lets
an unauthenticated caller read one person's buying intent or checkout
history by guessing an id. This lets the SAME caller, at the SAME cost,
harvest password hashes and activation keys for every buyer who has ever
made an offer to a given seller — and seller ids are far more guessable
(sequential, low cardinality, often visible in a listing URL) than a random
buyer id. `user_activation_key` in particular is a live WordPress mechanism
(used for password-reset / account-activation flows) that this response
hands to anyone who asks.

**No code was changed for this.** The mobile screen this was found while
building types the buyer ONLY as a bare `user_id` number — no `displayName`,
no resolved name, nothing from the `buyer` object at all — by design; see
`src/features/v2/seller-offers/types.ts`'s own note. The fix belongs on the
backend (auth-guard the route AND stop the join from returning the whole
`wp_users` row), same as the wishlist class, and is the user's call on
scheduling, not something to fix from a mobile PR.

### 2026-09-24, same day — a THIRD occurrence: this is a pattern, not a one-off

Found immediately after the entry above, while building the next seller
screen ("Orders (seller)"). **`GET /checkouts/seller/{sellerId}`** — a
DIFFERENT endpoint, a different slice file
(`checkoutApiSlice.ts:73`), same backend — has the identical shape:
unauthenticated (curled with no token, 200, real rows, seller 571) and each
of the 4 real checkout rows carries the SAME full `buyer` object:
`{ID, user_login, user_pass, user_nicename, user_email, user_url,
user_registered, user_activation_key, user_status, display_name}`.

Two unrelated endpoints on two unrelated slice files, both joining the
SELLER-facing "who did this" query straight onto `wp_users` with no field
allowlist, is enough to say this is a backend QUERY PATTERN — every
seller-facing "who is the buyer" join probably does this — not two
independent bugs. Worth checking systematically (grep the backend for the
join, not waiting to trip over each caller one screen at a time) rather than
patching per-endpoint as mobile happens to build against them.

Same handling as before: this screen's own types
(`src/features/v2/seller-orders/types.ts`) model only `buyer_id`, nothing
else from the row's `buyer` field.
