# Scan flow — what the web has that mobile does not

Audited 2026-09-17 against `nextjs-port`. One line each. Status is what mobile
has **today**, not what is planned.

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
