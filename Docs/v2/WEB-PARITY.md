# Scan flow — what the web has that mobile does not

Audited 2026-09-17 against `nextjs-port`. One line each. Status is what mobile
has **today**, not what is planned.

---

## ⚠️ RE-AUDIT 2026-09-22 — read this before the 09-17 text below

Three of this document's load-bearing facts have changed or were wrong. The
09-17 body is kept because its reasoning is still useful, but where the two
disagree, this section wins.

### 1. Mobile is NOT missing two steps. The web's Route and Inspection default OFF.

The 09-17 summary says a web batch walks six steps
(`Intake · Detected · Valuation · Route · Inspection · Review`) against mobile's
four. That is the spine with every flag on. Read from `ScanV2FlowPage.tsx`:

| Flag | Source | Default |
|---|---|---|
| `SCANV2_ROUTE_STEP_ENABLED = SCANV2_SCRAP_LOT_ENABLED` | `:313`, `:260` — `NEXT_PUBLIC_SCANV2_SCRAP_LOT === "true"` | **OFF** |
| `SCANV2_INSPECTION_STEP_ENABLED = SCANV2_SCRAP_LOT_ENABLED && SCANV2_INSPECTION_ENABLED` | `:281-282`, `:270-271` | **OFF** |
| `SCANV2_VALUATION_ENABLED` | `:293-294` — `!== "false"` | ON |
| `SCANV2_SUBMIT_STEP_ENABLED` | `:256-257` — `!== "false"` | ON |

So the web's **default batch spine is four steps** — `Intake · Detected ·
Valuation · Review` — which is exactly mobile's `capture · items · valuation ·
review`. **The decision to drop Route and Inspection did not diverge from the
web; it matches the web's default configuration.** They are scrap-lot
composition, behind a flag that is off.

`"skipped"`, the 4th step state mobile omits, is only ever applied to those same
two steps, and only when the seller picks "sell as product" over "scrap lot"
(`scanV2SkippedSteps`, `:2981-2989`). With both steps absent there is nothing to
skip — mobile's `V2StepState` of three values is correct, not a shortfall.

### 2. The single-item predicate matches, and it is count-only.

Web: `isSingleItemReview(counts) => Number(counts?.total) === 1`
(`utils/scanv2SingleItem.ts:43-45`) — `total`, not `accepted`, and `undefined`
is false so a 17-item lot never flashes the single screen. Mobile's
`v2SpineForDraft(itemCount)` is the same axis, and its third shape (`null` ⇒
empty spine, no denominator) is the honest extra mobile needs because capture
and analyzing run before anything has been counted.

### 3. The 09-17 server blocker is GONE — and #4 is no longer blocked on it.

Re-measured on `greenbidz-gcp`: `controller/draftItemsController.js` is on disk
(53,325 bytes, `Sep 17 14:16` — fixed hours after this doc was written),
`SCANV2_REVIEW_SCALE=true`, routes mounted at `routes/draftRoutes.js:139-144`,
and `greenbidz-test-backend` restarted `2026-09-21T13:53Z`, after the controller
landed. **Ten tasks sat behind a blocker that stopped existing the same
afternoon.** Detail in `todo/SCANV2_V2UI_14_ITEM_ROUTE.md`.

### 4. Two things the 09-17 text does not know

- **The web's Scan V2 is not in production.** `ScanV2FlowPage` is mounted only
  at the unguarded dev route `app/scanv2-flow/page.tsx:13-19`; the production
  `/dashboard/new-submission-upload` was reverted to the legacy flow
  (`app/(seller)/dashboard/new-submission-upload/page.tsx:21-29`). "Parity with
  the web" means parity with a dev-route flow. There are also stale duplicate
  copies of the spine under `src/scanflow/...` and `src/valuation/...` — do not
  port from those.
- **The web seller flow has no guest concept at all.** It is entry-gated by
  `ProtectedRoute` (`app/(seller)/layout.tsx:7`), and `grep -ci guest` over the
  whole flow directory returns zero. ⚠️ This does **not** license changing
  mobile: mobile's guest-first scan is required by App Review 5.1.1(v) (the
  1.0.3 (21) rejection) and the web's *valuation* flow is separately
  guest-capable (`src/lib/guestValuationRecord.ts`). Where mobile comments claim
  they are "matching `nextjs-port`'s gate-at-publish", they mean the valuation
  flow, not this one. Leave mobile's behaviour alone.

### 5. THE STRUCTURAL DIFFERENCE — why the web has no orphaned screens and mobile has three

This is the most useful thing in the comparison and the 09-17 audit missed it entirely, because it
compared screen-for-screen rather than comparing the *shape*.

**The web's whole flow is ONE PAGE with internal state.** `ScanV2FlowPage.tsx:613` holds
`const [step, setStep] = useState<UploadFlowStep>("empty")` plus a second machine `submitStage`, and
every transition is `setStep(...)` / `setSubmitStage(...)`. `grep -c 'router.push|router.replace'`
over that 3,400-line file returns **1**. There is essentially no navigation in the flow at all.

**Mobile split the same flow into ~10 expo-router routes.** Every transition is a `router.push`.

That difference is the entire reason for §2A of the work order:

| | Web | Mobile |
|---|---|---|
| A "screen" is | a render branch of one component | a route file |
| Reachability is | **guaranteed** — if its condition can be true, it renders | **manual** — something must `router.push` it |
| An unreachable screen is | impossible by construction | what happened three times (`analyzing.tsx`, and `items`/`review` outside the resume lane) |
| Passing state along is | already in scope | a param, a store write, or a mapper between two types named `DraftItem` |

So mobile did not merely "not finish the wiring" — it adopted a structure where the wiring is a
separate, forgettable step, and then forgot it. Worth knowing before W1–W6: the work is not
"translate the web's steps", it is "supply the connective tissue the web never needed".

### 6. ONE DOOR vs TWO — the answer to "photos, Excel, CSV, PDF"

**The web has a single intake that takes all of them.** `ScanV2Intake.tsx:93-98`:

```
accept="image/*,application/pdf,…spreadsheetml.sheet,text/csv,application/csv,.docx,.xlsx,.xls,.pptx,.csv"
```

One drop zone; the lane is chosen *after* the file is known — its own docblock: *"PDFs go through
the AI scan lane, spreadsheets through the structured-map lane."* It also accepts a **pasted**
spreadsheet and turns it into a real CSV (`utils/scanv2PasteIntake.ts`).

**Mobile has two doors, and neither is that one:**

- The scan flow is **camera-only**. There is no file picker in it.
- PDFs, spreadsheets and CSVs arrive **only through chat** (`app/v2/chat.tsx:1019` →
  `picker.pickDocument()` → `runExtractLane`), which writes a server draft that surfaces later in
  the drafts list.

So a seller with a supplier spreadsheet has to know to open the **assistant** rather than press
**Scan it** — and nothing on the Home screen says so. That is not a missing screen (§4.9's
`documents.tsx`); it is a missing **door**, and it is why W6 is "decide the entry" rather than
"build the screen".

### So what is actually left

| Web step (default flags) | Mobile today |
|---|---|
| Intake | ✅ `capture` + `analyzing` |
| Detected items | ✅ `items.tsx` |
| Valuation | 🟡 decision layer built (`valuationSummary` + `valuationView`); **no screen** |
| Review | 🟡 four sub-steps exist; **spine not wired**, still renders `Step n of 4` |
| Route / Inspection | ✅ correctly absent — off by default on the web too |
| Review item (single) | 🟡 in the spine, not wired |

Three pieces of work, not six: **the items→review route** (task 14, built
2026-09-22 — `src/features/v2/scan/openDetectedItem.ts`), **wiring `spine.ts`
into `reviewKit.StepHeader`** (task 03 / D4), and **the Valuation screen**
(task 12).

## The difference in one sentence

The web builds its step spine from the draft: a **batch** walks
`Intake · Detected items · Valuation · Route · Inspection · Review`, a
**single item** walks `Intake · Review item`
(`scanv2Steps.ts`). Mobile has one fixed spine — `Photos · Details · Pricing ·
Location` — and `useReviewItem()` reads **one** item.

So mobile's four steps ≈ the web's *single-item* review. Everything multi-item
is missing.

## Features to copy

| # | Feature | What it is | Mobile today |
|---|---|---|---|
| 1 | **Detected items grid** | N-row list; accept / discard each row | ✅ **built** — `app/v2/scan/items.tsx` |
| 2 | **Item states** | `needs_review · accepted · discarded · high_value · scrap` | 🟡 **partial** — all five COUNTED, only accept/discard settable |
| 3 | **Valuation step** | totals across items | ✅ **built** — `features/v2/scan/valuationSummary.ts`, derived from the rows, no extra request |
| 4 | **Conditional spine** | steps and numbering built from item count + flags; never "Step 4 of 3" | ❌ fixed 4 — **blocked**, see below |
| 5 | **ScanV2 draft shape** | open a draft created by the web/extract lane | ✅ **built** — 4th shape in `useResumeDraft`, keyed on item count |
| 6 | **Durable extract lane** | office doc → job → draft | ✅ **built** — `services/scanner/extractLane.ts` |

All of the above landed 2026-09-17.

### What was driven in a browser, 2026-09-17

Signed in as the test seller against `testapi` (the staging backend), web build
on `:8082`, mobile viewport.

| Step | Result |
|---|---|
| Sign in → lands on `/v2` | ✅ the v2 home, not the old one |
| v2 Home lists the document drafts | ✅ both `AI draft · 18 items` rows |
| Tap a row → `/v2/scan/items?draftId=247&count=18` | ✅ `openMultiItemDraft` fires; the old "Could not open this draft" is gone |
| `GET /drafts/247` | ✅ 200 — the draft exists |
| `GET /drafts/247/items`, `…/items/counts` | ❌ **404** — measured, not assumed |
| Items screen with rows (stubbed shape) | ✅ counts strip, totals, `(guess)` marker, accept/discard all render |
| Press **Accept** | ❌ → ✅ **fixed today.** The `PATCH` 404'd and the screen said nothing; it now shows "That change was not saved" and a `Saving…` state |

⚠️ **#1, #2 and #3 are still unverified against REAL rows.** The list above used
a stubbed response shaped by `draftItemsApi.ts` — short titles, every field
populated. It proves the screen draws; it proves nothing about real data.

### Why `testapi` 404s — two causes, both checked on the server

Measured 2026-09-17 on `/www/wwwroot/greenbidz-test-backend`:

1. **The checkout predates the routes.** No `controller/draftItemsController.js`
   on disk. HEAD is `5183056` (2026-09-16), two local-only commits past its own
   `origin/dev`, with eight modified files uncommitted. The routes *are* merged
   on GitHub (`dev` = `f25b6db`, and `main`), so a pull would bring them — but
   that checkout is dirty and diverged, so the pull is a judgement call, not a
   one-liner.
2. **The flag is unset.** `SCANV2_REVIEW_SCALE` is absent from its `.env`.
   `draftItemsController.js:75` compares it to the exact lowercased string
   `"true"`, and `draftRoutes.js:28` mounts the routes behind it, so they 404 by
   design until it is set.

Fixing either alone changes nothing.

## Field map — every field the list DTO returns

Ground truth is `helper/draftItemsQuery.js:975-1053` (`toItemDTO`), **30 fields**.
Mobile's `DraftItem` carries 19. Audited 2026-09-17 against the web's
`ScanV2ReviewGrid` / `ScanV2ValuationStep`.

| Field | Mobile | Where the web uses it |
|---|---|---|
| `id` `seq` `status` `title` | ✅ | row identity + accept/discard |
| `price` `currency` | ✅ | grid price cell, asking total |
| `fmv_used` `scrap_value` | ✅ | valuation bands |
| `category_name` `category_resolved` | ✅ | category cell + guess marker |
| `grade` `value_tier` `heat_tier` | ✅ typed | valuation chips — **mobile renders only `grade`** |
| `marketplace` `lot_group_id` | ✅ typed, unrendered | lot grouping, marketplace label |
| `thumbnail_object` | ✅ typed, unrendered | row thumbnail — **mobile shows no image** |
| `identification_confidence` | ✅ typed, unrendered | confidence-first sort (the grid's default) |
| `needs_clearer_photo` | ✅ typed, unrendered | flags rows whose photo is too poor to price |
| `row_version` | ✅ (added today) | optimistic concurrency for per-row edits |
| `year` `condition` `location` `qty` | ✅ **rendered** | grid columns — mobile shows them on the row's spec line |
| `brand` `model` | ✅ typed, unrendered | grid columns. The extract writes both into the title, so repeating them spends a line on words already on screen |
| `demand_score` `sell_weeks` | ✅ typed, unrendered | market-metrics chips on the valuation view |
| `ask` `min_bid` | ✅ typed, unrendered | the grid's inline price editor (a write path mobile does not have) |
| `route` | ❌ **deliberate** | the Route step, dropped from mobile scope |

Mobile now carries **29 of 30** fields; only `route` is deliberately absent.

### The row, after copying the fields across

```
[thumb]  Waters Alliance e2695 HPLC with 2489 UV/Vis detector
         USD 14,000 · ×3 · Grade A                      ← money
         Used — functional · 2019 · Taipei, TW · Liquid Chromatography
         Needs a clearer photo — the price may be unreliable
                                          Discard   Accept
```

Three decisions worth recording:

- **`qty` is on the money line, not the spec line.** A row of ten reading
  identically to a row of one is the most expensive thing this screen could get
  wrong. Shown only above 1 — `qty: null` means "none recorded", which is 1.
- **`condition` is labelled, never printed.** It arrives as a stored key
  (`"usedFunctional"`) and goes through `CONDITION_LABELS`; an unrecognised key
  is dropped rather than shown raw. Same rule the web states.
- **The actions moved out of `trailing`.** "Discard Accept" took ~120pt of a
  390pt row and `Row` truncates subtitle and meta to one line each, so the spec
  line rendered `Used — functional · 201…` — clipping away the very fields this
  change added. They now sit under the row, right-aligned.

`Row` gained an additive `meta` third line for this (kit rule: add the
primitive, don't inline it). `undefined` keeps every existing caller identical.

**`ask`/`min_bid` are not a totals bug.** I assumed they were and checked:
`ScanV2ValuationStep` never reads them — `factsFromRow` uses `row.price`
(`scanv2Valuation.ts:556`), so mobile's totals already match the web. They
matter only when mobile gains per-row price editing.

### Three logic divergences, found by this comparison and fixed

1. **Mixed-currency was computed over all rows, not priced rows.** One unpriced
   row carrying a stray currency nulled the whole total and told the seller
   their prices were in more than one currency — an assertion about prices that
   do not exist. The web had already fixed exactly this
   (`scanv2Valuation.ts:845-851`); we now match.
2. **A zero price counted as a price.** It added 0 to the total *and* escaped
   the "no price yet" count, hiding itself twice. The web filters `price > 0`.
3. **`category_resolved` is three-valued.** `deriveCategoryResolved` returns
   `null` when the taxonomy for that marketplace is unavailable. Typed as
   `boolean`, null was falsy, so an unchecked category rendered as "(guess)" —
   accusing the AI of guessing when the server had simply not looked.

### Display gaps (no data is wrong, less is shown)

Mobile's row is `title` + `price · category · grade`. The web's grid shows
brand, model, year, condition, location and qty as sortable, inline-editable
columns, plus a thumbnail and a confidence-driven triage tab bar. Mobile shows
no image and offers no filter. None of this is broken — it is a smaller screen
doing less — but `qty` is the one worth revisiting: an item with qty 10 looks
identical to one with qty 1.

### The client was wrong in four ways (fixed 2026-09-17)

Found by finally reading the backend rather than inferring it. None was visible
to the unit tests, which mocked the server and so agreed with the mistake:

| What | Was | Is |
|---|---|---|
| List filter | omitted → server default `needs_review` | `filter=all` |
| Paging | `limit` / `offset` (ignored) | `pageSize` (≤100) + `cursor` |
| Accept / discard | `PATCH /items/:id` | `POST /items:bulk`, `{op, select:{item_ids}}` |
| Bulk path | `items:bulkAction` (the registered name) | `items:bulk` (the literal the controller enforces) |

Also corrected: `high_value` and `scrap` are `value_tier` values, not statuses —
an item can be `accepted` **and** `high_value`, which the old single enum made
impossible to express.

Two things fixed as a result: the silent write failure above, and the query
retry — opening the screen fired **4** requests because React Query retries a
404 three times; now **1** per endpoint, both measured in the same harness.

*(Corrected 2026-09-17. These first read 8 → 2. The harness had a stale
`page.on('response')` logger alongside its route logger, so every request was
recorded twice and every count was double the truth. The ratio was right; the
figures were not.)*

**Not porting:** Route (scrap-lot composition) and Inspection. Decided
2026-09-17 — out of scope for mobile. A scrap lot is composed on the web.

### Why #4 is blocked, and on what

Two designs were considered and both are wrong **today**:

1. **Drop the Photos step when the draft has no photos.** Rejected and reverted
   the same day. `requiredStatus.ts:103` — `allComplete = rows.photos &&
   parsed.success` — makes photos a hard submit requirement, so hiding the step
   removes the only route to the screen that clears the block while Submit goes
   on refusing. Logged in `MISTAKES.md` 2026-09-17.
2. **Number the spine from item count, as the web does.** This is the right
   axis, and the blocker is a missing link: `app/v2/scan/items.tsx` lets a
   seller accept or discard a row and nothing more — there is **no route from a
   detected item into the four review steps**. A batch spine would number a
   journey nobody can walk.

**What unblocks it:** a route from a detected-items row into the per-item
review. That is a data problem, not a chrome problem — the review flow reads
the local `useScanDraft` store (`DraftItem` from `scanDraftStore`), while the
items screen reads server rows (`DraftItem` from `draftItemsApi`, a different
type of the same name). Opening a row means mapping one to the other and
setting it as `current`. Once that exists the spine is `Detected items ·
Photos · Details · Pricing · Location` for a batch and four steps for a single
item, and the numbering is real.

## What mobile already matches

Canvas 7a–7e are implemented element-for-element — checked string by string:
step chrome, marketplace best-guess (101LAB/101MACHINE/101IT), title and
description counters, PROFIT INTELLIGENCE, scrap baseline, currency,
Installed/Deinstalled, Ready to ship. Camera is missing only the **Auto** mode.

## The honest position

Mobile now handles **both**: a single item walks 7b–7e, a multi-item draft opens
the detected-items list with totals. What it still does not have is the web's
**conditional spine** (#4) — mobile shows a fixed four steps regardless of what
the draft holds, so the step chrome can describe a journey the seller is not on.

What a seller can do to a row on mobile is **accept or discard**. Editing a
title or price, and marking `high_value`/`scrap`, stay on the web.

*(Superseded 2026-09-17. This section previously read "a multi-item draft has no
screen, which is why opening one fails" — true until #1/#3/#5 landed.)*

## Two orphans, unrelated to parity

- Nothing navigates to **7a Analyzing** (`camera.tsx:232` says so).
- The document lane reports progress in **chat**, but 7a already has the
  designed UI for it — including a `Reading documents` phase
  (`analyzing.tsx:143`).

---

# Whole-app comparison: nextjs-port (101lab.co) vs the mobile app

Added 2026-09-23. **Everything above this line is about the SCAN FLOW only** —
that was the question when this file was started. This section is the wider
one: what a person can do on the web that they cannot do on mobile.

Counted from the route trees, not from memory: `nextjs-port` has **119**
`page.tsx` routes (44 under `(seller)/dashboard`, 13 under `(buyerdash)`, 4
under `(buyerplain)`, the rest public/content); the mobile app has **22** v2
routes plus ~35 on the older `(lab)` UI.

## The one structural fact that decides most of this

**Mobile does not re-implement browsing — it embeds the web.**
`MarketplaceWebView` loads 101lab.co inside the app, and `navPolicy.ts` keeps
*every* `101lab.co` / `greenbidz.com` URL inside the WebView (only other hosts
— maps, mailto:, payment redirects — bounce to the system browser). So a web
page is reachable on mobile **if the marketplace links to it**.

That gives three states, and they are not the same thing:

| | meaning |
|---|---|
| **Native** | built with the v2 kit, works offline-ish, follows the design |
| **Embedded** | the real web page inside the app's WebView — it works, but it is web chrome in a native app, and nobody has checked it at phone width |
| **Absent** | no route links there from the marketplace, so there is no way in |

⚠️ I verified the navigation POLICY permits these hosts. I did **not** click
through to each page from the mobile marketplace, so "Embedded" below means
"permitted and linked from the site", not "verified on the phone".

## Native on mobile

Auth (email + password, register with 6-digit code, password reset) · AI scan →
detect → review (photos / details / pricing / location) → valuation step →
publish · drafts · the seller's own listings · wants and matches · messages ·
the AI assistant chat · account and settings · notifications · delete account.

## What the web has and mobile does not

| Cluster | Web routes | On mobile |
|---|---|---|
| **Seller dashboard** — orders, offers, bids, shipments, submissions, products, reports, sales-sync, storefront, buyer-activity, auction/batch groups, auto-approval | 44 routes under `(seller)/dashboard` | **Absent natively.** The app has no orders, offers, bids or shipments screen at all. |
| **Seller org** — team, users, permissions, invitations, seller-network, company-organization | part of the 44 | **Absent.** No way to manage a team or invite anyone from the phone. |
| **Buyer dashboard** — watchlist, bids, winning-bids, order history, buy-now orders, inspections, shipments | 13 routes under `(buyerdash)` | **Absent natively.** Mobile's Buying pane is "Your wants" + "Matched for you" only. |
| **Checkout** — `/buyer/checkout`, `/buyer/checkout/[batchId]`, `(seller)/checkout` | 4 routes under `(buyerplain)` + 2 | **Embedded at best.** Nothing native; a payment redirect leaves the WebView to the system browser by policy. |
| **Bulk upload / manual listing** — `/dashboard/bulk-upload`, `/dashboard/new-listing`, `/sell/manual`, `/new-submission-upload` | 4 | **Absent.** Mobile creates listings one way only: the camera. See § "ONE DOOR vs TWO" above. |
| **Standalone valuation** — `/valuation`, `/valuation/submitted`, `/inspection-report` | 3 | **Absent as a flow.** Mobile has a valuation STEP inside scan (`/v2/scan/valuation`), which is a different thing: the web one is a lead-gen entry point for someone who has not signed up. |
| **Google sign-in** — `/auth/google-callback`, `/complete-google-profile` | 2 | **Absent.** Mobile auth is email + password only; no `GoogleSignin` anywhere in the app. |
| **Become a seller** — `/become-seller`, `/account-pending`, `/pending-permission` | 3 | Partial: mobile has `(auth)/pending` and `(lab)/sell/apply`. ⚠️ `sell/apply` carries an App Review note — read the top of that file before touching it. |
| **Content** — about, blog + `[slug]`, faq, how-it-works, resellers, factories, direct-sales, shipping, legal pages | ~12 | **Absent natively**, embedded if linked. No blog or FAQ in the app. |
| **Token entry points** — `/r/[token]` (referral), `/draft/preview/[token]`, `/sourced/[key]`, `/unsubscribe` | 4 | **Absent.** These are email-link destinations; on a phone they open the browser, not the app — no deep-link handler for them. |

## What mobile has that the web does not

- The **camera-first create flow** as the primary path, with on-device capture,
  reorder, and the multi-item split. The web's `/sell/ai` is the same engine
  behind a file picker.
- **Push notifications** (OneSignal).
- The **v2 design system** — the web is still on the older look.

## Reading this before acting

The gap is not 97 routes of work. Most of those 44 dashboard routes are one
feature each for a seller who is at a desk, and the honest question is which of
them someone would do *on a phone*. The three that look phone-shaped from here:
**orders/shipments status**, **bids and offers on your listings** (both are
"tell me what happened while I was away" — which is what notifications already
half-solve), and **watchlist**. Everything in the org/reports/sales-sync group
reads as desk work.

None of this is a recommendation yet — it is the map. Deciding what to build
needs the usage data, which is not in this repo.
