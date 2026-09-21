# v2 status — what still needs attention

**Rewritten 2026-09-21.** The previous version was observed on device
2026-09-16 and had gone false in load-bearing ways: it stated the v2 flag was
"unset everywhere including `.env`" (it is now `EXPO_PUBLIC_V2_UI=1`) and that
`app/index.tsx` still redirects to the old home (it calls `homeRoute()`). The
old text is in git — `docs(v2)` on `feat/v2-ui`.

Route list, the door, and the count of controls that explain themselves are
asserted by [`v2Inventory.test.ts`](../../src/__tests__/v2Inventory.test.ts),
not here. What follows is what a grep cannot know.

## Progress

Worked top-down. Each item carries a **Status** line; only these four values are
used, and "DONE" is reserved for something seen working, not something written.

| | meaning |
|---|---|
| 🔴 **BLOCKED** | cannot proceed without someone else — says who, and on what |
| 🟡 **OPEN** | actionable, not started |
| 🔵 **BUILT** | code written and tested, **not yet proven on a real surface** |
| ✅ **DONE** | observed working, with where and when |

| # | item | status |
|---|---|---|
| 1 | Detected items — endpoints 404 | 🔴 BLOCKED |
| 2 | Analyzing (7a) orphaned | 🔴 BLOCKED |
| 3 | Drafts 403 vs 401 on device | 🔵 BUILT 2026-09-21 |
| 4 | Publish never pressed | 🔴 BLOCKED |
| 5 | Multi-item dead-end | 🔴 BLOCKED |
| 6 | Item states half settable | 🔴 BLOCKED |
| 7 | Fields carried, not shown | 🟡 OPEN |
| 8 | Old-UI chrome inside v2 | 🟡 OPEN |
| 9 | No success screen | 🔴 BLOCKED |
| 10 | Remaining deferred writes | 🟡 OPEN |
| 11 | Extract lane degrades cleanly | ✅ DONE 2026-09-21 |
| 12 | Browse lots show no photographs | 🟡 OPEN — cause not established |
| 13 | Wishlist IDOR (unscheduled) | 🟡 OPEN |

**Guest surfaces swept on device 2026-09-21** (RMX2151, signed out). Eight
controls pressed, each photographed: the bell and "or type the details" both
gate; the Buying pane, Browse, the assistant, Matches, Messages and the language
sheet all render. Nothing dead, nothing trapping a guest.

⚠️ **Six of eleven are blocked on a person, not on work** — five of those on one
thing: the dev checkout has no `draftItemsController.js` and no
`SCANV2_REVIEW_SCALE`. Unblocking that single server clears §1, §5, §6, and most
of §2.

## Every v2 screen is dynamic. Two have never been seen working.

No v2 screen renders mock data. `lot.tsx` and `bid.tsx` were the last two and
were deleted on 2026-09-17 — both rendered `MOCK_LOT`, nothing navigated to
either, and bidding already works inside the Browse WebView.

"Dynamic" is not "working", and these are the gaps.

---

## 1 · Detected items — wired to endpoints that answer 404

`app/v2/scan/items.tsx` makes real calls. Everything ever verified about it used
a **stubbed** response, so nothing is known about its behaviour on real rows.

⚠️ **Two causes, and fixing either alone changes nothing** (checked on the
server 2026-09-17):

- `/www/wwwroot/greenbidz-test-backend` has no `controller/draftItemsController.js`
  on disk. HEAD is `5183056`, two local-only commits past its own `origin/dev`,
  with eight modified files uncommitted — so the pull is a judgement call, not a
  one-liner.
- `SCANV2_REVIEW_SCALE` is absent from its `.env`. The routes 404 **by design**
  without it (`draftRoutes.js:28`, compared as the exact lowercased string
  `"true"` at `draftItemsController.js:75`).

**Why this one deserves suspicion rather than patience:** reading the backend on
2026-09-17 found **four** contract errors in the client, all of which had passing
unit tests — wrong default filter, wrong paging params, wrong method for
accept/discard, wrong bulk path. A mock agrees with whatever it is told. Treat
this screen as unverified until it has listed a real draft.

## 2 · Analyzing (7a) — built, reachable by nobody

Tails a real recognition job and renders its five phases. Nothing navigates to
it. `camera.tsx:232` explains why in detail: 7a only WATCHES a run, and starting
one is a deferred write, so routing there today lands on "No scan running".

The document lane currently reports progress in **chat** instead, even though 7a
has a designed `Reading documents` phase for exactly that.

## 3 · Drafts fail on a real device — 403 vs 401

**Status:** 🔵 BUILT 2026-09-21 — the client-side half is in and tested. **Not
proven on device**: reproducing it needs a session that goes stale, which cannot
be conjured on demand. The backend half is still the proper fix and still open.

`interceptors.ts` now treats a **403 from the drafts router** as a dead session
— clears it and shows the sign-in sheet — alongside the 401 it always handled.

⚠️ **Scoped to that router, deliberately.** A 403 normally means
authenticated-but-not-allowed, and signing someone out for one would be a worse
bug than this. It is safe here because the router's only other 403 ("Missing
actor identity headers") belongs to the system-key path, which this client never
takes, and per-draft ownership yields empty/404 rather than 403. Eight tests pin
the scope, including that `/wp/drafts-report` must NOT match — `/drafts` is a
path segment, not a substring.

When the backend returns 401, the clause here becomes dead and should go.

⚠️ **Update 2026-09-21, after a cold start: the device had NO valid session at
all.** Force-stopping and relaunching the app dropped Home to its GUEST state —
the seller banner, no DRAFTS section, no LIVE LISTINGS. So the earlier screen
was a profile surviving in memory while the stored credentials were absent or
dead.

That makes the 403-vs-401 mismatch worse, not moot. It is what let a session
with no usable token keep rendering a signed-in Home: the ONE request that
verifies the token failed in a way the app does not recognise as an auth
failure, so nothing cleared the phantom session. The seller sees "your drafts
did not load" when the truth is "you are not signed in".

It also confirms the client-side fix would behave correctly — a 403 here should
clear the session and show the sign-in sheet.

Observed on the phone 2026-09-21, with the session that ships in the installed
build:

```
[listDrafts] failed 403 {"success":false,"message":"Missing or invalid x-drafts-key or seller token"}
```

The chain:

1. `draftAuthGuard` (`routes/draftRoutes.js:83`) answers an unverifiable token
   with **403**.
2. The app's response interceptor reacts only to **401**
   (`src/api/interceptors.ts:27`).
3. So an aged session never triggers the sign-out/refresh path. Home shows *"Your
   drafts did not load"* and **"Try again" can never succeed** — every retry
   re-sends the same dead token.

⚠️ **Why the screen looks healthy anyway, and why that is the trap.** Live
listings render from `batchRouter.get("/seller/:sellerId")`, which has **no
`protect` middleware** — it loads with no valid token at all. `/drafts` is the
only thing on Home that actually verifies the session, so 90% of the screen
working says nothing about auth. That misdirection cost real time before the log
above existed.

**Decision needed** (see [DECISIONS.md](DECISIONS.md)): the semantically correct
fix is the backend returning **401** for "no valid credentials" — 401 is
unauthenticated, 403 is authenticated-but-not-allowed, and the system-key
branch's "missing actor headers" is a genuine 403 that would stay. That touches a
shared route. The narrow alternative is the client treating a 403 from `/drafts`
as an auth failure, which papers over a wrong status code and will recur on the
next route behind this guard.

## 4 · Publish — wired, gated, never pressed

`usePublishDraft` carries both submit endpoints and both gates. It has never
run: the press creates a real listing in the staging review queue and is waiting
on an explicit go.

Save-as-draft, by contrast, **is** proven — `201 POST /drafts`, driven from the
real control.

## 5 · Multi-item drafts dead-end at accept/discard

There is no route from a detected-items row into the four review steps. A seller
can accept or discard and nothing else.

This also blocks **WEB-PARITY #4**, the conditional spine: a batch spine cannot
number a journey nobody can walk. The work is a data problem, not chrome —
review reads the local `useScanDraft` store while the items screen reads server
rows, and per-item edits would need `PATCH …/items/:id` with
`expected_row_version`. All of those endpoints are behind §1.

## 6 · Item states — half settable

`needs_review · accepted · discarded` can be set. `high_value` and `scrap` are
counted but not settable. They are **`value_tier` values, not statuses** — an
item can be `accepted` and `high_value` at once, which the original single-enum
model made impossible to express.

## 7 · Fields carried but not shown

Mobile holds 29 of the backend DTO's 30 item fields (`route` is the deliberate
omission). Not rendered:

- `brand` / `model` — on purpose: the extract writes both into the title, so a
  second copy spends a line on words already on screen.
- `demand_score` / `sell_weeks` / `heat_tier` — the web shows these as chips on
  its valuation view; mobile has no equivalent surface yet.
- `ask` / `min_bid` — the web's inline price editor, a write path mobile does
  not have. **Not a totals bug**: `ScanV2ValuationStep` never reads them either.

## 8 · Old-UI chrome mounted inside v2

Working controls in the wrong tokens, each marked `TODO(v2-design)`. The
compromise is deliberate — a working control in mixed chrome beats a v2-pure
dead end — but it is visible to a user:

| screen | borrowed |
|---|---|
| Review · Location | the shipped `CountryPicker` |
| Review · Details | the shipped `CategoryPickerSheet` |
| Review · Photos | the shipped reorder-photos screen |
| Camera | hands off to the shipped processing screen |

## 9 · No success screen

A published listing lands on `/v2` with a toast. The canvas has no artboard past
7e, so a 7f would be a new design rather than a copy. Routing to the shipped
success screen would drop the seller into old chrome at the most triumphant
moment — the complaint that has been raised repeatedly.

Landing on Home is honest but thin: it loses the batch number.

## 10 · Remaining deferred writes

Everything a seller can press in the scan flow now writes. What is left:

- `matches.tsx:616` — no composer.
- `analyzing.tsx:662,673` — "Continue in background" and Cancel do the local
  half only; the server halves are `POST /recognition-jobs/:id/detach` and a
  cancel call.
- `ChatCards.tsx:118` — **bigger than the TODO says.** The line reads "replace
  with a real save-this-as-a-want action", which sounds like one button. In fact
  v2's card dispatcher handles only `product_list` and `product`; a `wtb_draft`
  frame falls to the default and renders *"This answer included a 'wtb_draft'
  card, which v2 does not draw yet."*

  So the whole save-a-want flow is absent from v2, and `CHATBOT_RULES` makes it
  mandatory: a no-match must LEAD with the save-a-want offer. The shipped
  `LabWtbDraftCard` (`features/lab/chat/cards.tsx:1355`) is the thing to port —
  ~200 lines carrying condition chips, budget tiers seeded from preview prices,
  quantity, and the post-save pending-approval state.

  ⚠️ Do NOT "fix" this by building a want out of the search string. The card is
  driven by a STRUCTURED draft the assistant emits; a want invented from a
  free-text query arrives with no category or condition, which is precisely the
  shape the WTB data-quality review found unusable.
- `BuyingPane.tsx:326,355` — match detail's bid/contact-seller, and create.

## 11 · The extract lane degrades cleanly — ✅ DONE 2026-09-21

**Status:** ✅ DONE. Closed by DELETING the thing this item asked to wire.

`isExtractLaneAvailable()` probed `/gcs/resumable/create` with an empty body so
a caller could "fall back rather than uploading megabytes into a route that does
not exist". Reading it showed wiring it would have been the wrong fix:

- It bought nothing for the megabytes. `runExtractLane` uploads at **step 2**,
  after the server has already answered `create`. A 404 costs one small request
  either way.
- It doubled requests on the happy path — probe plus real call — to improve the
  wording of a case that is already failing.
- Two calls can disagree; a deploy landing between them makes the probe stale,
  and the real request is the only authority.

The actual gap was narrower than the item claimed. The **flag-off** case already
said "The document lane is not enabled on this server." Only a **404** fell
through, as axios' "Request failed with status code 404" — a sentence about HTTP
shown mid-upload. `runExtractLane` now maps that 404 to the same sentence, at
the call that actually happens.

Four tests pin it, including that a 500 must NOT be reported as "not enabled"
(that is the server broken, not the feature absent — telling a seller otherwise
sends them to the wrong person) and that exactly one request is made.

⚠️ Still unproven against a backend that genuinely lacks the routes; the tests
mock the 404. Cheap to confirm once §1's server question is answered.

## 12 · Browse shows lots without photographs — observed, cause NOT established

**Status:** 🟡 OPEN, and deliberately undiagnosed.

Pressed on the handset 2026-09-21, signed out. Browse loads the real
marketplace — *"3670 results open for bidding"*, lots #7430 and #7427, LIVE
badges, Filters, View — but every visible lot card renders the grey placeholder
instead of a photograph, through two screens of scrolling.

What IS established:

- The web app serves images. The same page, signed out, loaded 10/10 images on
  desktop and again at phone width with a phone user-agent — **0 broken, 0
  failed responses** — including real lot photos from `storage.googleapis.com`
  and `ttinstruments.com`.
- It is not DNS. The handset pings `storage.googleapis.com` (20ms),
  `www.ttinstruments.com`, `101lab.co` and `testapi.greenbidz.com` successfully.
- It is not our WebView config. `MarketplaceWebView` sets no image-related
  props — no `blockNetworkImage`, no `loadsImagesAutomatically={false}`.

What is NOT established, and must not be guessed at: whether those particular
lots simply have no photograph. The phone and the desktop were showing
DIFFERENT lots, which alone could explain everything.

⚠️ I tried to settle it with a per-card DOM probe pairing each lot id to its
image, and the probe was unreliable — it attributed four images to one lot
because the parent climb lands on a shared container, and 4 of 10 images had
not finished decoding when it measured, which is not the same as broken.
Reporting a cause from that would have been inventing one.

**The next step is one query, not more probing:** ask the database whether lots
7430 and 7427 have images. If they do not, this row closes as data.

## 13 · Unscheduled

- [SECURITY-WISHLIST.md](SECURITY-WISHLIST.md) — a live unauthenticated API this
  UI must not call. Still open.

---

## Health

- 146 suites / 1451 tests green; `tsc` and eslint clean.
- Branch `feat/v2-ui`, 7 commits, **not pushed**.
- Running on device (RMX2151) against staging, bundle served in 2.6s.
