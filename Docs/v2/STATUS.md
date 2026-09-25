# v2 status — what still needs attention

**Rewritten 2026-09-21.** The previous version was observed on device
2026-09-16 and had gone false in load-bearing ways: it stated the v2 flag was
"unset everywhere including `.env`" (it is now `EXPO_PUBLIC_V2_UI=1`) and that
`app/index.tsx` still redirects to the old home (it calls `homeRoute()`). The
old text is in git — `docs(v2)` on `feat/v2-ui`.

Route list, the door, and the count of controls that explain themselves are
asserted by [`v2Inventory.test.ts`](../../src/__tests__/v2Inventory.test.ts),
not here. What follows is what a grep cannot know.

**Handing this to a tester?** [QA-PLAN.md](QA-PLAN.md) is the manual pass — four
passes, a 17-screen coverage matrix, and a do-not-file list built from the
blocked items below, so nobody re-reports a known 404.

## Progress

Worked top-down. Each item carries a **Status** line, and "DONE" is reserved for
something seen working, not something written.

| | meaning |
|---|---|
| 🔴 **BLOCKED** | cannot proceed without someone else — says who, and on what |
| 🟡 **OPEN** | actionable, not started |
| 🔵 **BUILT** | code written and tested, **not yet proven on a real surface** |
| ✅ **DONE** | observed working, with where and when |
| 🟢 **ANSWERED** | investigated and found to need no code — says what the answer was |

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
| 12 | Browse lots show no photographs | 🟢 ANSWERED — data, not a bug |
| 13 | Wishlist IDOR (unscheduled) | 🟡 OPEN |

**Guest surfaces swept on device 2026-09-21** (RMX2151, signed out). Eight
controls pressed, each photographed: the bell and "or type the details" both
gate; the Buying pane, Browse, the assistant, Matches, Messages and the language
sheet all render. Nothing dead, nothing trapping a guest.

### QA Pass A — run on device 2026-09-21, **PASS** with four defects

[QA-PLAN.md](QA-PLAN.md) §2 executed in full on RMX2151, signed out. **21
controls pressed, each photographed.**

| | result |
|---|---|
| A1 · guests can look | 8/8 surfaces render, no sign-in wall |
| A2 · guests asked at the right moment | 10/10 gates fire, each with copy naming the reason |
| A3 · the sign-in sheet's own buttons | 3/3 live — sign-in, registration, and the escape |

The 5.1.1(v) rule holds in both directions: nothing is gated at the door, and
nothing lets a guest fill a form before asking.

| # | defect | severity | state |
|---|---|---|---|
| D1 | Chat logged a React error on **every** open | HIGH | ✅ FIXED + verified |
| D2 | Browse: floating "Filters" pill covers a lot's title | MEDIUM | 🟡 OPEN — web side |
| D3 | "Language and currency" is gated for guests | MEDIUM | 🟡 OPEN |
| D4 | Sign-in / registration are old chrome | LOW | 🟡 OPEN — add to §8 |

**D1 — fixed.** `useChatController.ts:63` seeded the conversation store from a
`useState(() => …)` lazy initialiser, which runs in the **render phase**, while
`useConversation` is subscribed on the next line. React answered *"Cannot update
a component (`ChatScreen`) while rendering a different component
(`ChatScreen`)"* on every chat open, and the LogBox banner it raises sits over
the tab bar. Moved to a ref-guarded `useLayoutEffect` — after render, before
paint, so a thread opened with an `initialQuery` still never flashes empty.
Verified on device: chat opens clean, and *"Help me price a used centrifuge"*
streamed back a real reply. 243 chat tests and `tsc` green.

⚠️ This is shipped lab-chat code, not v2-only — the old `/(lab)/chat` screen
uses the same controller and had the same warning.

**D3 is a consistency question, not a missing gate.** A guest CAN change
language from Home's `EN` control — the sheet opens and works — but the
"Language and currency" row on Account raises the sign-in sheet. Same setting,
two answers. Display preferences arguably should not need an account at all.

**D2 belongs to the marketplace page,** not to the app: the pill is the web
page's own floating Filters button, and inside the WebView it lands mid-card
over the lot title rather than at the foot of the viewport.

⚠️ **Six of thirteen are blocked on a person, not on work** — five of those on
one thing: the dev checkout has no `draftItemsController.js` and no
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
- ~~`ChatCards.tsx:118` — the save-a-want card~~ — ✅ **DONE 2026-09-21.**
  `WantDraftCard.tsx` draws `wtb_draft` in v2 chrome: keyword chips, condition
  multi-select with an "Any" that clears, budget field with tiers, quantity, the
  preview-match teaser, and the post-save pending-approval state. Behaviour
  borrowed from `LabWtbDraftCard`; budget maths extracted to
  `features/lab/chat/wantBudget.ts` so both cards share one copy (11 new tests).

  Proven on device: asked for a Bruker Avance III 600 MHz NMR, the card rendered
  with the title, keywords and the £80,000 budget the assistant had extracted;
  pressed a budget chip and the field followed it.

  ⚠️ **Pressing Save as a guest first produced "Couldn't save that want — please
  try again"** — untrue and unactionable, because `POST /wtb` needs an account
  and retrying could never work. That is the "gated too LATE" half of 5.1.1(v).
  Now wrapped in `requireAuth('want', …)`, and the sign-in sheet was seen firing
  with its own reason copy. Worth remembering: the port was faithful to a card
  that only ever ran for signed-in users, so the guest case had no precedent to
  copy — a borrowed implementation carries its original's assumptions.

  ⚠️ Still unproven: the **post-save state**. It needs a signed-in account, and
  saving creates a real staging want.

  Note for whoever reads this next: the assistant does not always emit
  `wtb_draft`. Asked directly as a guest it offered to take a name and email as
  a "guest lead" instead; asking it to *draft* the want produced the card.
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

### Answered 2026-09-21 — almost certainly DATA, not a rendering fault

No database needed: the marketplace's own public endpoint says it.
`GET /api/v1/batch/fetch?page=1&limit=12&lang=en&type=LabGreenbidz` returns each
lot's photos under `firstProductImages`, and for the twelve newest live lots:

| lots | photos |
|---|---|
| #6990 – #6994 (the five newest) | **key absent entirely** |
| #6901 – #6958 | 1, 2, 3, 18, 4, 7, 17 |

So **5 of the 12 newest live lots have no photograph at all**, and the API omits
the field rather than sending an empty list. A grey placeholder is the correct
thing to draw for those — the app is behaving properly, and the web app
demonstrably renders photos whenever they exist (10/10 on desktop, 0 failed
responses).

⚠️ **Not fully closed, and here is the residue.** I could not isolate the two
lots actually seen on the handset: `search=7430` returns nothing and
`batch_number=7430` is ignored (it returns the unfiltered list). So "those
specific lots have no photo" is inference from a strong pattern, not a
measurement of them. Calling it CONFIRMED would be the same overreach as the
DOM probe above.

**Worth raising with the marketplace side either way:** new lots going live with
no photograph is a listing-quality question, not a mobile one. Browse is the
first thing a buyer sees.

## 13 · Unscheduled

- [SECURITY-WISHLIST.md](SECURITY-WISHLIST.md) — a live unauthenticated API this
  UI must not call. Still open.

---

## Health

- 148 suites / 1464 tests green; `tsc` clean.
- ⚠️ **eslint is NOT clean, and the earlier claim here that it was should not be
  trusted.** `npm run lint` reports 76 errors across 22 files — all pre-existing
  and **none in `app/v2/` or `src/features/v2/`** (worst offenders:
  `app/scan/processing-v2.tsx` 23, `src/components/AppSplash.tsx` 17,
  `src/components/ui/Sheet.tsx` 10). Counted 2026-09-21.
- Branch `feat/v2-ui`, 7 commits, **not pushed**.
- Running on device (RMX2151) against staging, bundle served in 2.6s.
