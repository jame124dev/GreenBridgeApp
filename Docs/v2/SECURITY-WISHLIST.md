# Wishlist API — unauthenticated, live on prod

**Status:** reported, NOT fixed. No code changed. Found 2026-09-16 while deciding
whether to wire 2a's save heart.

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
