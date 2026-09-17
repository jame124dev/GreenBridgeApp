# v2 Browse (6c) — what native browse actually needs

**Status:** parked. An interim ships today; the drawn screen is blocked on the backend.
**Design:** `docs/v2-design/screens/6c.html`
**Interim:** `app/v2/browse.tsx`

---

## What ships today

The v2 brand strip (`headerFlush`) over the **working marketplace WebView**
(`101lab.co/buyer-marketplace`). Real data — 2,995 open lots. The Browse tab is
a live destination rather than a dead one, which matters: a visible tab that
goes nowhere is an App Review problem in its own right (Guideline 2.1).

It is **not** the drawing, and the file says so at the top.

## What the drawing asks for

| Element | Drawn |
|---|---|
| Search | "Equipment, brand, lot #" |
| Filter chips | Closing soon · Newest · Price · Live |
| Lot card | `#5475 · United Kingdom · 88 days left`, title, price or "No offers yet", **Bid** / **Make offer** |

## Why it cannot be built yet

**There is no marketplace browse endpoint in the app.** Verified, not assumed —
`src/api/` holds only `greenbidzClient` / `quippyClient` / `interceptors`, and
the lab hooks cover wants, matches, messages and batch review. `useBatchProducts`
is the *seller's* multi-product review, not browsing.

That is the reason browsing has always been a WebView. It is not a shortcut
someone took; there is nothing to call.

## What a native 6c needs from the backend

One public listings endpoint, no auth (guests browse — Guideline 5.1.1(v)):

- **Page** of open lots: lot number, title, country, close time, currency
- **Live bid state**: bid count, current price, or "no offers yet"
- **Search** across equipment / brand / lot number
- **Sort**: closing soon, newest, price
- **Filter**: live only
- Stable cursor paging — 2,995 lots is a long list

Rough shape: `GET /listings?q=&sort=&live=&cursor=` returning the card fields
above. The marketplace web app already renders exactly this data, so the query
exists server-side; it is the HTTP surface that is missing.

Worth checking before designing anything new: `jos_recycle_batch_product` and
the group-listings query that was indexed for the marketplace performance fix
(28–54s → ~50ms). The data is already assembled for the web; a JSON route over
the same query may be most of the work.

## Cheaper middle option, if native is not funded soon

`MarketplaceWebView`'s `path` prop takes a query string. A **native v2 search
field** could drive the real list by loading
`/buyer-marketplace?<param>=<query>`.

That buys the thing the interim is missing — it would let `hideSiteHeader` be
turned on, killing the navy 101LAB chrome the t6 brief wants removed, **without
losing search**.

⚠️ It needs the marketplace's actual query-param name confirmed first. Do not
guess it — a wrong param silently returns the unfiltered list, which looks like
a broken search rather than a broken link.

Filter chips could work the same way if the web supports sort/filter params.

## Decisions for the client

1. **Fund native browse?** It is the only screen of the eleven that is a real
   build rather than a reskin, and it needs backend work first.
2. **Or do the query-param search** as a middle step — small, and it removes
   the navy chrome, which is the interim's most visible compromise.
3. **Or leave the interim.** It works and it is honest; it just does not look
   like the drawing.

## What NOT to do

- Do not build the drawn search field or filter chips as native controls over
  the WebView without wiring them. They would look real and do nothing, which
  is worse than not having them, and Guideline 2.1 treats a visible control
  that only explains itself as an unfinished app.
- Do not use `hideSiteHeader` on its own. It removes the navy logo bar **and**
  the search field that lives in it, and Browse without search over 2,995 lots
  is a worse screen than Browse with one extra logo. Tried on device; reverted.
