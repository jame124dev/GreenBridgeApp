# v2 QA — manual test plan

> **Who this is for:** a tester with an Android handset and a cable. No React
> Native knowledge assumed. Everything you need to run this is below; where a
> step needs a credential or a go-ahead, it says so and names who to ask.

**What v2 is.** A full redesign of the seller app, built as a parallel UI at
`app/v2/`. The old UI still ships and still launches — v2 is somewhere you
*go*, not somewhere you land. This plan covers **16 screens plus one redirect**.

**The one thing to understand before you start.** Every v2 screen reads live
data — none of them render fixtures. That is *not* the same as working. Six
areas are known-broken for reasons already diagnosed, and filing those again
costs everyone time. **Read §1 before pressing anything.**

---

## 0 · Setup

### 0.1 The build

v2 is behind an off-by-default flag. It must be `1` **in `.env` at bundle
time** — `EXPO_PUBLIC_*` values are inlined when Metro builds, so changing it
needs a Metro **restart**, not a reload:

```
EXPO_PUBLIC_V2_UI=1        # GreenBridgeApp/.env line 33
```

Confirm Metro is up before launching. The port varies by machine (a Vite server
often owns 8081), so check rather than assume:

```bash
curl -s http://127.0.0.1:8081/status    # expect: packager-status:running
curl -s http://127.0.0.1:8082/status    # try this one if 8081 is silent
```

On a cabled device, forward whichever port answered — **this is lost every time
the cable is re-seated**, so re-run it after any disconnect:

```bash
adb reverse tcp:8081 tcp:8081
```

### 0.2 Getting into v2

Two ways in. Use the second when you need a clean slate.

1. **In-app:** old Account tab → **Development** section → *"Open the new UI (in
   progress)"*. This row only appears when the flag is on.
2. **Deep link:** `adb shell am start -a android.intent.action.VIEW -d "greenbridge://v2"`
   — the scheme is `greenbridge`, not the package name.

### 0.3 What you need from the team

| Need | Ask | Why |
|---|---|---|
| Staging seller login | the project director | Pass B and C need a signed-in seller. **Do not write the password into this file, a ticket, or a screenshot.** |
| Go-ahead to press **Publish** | the project director | It creates a real listing in the staging review queue. See §1. |
| A draft with several items | the project director | The multi-item path (§4.4) can't be reached without one. |

Backend under test is **staging** (`testapi.greenbidz.com`). If the app is
pointed anywhere else, stop and ask — a bug found against the wrong backend is
not a bug.

### 0.4 Six traps that will waste your afternoon

These are not hypotheticals; each one has already cost a session here.

1. **The magenta `SYS → LIGHT` pill.** A dev-only control floating over the
   bottom-left of *every* v2 screen. It sits on top of real controls and eats
   the tap silently — it has hidden three so far. **Long-press it to hide it for
   the session** before you test anything, or you will file dead-control bugs
   that aren't.
2. **Never reset by pressing BACK repeatedly.** Six BACKs walk out of v2 into
   the *old* home, which also has a Home tab, a bell and draft cards. Your next
   twenty taps then land on the old UI while looking like v2. Reset with the
   deep link in §0.2.
3. **A screen that "won't scroll" probably scrolls.** The Review steps have a
   fixed header *and* a fixed footer. A swipe starting on either does nothing —
   start the swipe in the middle of the screen.
4. **A change that "didn't work" is usually a stale bundle.** Dev builds hold
   the old JavaScript. Confirm Metro rebuilt before reporting that a fix is
   missing.
5. **A white screen is a bundle still loading.** Wait. Don't restart.
6. **This handset is 423dp wide**, not the 360dp most designs are checked at.
   Layout that looks roomy here may not be. Note it, don't assume.

---

## 1 · Known-broken — do NOT file these

Six areas are already diagnosed and tracked in
[STATUS.md](STATUS.md). You will hit them. Filing them again is noise.

| You will see | Why | Tracked as |
|---|---|---|
| **Detected items** screen fails to load rows | Its endpoints answer 404 — the staging server is missing a controller and a feature flag | §1 |
| No way from a detected item into the review steps | Same missing endpoints | §5 |
| Item states: `high value` / `scrap` can be read but not set | Those are a separate field the UI can't write yet | §6 |
| The **Analyzing** screen is unreachable; it says "No scan running" if you deep-link to it | Nothing navigates to it by design yet | §2 |
| Publishing lands on Home with a toast, not a success screen | Not designed yet | §9 |
| Old-styled screens appear inside v2 for: Country picker, Category picker, photo reorder, camera processing | Deliberate — a working control in the wrong skin beats a pretty dead end | §8 |

⚠️ **Do not press Publish** in Pass C until the director has said go. Everything
up to and including **Save draft** is safe and expected; Publish creates a real
listing in the staging review queue that someone then has to clean up.

**If something in this table behaves *better* than described, that is worth
reporting** — it means the server was fixed and the plan is stale.

---

## 2 · Pass A — Guest

Sign out first, or use a fresh install. This pass matters more than it looks:
**build 1.0.3 (21) was rejected by App Review on 2026-08-24** for asking a guest
to register before they could browse. The rule that came out of it:

> A guest may look at everything. They are asked to sign in **only** at the
> moment they press something that needs an account — and then the thing they
> pressed happens, not a dead end.

So there are two opposite failures to watch for, and you are hunting both:

- **Gated too early** — a guest is blocked from merely *looking*. Rejection risk.
- **Gated too late** — a guest fills in a whole form and is stopped at submit.
  Cruel, and still a bug.

### A1 · Guests can look

Each of these must render real content with **no sign-in prompt**:

- [ ] Home — Selling tab
- [ ] Home — Buying tab (swipe, and via the tab bar)
- [ ] Browse — the marketplace loads, lots and prices visible
- [ ] Matches
- [ ] Messages
- [ ] Account — the full list of rows is visible, nothing hidden
- [ ] The assistant (chat) — **including sending a message and getting a reply**
- [ ] The language sheet (`EN` in the top-right)

### A2 · Guests are asked at the right moment

Press each. Expected: the sign-in sheet appears, and **after signing in the
original action completes** — you are not dumped back at Home.

- [ ] The bell (top-right, any screen)
- [ ] Home → **Scan it**
- [ ] Home → **or type the details**
- [ ] Home → a draft card
- [ ] Account → My listings
- [ ] Account → Drafts
- [ ] Account → Offers
- [ ] Account → Profile / Notifications / any settings row
- [ ] Matches → save or create a want
- [ ] Messages → send a message

### A3 · The sign-in sheet itself

This screen's entire job is *not trapping a guest*, and all three of its buttons
were once dead at the same time. Press every one:

- [ ] Sign in → reaches the real sign-in screen
- [ ] Create an account → reaches registration
- [ ] The dismiss / "not now" escape → returns you to where you were, still a guest
- [ ] Tapping the backdrop dismisses it
- [ ] Nothing is cut off or cramped; the sheet is readable in both light and dark

---

## 3 · Pass B — Signed-in seller, home and lists

Sign in with the staging seller. **Then force-stop and relaunch the app** before
starting — a session can survive in memory after its credentials have died, and
that has made a broken screen look healthy.

- [ ] Home shows the seller state: DRAFTS and LIVE LISTINGS sections present
- [ ] **DRAFTS loads.** If it says *"Your drafts did not load"*, that is the
      one known auth defect — note the exact wording and whether **Try again**
      ever succeeds (it should not, and that is the bug). Tracked as §3.
- [ ] LIVE LISTINGS loads. ⚠️ This section loads *even with no valid session*,
      so it working tells you nothing about whether you are signed in.
- [ ] DRAFTS → **See all** → the drafts list. Must stay in v2 chrome.
- [ ] LIVE LISTINGS → **See all** → the listings list. Must stay in v2 chrome.
- [ ] A listing row → listing detail. Batch number, status chip, item rows.
- [ ] An item row inside listing detail
- [ ] A draft row → resumes that draft into the review flow
- [ ] Account: identity, verification line, and every row pressed
- [ ] Every tab in the bar: Home · Browse · Matches · Messages · Account
- [ ] Open the keyboard anywhere — the tab bar must collapse and come back

**Chrome check, on every screen above.** v2 has one look. If a screen suddenly
has a different tab bar, different fonts, or badges reading `99+`, you have
fallen into the old UI — note exactly which control did it. That is a real bug
and it has shipped twice.

---

## 4 · Pass C — the scan flow

This is the product. Work through it in order.

### 4.1 Camera (3b)

- [ ] Close (✕)
- [ ] Flash toggle
- [ ] Gallery / picker
- [ ] Shutter — takes a photo, the roll count goes up
- [ ] The roll thumbnail — opens what you have taken
- [ ] Voice (🎤)
- [ ] Take several photos, then continue

### 4.2 The four review steps

Order is **Photos → Details → Pricing → Location**. Each shows `STEP n OF 4` and
a progress bar — check the number and the bar agree with where you are.

**Step 1 · Photos**
- [ ] Add a photo
- [ ] Remove a photo
- [ ] **Rearrange** — opens the reorder screen (old chrome, expected — §8)
- [ ] Reordering actually sticks when you come back
- [ ] Continue

**Step 2 · Details**
- [ ] Title and description accept text and keep it
- [ ] **Category → Choose** opens the category picker and the choice sticks
- [ ] Condition / quantity / any other field
- [ ] Continue

**Step 3 · Pricing**
- [ ] The AI estimate panel renders numbers, with the "verify before publishing" note
- [ ] **Buy now** / **Make offer** toggle
- [ ] Price accepts a number and keeps it
- [ ] ⚠️ **Check the price on the next screen matches what you typed.** A screen
      once displayed "No price" while publishing a live listing at $1,500. If
      the number shown anywhere disagrees with what you entered, that is a
      **critical** bug — stop and report it immediately.
- [ ] Continue

**Step 4 · Location**
- [ ] Country picker opens (old chrome, expected — §8) and the choice sticks
- [ ] Address / city fields
- [ ] Back-swipe works from every step and nothing is lost

### 4.3 Saving and publishing

- [ ] **Save draft** — works. Then leave, return to Home, and confirm the draft
      is in the DRAFTS list. Resume it and confirm your entries survived.
- [ ] Publish — **only with an explicit go.** Confirm the gates fire first if
      the account isn't an approved seller.

### 4.4 Multi-item (blocked — confirm, don't chase)

- [ ] Open a draft with several items → the Detected items screen
- [ ] Note whether rows load at all. 404 is the expected failure today (§1).
- [ ] Accept / discard, if rows appear
- [ ] Confirm there is no way from a row into the review steps — expected (§5)

---

## 5 · Pass D — chat, matches, messages

- [ ] Send a text message to the assistant; a reply streams in
- [ ] Attach a photo
- [ ] Voice input
- [ ] Any card in a reply — press through to whatever it points at
- [ ] ⚠️ Ask for something that has no match. The assistant is supposed to
      **lead with an offer to save it as a want**. Today v2 instead prints
      *"This answer included a 'wtb_draft' card, which v2 does not draw yet."*
      Confirm whether you see that — it is known (§10) but its visibility to a
      real user is worth recording.
- [ ] Matches: tabs, filters, a match row, match detail, its bid / contact
      buttons (several are inert — note which)
- [ ] Messages: a thread opens, scrolls, and the composer behaves

---

## 6 · Screen coverage

**A screen is not tested until every control on it has been pressed** — not the
obvious one, all of them. Tick a screen only when that is true.

| # | Screen | Reached by | Done |
|---|---|---|---|
| 1 | Home — Selling (6a) | tab bar → Home | ☐ |
| 2 | Home — Buying (6b) | swipe, or tab bar | ☐ |
| 3 | `/v2/buying` redirect | deep link | ☐ |
| 4 | Browse | tab bar | ☐ |
| 5 | Matches | tab bar | ☐ |
| 6 | Messages | tab bar | ☐ |
| 7 | Account (6f) | tab bar | ☐ |
| 8 | Assistant / chat | Home → assistant row | ☐ |
| 9 | My drafts | Home → DRAFTS → See all | ☐ |
| 10 | My listings | Home → LIVE LISTINGS → See all | ☐ |
| 11 | Listing detail | a listing row | ☐ |
| 12 | Camera (3b) | Home → Scan it | ☐ |
| 13 | Review · Photos (7b) | after camera | ☐ |
| 14 | Review · Details (7c) | step 2 | ☐ |
| 15 | Review · Pricing (7d) | step 3 | ☐ |
| 16 | Review · Location (7e) | step 4 | ☐ |
| 17 | Detected items | a multi-item draft | ☐ |

Not reachable and not expected to be: **Analyzing (7a)** — see §1.

Run the whole matrix **twice**: once in light mode, once in dark.

---

## 7 · Filing a bug

One ticket per defect. Include:

```
Screen:        e.g. Review · Pricing (step 3 of 4)
Signed in as:  guest | seller
Control:       what you pressed, by its visible label
Expected:      what should have happened
Actual:        what did
Screenshot:    always
Repro:         numbered steps from a fresh launch (deep link, not BACK)
Build:         commit / build number under test
```

**Before filing a dead control**, do two things:
1. Long-press the magenta pill to hide it and try again (§0.4).
2. Press a *different* control on the same screen. If that one works, the
   problem is the control. If nothing works, the problem is the screen — say so.

**Severity**

| | |
|---|---|
| **Critical** | Wrong money, wrong data written, a guest blocked from looking, or a dead end with no way out |
| **High** | A primary action does nothing, or the flow cannot be completed |
| **Medium** | A secondary control fails; wrong chrome (old UI inside v2) |
| **Low** | Spacing, wording, truncation |

---

## 8 · Sign-off

```
Build / commit under test:  ____________________
Device + Android version:   ____________________
Backend:                    staging (testapi)
Tester:                     ____________________
Date:                       ____________________

Pass A · Guest          ☐ pass  ☐ fail   defects: ____
Pass B · Seller         ☐ pass  ☐ fail   defects: ____
Pass C · Scan flow      ☐ pass  ☐ fail   defects: ____
Pass D · Chat/matches   ☐ pass  ☐ fail   defects: ____
Coverage matrix         ☐ all 17, light + dark

Publish pressed?        ☐ no   ☐ yes, authorised by ____________
```

---

*Companion documents: [STATUS.md](STATUS.md) for what is known broken and why ·
[GUEST-VS-SIGNED-IN.md](GUEST-VS-SIGNED-IN.md) for the guest rules ·
[TRAPS.md](TRAPS.md) for device gotchas.*
