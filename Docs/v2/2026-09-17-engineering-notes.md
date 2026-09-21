> **Internal engineering notes, moved out of `daily-updates/` on 2026-09-17.**
> `daily-updates/DAILY_UPDATE_RULES.md` says that folder is client-facing and
> non-technical, and that rollout/planning notes belong in `docs/` instead.
> This is the original CTO-view write-up for the day, kept verbatim.
> Image paths point back at `daily-updates/2026-09-17/`.

# Daily update — 2026-09-17 (CTO view)

**One workstream: the v2 mobile UI** (`GreenBridgeApp`).

Today v2 stopped being a walkthrough. The review flow can now **save a draft to
the server** — proven, `201 POST /drafts` — and **publish** is wired with both
submit endpoints and both gates. A month of v2 work that had been sitting
uncommitted since 24 August is now **7 commits on `feat/v2-ui`**: 172 files,
+47,318 lines, clean tree, 1451 tests green.

The day's real finding was not a feature. It was that **v2 could not publish
anything at all**, for a reason no test could see: the category picker did not
exist. And the recurring theme, three times over, was **me trusting my own
instruments instead of reading the source** — an API client written against a
contract I never opened, a 404 diagnosed twice without looking at the server,
and a measurement harness that counted everything twice.

**Nothing pushed. Nothing deployed. No listing published** — the one write that
creates real data is still waiting on your go.

![Four captures from the v2 web build against staging](2026-09-17/v2-writes-and-the-category-block.png)

*Four real captures from the browser harness driving v2 against the **staging**
backend, signed in as the test seller. The sign-in sheet after respacing; the
detected-items screen with its new fields (**these rows are stubbed** — the
endpoint 404s on staging, see below); the category picker working on a real
draft; and that draft reaching every-step-green for the first time.*

---

## Headline

**v2 could not publish a single listing, and the blocker was a missing screen.**

`app/v2/scan/review/details.tsx` answered the Category control with a sentence:
*"The category picker is a separate screen and is not rebuilt yet."* That reads
like a cosmetic gap. It is not — `detailSchema` **requires** a category, so any
draft the AI could not confidently place was permanently unpublishable from v2,
with no control anywhere able to fix it.

On the test account that is not an edge case. **Both** single-item drafts
reachable from the drafts list were in exactly that state.

So the order of work mattered. Had publish gone in first, we would have shipped
a Submit button that no real draft on a real account could ever reach — and it
would have passed every test, because the tests do not know what a draft looks
like.

Fixed by lifting the **shipped** `CategoryPickerSheet` rather than rebuilding
it. It was already prop-driven, which is what made it liftable whole, and it
already handles the accordion, the search, the flat-vs-nested tree and the
"Other (type brand)" sentinel — a week of edge cases we would have re-derived
wrong. Same precedent the Location step already sets with the shipped country
picker: old-UI chrome inside a v2 screen, marked for the design pass, because a
working control beats a v2-pure dead end.

## What shipped

**The writes.** Save-as-draft now reaches the server from all four review steps
and is **proven end to end** against staging. Publish carries both endpoints
(a queue goes to the grouped route, a single draft to the direct one) and both
gates in the shipped order — sign-in, then seller approval, both *before* field
validation, so someone being sent to the seller form is not nagged about a price
on the way.

One detail worth the line: the server draft id lives in a store, not in screen
state. v2 splits review across four screens, so screen state would have created
a **new draft on every step's save** — four copies of one listing.

**The guard caught it.** `submitGateTopology` failed the moment publish was
wired, because v2 was a third publish path it did not know about. That test
exists precisely to force a visible declaration, and it did its job: neither
publish endpoint enforces seller approval server-side, so the client gate is the
only gate there is.

**Detected items** gained the fields the web grid has — thumbnail, quantity,
condition, year, location, plus the "needs a clearer photo" flag. Mobile now
carries **29 of the backend's 30 item fields**; only `route` is deliberately
absent, per your call to drop the Route step.

**The sign-in sheet**, which you flagged as looking empty. Measuring it rather
than eyeballing found the actual fault: the three buttons sat **~10pt apart
inside 26pt of clearance** — a cramped slab floating in empty space. 10pt is the
band our spacing rules reserve for *inside* a component. Now 16 between the two
sign-in choices, 22 before the escape hatch, and the type moved up a step.

## The other half of the day — Home, the nav, the list screens, chat cards

A second thread ran on the same app: the screens either side of the review flow.

![Four captures from the v2 build on the test device](2026-09-17/v2-home-nav-lists-and-chat-cards.png)

*Four real captures off the connected device against the **dev** backend, signed
in as the test seller, all from one build. Home with real drafts and listings;
the two new "See all" screens; and the assistant returning **6 of 50** results
as cards.*

**The design canvas had what three files said was missing.** `GreenBidz Mobile
App.html` sits in the workspace root with its `uploads/` and — the one that
mattered — **`TabBar.dc.html`**. Three docblocks in the codebase stated that
artwork was unavailable and built around its absence:

| The code said | The folder held |
|---|---|
| the tab bar drawing "needs a re-auth to fetch" | it, 3,188 bytes |
| the banner photo "is not in the repo" | `banner-surplus-into-capital.webp` |
| `tone="soft"` means "no filled pill" | a pill, just a paler one |

That absent banner photo was not cosmetic. The banner is **sized** for a
photograph, so a flat ground left 56dp of empty dark green above the caption
against 26dp below it — the 2.1:1 asymmetry two independent design reviews each
called "a missing background image". The fix was the asset, not the padding.

**Chat cards.** The assistant screen already mounted the shipped controller, so
send and stream worked. But `turn.cards` was reduced to a boolean and rendered
as one sentence — *"This answer came with a card the redesign has not drawn
yet."* A buyer asking for centrifuges was told results existed and shown none;
the backend had returned **50**. Now capped at 6 with one "View all", per
`CHATBOT_RULES`, reusing the shipped normaliser rather than re-deriving it.

**Two more old-UI leaks closed.** Home's "See all" and the Account rows pushed
into `/(lab)/…`, so two taps into v2 the whole tab bar changed — the complaint
you have raised repeatedly. Three new screens (`/v2/drafts`, `/v2/listings`,
`/v2/listing/:pk`) keep it inside v2.

**Accessibility, measured not eyeballed.** The nav's inactive labels were
`inkSubtle` at **2.94:1** — under AA, on the app's primary navigation. Moving to
`inkMuted` (5.65:1) collapsed the gap to the active state to **1.27:1**, so the
pill from the drawing is doing real work rather than decoration. The banner
caption went from 3.77:1 to **8.34:1** once both of the canvas's stacked scrims
were implemented rather than one.

New rule file: **`Docs/UIUXRuleSet/responsiveness.md`** — how fast a touch must
be acknowledged. Its audit found **six** kit components with a `Pressable` and
no press feedback, including the bottom nav. That is the "it takes time so I tap
twice" report: past the OS double-tap window the second tap is a real second
press.

## What the comparison against the web found

A field-by-field audit against `nextjs-port` and the backend DTO turned up
**three logic divergences**, all of which would have produced confidently wrong
money:

1. **Mixed-currency was computed over every row, not the priced ones.** One
   unpriced row carrying a stray currency killed the total and told the seller
   their prices were in more than one currency — an assertion about prices that
   do not exist. The web had already hit and fixed this; their comment is what
   led me to ours.
2. **A zero price counted as a price.** It added 0 to the total *and* escaped
   the "no price yet" count — hidden twice over.
3. **`category_resolved` is three-valued, not boolean.** The server returns
   `null` when it could not check that marketplace's taxonomy. Typed as a
   boolean, null was falsy, so an unchecked category rendered "(guess)" —
   accusing the AI of guessing when the server had simply not looked.

## Mistakes, and what they cost

**Seven today across the two threads**, and they rhyme: **I trusted something I
wrote — a client, a harness, a probe, a stale build — instead of reading the
source.** All are in `MISTAKES.md`; three escalated to operating rules. Two of
them reached you as confident, wrong statements and cost you a decision request
that should never have been made.

The first three are from the review/publish thread.

**1 · I wrote an API client without opening the routes.** Four details were
wrong and none could ever have worked: the list filter defaults to
`needs_review` not `all`; paging is `pageSize`/`cursor`, not `limit`/`offset`;
accept/discard is the bulk route, not `PATCH`; and the callable bulk path is
`…/items:bulk`, not the registered name. I then wrote seven unit tests
**asserting the wrong contract** — a mock encodes my belief and then agrees with
it, so the suite went green in exact proportion to how confidently I guessed.
The filter one was the quiet killer: the screen would have shown a subset of the
draft and totalled it, looking entirely normal.

**2 · I diagnosed the same 404 twice, wrongly, without looking.** First "the dev
server runs a stale build". Then, when you pushed back that staging already has
these steps, I read the routes, found a feature flag, and over-corrected to "it
is only the flag". SSH showed **both** were true at once: that checkout has no
`draftItemsController.js` on disk **and** `SCANV2_REVIEW_SCALE` is unset. Fixing
either alone changes nothing. Your pushback was worth more than both my
attempts.

**3 · My measurement harness counted every request twice** — two loggers, one of
them justified in a comment I had written myself. I published "8 requests → 2"
into a doc when the truth was 4 → 1, and spent several steps investigating a
duplicate-write bug in the app that did not exist. Both docs corrected.

Also caught before shipping: a "conditional spine" design that would have
**hidden the Photos step** on photoless drafts — removing the only route to the
screen that clears a block Submit still enforces. Reverted the same turn.

**And a small one worth knowing:** the workspace `CLAUDE.md` was corrupt — `grep`
had been reporting it as a *binary* file. It held a real NUL byte, inside the
very rule warning that a `\x` escape handed to a file-writing tool gets decoded
on the way to disk. Pre-existing, repaired, backed up.

### From the second thread — four more, same family

All logged; one escalated to an operating rule. The shape here was **trusting a
measurement without first checking the instrument or the build**.

**4 · I reported a working control as broken, and asked you to decide about it.**
I told you the Browse tab was dead, "4 of 4 attempts", and asked whether to
change the app's navigation semantics. It was never broken. `uiautomator dump`
**cannot dump a screen holding a loading WebView** — it fails and writes no file
— and because I had redirected stderr to `/dev/null` and reused one filename,
the `adb pull` after it kept handing me the *previous* screen. Four repetitions
of one broken probe read as four confirmations. The promo banner reached Browse
fine the whole time, which should have falsified it on the spot. Escalated to
`CLAUDE.md`.

**5 · I asked you to arbitrate a contrast trade-off that did not exist.** I
reported the banner eyebrow stuck at 4.00:1 against AA's 4.5 and offered you a
choice between the drawn colour and white. The scrim fix was already written and
simply **not loaded on the device**; on a fresh bundle the same measurement is
**8.34:1**. The tell was there — the number had not moved *at all* after an
edit, to two decimal places. An unchanged measurement after a change is a fact
about the build, not the design.

**6 · "TabBar is the only component without press feedback."** It was one of
six. I had grepped a list of eight component names I typed from memory and
called it verified. The audit command I then wrote into the rule file returned
the real population and contradicted me — I was wrong by five, and had
understated the problem you reported.

**7 · I ran the control-coverage sweep as the opening move.** Asked to work the
Home screen, I started by pressing every control that navigates *away* from it,
and you had to stop me. That sweep is the definition of done, not the work.

## Where it stands, honestly

| | |
|---|---|
| Screens | **17 routes** (`find app/v2 -name '*.tsx' ! -name '_layout.tsx'`), up from 13. **Four are NOT in the canvas** — detected-items, and the three list/detail screens — so their docblocks carry what was derived and what was a design call |
| Writes | Save-as-draft **proven**; publish **wired, never pressed** |
| Detected items | Renders correctly from **stubbed** rows; never seen real ones |
| Scan parity | 4 of 6 built, 1 partial, 1 blocked |
| Tests | 146 suites / 1451 tests green; tsc + eslint clean |
| Chat | Send/stream **proven on device**; results cards render, **2 of 22** card types drawn — the other 20 name themselves |
| Old-UI leaks | Home "See all" ×2, Account rows ×2 and the scan entry **closed**; the bell, chat result rows and Browse remain, each declared |
| Deployed | **Nothing.** Local only, nothing pushed |

The gap I would not paper over: **the detected-items screen has never met a real
row.** Everything I have verified about it used a stubbed response. Given that
today's audit found four contract errors in that exact file — all green on tests
— I would not call it working until the endpoint answers.

## What I need from you

1. **Press Submit.** One explicit go and the publish path is proven end to end.
   It creates one real listing in the staging review queue; the draft is already
   staged with a category and an address. The permission layer blocked me from
   doing it on an implied yes, which was the right call.
2. **The dev server.** Two things, both needed: pull `dev` onto the test
   checkout, and set `SCANV2_REVIEW_SCALE=true`. That checkout has 8 modified
   files and 2 local-only commits, so the pull is a judgement call rather than a
   one-liner.
3. **A success screen — or not.** The canvas has no artboard past 7e, so a
   published listing currently lands on Home with a confirmation toast. Routing
   to the shipped success screen would drop the seller into old chrome at the
   most triumphant moment, which is the complaint you have raised repeatedly.
   Landing on Home is honest but thin.
4. **A buyer product page — or the old one stays.** Tapping a chat result opens
   `/(lab)/product/[id]`: v2 has no buyer detail screen (`/v2/listing/:pk` is
   the SELLER's batch detail, a different thing). Same trade as Browse being a
   WebView, and the same reason — a card that goes nowhere is worse.
5. **The `inkSubtle` palette value.** `#8B9A92` is 2.94:1 on white — below AA,
   and used 60 times. `#65736B` clears 4.5:1 on all three grounds at the same
   hue. The nav no longer uses it; everything else still does. **Tehreem's
   call**, and the contrast test grandfathers it until she makes it.
6. **A reversed brand logo.** The real lockup is now in the header, but the
   artwork is fixed-colour navy: on the dark ground it measured **1.08:1**, so
   dark mode flattens it to a monochrome tint and loses the teal. A proper
   reversed asset would restore it — there is none in `assets/` or the canvas.

## Next

- The **detected-items → review link**. The multi-item flow still dead-ends at
  accept/discard, and it is the prerequisite for the conditional spine — the
  last parity item. A batch spine cannot number a journey nobody can walk.
- **7b "Rearrange"** — the last control that explains itself instead of working.
  Clearing it takes the App Review 2.1 count to zero.
- The 7a Analyzing screen is still orphaned, and the wishlist IDOR write-up is
  still unscheduled.
- **The remaining 20 chat card types.** Drafts, queues, WTB matches and the
  handoff all still render as a line naming themselves. `product_list` proved
  the pattern — reuse the shipped normaliser, render in v2 tokens — so the rest
  are mechanical rather than novel.
- **Delete and Edit on the two new list screens.** Both are writes, and a
  destructive one needs a confirm-and-undo surface that is not drawn. The old
  screens keep both, so nothing is lost — but these are not replacements until
  they are ported.
- **Guest Home is still thin below the banner.** With the photograph in it now
  reads as deliberate rather than broken, but a signed-out first-run still ends
  in whitespace. That is a design question, not a bug.
