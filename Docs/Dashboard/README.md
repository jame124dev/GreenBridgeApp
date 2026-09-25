# Buyer & Seller dashboards on mobile — implementation plan

Written 2026-09-23 for the engineers who will build this. Companion to
`Docs/v2/WEB-PARITY.md`, which is the gap analysis this plan answers.

> ## ▶ Building a page? Read `PAGE_PLAYBOOK.md` instead of this file.
>
> This README is the *strategy* — what copies, what does not, and why. The
> step-by-step flow for one page, proven on `/v2/dashboard/bids`, is
> **`Docs/Dashboard/PAGE_PLAYBOOK.md`**. The instruction for the next page is
> literally "Build `<page>` following `Docs/Dashboard/PAGE_PLAYBOOK.md`".

**The strategy is right and this plan follows it: do not design these screens.
They exist, they work, and they are already wired to the backend the app
talks to. We take them.** What follows is the honest mechanics of taking them,
because "clone the repo and copy the files across" does not survive contact
with React Native, and planning around that would cost more than knowing it now.

---

## 1. What actually copies, measured

The source is `nextjs-port` (GitHub `jamtechdev/101lab-2`), already checked out
next door — no clone needed. It is React DOM + shadcn/ui + RTK Query.

Line counts across five buyer pages, split at the top-level `return (`:

| File | Total | Logic | Markup | Markup % |
|---|---|---|---|---|
| `shared/pages/buyer/MyBids.tsx` | 402 | 63 | 339 | 84% |
| `shared/pages/buyer/MyInspections.tsx` | 343 | 76 | 267 | 78% |
| `features/buyer/pages/buyer/orders/BuyerOrders.tsx` | 434 | 141 | 293 | 68% |
| `features/buyer/pages/buyer/OrderHistory.tsx` | 349 | 55 | 294 | 84% |
| `features/buyer/pages/buyer/BuyerWatchlist.tsx` | 187 | 71 | 116 | 62% |
| **total** | **1,715** | **406** | **1,309** | **76%** |

That 76% is `<div>`, `className=`, and shadcn `<Table>` / `<Dialog>` /
`<Select>`. **React Native has none of those elements.** There is no adjusting
a `div` into a `View` — the whole tree changes, and so does every style.

So the split is:

**Copies verbatim (the 24%, and it is the part that is easy to get wrong):**
- TypeScript request/response types and DTOs
- Endpoint URLs, query params, pagination shape
- Status → label → tone maps, and the status state machines
- Formatters (currency, dates, lot numbers, masked emails)
- Filter, sort and search predicates
- User-facing copy, for the i18n keys

**Does not copy — rebuild on the v2 kit (the 76%):**
- Every JSX element and every Tailwind class

**Already in our kit, so not even a rebuild:**
- `Timeline` — dot + connector rail. This IS the order/shipment status
  component; the scan flow already uses it (`app/v2/scan/analyzing.tsx`).
- `Tabs` — the filter row above each list (All / Active / Won / Lost).
- `Row`, `RowThumb`, `RowTrailing`, `Chip`, `SectionHeader`, `SectionNote`,
  `EmptyState`, `PrimaryAction`, `QuietAction`, `Field`, `Screen`.

A list screen built from those is roughly 80–150 lines, against the web's 400.

## 2. The data layer — one decision to make first

| | Web (`nextjs-port`) | Mobile (this app) |
|---|---|---|
| Client | RTK Query (`@reduxjs/toolkit`) | React Query + axios |
| Present? | — | `@reduxjs/toolkit`: **ABSENT**, `react-redux`: **ABSENT**, `@tanstack/react-query`: `^5.100.14`, `axios`: `^1.16.1` |
| Site identity | `?type=${SITE_TYPE}` query param (`buyerApiSlice.ts:5,267`) | `x-platform` header, `greenbidzClient.ts:10` |
| `SITE_TYPE` value | `LabGreenbidz` (`src/config/site.ts:72`) | `LabGreenbidz` (`app.config.ts:279`) |

So `buyerApiSlice.ts` **cannot be dropped in** — it is RTK, and this app has no
Redux at all. Two options:

- **(A) Transcribe to React Query.** Copy the URL, the params and the response
  type verbatim into a `useQuery`. ~10 lines per endpoint. No new dependency,
  matches every other screen in the app. **Recommended.**
- **(B) Add RTK Query alongside React Query.** Lets the slice paste in nearly
  whole, at the cost of two data libraries, two caches and two sets of
  invalidation rules in one app.

⚠️ Note the site-identity difference: mobile sends a header where web sends a
query param. Before building, confirm the backend accepts the header on these
specific routes — the app's existing calls prove it for the routes it already
uses, not for these. `<VERIFY: curl one buyer route with the x-platform header
and no ?type= and diff against the same call with ?type=LabGreenbidz>`

## 3. Scope — what belongs on a phone

The web has 44 seller-dashboard routes and 13 buyer ones. Most are desk work.
The test applied here: **would someone do this standing up, away from their
desk?** That is the "what happened while I was away" set, plus anything that
blocks money.

### Buyer — in scope (5 screens)

| Screen | Web source | Endpoint (cited) |
|---|---|---|
| Buying home (counts + recent) | `shared/pages/buyer/BuyerDashboard.tsx` | `GET /buyer/dashboard/{buyerId}` — `buyerApiSlice.ts:265` |
| My bids (+ outbid state) | `shared/pages/buyer/MyBids.tsx` | `GET /buyer/bid/buyer/{buyerId}` — `services/api/slices/buyerApiSlice.ts:274` · top bid `GET /buyer/bid/batch/{batch_id}/top` — `services/api/slices/bidApiSlice.ts:472` |
| Orders + order detail | `features/buyer/pages/buyer/BuyerRequests.tsx` (570 lines) — **not** `orders/BuyerOrders.tsx`, see the dead-files note below | `GET /order/buyer/{buyerId}?page=1&limit=` — `orderApiSlice.ts:85` |
| Shipment tracking | `features/buyer/pages/order/BuyerOrder.tsx` | `GET /shipment/order/{orderId}` — `shipmentApiSlice.ts:151` |
| Watchlist | `features/buyer/pages/buyer/BuyerWatchlist.tsx` | `GET /wishlist/{buyerId}` — **not in any RTK slice**; a direct axios call at `BuyerWatchlist.tsx:38`, items at `res.data.data.wishlist` |

Already native, do not rebuild: **wants** and **matches** (`/v2/matches`,
BuyingPane's "Your wants" / "Matched for you").

### Seller — in scope (4 screens)

| Screen | Web source | Endpoint (cited) |
|---|---|---|
| Bids on my listings | ⚠️ **the same component as the buyer's.** `SellerMyBids.tsx` is 15 lines: `<MyBids batchBasePath="/dashboard/buying" />`. One mobile screen with a prop, not two. | `GET /seller/bids/{sellerId}` — `buyerApiSlice.ts:323` |
| Offers in / respond | `features/buyer/pages/offer/SellerOffer.tsx` (306 lines) | `GET /offer/seller` — `bidApiSlice.ts:653` · `PUT /offer/{offer_id}/status` — `bidApiSlice.ts:665` |
| Orders | `features/buyer/pages/order/SellerOrder.tsx` (367 lines) | ⚠️ it queries **checkouts, not orders**: `useGetSellerCheckoutsQuery` → `GET /checkouts/seller/{sellerId}` — `checkoutApiSlice.ts:73` · `PUT /checkouts/{checkoutId}/status` — `checkoutApiSlice.ts:92` |
| Shipments | — | `GET /shipment` — `shipmentApiSlice.ts:163` |

### ⚠️ Dead files — do not port these

`features/buyer/pages/buyer/orders/BuyerOrders.tsx` (434 lines) and
`features/buyer/pages/buyer/offers/BuyerOffers.tsx` (449 lines) are imported by
**nothing** — checked across `src/` and `app/`. An earlier draft of this plan
cited `BuyerOrders.tsx` as the source for the buyer orders screen; it would have
sent someone to port an orphan. The live route renders `BuyerRequests.tsx`.

Also worth knowing before reading `MyOrders.tsx`: the route comment at
`app/(buyerdash)/buyer/orders/page.tsx:4` records that it "ran the exact same
query as /buyer/winning-bids … a duplicate of that page under a misleading
name". Read what a route renders before trusting a filename.

### Explicitly OUT of scope, and why

Team / users / permissions / invitations · reports · sales-sync · storefront ·
auto-approval · company-organization · auction & batch groups · bulk upload ·
buyer-activity. All desk work, all better on the web, all reachable in the app
today through the marketplace WebView if anyone needs them.

**Checkout is out too, deliberately.** Payment redirects leave the WebView for
the system browser by policy (`navPolicy.ts`), and putting a native payment
flow in a store app raises App Review questions this app has already been
rejected over twice. Buyers finish payment on the web.

## 4. Sequence

1. **One vertical slice first: My bids.** Highest value (it is the "am I still
   winning" question), and it exercises everything — a tab-filtered list, a
   status map, pagination, an empty state, a detail push. Build it, ship it,
   and let it settle the patterns before anything else starts.
2. Buying home, once the bid row component exists — the home is that row plus
   counts.
3. Orders + order detail + shipment tracking, as one piece. `Timeline` does
   the status rail.
4. Seller: bids, offers, orders, shipments. Same components, different query.
5. Watchlist last. Two notes from reading it: the endpoint is outside the RTK
   layer (a raw axios `GET /wishlist/{buyerId}`), and the web refreshes it by
   dispatching a `window` event, `"wishlist-changed"`. There is no `window` in
   React Native — that becomes a React Query `invalidateQueries`, and it is the
   one place in this plan where copying the logic verbatim would produce dead
   code that throws nothing.

## 5. Risks

- **The gap analysis is the map, not the demand.** Nothing here is validated
  against what sellers and buyers actually do on a phone; the usage data is not
  in this repo. Slice 1 exists partly to find out.
- **The web pages are the spec, and they have bugs.** Copying the logic copies
  those. Read before transcribing; three logic divergences were already found
  this way for the scan flow (`Docs/v2/WEB-PARITY.md`).
- **Every list here is a FORM's neighbour.** The keyboard/slot rules in
  `FORM_INPUT_RULES.md` § 4 apply to any screen with a search field.
- **Do not skip `UX_DESIGN_RULES.md`** — one primary action, sticky, and the
  empty state carries the action that fills it.

## 6. Definition of done, per screen

The `v2-screen` skill's two-part bar, unchanged: `tsc` clean, `v2Adherence` and
`v2Contrast` green, no new jest failures, **and pressed on a real device in
both schemes** with the longest real title, a missing image, and the empty
state. A list screen is not done because it renders one fixture row.

---

## 7. Where the dashboard lives in the app — decided 2026-09-23

**Account is the hub. Not a new tab, and not a drawer.**

The app had already made this choice before the question was asked:
`app/v2/account.tsx` carries a **"Selling"** section (My listings, Drafts,
Offers received), each a `Row` pushing to a screen. What was missing was the
other half. So the buyer dashboard is a **"Buying"** section on the same
screen, in the same pattern, and each page joins it as it lands.

Why not the alternatives:

| Option | Why not |
|---|---|
| **Hamburger / side drawer** | The app navigates by a bottom tab bar. A drawer would be a second navigation system holding the same destinations, hidden behind a menu — worse discoverability than the rows it replaces. |
| **A sixth tab** | Five is already the limit, and "Bids" does not out-rank Browse or Messages for frequency. |
| **A separate `/v2/dashboard` screen** | Adds a hop (Account → Dashboard → list) for no gain, and either duplicates the Selling rows or moves shipped, tested navigation. |

**The split of duties**, which is the part worth keeping:

- **Account → Buying / Selling** is the INDEX. Everything, always in the same
  place, findable by someone who does not know what it is called.
- **Home's Buying and Selling panes** are the SUMMARY — the two or three
  things that need attention now ("outbid on 1", "payment due"), each deep
  linking into a list. Not a directory.

This is eBay's structure: one hub holding Bids/Offers and Watchlist, with
reminders surfaced separately, rather than a tab per list
([My eBay](https://www.ebay.com/help/account/using-ebay/using-ebay?id=5185)).

**One tension, recorded not solved:** Account mixes identity and settings with
activity, which is why "Offers received" under it reads slightly oddly. eBay
avoids it by naming the tab *My eBay* rather than *Account*. Renaming ours is
a product call, not a refactor — raise it before the section grows.

### The `__DEV__` gate

The "My bids" row is wrapped in `__DEV__` and says "Sample data — not
connected yet" in its subtitle. `/v2/bids` renders four hardcoded rows, and an
index entry to invented data is worse than no entry. **Phase 2 removes the
gate and the subtitle**; that is part of phase 2's definition of done, not a
follow-up.
