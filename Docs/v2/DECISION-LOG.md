# Decisions already made

Not to be confused with [DECISIONS.md](DECISIONS.md), which is what is still
*waiting* on a person. This is what was **settled**, and why — so nobody relitigates
it in three weeks, and so the reasoning survives the session it was made in.

Newest last. Each entry says what was decided, what it cost to learn, and what
would justify reopening it.

---

## 2026-09-15 · A screen is not verified until EVERY control is pressed (⚑)

**Decided:** one control per screen is not a verification. The bar is every
control tapped and its effect observed.

**Why:** v2's sign-in sheet was signed off "verified on glass, both schemes" —
with a colour sampled off the backdrop — while **all three of its buttons were
dead**. The one screen whose job is "do not trap a guest" trapped them. Raising
the bar then found 13 more controls that did nothing, across 14 surfaces.

**Cost of learning it:** fourth occurrence of screenshot-instead-of-press. The
earlier three are in `MISTAKES.md`.

**Reopen if:** never for device work. The one exception already noted: on 6c the
WebView is invisible to `uiautomator`, so there a screenshot *is* the probe.

---

## 2026-09-15 · A held-back control must say so, not buzz

**Decided:** a control that cannot do its job yet prints a sentence. It never
fires a bare `haptics.tap()` and returns.

**Why:** a buzz is worse than silence — it confirms the tap landed, so a missing
screen reads as a hang rather than an unfinished feature. Seven controls now do
this; all seven previously buzzed.

**Reopen if:** shipping. The sentences are an App Review 2.1 risk and must be
wired or removed first — see [SHIP-BLOCKERS.md](SHIP-BLOCKERS.md).

---

## 2026-09-15 · 101lab only — the marketplace picker is gated off

**Decided:** `MARKETPLACE_PICKER_ENABLED`, default off. The multi-marketplace
work stays behind the flag rather than being deleted.

**Why:** the dev API really does advertise three marketplaces (verified by curl,
not assumed), so the picker appeared legitimately. But this build lists to
101lab, and a "Change" that opens a list of one is a question with one answer.
Gated at the single point every consumer reads.

---

## 2026-09-16 · Replies are three lines; detail goes in the docs

**Decided:** every reply is `Done: / Next: / Need:` — `Need` omitted when nothing
is waiting, and the only line that may be bolded.

**Why:** the user asked twice whether a human could read my replies. The second
time, the previous reply was ~350 words with nine bold fragments. The rule had
already been written into `CLAUDE.md` and ignored, so the fix is a shape that
cannot grow into a report rather than another promise.

**Reopen if:** a direct question is asked — that gets a direct answer. Not a
licence to return to paragraphs.

---

## 2026-09-16 · Doc facts that a grep can check live in a test, not in markdown

**Decided:** `src/__tests__/v2Inventory.test.ts` asserts the v2 route list, the
count of self-explaining controls, whether any entry point into v2 exists, and
which screens wire the language sheet. The markdown keeps only what a grep
cannot know.

**Why:** `V2_CHECKLIST.md` reached ~1,900 lines and several claims were stale
within *hours* — a screen marked verified that could not be opened, a "no real
data" on a screen holding 3,668 live lots, a generalisation about animations
that one grep disproved. Prose cannot notice when the code moves.

**Cost of learning it:** `Docs/` already contains six plans using a hand-run
review protocol, and every one still carries unresolved "READY FOR REVIEW"
markers; the cleanup plan got 13 items approved and has not moved since
2026-05-29.

**Reopen if:** the test becomes a maintenance burden — but note it was broken
four ways deliberately before being trusted, which is the standard any
replacement has to meet.

---

## 2026-09-16 · The QA gate is a test, not a reviewer

**Decided:** a task is done when a test that has been *proven to fail* passes.
An agent review may supplement that; it may not be the gate.

**Why:** the six stalled plans above all gate on a human saying "approved", and
none got one. A test closes itself. Also: an agent reading code is the same
verification mode that let 13 dead controls through sign-off — every one of them
looked correct in source.

**Corollary:** device work stays serial and is not delegated. There is one
phone, and "done" means pressed.

---

## 2026-09-16 · v2's missing entry point outranks polishing v2

**Decided:** finding v2's front door is the top priority; screen-level work is
downstream of it.

**Why:** raised by the user watching the device keep landing on old screens.
Checked and true — the app launches into the old UI and nothing outside
`app/v2/` navigates into v2. I had spent that session bisecting 3a, a static
mock nobody can open, while the whole surface had no door. The screens work;
what stands between them and a user is one routing decision.

---

## 2026-09-16 · 7b/7c Save as draft commits locally instead of apologising

**Decided:** the two deferred `Save as draft` controls now do what 7d and 7e
already did — commit to the device, then `router.back()`. No sentence.

**Why:** their notices were **false**. They said "what you just typed is not
stored yet" while `COMMIT_FIELD_EDITS` is `true`, so the edits were already in
MMKV (`commit()` on blur in 7c, `onPickMarketplace` on tap in 7b). Telling a
seller their work is lost when it is on the device is the worse of the two
available errors, and it is the same fault as 7c's category notice a day earlier.

Two file-top docblocks also claimed that flag was off while its declaration
sixty lines below read `= true`. A docblock that contradicts its own constant is
how the false notice survived review.

**What did NOT change:** the server POST. It stays a `TODO(v2-writes)`, and
nothing now claims the draft reached the account.

**Cost of learning it:** an agent audit caught it, and I nearly dismissed the
finding because my own grep (`COMMIT_FIELD_EDITS = `) could not match a
declaration written `COMMIT_FIELD_EDITS: boolean = true`.

**Verified:** on device, both screens — pressed, navigated back, no notice
rendered. The App Review list drops from seven controls to five, and
`v2Inventory.test.ts` was proven to go red before it was allowed to go green.

---

## 2026-09-16 · Bidding is gated at the LOT, and it reuses `offer`

**Decided:** 2a's `Place bid` now runs through `requireAuth('offer', …)` before
`/v2/bid` opens. Viewing the lot is untouched and stays open to everyone.

**Why gate at 2a and not 2b:** 2b is a full form with an amount field. Asking a
guest for an account *after* they have worked out a number and typed it throws
that work away and reads as a bait-and-switch; the cheap moment to ask is before
the form exists. One gate, one place — 2b keeps none of its own.

**Why now, with nothing wired:** the bid POST is still unbuilt, so this is a
gate ahead of its write on purpose. The version that ships without it is the
version that lets someone type a number and then tells them no, and no runtime
failure or device pass would have noticed the absence before the write landed.

**Why `offer` and not a new reason:** `GateReason` is a closed set of seven with
one copy table (`features/auth/gateCopy.ts`), and `offer` already reads "Sign in
to make an offer / Offers are tied to your account so the seller can reply to
you." The shipped marketplace WebView guard already maps `place bid` onto the
same reason (`features/lab/marketplace/webAuthBridge.ts`), so the web surface
and the native one now say the same thing to the same tap. An eighth reason for
this one control is how those two drift apart.

**What did NOT change:** `Save this lot`. The heart is still local `useState`
and still persists nothing — see `GUEST-VS-SIGNED-IN.md`. A Node wishlist API
does exist (`POST /api/v1/wishlist/{userId}/toggle`, mounted `app.js:439`) and
the web frontend calls it from 12 sites across 8 files, but this app has no
wishlist client at
all, and whether to wire it, gate it or drop the heart is an open question, not
an implementation detail.

**Verified:** `v2Inventory.test.ts` gained a `v2 guest gates` block asserting
both halves of Guideline 5.1.1(v) — bidding gated, viewing not — and was proven
red with the gate removed before being allowed green. Full suite 142/142,
1403 tests. NOT yet pressed on a device.

**Pressed on the device 2026-09-16, after the above was written.** Signed out,
deep-linked to `/v2/lot`, tapped "Place bid": the sheet appeared with the
`offer` copy and the bid form did not open. All three sheet buttons were then
pressed individually, because this exact sheet once shipped with all three dead
— "Keep browsing" returns to the lot, "I already have an account" reaches the
sign-in screen, "Create account" reaches signup. Gate confirmed working.

⚠️ The first device run appeared to FAIL, and it was my own doing: the
break-test had Fast-Refreshed the gate-less bundle onto the phone, and restoring
the file on disk did not restore the bundle. Logged in `MISTAKES.md`. Never run
a proof-of-failure edit against a file a live device is reloading from without
forcing a fresh bundle before the device pass.

## 2026-09-16 · 2a's save heart is removed, not gated and not wired

**Decided:** delete the ♡ from the lot hero. The canvas draws one; the app will
not have one until it can actually save.

**Why removal and not a gate:** it was local `useState`. It filled in and
persisted nothing — identically for a guest and for a signed-in user, and
neither was told. Gating it only fixes the guest half and leaves it silently
broken for everyone who signs in. This is the opposite failure from the five
controls in [SHIP-BLOCKERS.md](SHIP-BLOCKERS.md): those admit they are
unfinished, whereas a filled heart claims a success it never delivered.
Guideline 2.1 reads the second as the weaker position.

**Why not wire it:** two independent blockers. 2a renders `MOCK_LOT`, so there
is no product id to save; and the backend route that would receive it has no
authentication at all (see below).

**What it cost to learn:** the backend has a complete wishlist API
(`POST /api/v1/wishlist/{userId}/toggle`, mounted `app.js:439`) and the web has
used it from 12 call sites across 8 files for a long time — so "no endpoint
exists" would have been the wrong reason, and was nearly the reason given.

**Reopen when** the lot is real data AND the route is authenticated. Not before.

**Pinned:** `v2Inventory.test.ts` → `has no save control that pretends to save`,
asserting on `<Heart` and `setSaved` rather than the word "heart", because the
file now carries a long comment explaining the removal and `codeOf()` does not
strip the inner lines of a `{/* … */}` JSX block. Proven red by re-adding a
`<Heart />` before being allowed green.

## 2026-09-16 · The wishlist API is unauthenticated — reported, not touched

**Found:** all five `/api/v1/wishlist/:userId` routes have zero auth middleware
and read the identity from the URL path (`const { userId } = req.params`, with
only a presence check). Anyone can read or modify anyone's wishlist. It is live
on prod and predates this work.

**Decided:** write it up, change no code. Full detail, blast radius, the
enumerated web call sites and a five-step fix are in
[SECURITY-WISHLIST.md](SECURITY-WISHLIST.md).

**Why not just fix it:** deriving `userId` from the JWT is a breaking API
change, not a patch — it breaks 12 web call sites across 8 files, so server and
web must ship together. That is a scheduling decision, and this also touches
auth/ownership scope, which the root `CLAUDE.md` says to flag rather than
improvise.

**Not the first of its kind:** `/chat/*` had the same shape and leaked an inbox
plus email addresses in production (memory `project_chat_auth_idor_prod`). Worth
sweeping other `:userId`-in-path routes.

## 2026-09-16 · Mobile keeps the 6-digit signup code; web keeps the link

**Observed by the user:** mobile signup asks for a verification code and 101lab
web never does — an extra step on mobile.

**Confirmed in code.** Web `Auth.tsx:327` calls `signupWithLink`, and
`VerifyEmailPage.tsx:28` reads a `?token=` out of the URL: one submit, then a
click in an email. Mobile `services/auth/register.ts:97,107,141` runs
`signup-initiate` → `verify-signup-code` → `complete-signup`: three steps, with
a 6-digit code typed in the middle. Both endpoint families exist on the shared
backend, and **no web page calls the code flow at all** — so this is a client
choice, not a backend limitation.

**Decided:** keep the split.

**Why:** a link works on the web because the click lands in the same browser
that started the signup. On a phone it only returns the person to the app if the
email's link deep-links into it; otherwise mobile signup ends on the website,
which is a worse outcome than typing six digits. Codes are the conventional
mobile pattern for exactly this reason.

**The real cost, and where to watch it:** this sits directly behind the bid
gate. A guest taps "Place bid" → "Create account" and now owes six digits before
they can bid — the most expensive place in the app to spend two extra steps. If
bid conversion is ever measured, measure it here first.

**Reopen if** the verification email's link is confirmed to deep-link into the
app, which would make the web flow viable on mobile and worth unifying.

## 2026-09-16 · Signing in from v2 returns you to v2 — one gatekeeper, three call sites

**The bug, in the user's words:** "it goes back to the previous version while
using." Reported more than once, and I twice explained it away as expected
behaviour. It was not. Gate on ANY v2 screen — bid, draft, sell, account — sign
in, and you were deposited in the OLD UI with no route back except the dev-only
door on Account. The gate worked; the return did not.

**Why no existing test caught it:** every v2 file was clean. The `v2 exits into
the old UI` suite reads v2 sources, and the ejection was in the SHARED auth
stack, which is not a v2 file. A suite that enumerates one directory cannot see
a bug in the directory next door.

**Three call sites, and the third is why patching the first two fails:**

| # | Site | Shape |
|---|---|---|
| 1 | `app/(auth)/login.tsx` | `onSuccess` + the `ACCOUNT_PENDING` branch |
| 2 | `app/(auth)/register.tsx` | the same two shapes again |
| 3 | `app/_layout.tsx` `AuthGuard` | `if (profile && inAuthGroup) replace(HOME_ROUTE)` |

(3) is a global effect keyed on `profile`. It fires the instant login sets a
profile while the route is still inside `(auth)` — the same instant the screen
issues its own redirect. Two redirects race, and the hardcoded one won often
enough that fixing only (1) and (2) would have looked fixed, intermittently.
That is the worst possible outcome, so the guard now stands down while a v2
landing is owed.

**Decided:** one function, `features/v2/routing/postAuthLanding.ts`. All three
sites call it. It returns the stored `/v2` path if there is one and
`LEGACY_HOME` otherwise, so **for the shipped UI it is the identity** — old-UI
users land exactly where they landed before.

**A path, not the pending action.** `requireAuth(reason, action)` still discards
`action` for a guest, deliberately: replaying an arbitrary closure across a
navigation, an auth round-trip and a remount is how a write fires twice.
Returning someone to the screen is honest — they press the control again, now
signed in, and it works.

**Verified end to end on the device, as a guest:** lot → Place bid → gate sheet
→ "I already have an account" → signed in → **back on the v2 lot** → Place bid
again → the bid form opens. Before this change, step 5 was the old home.

**Pinned** by four assertions in `v2Inventory.test.ts`, including one that the
`AuthGuard` condition still carries `!hasPendingV2Return()` — deleting that term
restores the race in a form that passes every other test and reproduces perhaps
one run in three. Proven red by removing it.

**Worth knowing for the next session:** the v2 sign-in sheet is a `<Modal>` that
`uiautomator dump` misses intermittently — it reported "sheet open: False" while
a screenshot taken two seconds later showed the sheet fully rendered. On this
surface, screenshot before concluding a control did nothing.

**Not done, and the user's better idea:** they asked for a general router-level
gatekeeper — "keep me in v2, and open a v1 route only when I say so". This fixes
the auth boundary, which is where every reported leak actually was, but it is
still per-site. A real guard in the root layout, keyed on a sticky "in v2" flag
with an explicit escape hatch, would catch leaks nobody has hit yet. Worth doing
before the flag is turned on.

## 2026-09-16 · The promo banner is for guests only, on both Home modes

**Decided:** `PromoBanner` renders only when `useIsGuest()` is true, on 6a and
6b. For an account it is gone, not moved.

**Why:** it is acquisition copy. "Turn idle plant into capital / See what sells"
argues that the app is worth using — right for someone who has not signed up,
wrong for a seller with 24 drafts and live listings, and it rendered ABOVE their
own work. Seen on the device signed in: the seller scrolled past a pitch to
reach their own drafts. Nothing on Home should outrank a seller's own work.
6b had the same shape — "Skip the valuation — we price it for you" explains the
product to someone already using it.

**Why gone rather than moved below:** moving it keeps a block that earns nothing
for that person and pushes Live listings further down. If a signed-in slot ever
earns its place it should show their own state ("2 listings in review"), which
is data we already hold — that is a new component, not a relocated banner.

**Guests keep it,** because a guest Home is thin — hero, assistant, banner, then
nothing — and the banner is doing real work there. Removing it from both states
would have made the emptiest screen emptier.

**Verified on device, both states, after a forced reload.** Signed in: no
banner, `DRAFTS` and the first two drafts now sit above the fold. Guest: banner
present, drafts correctly absent, and its "See what sells" CTA was pressed — it
lands on Browse (101lab `/buyer-marketplace`, 3668 live results). The CTA was
pressed because the change altered its container, and a control in a container
you edited is a control you have to press.

**Pinned:** `v2Inventory.test.ts` → `shows the promo banner to guests only`, run
over BOTH panes via `it.each`, because 6b is behind a tab and a device pass that
only opens Home never sees it. The assertion is order-sensitive — `isGuest` must
appear immediately before `<PromoBanner`, not merely somewhere in the file,
since both panes use `isGuest` several times — and it caps the banner at one per
pane so a second unguarded copy cannot route around the guard. Proven red by
replacing the guard with `{true ?`.
