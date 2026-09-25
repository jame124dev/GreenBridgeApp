> # ⚠️ SUPERSEDED — current state lives in [`Docs/v2/`](v2/README.md)
>
> This file reached ~1,900 lines and several of its claims were stale within
> hours of being written. It is kept as an ARCHIVE, not deleted, for two
> reasons: the reasoning behind most v2 decisions is in here, and code comments
> across `app/v2/` reference it by name.
>
> **For current state, read instead:**
> [STATUS](v2/STATUS.md) · [DECISIONS](v2/DECISIONS.md) ·
> [SHIP-BLOCKERS](v2/SHIP-BLOCKERS.md) · [ARCHITECTURE](v2/ARCHITECTURE.md) ·
> [TRAPS](v2/TRAPS.md)
>
> The facts a grep can establish are now asserted in
> `src/__tests__/v2Inventory.test.ts`, so they fail loudly instead of rotting
> quietly. Do not add to this file.

---

# v2 Redesign — Checklist

Updated 2026-09-15. Detail lives in `V2_UI_SKILLS.md`; this is just the tick list.

## Status of every OPEN item

Every `- [ ]` below carries a tag saying WHY it is open, because "not done" and
"cannot be done by me" are different things and the difference is what decides
what happens next. Three items are `READY(needs go)` — I can do them, they just write real data.
Everything else needs something from outside this session.

| Tag | Meaning | Count |
|---|---|---|
| `BLOCKED(you)` | Needs a decision, an asset, or a signed-in/real-world action from the team | 11 |
| `READY(needs` go) | **I can do it** — but it writes real data, so it needs an explicit go | 3 |
| `BLOCKED(backend)` | Needs an endpoint that genuinely does not exist (verified — see the inventory) | 3 |
| `BLOCKED(scan)` | Needs a real scan of a real nameplate to produce populated state | 2 |
| `BLOCKED(device)` | Needs hardware or a device setting I cannot reach (360dp, iOS) | 2 |
| `BLOCKED(build)` | Needs a native rebuild — gradle, not OTA | 2 |
| `BLOCKED(design)` | Needs something drawn that the canvas does not cover | 2 |
| `PARTIAL` | Underway, part done, rest blocked | 1 |
| `HELD` | Deliberately not done, with a stated reason | 1 |

⚠️ These tags are re-derived, not maintained by hand — several were WRONG when
first written on 2026-09-15 and had to be corrected the same day (`Field` was
not a design call, the deferred writes were not backend-blocked). Treat a tag as
a claim to re-check, not a fact.

**The shortest path to unblocking the most work** is the `BLOCKED(you)` column:
four are pure design calls (palette, dark sign-off, Browse strategy, the two
PENDING material questions), and one — a scan of a real nameplate — would on
its own clear both `BLOCKED(scan)` items and populate 7b–7e.


## What I am waiting for — the `BLOCKED(you)` items, as asks

Each row is the SPECIFIC thing needed, not the topic. Ordered by how much it
unblocks. Four of these are one-word answers.

**Row 1 is done** (2026-09-15) and is kept here as the worked example of why
these matter: one test login turned three invisible bugs into fixed ones inside
an hour. The rest are still open.

| # | I need | From | Unblocks |
|---|---|---|---|
| 1 | ~~A dev/staging test login~~ **✅ SUPPLIED 2026-09-15** — a seller account. A plain BUYER account is still wanted (buyer-side Matches/Messages differ). | you | ~~The single biggest gap~~ — now done, and it immediately exposed THREE bugs invisible to a guest: the sign-in gate's three dead buttons, its lost navigation, and Home not scrolling at all. Every v2 screen so far has been seen as a GUEST — real drafts, matches, verification state, the Matches add-a-want button and the whole signed-in half of Account have never rendered. Also the last unmeasured material ramp. |
| 2 | **One scan of a real nameplate** — point the phone at any equipment plate and shoot | you (physical) | Populates 7b–7e, which have only ever been seen holding an empty draft, plus the six `tinted` footer pills that depend on real field values. Clears both `BLOCKED(scan)` items. <br>*Workaround if easier: display a nameplate photo on a monitor and shoot that — the pipeline cannot tell the difference.* |
| 3 | **English-only at launch: yes or no?** | you / product | i18n. ~305 string sites × 6 locales (`en ja th vi zh-Hans zh-Hant`). Deferring is a real choice with a growing price — every screen finished in English adds ~20 strings to a later extraction. |
| 4 | **Detection mechanism: (a) or (b)?** <br>(a) wire `POST /recognition-jobs` so 7a starts its own run — the drawn design, needs background recognition enabled server-side. <br>(b) rebuild 7a around `useSmartDetect` — less work, proven in production. | you | Closes the v2 scan chain. Today the camera hands off to the SHIPPED processing screen, so the flow works but leaves v2 chrome mid-journey. |
| 5 | **Ship below WCAG AA: yes or no?** If no, `inkSubtle` `#8B9A92` → **`#65736B`** | Tehreem | 60 sites. Current value fails AA *and* AA-large on all three grounds. Value is solved and ready; the ramp tests guard the result. |
| 6 | **The `EN` badge: a control on every screen, or a label on every screen?** Today it opens the language sheet on 6a Home and `/v2/chat`, and is inert text on Matches, Messages, Account and Browse — identical in appearance on all six. | you / product | Six screens, one prop (`onLanguage`). Nothing is broken either way, so this is a consistency call, not a bug fix — but a badge that works on two screens and not on four teaches people the wrong thing. `BrandBar`'s comment says Account owns the switch, which Home and Chat contradict. |
| 7 | **The country picker omits every market this app is localised for** — Taiwan, China, Japan, Thailand, Vietnam, India (Singapore is the only Asian entry in 96). Extend the list, or let the field accept free text? | you / product | 7e, and the same file on web. The backend DEFAULTS to `country: 'Taiwan'`, and 7e's own "Use my location" wrote `India` on device — both unselectable, so a seller cannot edit a country the app itself set. The list is a verbatim port, so mobile and web must change together. |
| 8 | **`Bubble`: ramp or stay flat?** | Tehreem | One component. `TintedRow`, its analogue, ramps — but nothing currently forces it either way, which is why I did not decide it myself. |
| 9 | **Palette sign-off** — built as drawn (`#2E7D5B`); the brand guide says turquoise `#35C3AA` + navy | Tehreem | Every screen. Cheap now, expensive after launch. |
| 10 | **Dark-mode sign-off** — the canvas has no dark variant, I derived the whole palette | Tehreem | Every screen in dark. Derived values have been contrast-tested but never design-reviewed. |
| 11 | **Browse strategy** — t6 shell around the WebView now, or hold for native browse? | you | 6c. Native browse also needs the missing public listings endpoint (see the endpoint inventory), so "hold" may be the only real option. |
| 12 | **The banner image file** (`uploads/surplus into capital-banner image.webp`) | you / Tehreem | Two Home banners currently render the no-photo fallback. Drop the file in and set one constant. |
| 13 | **A go to wire the real writes** | you | The three `READY(needs go)` items. Each writes real data — a live listing, an account deletion — so I will not touch them on a nod. |

**If you only do two things:** a test login (#1) and one nameplate scan (#2).
Between them they unblock more than the other nine combined, because both
produce the populated states that nothing else can fake.

## Foundation

- [x] Poppins 400/500/600 installed + loaded
- [x] Colour tokens — light
- [x] Colour tokens — dark (derived, **not yet reviewed by Tehreem**)
- [x] Space / radius / type / icon / control scales
- [x] Motion tokens + press feedback
- [x] Theme provider (works while app is pinned to light)
- [x] `app/v2/` route group
- [x] Adherence test (blocks raw hex, raw type, off-scale values)
- [x] Contrast + ΔE test, both schemes
- [x] `v2-screen` build skill
- [x] Design screens extracted to `docs/v2-design/screens/`

## Kit

- [x] Screen (safe areas, header sheet, tab-bar reserve)
- [x] Text
- [x] Hairline
- [x] SectionHeader
- [x] SectionNote
- [x] BrandBar
- [x] Tabs
- [x] Row / RowThumb / RowTrailing
- [x] TintedRow
- [x] PromoBanner
- [x] Chip
- [x] ProgressLine
- [x] PrimaryAction
- [x] QuietAction
- [x] IconAction
- [x] Field + FieldIcon (text input — every 7x form screen needs it)
- [x] PillButton / Stepper / SoftPanel (promoted from the review flow)
- [x] EmptyState
- [x] GlyphButton (was `FieldIcon`)
- [x] Timeline / EnterOnMount / Shimmer
- [x] HomePager + PaneShell (two-pane swipe, no native dep)
- [x] SchemeToggleDev (dev only)
- [x] `PrimaryAction variant="tinted"` — the second action, on `accentWash`
- [x] **`Surface` + `theme/v2/material.ts`** — depth derived from a role, never
      invented. The ramp travels AWAY from its ink and the token colour is one
      END of it, so a material surface can never be worse for contrast than the
      flat one it replaces. `ramp()` takes the INK, not a `lightInk` flag: the
      answer flips with the scheme (a card is dark-on-light in light, near-white
      on dark in dark), and the flag version silently ran the gradient toward
      the label — 14.29:1 → 9.80:1. Caught by the ramp test before any screen
      used it. Applied to `PrimaryAction`; on device the pill measures
      #2D7B59 → #235F46 down its length.
- [x] **SignInSheet** — the guest gate in v2 tokens (`features/v2/auth/`).
      Same store and same copy as the shipped prompt, which stays mounted for
      the old UI. Copy now lives in one place (`features/auth/gateCopy.ts`).
- [x] **TabBar** — built from the canvas's `dc-import` facts (78pt, five tabs,
      `theme=light tone=soft`). `TabBar.dc.html` itself still needs
      `/design-login`; swap wholesale when it is reachable.

## Per-screen progress board

One row per screen, five columns, derived from what was actually observed —
not from whether the file exists. Added 2026-09-15 because the status had been
scattered across prose and nobody could answer "is 7c done?" without reading
the whole document.

**Columns.** *Built* = renders. *vs canvas* = its drawing's visible text diffed
against the live screen. *Pressed* = at least one control tapped and its effect
observed (⚑ = EVERY control pressed). *Real data* = seen holding a real
account's content, not a fixture. *L+D* = seen in both colour schemes.

| Screen | Built | vs canvas | Pressed | Real data | L+D |
|---|:--:|:--:|:--:|:--:|:--:|
| **6a** Home — selling | ✅ | ✅ | ⚑ all 11 | ✅ drafts + listings | ✅ |
| **6b** Home — buying | ✅ | ✅ | ⚑ all 8 | ✅ wants + matches | ✅ |
| **6c** Browse | ✅ WebView | n/a | ⚑ all 4 | ✅ 3,668 lots | ⛔ web-side |
| **6d** Matches | ✅ | ✅ | ⚑ all 6 | ✅ 12 wants / 20 matches | ✅ |
| **6e** Messages | ✅ | ✅ | ⚑ all 4 | ✅ 190 threads | ✅ |
| **6f** Account | ✅ | ✅ | ⚑ all 6 | ✅ 3-of-4, 20+, 24+ | ✅ |
| **7a** Analyzing | ✅ | ⚠️ copy only | ✅ empty state | ❌ unreachable | ✅ empty only |
| **7b** Review · photos | ✅ | ✅ | ⚑ all 5 | ✅ resumed draft | ✅ |
| **7c** Review · details | ✅ | ✅ | ⚑ all 9 | ✅ resumed draft | ✅ |
| **7d** Review · pricing | ✅ | ✅ | ⚑ all 9 | ✅ real bands | ✅ |
| **7e** Review · location | ✅ | ✅ | ⚑ all 10 | ✅ resumed draft | ✅ |
| **2a** Listing detail | ✅ | ✅ | ⚑ all 7 | ⚠️ fixture | ✅ |
| **2b** Place a bid | ✅ | ✅ | ⚑ all 5 | ⚠️ fixture | ✅ |
| **3a** Talk to assistant | ⛔ MODULE FAILS | ✅ | ❌ unreachable | ⚠️ fixture | ✅ dark by design |
| **3b** Scan an item | ✅ | ✅ | ⚑ all 5 | ✅ real capture | n/a viewfinder |
| Assistant (`/v2/chat`) | ✅ | not drawn | ⚑ all 12 | ✅ live controller | ✅ |
| SignInSheet | ✅ | not drawn | ✅ all 3 | n/a | ✅ |

### ⚑ Full control coverage

- **6d Matches — all six pressed (2026-09-15).** All / Active / Paused tabs, a
  match row (→ the shipped match detail: 85% AI MATCH, "Why AI matched you",
  Confirm interest), the "+" add-a-want, and the bell.
  **Found the 9th and 10th dead controls: the notification bells on Matches AND
  Chat were both `requireAuth('notifications', () => {})` — empty.** `index.tsx`
  already pointed at the shipped notifications screen, so three bells in one app
  disagreed about whether notifications open. Both now match Home.
  ⚠️ The earlier dead-control sweep MISSED these. It grepped for a literal
  `() => {}`, and a callback containing only a COMMENT is not literally empty.
  Re-run with a parse that strips comments — and with a control asserting the
  known-bad bell is caught — it found exactly these two plus three non-issues
  (the guest forks on matches/messages, deliberately unreachable, and a code
  comment in SignInSheet).

- **6f Account — all six pressed (2026-09-15), no bugs.** My listings (30 TOTAL,
  ~30s to load), Drafts, Offers received → the shipped inbox exactly as its
  comment documents, Profile information → the shipped account screen, Sign out
  (wired), Delete account (wired today — was dead).
  Note the load time: "My listings" shows "Loading your listings…" for ~30
  seconds against a real account. Not a hang — it resolves — but it is a long
  unexplained wait on a screen v2 sends people to.

- **6a Home (selling) — all eleven pressed (2026-09-15).** EN → the language
  sheet (six locales), the bell → notifications, Selling/Buying tabs, Scan it,
  "or type the details", "Ask the assistant" → `/v2/chat`, the promo banner,
  DRAFTS "See all", a draft card → the v2 review, LIVE LISTINGS "See all", and
  a listing row.
  **Found the 11th broken control — and this one was not dead, it was HALF
  alive.** Tapping `Buying` moved the tab indicator and left the pane on
  Selling. `reanimated-tab-view`'s `TabView` reads `navigationState.index` ONCE
  to seed its own state and ignores it afterwards, so the half of the header
  rendered from `page` moved and the half owned by the library did not. It is
  now driven through the library's `jumpTo` ref, guarded so a SWIPE does not
  re-jump the pane the finger has already moved. Proven on device in both
  directions, swipe still works, 3 regression tests in
  `src/features/v2/home/__tests__/HomePager.test.tsx`.
  ⚠️ **A screenshot of this bug looks correct** — the tab you pressed is
  visibly selected. It is only visible if you read the pane's text as well.

  **FIVE of 6a's eleven controls hand off to the OLD UI.** This matters for the
  "delete the old UI" step and is recorded here because nothing else lists it:

  | 6a control | lands on | old-UI file |
  |---|---|---|
  | or type the details | Listing method | `app/scan/listing-method.tsx` |
  | promo banner | Browse (lab tabs) | `app/(lab)/(tabs)/browse` |
  | DRAFTS · See all | Your drafts (24 items) | `app/scan/drafts.tsx` |
  | LIVE LISTINGS · See all | My listings (30 total) | old listings screen |
  | a listing row | Batch detail | old batch-detail screen |

  Each is a `TODO(v2-nav)` in code, so none is a surprise — but the count is:
  Home alone cannot survive deleting the old UI, and the old tab bar
  (`Chat`, not `Messages`) is visible the moment any of the five is pressed.

- **6e Messages — all four pressed (2026-09-15), no bugs.** `All 190` and
  `Unread 2` (the list really does filter: seven visible threads down to the two
  unread, both on Lot #5480 — the same duplicate-pair that caused the React key
  collision), a thread row, and the bell → notifications.

- **Not a bug, but an inconsistency worth a decision: the `EN` badge is a
  CONTROL on two screens and a LABEL on four.** `BrandBar` renders it as a
  `Pressable` only when given `onLanguage`, and otherwise as plain text — so
  nothing is dead. But it looks identical either way:

  | screen | `EN` opens the language sheet |
  |---|:--:|
  | 6a Home | ✅ |
  | `/v2/chat` | ✅ |
  | 6d Matches | ❌ label |
  | 6e Messages | ❌ label |
  | 6f Account | ❌ label |
  | 6c Browse | ❌ label (no badge passed) |

  `BrandBar`'s own comment says *"display label only — the real switch lives on
  Account › Language"*, which Home and Chat contradict. Someone who changes
  language from Home will tap it on Messages and get nothing.
  **Decision needed (yours):** wire `onLanguage` on all six, or remove it from
  Home and Chat and let Account own it. I have no canvas evidence either way,
  and it changes six screens, so I have not picked. Everything else about the
  bar is consistent.

- **7b–7e Review — every reachable control pressed (2026-09-15).** Two writes were
  deliberately NOT pressed and stay `READY(needs go)`: **Save as draft** (on all
  four steps) and **Submit listing**. Submit is correctly `enabled=false` on this
  draft, gated by "Needs a category" — the gate works.
  - **7b** back, the photo thumbnail, ADD, Continue. The thumbnail is
    `setActive(i)`, so on a one-photo draft "nothing happens" is the correct
    result, and "Rearrange" is deliberately hidden below two photos. Neither is
    a dead control; both are unexercised until there is a multi-photo draft.
  - **7c** back, all five text fields (each focuses and raises a keyboard; YEAR
    correctly gets `number-pad`), the CATEGORY **Choose**, and all five
    CONDITION chips.
  - **7d** back, Buy now / Make offer (Make offer swaps in its own explanatory
    copy), the price field (`decimal-pad`), the quantity stepper up AND down —
    it re-disables at 1 — and both CURRENCY chips (the price prefix follows).
  - **7e** back, Use my location, the address field, the country picker, Add
    another location, Remove additional location, and both INSTALLATION chips
    (the hint becomes "Buyer needs to deinstall + ship" — the consequence, not a
    restatement). Adding a location correctly flips the timeline to "Needs a
    pickup address".

- **FIXED on 7c: the category notice told sellers a falsehood in the one case it
  mattered.** Tapping **Choose** on a draft the scan could NOT place said *"the
  category the scan chose is what will be published"* — while the row above it
  read "Not set yet · We could not place this one". There is no category to
  publish, and the listing cannot be submitted without one. The notice is now
  keyed off the SAME value the row renders (`categoryLine(draft)`, not
  `categoryId` — an id can be set while its names come back blank, which is this
  account's actual draft shape) and says so plainly. Verified on device.

- **⚠️ The country picker cannot express the markets this app is BUILT for.**
  `src/features/scanner/constants/countries.ts` is a 96-entry list ported
  verbatim from the web, and its own header admits it omits Taiwan, China,
  Japan, India, Thailand, Vietnam, Indonesia and Malaysia. Set against the six
  locales the app ships (`en ja th vi zh-Hans zh-Hant`), **every non-English
  locale's home country is missing**: ja→Japan, th→Thailand, vi→Vietnam,
  zh-Hans→China, zh-Hant→Taiwan. Singapore is the only Asian entry present.

  This stopped being theoretical on device today:
  - The resumed draft's country is **Taiwan** — which the picker cannot
    re-select. Searching it returns *"No countries match 'Taiwan'"*.
  - **7e's own "Use my location" button set the country to India** from a real
    GPS fix — another value its own picker cannot represent. The app can write a
    country it cannot then edit.
  - The backend defaults `country: 'Taiwan'` when AI omits the field
    (`controller/wordPress.js:452-459`), so the DEFAULT is unselectable.

  The source comment asks for a decision between extending the list and allowing
  free text. **That decision is now row 7 of the waiting table** — it is not a
  mobile-only bug (web has the identical list), so fixing it in one place only
  would split them.

- **2a Listing detail — all seven pressed (2026-09-15). Found TWO more dead
  controls, both `onPress={() => haptics.tap()}`.** Back, Save, Share, Read the
  full description (a real toggle — "Show less" on the way back), and Place bid
  all worked. **"Make offer" and the seller "Message" key each fired a haptic
  and returned.** A buzz is worse than nothing: it confirms the tap landed, so
  the missing screen reads as a hang. Both now name their own gap in the same
  shape the review steps use, verified on device. The file header claimed "both
  footer actions are inert", which was wrong twice over — Place bid routes to
  2b, and Make offer was not inert but dead — and is corrected.

- **2b Place a bid — all five pressed, one more silent haptic.** Close, the
  three quick-bid chips and Review bid. Review bid is held back ON PURPOSE (a
  bid is a binding write against money) but it was held back as a bare buzz, on
  the one screen whose own copy says *"bids are binding"*. It now says
  "the bid confirmation step is not built yet — nothing has been sent."
  The big amount is a `Text`, not an input — documented as deliberate ("the
  chips are the whole input on this pass"), so it is not a missed control.

- **3b Scan an item — all five pressed, no bugs.** Cancel, Flash (off→on), Add
  files, Capture and Flip. Flipping to the front camera correctly REMOVES the
  flash control rather than leaving a dead one.

- **Assistant `/v2/chat` — all twelve pressed, no bugs.** EN → the language
  sheet, the bell → notifications, Selling/Buying (these switch content
  directly and do NOT have Home's pager defect), all three suggestions, the
  composer, Take a photo, Attach a document, and the five tab-bar items. **Send
  is correctly `enabled=false` on an empty composer.** Note that "Take a photo"
  opens the SYSTEM camera, not v2's own 3b viewfinder — that is deliberate reuse
  of the shipped `useAttachmentPicker`, but it does mean v2 has two different
  camera experiences depending on which door you came through.

- **🚫 3a is UNREACHABLE — it has no entry point at all.** This is a downgrade
  from its previous ✅ row, and the strongest single argument for the ⚑ pass.
  - Nothing in the app navigates to it. `routes.v2Voice` is DEFINED at
    `src/lib/routes.ts:50` and **used by no file** — the first grep for the path
    string missed it, the grep for the constant settled it.
  - Its deep link does not resolve either, and that is not a flaky probe: from
    the same Home state, `lot`, `bid`, `chat`, `matches`, `browse`, `account`
    and `buying` all resolved and only `voice` did not. The route IS present in
    the Metro bundle (`V2VoiceRoute` ×4), so it is bundled but not routable.
    **Root cause not yet established — do not guess it.**
  - So its `Pressed` column cannot honestly be filled: a user has never been
    able to open this screen. Its canvas parity still stands (it was drawn and
    compared), and its whole surface is documented static — the mic, camera,
    speaker, "Use this" and quick replies are all inert by design — so the work
    to finish it is an entry point PLUS five wirings, not a re-layout.

- **6b Home-buying — all eight pressed (2026-09-16). Two more defects, and one
  of them was the sharpest mismatch found so far.**
  Type it, "or browse the open lots", the assistant row, the banner, YOUR WANTS
  "See all 12" → 6d, a want row → that want's match list, MATCHED FOR YOU
  "See all 96" → 6d, and a match row → the match detail.

  **FIXED — the buying pane's assistant opened the SELLING assistant.** The row
  reads *"Find an LC-20 under $12k"*; tapping it pushed the shipped
  `/(lab)/chat`, which is headed **"Sell with AI — What are you selling?"**. A
  buyer was handed the seller flow by the one control that had just offered to
  find them a lot. The banner on the same pane did the same thing. Both now push
  `/v2/chat`, like 6a.

  The mode is not a route param — `/v2/chat` reads it from the shared
  `useComposer` store — so **both panes now set their own mode before
  navigating** rather than inheriting whatever the last screen left behind.
  Without that, 6a would have opened "what are you looking for?" for a seller
  the moment anyone had visited 6b first. Verified in both directions on device:
  6a → "Describe what you are selling", 6b → "Say what you need and it searches
  the marketplace for you".

- **FIXED — deep-linking to the buying pane showed the wrong pane.**
  `/v2/buying` redirects to `/v2?mode=buying`, so Home mounts with `page`
  already 1 — but `TabView` starts its carousel on the first route regardless,
  so the tab row said **Buying** while the pane underneath showed **Selling**.
  The same split as yesterday's tab-press bug, reached by deep link instead of
  by tapping, and it survived yesterday's fix because that guard treated the
  mount case as already-satisfied.
  Two changes: the guard now seeds from 0 (where the carousel actually starts),
  and `TabView` is given an `initialLayout` width — without it the carousel has
  zero width on the first render and a mount-time `jumpTo` is silently a no-op.
  A fourth regression test covers the mount case.

  ⚠️ **Still open, deliberately not fixed:** if Home is ALREADY mounted, a
  `/v2/buying` deep link does not move the pane, because `mode` is read only in
  a `useState` initialiser. Nothing in the app navigates to `/v2/buying` (the
  tab bar targets `/v2` and lists `/v2/buying` only for active-state matching),
  so this is deep-link-only. Syncing the param on every render risks fighting
  the swipe, which is the bug that started all of this — worth doing carefully,
  not in passing.

- **Copy question on 6b's banner (yours).** It is drawn and coded with the
  eyebrow **FOR BUYERS** over the headline *"Skip the valuation — we price it
  for you"*. Valuation is the SELLER flow. Either the eyebrow or the headline is
  addressed to the wrong person; I have not guessed which.

- **6c Browse — pressed and holding real data (2026-09-16). Its row was three
  `n/a`s and one of them was simply wrong.** The embedded marketplace loads
  **3,668 lots open for bidding** with photos, prices and LIVE badges, so
  `Real data` is ✅, not `n/a`.
  Four controls exercised: the v2 bell → notifications; the web **Filters**
  sheet (real category counts — 1,425 Lab Infrastructure, 307 Cold Storage);
  a listing's **View**, which opens the lot detail **inside the app**
  (`MainActivity` stays foreground — it does not bounce anyone to a browser);
  and Android **back**, which steps through WebView history rather than leaving
  the screen, because `MarketplaceWebView` installs a `BackHandler` that calls
  `goBack()` while `canGoBack`.
  ⚠️ **uiautomator cannot see inside a WebView** — the text dump is identical
  before and after every one of those taps. On this screen a screenshot is the
  only probe that can tell a working control from a dead one, which is the exact
  inverse of every other screen in this document.

  **`L+D` is marked ⛔, not ❌ — it is not achievable from mobile.** The WebView
  is handed no colour scheme (`MarketplaceWebView` passes only a `uri`), so the
  embedded page renders in its own styling whatever the app is set to. Dark
  parity here is web-side work, not a mobile gap.

  **Two chrome observations, neither a bug on its own:**
  - Three bands of chrome stack before any content — v2's GREENBIDZ bar, then
    the page's own 101LAB header, then the page's search bar. `UX_DESIGN_RULES`
    calls out duplicate controls; this is the clearest instance in v2.
  - The lot detail reads **"Listed by <seller name>"**. `CHATBOT_RULES` forbids
    the assistant from surfacing a seller's name, while the marketplace we embed
    prints it on every lot. The rule is scoped to chat so this breaks nothing,
    but the two surfaces in one app disagree about whether a buyer may know who
    the seller is.

- **3a — narrowed from "unreachable, cause unknown" to a located fault
  (2026-09-16).** Yesterday this row said the route did not resolve and the root
  cause was not established. It is now bisected on the device:

  | test at `/v2/voice` | result |
  |---|---|
  | the real 487-line screen | **`+not-found`** |
  | a trivial component at the same path | routes instantly |
  | all of its real imports + a trivial render | routes |
  | its real `V2ThemeProvider` wrapper + `Screen` | routes |
  | a brand-new throwaway route in the same folder | routes instantly |

  So **route registration is healthy and the URL is correct** — the fault is in
  this module's own body, below the provider shell. A module that throws while
  being evaluated never registers its route, and expo-router then serves
  `+not-found`, which is indistinguishable from a missing file. That is why the
  first pass read it as "no route".

  Two things this ALSO rules out, both of which I had guessed at: it is not a
  stale Metro route context (`voice.tsx` is older than `lot.tsx` and `bid.tsx`,
  which both route fine, and a file created mid-session routed immediately), and
  it is not the filename.

  **Lead for whoever finishes it:** Metro's log holds
  `ReferenceError: Property 'GUTTER' doesn't exist` with the stack
  `<global> (app/v2/voice.tsx)` — a module-scope failure, which is exactly the
  shape that produces this symptom. `GUTTER` is used at module scope in this
  file's `StyleSheet.create` (lines 436 and 454) and is a plain `const` export
  from `theme/v2/scale.ts`, so a temporal-dead-zone hit through a circular
  import is the obvious suspect. ⚠️ **But that log entry is 40.3 hours old and
  came from a hot update — no error was logged for this file today**, so treat
  it as a lead, not the answer. Verified by timestamp arithmetic against the
  log's newest entry, not by eye.

  **Still separately true:** nothing navigates here even if the module is fixed.
  `routes.v2Voice` is defined at `src/lib/routes.ts:50` and used by no file.
  Finishing 3a is: fix the module, add an entry point, then wire the five
  controls its own header documents as inert.

- **3a — root cause LOCATED to one line (2026-09-16). The screen is fine; its
  waveform animation is what stops the route opening.**

  Removing `<Waveform />` makes the whole screen render — header, three
  transcript turns, priced answer, quick replies, composer. So nothing is wrong
  with the module, the route, the imports, the styles or the fixture; the
  earlier "unreachable / no entry point" reading was two separate problems
  stacked, and this is the one that matters.

  Bisected to `Bar`'s animation, then characterised by varying only the repeat:

  | animation in the waveform | route opens? |
  |---|:--:|
  | none (effect disabled) | ✅ |
  | one-shot `withTiming` | ✅ |
  | `withRepeat(…, 4, true)` | ✅ |
  | `withRepeat(…, 100000, true)` | ❌ |
  | `withRepeat(…, -1, true)` × 11 bars (shipped) | ❌ |
  | `withRepeat(…, -1, true)` × 1 shared driver | ❌ |
  | `-1` deferred via `InteractionManager.runAfterInteractions` | ❌ |

  So within this screen it is **not** the bar count and **not**
  infinite-versus-finite: a three-second loop opens, an endless one does not.
  Nothing is logged in Metro or logcat either way, which is why this looked like
  a missing route for two days.

  ⚠️ **Do not read that as "endless animations break screens" — I checked, and
  it does not generalise.** Five other files use `withRepeat(…, -1, …)`:
  `(lab)/chat` gates its one on `live && !reduced` (streaming only), and 7a's
  two live in `StepDot`/`Shimmer`, which its empty state never mounts — so
  neither is a counterexample. But **`app/(auth)/pending.tsx` starts FOUR of
  them unconditionally in `useEffect` on mount**, and that is a shipped screen.
  I could not reach it to test (its deep link does not route and it needs a
  pending-approval account), so it stands as a likely counterexample I have not
  ruled out. The honest scope of the table above is *this screen*, not the
  pattern.

  **Not fixed, and deliberately left alone.** Three candidate fixes were tried
  on the device and all three failed, so anything further would be guessing at a
  mechanism I have not established. The file is restored byte-identical to how
  it was found. Since nothing in the app routes here anyway
  (`routes.v2Voice` is used by no file), the screen is no worse off — but this
  is now a one-line problem with a reproducible test table, not a mystery.

  **Do not "fix" this by deleting the waveform.** It is the screen's whole
  claim — the canvas note is *"live waveform while speaking"*.

### ⚠️ v2 HAS NO DOOR — the whole UI is deep-link only (found 2026-09-16)

Raised by the user watching the device keep landing on the old screens. Checked,
and they are right:

- `app/index.tsx` redirects a launch to **`/(lab)/(tabs)/home`** — the OLD UI.
- **Nothing outside `app/v2/` navigates into v2.** A grep for `push`/`replace`/
  `navigate`/`href`/`Redirect` onto any `/v2` path across all of `app/` and
  `src/`, excluding v2's own files, returns **zero** results.

So every reload drops back into the old app, and every v2 screen this checklist
calls verified was reached by `adb` deep link. That is fine for review and it is
why the work has been possible — but it means v2 ships to nobody until a door
exists, and it makes 3a's missing entry point a symptom rather than the disease.

It also reframes how the ⚑ passes should be read: the screens work, and the
thing between them and a user is one routing decision, not fifteen.

**Decision (yours), because it changes what people see:**
1. Flip `app/index.tsx` to v2 behind an env flag — v2 for us, old UI for everyone
   else, one line, reversible.
2. A dev-only entry from the old Account screen — lowest risk, nothing user-facing.
3. Leave it deep-link only until v2 is signed off.

I have not picked: option 1 changes the app's front door.

### Pre-submission inventory — every v2 control that does not yet do its job

Compiled 2026-09-16 by grepping the code, not from memory, because this is the
list App Review walks into. Guideline **2.1 (App Completeness)** treats a
visible control that only explains itself as an unfinished app, and every one of
these is currently visible.

**Seven controls explain themselves instead of working.** Each prints a sentence
rather than acting. That is deliberate and better than the silent haptics they
replaced — but the sentence must not ship.

| # | Screen | Control | What it says |
|---|---|---|---|
| 1 | 2b | Review bid | the bid confirmation step is not built; nothing sent |
| 2 | 2a | Make offer | offers are not rebuilt in this UI |
| 3 | 2a | Message seller | this lot is sample data, so there is no seller |
| 4 | 7c | Category → Choose | the picker is a separate screen, not rebuilt |
| 5 | 7c | Save as draft | saving is not wired up in this build |
| 6 | 7b | Rearrange | reordering photos is not wired up |
| 7 | 7b | Save as draft / marketplace | saving is not wired up in this build |

*(Counted at 8 on the first pass — `matches.tsx:365` was a false positive: the
grep matched the word `defer()` inside a comment, and that control is a real
navigation. Verified by reading each site.)*

**Three writes are built-but-held, which is a different thing and is fine.**
7d and 7e's *Save as draft* genuinely commit locally and navigate back — the
draft is on the device and resumable — with only the server POST left as a
documented `TODO(v2-writes)`. 7e's *Submit listing* is correctly `disabled` by
the completeness gate. None of these lies to the user.

**Four asks in the waiting table re-verified today against the code**, so none
of them is stale: `inkSubtle` is still `#8B9A92`, both `BANNER_PHOTO` constants
are still `null` with no asset in the repo, `MARKETPLACE_PICKER_ENABLED` still
defaults off, the country list is still 96 entries, and `onLanguage` is still
wired on exactly two of six screens.

### What the gaps actually are

**`L+D` — the review flow and Messages were the hole, and it is now closed
(2026-09-15).** 6e, 7b, 7c, 7d and 7e all checked in dark on device: dark header
sheets, the timeline's active/inactive dots still separable, the Profit
Intelligence card legible on `wash`, the "1 of 1" light pill correctly staying
light over the photograph, and both footer actions reading as actions. No
defects found.
**Completed the column the same day.** 6d, 6f, `/v2/chat` and 7a re-checked in
dark SIGNED IN (the earlier ✅s for the tabs were taken as a guest, which is a
different screen): Matches with real photos and relevance chips on
`accentWash`, Account with the verification bar and the 24+ chip, the assistant
with its composer, 7a's empty state. No defects in any of them.
**6a and 6b populated-dark re-taken too** — Selling with its drafts rail (age
chips on `accentWash`) and LIVE LISTINGS, Buying with two saved wants, "MATCHED
FOR YOU · See all 96" and real listing thumbnails. Correct in both.
⚠️ Remaining gaps in this column, and they are the only ones: 7a's RUNNING
state is unreachable so only its empty state is covered, and 6c is a WebView
whose colours belong to the web page.
**Nothing was wrong in dark on any screen.** That is a real result rather than
a null one: the dark palette was DERIVED (the canvas has no dark variant) and
contrast-tested, but had never been seen carrying a real account's content. It
does not replace Tehreem's sign-off — it removes "does it even hold up" from
that conversation.
Context: dark is reachable only through the dev toggle
(`userInterfaceStyle` is pinned to light), so none of this is a shipping defect
today — it is surface that becomes one the day dark ships.

**`Real data` on 2a / 2b / 3a is a fixture and will stay one** until there is a
public listings endpoint (2a/2b) or voice (3a). Marked ⚠️ rather than ✅ so the
distinction does not quietly disappear.

**7a is the only screen whose main state has never been rendered.** Its copy
matches the canvas line for line, but the running state needs a
`recognition-jobs` job and nothing in v2 can start one — the undecided (a)/(b)
fork. Copy parity is recorded as ⚠️, not ✅, because it is a weaker claim.

**⚑ Every-control coverage is claimed for no screen.** One control per screen is
the current bar. The two bugs found on 2026-09-15 by pressing a SECOND control
(Matches "+", Account "Delete account") are the argument for raising it.

## Screens — 15 of 15 DRAWN screens built

⚠️ **Corrected 2026-09-14.** This section said "12 of 12" and that was wrong.
It counted the screens extracted from turns 6 and 7 — but the canvas
(`Greenbidz mobile app redesign/GreenBidz Mobile App.html`) has seven turns,
and **t2 and t3 are additions, not colour iterations of the six tabs**:

  t1        first pass at the six tabs        superseded
  t2        2a Listing detail · 2b Place a bid   ← never built
  t3        3a Talk to the assistant (voice)
            3b Scan an item (camera)             ← never built
  t4, t5    the same six tabs in two other colour directions  superseded
  t6, t7    what is built

t4/t5/t6 ARE the same six screens three ways and t6 won. t2 is headed "The two
screens the recording didn't cover" and t3 "Camera and voice, made visible" —
both are extra. Extracted to `docs/v2-design/screens/t2-full.html` and
`t3-full.html`.

The count: **15 drawn** (6 in t6 + 5 in t7 + 4 in t2/t3), **15 built** — 11 at
the time this section was corrected, plus 3b, 2a, 2b and 3a since.

⚠️ **"All 15 drawn screens are built" does NOT mean the UI is done.** Four of
them (2a, 2b, 3a, and 6c's real replacement) render fixtures, not data, and the
writes are still deferred. What is finished is the LAYOUT pass the user asked
for: every drawing has a screen, in v2 tokens, checked on glass in both schemes
with a control pressed. See "Still open" below.

**The assistant is now TWO screens and that is the open question.**
`app/v2/chat.tsx` was built to a brief when 3a appeared undrawn — a text
composer with suggestion rows, wired to the real `useChatController`. `t3a` is
the drawing that later surfaced, and it is a VOICE turn; it is now built as
`app/v2/voice.tsx`, static. They are two modes of one assistant, and nothing
routes between them yet. Reconciling them is a design decision, not a port:
either voice becomes a mode the text screen can enter, or the text composer
becomes the "Tap to type" state of the voice screen. **Needs a call before
either is wired.**

- [x] **2a Listing detail** — BUILT and pressed on device, both schemes.
      `app/v2/lot.tsx`. Photo hero bleeding under the status bar, identity,
      the price block, a 2×2 spec grid, a collapsible description and the
      seller row; footer is tinted "Make offer" + "Place bid".
      **STATIC** — renders `src/features/v2/mock/lot.json` via `MOCK_LOT`. The
      fixture is shaped like the response it stands in for, so wiring it is
      `useLot(id)` in place of `MOCK_LOT`, not a re-layout. Both footer
      actions are inert except "Place bid", which navigates to 2b.
      Pressed: "Place bid" → 2b, and the save heart (fills).
      Two things the canvas corrected after the first pass — I had the hero
      chrome exactly inverted (`t2-full.html:20-24`): the round controls are
      the LIGHT pill (`rgba(255,255,255,.94)`, dark glyphs) and the photo
      counter is the DARK scrim at bottom-LEFT, where I had built dark
      controls and a light counter on the right. `ScrimPill` gained a
      `tone="scrim"` for it, since which weight a pill takes over photography
      is a kit decision, not a per-screen one.
      The no-photo hero ground then had to move `fill` → **`scrimFallback`**.
      Once the round controls are white, a pale `fill` makes them disappear —
      the chrome is drawn for a PHOTOGRAPH, so the stand-in must behave like
      one. `scrimFallback` is the role that exists for exactly that and does
      not flip; `PromoBanner` had already made the same call for the same
      reason. Side effect worth having: the status-bar glyphs are legible over
      the hero now, which they were not on the pale ground.
- [x] **2b Place a bid** — BUILT and pressed on device, both schemes.
      `app/v2/bid.tsx`. The amount big and centred, three quick bids, the
      verdict line, and the WHAT YOU'LL PAY breakdown (bid, buyer fee 5%,
      collection, total if you win) computed locally from `MOCK_LOT`.
      **STATIC and INERT** — "Review bid" does nothing. Placing a bid is a
      real write against money and belongs behind a confirmation step that
      does not exist yet. Below the minimum the action disables rather than
      warning, because the server rejects it anyway.
      Pressed: each quick bid re-computes fee and total ($8,400 → $420 →
      $8,820; $9,000 → $450 → $9,450).
      The first pass hand-rolled the quick-bid chips and signalled the
      selected one with `accentWash` against `fill` — a ground-vs-ground
      difference far under the 3:1 WCAG 1.4.11 asks of a component boundary,
      and on glass the three read as identical. Replaced with the kit's
      `PillButton tone="choice"` (filled accent + ✓), which is what every
      other either/or in v2 already is. Borrowing it was the fix; the bespoke
      pill was the bug.
- [x] **3a Talk to the assistant** — BUILT and pressed on device. `app/v2/voice.tsx`.
      The VOICE turn: a top bar with close / "Assistant" / "• Listening" /
      speaker, a three-turn transcript (assistant ask → the person's photo +
      spoken reply → a priced answer with SUGGESTED ASK $4,600 and "Use this"),
      two quick replies, and a composer whose camera key and mic are the SAME
      size — the canvas's own structural point, that showing the assistant
      something is not a lesser act than telling it.
      **STATIC and almost entirely INERT** — renders `MOCK_VOICE` from
      `src/features/v2/mock/voice.json`. Nothing listens, speaks, sends or
      records. The one live control is the camera key → 3b, which is pressed
      and verified.
      **DARK IN BOTH SCHEMES**, by nesting `V2ThemeProvider initialPreference="dark"`.
      The canvas draws 3a on `#16261F` and that is a MODE, not a colour
      direction — a voice turn is a call. Nesting the provider rather than
      adding non-flipping `voice*` roles keeps the palette from growing a
      second near-identical set. The canvas's own greens (`#7ED9A8`/`#0B2A1E`)
      are NOT followed: they belong to a superseded direction (t6 won), so the
      layout is the canvas's and the palette is v2's.
      The waveform animates. A frozen waveform under a label reading
      "Listening" contradicts its own caption — and unlike 3b's live read-out
      it can be honest while static, because it claims UI state, not a result.
      `timing()` carries `ReduceMotion.System`, so it stops when asked.
      Two kit gaps closed rather than inlined: **`Bubble`** (the kit had no
      conversation primitive; `chat.tsx` had flagged it and inlined its own)
      and **`PillButton tone="filled"`** (a 34pt filled action for inside a
      card — `PrimaryAction`'s 54pt slab would outweigh the card holding it).
      ⚠️ `Bubble` deliberately does NOT match `chat.tsx`, which boxes only the
      user and lets the assistant answer as prose. That is right for a long
      written answer; a voice transcript of short alternating turns needs both
      sides boxed or there is nothing to show where a turn started. `chat.tsx`
      is NOT migrated onto it — see the reconciliation item below.
- [x] **3b Scan an item** — BUILT and pressed on device: corner-mark guided
      frame, "Frame the nameplate", flash, shutter, and a roll chip that counts
      up. Capture path BORROWED from `app/scan/camera.tsx` (takePictureAsync →
      compressPhoto → `useScanDraft.start`), chrome new. Two things found by
      using it: the first version put "Tap the count to read it" under the bar,
      which collided with the shutter and was vague — the chip now says
      "Review 2"; and a raw `#000` was caught by the adherence test, so the
      palette gained a non-flipping `viewfinder` role (a viewfinder is a hole
      in the app, not a surface of it).
      NOT built: the live read-out over the frame. It needs background
      recognition (`EXPO_PUBLIC_BACKGROUND_RECOGNITION`, currently off), and a
      chip that never fills is a control that only explains itself.
      ⚠️ I had previously written that the canvas has no camera screen and that
      handing off to the shipped camera was therefore correct. That was wrong —
      I had checked the extracted subset, not the canvas.

**2a and 2b are the BUYER half of the app**, and they are now drawn but not
fed. Nothing in the running app routes to `/v2/lot` — it is reachable only by
deep link (`greenbridge://v2/lot`) — because a lot detail with no list in front
of it has no entrance. The entrance is 6c Browse, which is still the WebView,
still waiting on the same public listings endpoint. When that lands, one
`useLot(id)` swap turns both screens live and "place bid" finally has a home.

## Screens built — 12 (6c is an interim, see below)

- [x] 6a  Home — selling
- [x] 6d  Matches
- [x] 6f  Account
- [x] 6b  Home — buying (now a PANE of 6a, swipeable; `/v2/buying` redirects)
- [x] 6e  Messages inbox — the screen `6e.html` actually draws
- [x] Assistant — built to brief; not drawn on the canvas at all
- [x] 7a  Analyzing
- [x] 7b  Review — photos
- [x] 7c  Review — details
- [x] 7d  Review — pricing
- [x] 7e  Review — location
- [~] 6c  Browse — **INTERIM.** v2 brand strip (`headerFlush`) over the working
      marketplace WebView. NOT the drawing: 6c draws a native list with search,
      four filter chips and lot cards, and **no browse endpoint exists in the
      app** (checked `src/api` + the lab hooks), which is why browsing has
      always been a WebView. Built so the Browse tab is not a dead destination.
      Replace wholesale when the listings endpoint lands.

## ✅ FIXED — Home's controls were inert (found 2026-09-03 by pressing them)

`Scan it` — the app's primary action — and the whole assistant row did nothing,
and had done since `reanimated-tab-view` replaced the hand-rolled pager.

**Cause:** `TabView` wraps the panes in a `GestureDetector`. RN's `Pressable`
uses the JS responder system, which RNGH intercepts natively, so inside the
pager it never receives the tap. The pan needs 10px to activate, so tap and
swipe were never in competition — RNGH just will not pass a touch to a foreign
responder inside its own detector.

**Fix:** all 14 kit components import `Pressable` from
`react-native-gesture-handler`. Proven by bypass → restore → fix, one variable
at a time. `Scan it` now opens the sign-in sheet with the pager in place
(header #EDF6F1 → #3E4C47 on device).

**Side effect, also fixed:** RNGH's Pressable does not clip children like RN's,
so `PromoBanner`'s square fill painted over its 26pt corners (corner pixel
#FFFFFF → #1A3A2B). Both fills now carry their own radius; re-measured
#FFFFFF. Anything relying on a parent's `overflow: 'hidden'` is suspect —
see `MISTAKES.md`.

⚠️ The "verified on device" ticks made before this point came from SCREENSHOTS
and cover appearance only. A screen counts as verified when a control on it has
been PRESSED. Re-doing those: see the list below.

## Fixed by PRESSING controls, 2026-09-03 (not by looking at them)

- [x] **Home's controls were inert** — see the block above.
- [x] **Two sign-in sheets stacked on every v2 gate.** The old `SignInPrompt`
      stayed mounted with the v2 one and rendered off the same store; in dark
      you could see the light backdrop (#76827E) above the dark sheet. The old
      prompt now returns null under `/v2`. My own docblock had predicted this
      and I had not guarded it — `MISTAKES.md`.
- [x] **The lit edge escaped every pill.** It was a 1pt strip with a 999pt
      radius, which cannot render a curve; it drew straight across and only
      looked right while a parent clip hid it. Now a third gradient stop at 5%,
      so it follows the shape and costs one fewer view. Outside the pill:
      #28332E → #08150F.
- [x] Account: **Sign in pressed**, correct per-reason sheet.
- [x] Matches: **pill pressed**, sheet opened.
- [x] Home: **Scan it pressed**, sheet opened.
- [x] **6b Home — buying**: seen for the first time (dark), swipe works with the
      tabs holding still, and "Type it" pressed → the *want* gate opened with
      the right per-reason copy.
- [x] **6e Messages**: "Sign in to message sellers" pressed → *message* gate.
      Also its first look in dark.
- [x] **Assistant**: reached by PRESSING Home's assistant row — the control
      that was dead — then the composer pressed, `mInputShown=true`. Dark, first
      look.
- [x] **7a Analyzing**: "Scan an item" pressed → navigates to the real camera,
      which asks for permission. The `EmptyState` fix verified in dark.
- [x] ~~7b–7e: cold-open only~~ — **STALE, corrected 2026-09-15.** All four
      rendered populated today from a resumed valuation draft and were walked
      end to end in v2 chrome (7b 25% → 7c 50% → 7d 75% → 7e 100%), with the
      real photo, title, price and bands. "They need a real scan" was true when
      written and stopped being true when drafts became resumable.
- [ ] `BLOCKED(backend)` 6c Browse: the controls belong to the web page, so pressing one tests the
      marketplace site rather than v2. Left deliberately.

⚠️ ~~"Scan an item" lands on the OLD UI's camera~~ — **STALE, corrected
2026-09-15 and verified by grep: there are ZERO `routes.scanCamera` references
left anywhere in `app/v2` or `src/features/v2`.** All six v2 scan entry points
(7a, and the four review steps' empty states, plus 7b's ADD tile) now use
`routes.v2Camera` / `v2CameraAppend`. That was fixed when 3b was built; the note
simply outlived it.

What IS still true: the camera's `onDone` hands to the SHIPPED processing screen
(`routes.scanProcessing`), because starting a `recognition-jobs` run is the
undecided (a)/(b) fork. So v2 owns the camera but not yet the detection step.

## Working on a device — the recipe (it is fiddly)

1. Metro on **8082** (`npx expo start --dev-client --port 8082`). NOT 8081 —
   that is the Vite web server. **Never `CI=1`**: it prints "reloads are
   disabled" and you lose Fast Refresh.
2. `adb reverse tcp:8082 tcp:8082`.
3. Load the bundle: `am start -a android.intent.action.VIEW -d
   'greenbridge://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082'`
   (Git Bash needs `MSYS_NO_PATHCONV=1` or it mangles the URL).
4. Then `-d 'greenbridge://v2'`. The app root renders blank for a guest and
   cold starts land on the OLD UI, so this link is what gets you into v2 —
   resend it if you get the old home.
5. Gradle: `-Xmx2g --max-workers=1`. The committed `-Xmx3g` with two workers
   OOMs a 32 GB machine once daemons are resident — a 512 MB mmap failed and
   the CMake step for `react-native-nitro-modules` died. Never `clean`.

⚠️ The scheme toggle resets to `system` (light) on every reload — the
preference is component state, not persisted. Re-tap it after a reload.

## Verified on device

Realme RMX2151 · Android 12 (412dp) · testapi · guest.
Xiaomi Mi A1 · Android 9 (424dp, 753dp TALL — 91dp shorter than the design) · prod · guest.

- [x] 6a light + dark
- [x] **6a with material, light + dark** — pill ramp sampled on device
      (#2D7B59 → #235F46); tab-bar active icon now `accentInk` #8DC7AA (9.66:1)
      against the idle #6E9683 (5.65:1) — it used to be the DIMMEST thing in
      the dark bar at 3.74:1
- [x] **6a full kit material, light + dark** — sampled on device, and both
      ramps run the right way: the assistant row (`wash`, dark ink) lightens
      upward and ENDS at the token (#FBFDFC → #EFF7F2 ≈ #EDF6F1); the promo
      card (`scrimFallback`, light ink) STARTS at the token and darkens
      (#193829 ≈ #1A3A2B → #0D1C15)
- [x] **6f Account with material, dark** — Sign in pill + avatar circle
- [x] **6d Matches with material, dark** — EmptyState pill
- [x] **6d Matches + 6f Account with material, LIGHT** — pill and avatar ramps
- [x] **6e Messages with material** — guest state
- [x] **Assistant with material** — and it is where the `IconAction` gap showed
      up; send button now ramps #2A7253 → #235D44 on device
- [x] **7b Review (cold open) with material** — "Scan an item" pill; the false
      "STEP 3 OF 4 · 75%" chrome is still correctly absent
- [x] 6c Browse — checked: a WebView, so material stops at the brand strip.
      Nothing to do here.

**Every v2 screen has now been seen with material on a real phone.** What has
NOT been seen is material on POPULATED content, because a guest never reaches
it: thread rows and their unread chips, want cards and their relevance chips,
draft rows with photo tiles, and the four review steps with a real scan. Those
need a signed-in session — the same gap that has been open since the start.
- [x] 6d light + dark
- [x] 6f light + dark
- [x] **6b light + dark** — on glass 2026-09-15, both schemes, and PRESSED.
      Reached by swiping Home's pager to the Buying pane (the tab strip follows
      the swipe). Renders correctly in both: hero, "Type it" with its ramp, the
      assistant row, and the FOR BUYERS banner on `scrimFallback`.
      Pressed "Type it" → the guest gate slides up ("Sign in to save what you
      need" / Create account / I already have an account / Keep browsing), which
      is the right answer for a guest and proves the pane's primary action is
      wired, not just drawn.
- [x] **SignInSheet light + dark** — on glass. Found the backdrop was using the
      banner-photography `scrim`; now `backdrop`
- [x] **6d Matches after the `EmptyState` migration** — on glass, both schemes
- [x] **Signed-in states — RENDERED 2026-09-15, first time ever.** A
      `greenbidz_test` seller account was supplied, so v2 was finally seen
      holding real data instead of a guest's empty screens.
      **Account:** "AS" initials, name + "Seller · Lucknow", **Verification
      3 of 4** with its progress bar and "Add business documents to finish",
      My listings **20+**, Drafts **24+** in an accent chip. Every one of those
      states had only ever existed in code.
      **Matches:** All 12 / Active 5 / Paused 7, "Heavy Machine · Instant ·
      20 MATCHES", real thumbnails and real relevance chips (85 / 84 / 84 / 83 /
      83 / 82%).
      **Home:** a DRAFTS rail on Selling, and on Buying two saved wants plus
      "MATCHED FOR YOU · See all 96" with real listing photos.
      The layout holds on real content — long titles truncate cleanly, the
      relevance chips do not crowd the chevron, and nothing overflowed. That is
      the thing mock data could not prove (see `reference_mock_data_not_represen
      tative` in the auto-memory).
      **The add-a-want `+` button ramps #2D7958 → #246047** — the last
      unmeasured material ramp in the app, and it only renders signed in.

- [x] **FIFTH BUG — FIXED 2026-09-15. Every draft on a real account was
      UNRESUMABLE, and it was not a v2 bug.** Found 2026-09-15 by tapping a row
      on Home's DRAFTS rail with a real seller account (24 drafts).
      The row fires correctly and reports honestly — a toast says "Could not
      open this draft". The failure is inside the SHARED
      `src/features/scanner/useResumeDraft.ts`, so the OLD UI has it too.
      **Root cause, from the payload itself:** the draft payload is
      `{source, created_at, scanv2, ready_to_list, ready_to_list_at}` — a
      **ScanV2** draft, created by the WEB seller flow. That is a third shape
      the mobile resume path does not handle: `isLabDraft()` rejects it (no
      `mode`, no `labDraft`) and the scan branch cannot hydrate it (no
      `persistedScan`), so it throws `draft payload missing persistedScan`.
      **ANSWERED from the backend + web source (2026-09-15).** This is not an
      open question any more — the web hit the identical bug and fixed it.
      `nextjs-port/src/scanflow/pages/new-submission-upload/utils/valuationDraftPayload.ts`
      documents the contract exactly:

          { source: "greenbidz.com/valuation", created_at,
            scanv2: { items: [...], file_urls: [...], scrap_lot? },
            ready_to_list?, ready_to_list_at? }
          — flow "ai", mode "multi", and NO rows in `gb_listing_draft_items`.

      Its header states the general problem plainly: *"Three apps write
      `gb_listing_drafts.payload` and this one shape had no reader."* On the web
      the same draft fell through to the form-blob branch, `countRequiredDone`
      read `.length` off `undefined`, and **"opening ?resumeDraftId for any
      valuation-sourced draft was a white screen."** They fixed it by writing a
      mapper that converts the valuation item shape into their form state,
      mirroring `mapAiToForm` field for field so a resumed valuation lot behaves
      like a resumed AI scan.
      So these drafts come from the **guest `/valuation` flow on 101lab.co** —
      the other workstream in today's daily update — and mobile is simply the
      app that never got a reader.
      **The mobile fix is precedented, not speculative:** the same mapping, with
      a different target (mobile needs a `persistedScan`-shaped blob for
      `hydrateScanDraftFromPayload`, not `QuickListingFormState`). Still
      `BLOCKED(you)` only because it is a chunk of real work against money-
      adjacent data and should be scheduled, not slipped in.
      Worth noting mobile already fails BETTER than the web did: an honest
      toast, not a white screen.

      **FIXED — `src/services/drafts/valuationDraft.ts`** (new), wired as a
      third branch in `resumeDraftById`. READ-ONLY: it maps a payload the server
      already has into the local store; it writes, uploads and publishes
      nothing. Field choices mirror the web mapper deliberately, so the same lot
      resumed on a phone and on the web agree. The `DraftItem` factory is now
      exported from the store (`draftItemFrom`) rather than duplicated —
      duplicated defaults are how these three shapes drifted apart.
      **17 unit tests** against the REAL payload shape (keys logged off device,
      cross-checked with the web writer's contract docblock), covering the ask/
      band price precedence, discards, the `file_urls` image fallback, and a
      junk row.
      **Second bug found while fixing the first:** the first working version
      opened "Analyzing your items…" — `resumeRouteForItem` sends any draft with
      no `ai` to processing, so a lot the website had ALREADY analysed and the
      seller had already reviewed was being re-analysed. That costs an API call
      and can overwrite the seller's own corrections. The mapper now populates
      `ai` from the payload — which is simply true — and sets `lastStep:
      'detail'`.
      **Verified on device, end to end:** tap a draft → review opens with the
      real valuation photo (loaded from its GCS URL), title "Laboratory
      Spectrophotometer", marketplace 101LAB, brand/model correctly EMPTY, and
      **CATEGORY flagged red** in the footer — which is the mapper's intent
      working: no category travels in a valuation payload, so the screen asks
      instead of inventing one.
      ⚠️ It lands on the SHIPPED detail screen, not v2's 7b–7e — same mixed-
      chrome compromise the v2 camera already makes. So this does NOT populate
      7b–7e; those stay open.
      ⚠️ Worth noting the UI is not lying: the row is labelled "AI draft" from
      `d.flow === 'ai'`, which is a different signal from the payload shape the
      resume path branches on. Those two can disagree, and here they do.
      **Diagnosability fixed regardless:** the `catch` discarded the error
      entirely, so this was invisible without editing the file. It now logs
      under `__DEV__`, and the failure is documented at the throw site.
      ⚠️ I twice concluded "the draft row is dead" before finding the toast —
      my screenshots at 8s and 12s were simply too late; the toast had faded.
      A control that fails is not a control that is dead, and the difference is
      a 2-second screenshot.

- [x] **Assistant (`/v2/chat`) — signed in and pressed 2026-09-15.** Clean
      empty state: "TRY ASKING" with three suggestions, Selling/Buying tabs, and
      the composer. Pressed a suggestion → it DRAFTS into the composer and
      enables send, rather than sending. That is the right behaviour and it is
      now observed, not assumed. No JS errors on mount with a real account.
      Send stays inert by design (`TODO(v2-writes)`) and was NOT pressed — it is
      a real call to the assistant.

- [x] **Dev scheme toggle no longer covers the composer.** It sat at
      `tabBar + inset`, which put it straight on top of the chat composer's
      camera and attach keys — its own comment says it was moved LEFT to dodge
      the send button, and it had simply landed on the other two. Now cleared by
      one `control.input` (the composer's own height), so it clears any footer
      the kit builds and merely floats higher on screens without one.
      Small thing, but it was blocking verification of the two controls beneath
      it, which is how it was found.

- [x] **101lab ONLY — the marketplace question is gone (2026-09-15).**
      Product direction: this deployment is 101lab (`SITE_TYPE=LabGreenbidz`),
      so the scan flow must not ask which marketplace, and must not offer
      "Change".
      ⚠️ The mobile ROUTING logic was already right — `routingNeedsAsk` returns
      false when `supported.length <= 1`. The picker appeared because the DEV
      API genuinely advertises three: `/mobile-config` →
      `["101lab","101machine","101it"]` (verified by curl, not assumed).
      **Gated at the single point every consumer reads** —
      `useSupportedMarketplaces()` — behind `MARKETPLACE_PICKER_ENABLED`
      (`EXPO_PUBLIC_MARKETPLACE_PICKER`, default OFF). v2's 7b, the shipped
      `RoutingChip` and `MarketplaceSheet` all collapse together, so no screen
      is left holding a stale three-option list. The multi-marketplace routing
      work is INTACT behind the flag, not deleted.
      `PickerRow.onChange` is now optional: a settled value with one possible
      answer is a statement, and a "Change" that opens a list of one wastes a
      tap to say no. The footnote "Category and currency are set once you
      choose" is hidden too — it describes a step that no longer happens.
      On device: MARKETPLACE now reads **101LAB · Lab & scientific equipment**,
      no radios, no Change. Mirrors the web, whose own mapper says "ALWAYS THIS
      DEPLOYMENT'S MARKETPLACE — the item's stored guess is dropped".
      ⚠️ Cost me a red box first: I gated with an early `return` above
      `useQuery` and wrote a comment calling it legal. It is not — hooks must
      run in the same order every render. Correct lever is
      `useQuery({ enabled })`. All 140 suites passed while it was broken,
      because a mocked module constant cannot vary within a run. Logged.

- [x] **7b IS POPULATED, IN v2 CHROME, FROM v2 HOME.** Tapping a draft on v2
      Home now lands in `/v2/scan/review/photos` — "STEP 1 OF 4 · PHOTOS · 25%",
      the v2 timeline, the real valuation photo from GCS, "1 of 1", thumbnail +
      ADD, and the v2 footer. No drop into old chrome mid-journey.
      `resumeDraftById` gained an optional `ResumeRouteResolver` (defaulting to
      the shipped `getScanResumeRoute`, so the old UI is untouched) and v2's
      `SellingPane` passes its own.
      ⚠️ SINGLE-PRODUCT ONLY, and deliberately: v2's review reads ONE item via
      `useReviewItem()` and there is no v2 grouped-review screen, so a
      multi-item draft would land on a screen that cannot show it. Grouped
      drafts keep the shipped path. Same line the scan handoff draws.
      **This retires "needs a real scan" for 7b.** A resumed valuation draft
      populates it with real data — real title, real photo, real price — which
      is what the item was actually for.

- [x] **6e Messages — populated and pressed 2026-09-15.** All **190** threads /
      Unread 3, "3 threads are waiting on you", monogram tiles, counterparty +
      `Lot #`, relative stamps and unread dots. Pressed a row → hands off to the
      shipped thread screen `/(lab)/deal/[id]` with real messages, date dividers
      and read receipts, exactly as this screen's docblock says it should.
      **FOURTH BUG FOUND AND FIXED: duplicate React keys.** The row key was
      `${row.ID}-${row.batch_id}` — seller + lot — and real data contains TWO
      conversations between the same pair about the same lot, so React logged
      `Encountered two children with the same key, '574-5480'`. That is not
      cosmetic: non-unique keys let React duplicate or omit rows and attach the
      wrong one's state on update, in a 190-row list.
      Key is now `conversation_id` when the wire sends one (it is optional), and
      `${ID}-${batch_id}-${index}` when it does not. Verified by CLEARING logcat
      first and reloading: **0 warnings**, where there had been three per render.
      Invisible to a guest and to any short fixture — it needs two colliding
      rows to exist at all.

- [x] **JS-warning sweep across the signed-in screens** (Home, Matches,
      Account, Chat, Messages) — logcat cleared first, then each visited.
      **No duplicate-key or VirtualizedList warnings remain.** That result is
      trustworthy for the key warnings specifically, because the SAME grep found
      three of them twenty minutes earlier on the same account, and the app is
      demonstrably still logging (10 lines from its pid in the window).
      ⚠️ Stated honestly: my attempted control was NOT a control. I navigated to
      a nonexistent route expecting a warning, and got none — but Expo Router
      renders `+not-found` silently, so that path never produces one. It proved
      nothing. A real control needs a deliberately warning-producing render.
      So: the key warnings are gone (proven by before/after with the same
      probe); "no OTHER warnings" is weaker evidence than it looks.

- [x] **THREE BUGS the signed-in pass exposed, all fixed and re-pressed.**
      Every one of them was invisible to a guest, which is why months of
      screenshots missed them.

      1. **v2's sign-in gate was completely unusable.** All three controls —
         Create account, I already have an account, Keep browsing — were DEAD;
         only the scrim dismissed. Cause: the sheet is a RN `<Modal>`, which
         renders in a SEPARATE native view hierarchy, and RNGH only attaches its
         recogniser under a `GestureHandlerRootView`. The app-level one in
         `app/_layout.tsx` does not reach inside. Every control in the sheet is
         an RNGH `Pressable` (the kit) so all were inert, while the scrim — RN's
         own `Pressable` — kept working. **That asymmetry is the diagnostic: if
         one control in a modal works and the rest do not, compare which
         `Pressable` each imports before touching the layout.**
         Fixed with a nested `<GestureHandlerRootView>`; the scrim was also made
         a SIBLING of the card rather than its parent, which removes a no-op
         swallow whose only job was to fight its own children.
         ⚠️ This screen was recorded here as "SignInSheet light + dark — on
         glass". It was looked at, not pressed. Logged in `MISTAKES.md`; the
         rule is escalated to `CLAUDE.md` (4th occurrence of screenshot ≠
         pressed).
      2. **The gate navigated nowhere even once the buttons fired.** `go()` ran
         `close()` before `router.push(path)`; unmounting the `<Modal>` in the
         same tick lost the navigation, so the sheet closed and the app stayed
         put. Fixed by pushing first and closing after — the route lands, then
         the sheet unmounts over the top of it, which is invisible.
      3. **Home did not scroll — at all.** `PaneShell` used react-native's
         `ScrollView` inside `TabView`'s `GestureDetector`, so the pan claimed
         every vertical drag and the list never moved. Signed in, that put the
         DRAFTS rail and the whole "MATCHED FOR YOU · See all 96" section
         permanently below the fold with no way to reach them. Horizontal
         paging kept working throughout, which is the signature.
         Fixed by swapping to **`RTVScrollView`**, the library's own scroller,
         built to give the vertical axis to the list and the horizontal to the
         pager — a prop-compatible swap, not a hand-tuned gesture hack.
         Measured after: Selling 584 and Buying 591 changed sample points
         against 0 before.
         **Why it hid:** a guest has no drafts, no listings and no wants, so
         nothing on Home was ever tall enough to need scrolling. The bug needed
         real data to exist at all.
- [x] **Two more classes enumerated — both came back CLEAN.** After the dead-
      control sweep, the same method applied to two other "looks alive, does
      nothing" families. Recording the clean results, because a class checked is
      worth as much as a class fixed.
      **Navigation targets: all 19 valid.** Every literal `router.push/replace/
      navigate` from v2 was resolved against the real route tree. Four looked
      broken (`/account`, `/deals`, `/listings`, `/notifications`) until the
      checker was fixed to strip `(group)` segments, which Expo Router does not
      put in the URL. No broken navigation in v2.
      **Accessible names: all 20 Pressables covered.** First pass flagged 11 —
      all false, because the regex stopped at the `>` inside `=>` arrow props
      and never saw the later attributes. A brace-aware pass left 3, and each
      was then checked individually: one is inside a CODE COMMENT quoting old
      code, and two are `Stepper`'s − / + which are deliberately
      `accessibilityElementsHidden` because the parent is an
      `accessibilityRole="adjustable"` with a label and `accessibilityValue` —
      the correct pattern, one element for the volume keys rather than three.
      ⚠️ Both checkers were only trusted AFTER a control proved they could
      detect a planted miss AND a known hit. The first versions of both were
      wrong in opposite directions (one under-reported, one over-reported), and
      without the control I would have recorded a false clean and a false alarm.

- [x] **2a's "Share this lot" wired — the one inert control that needed no
      backend.** Of the nine haptic-only handlers, seven sit on 2a / 2b / 3a and
      are inert because they need a listings endpoint or voice. Share needs
      NEITHER — it is the OS sheet — so it was dead by oversight rather than by
      constraint, which is a different thing and worth separating.
      Borrowed the app's existing pattern (`lab/chat/MessageActions.tsx`
      already calls `Share.share`) rather than inventing one.
      Shares TEXT, not a URL: there is no public lot URL to point at until
      Browse is native, and a link to nowhere is worse than none. The lot number
      is what someone actually needs to find it.
      Verified on device: the native sheet opens carrying "Thermo Dionex
      UltiMate 3000 stack — #5402 on GreenBidz".
      Remaining inert controls on those screens are now inert for a REASON that
      is written down, not by accident.

- [x] **EIGHTH BUG — v2's "Delete account" fired only a haptic.** Found by
      enumerating the class rather than hunting one at a time: grepped v2 for
      handlers that are `() => {}` (none left) and for handlers that ONLY fire a
      haptic (nine). Seven of the nine are on 2a / 2b / 3a, which are documented
      STATIC fixture screens with deliberately inert actions. Of the two on a
      LIVE screen, "Sign out" was properly wired (`signOut.mutate()`) and
      **"Delete account" was not.**
      That one matters more than a normal dead control: **App Store Guideline
      5.1.1(v) requires it and App Review TESTS it**, so a reviewer presses this
      button. A dead one reads as a deliberate dark pattern, not an unfinished
      screen.
      **Wired to the SHIPPED confirm flow** — `/(lab)/account/delete`, the same
      screen the old UI's `DeleteAccountLink` opens, which owns
      `useDeletionPreview` and `useDeleteAccount`. Navigating is not deleting:
      the irreversible step stays behind that screen's own gate.
      Verified on device: it opens a properly gated flow — WHAT HAPPENS, live
      preview data ("99 listings still on the market · 2 open orders"), a
      password field, and **"Delete my account" DISABLED** until the password is
      entered. Neither the password nor that button was touched.
      `TODO(v2-nav)` to swap for a v2 confirm screen if one is ever drawn.

- [x] **SEVENTH BUG — Matches' "+ add a want" was a SILENT dead control.**
      Found by applying the escalated rule (a screen with N controls is not
      verified until N are pressed) to the signed-in screens. The handler was
      `requireAuth('want', () => {})` — an EMPTY callback. Signed in, the button
      fired a haptic and did nothing: not even the `defer()` sentence the review
      screens use for unwired actions. Worse than a dead button that explains
      itself.
      **Wired, not removed**, because a working path already existed and v2
      already used it: Home's Buying pane hands "Type it" to the SHIPPED My
      Wants screen, which owns the sheet that actually creates a want. Two
      controls meaning "add a want" should not disagree about whether that is
      possible. Verified on device — the "+" now opens My Wants.
      ⚠️ It lands in old chrome, the same mixed-chrome compromise as the camera
      and the draft resume. `TODO(v2-nav)` to repoint at the v2 composer when
      it is drawn.
      **Diagnosis note:** three attempts failed on a stale bundle before this.
      The discriminator that settled it was pressing the IDENTICAL call in
      `BuyingPane` — pre-existing code, so a working result there proved the
      pattern and isolated the fault to my bundle rather than my logic.

- [x] **7a compared against the canvas — copy matches; running state is
      UNREACHABLE from here, and that is the known fork, not a defect.**
      On device 7a shows its EMPTY state: "Nothing is being analyzed / No scan
      running / Start a scan and this screen follows it live — each item appears
      as the AI reads it" + Scan an item + Back to home. Correct: 7a WATCHES a
      `recognition-jobs` run via `?job=<id>`, and nothing in v2 can start one
      until the (a)/(b) decision is made. So the drawn RUNNING state cannot be
      photographed yet.
      Compared its copy against `7a.html` instead, and every drawn element is
      present: the AI ANALYZING chip, "Analyzing your items", "Live results
      appear as we find them.", `STEP n OF 5` with a percentage, all five steps
      in the canvas's own wording (Validating · Reading documents · Uploading
      **and** detecting · Identifying products · Done), "Continue in
      background", "Keep using the app — we will notify you when it is ready.",
      the `m:ss · GreenBidz Vision AI` meta line — which renders UPPERCASE
      because `eyebrow` bakes in `textTransform`, matching the drawn
      "GREENBIDZ VISION AI" — and Cancel.
      One improvement on the drawing: Cancel renders only while there IS
      something to cancel; a finished or failed run gets a plain way out
      instead, so no state is a cul-de-sac.
      ⚠️ Copy parity is NOT the same as seeing it run. Stated as what it is.

- [x] **ALL 15 DRAWN SCREENS NOW COMPARED AGAINST THE CANVAS.** 6a, 6b, 6d, 6e,
      6f, 7a, 7b, 7c, 7d, 7e, 2a, 2b, 3a, 3b — plus 6c, which is a WebView whose
      controls belong to the web page. Every divergence found is either a
      DOCUMENTED data limitation (draft completeness sub-line, offers count, the
      "See all" under-report guard), a store requirement the canvas predates
      (Delete account, 5.1.1(v)), a deliberate product decision (101lab-only
      marketplace; "Continue" not "Submit" on steps 1-3), or an empty/failure
      state the canvas simply never drew and the build had to invent (7c's
      "Not set yet" category, 7e's negative verdict, 7a's "No scan running").
      The comparison found exactly ONE real defect — the em-dash publishing as
      a value on 7c — and it is fixed.

- [x] **6a / 6d / 6f compared against the canvas WITH REAL DATA (2026-09-15).**
      The six tabs had only ever been diffed while empty; this is the pass with
      a real seller account behind them.
      **6a Home — selling: matches.** Selling/Buying, "What are you selling
      today?", Scan it, "or type the details", the assistant row, FOR SELLERS /
      "Turn idle plant into capital" / See what sells, DRAFTS and LIVE LISTINGS
      rails. Two divergences, both already DOCUMENTED decisions rather than
      gaps: the draft sub-line is "AI draft · 21h" and not the drawn "Needs 2
      photos and a price · 70%", because that completeness read is not on the
      list endpoint (it would cost one GET per row); and "See all" drops its
      count when there is MORE than loaded, rather than under-reporting.
      **6d Matches: matches**, including the drawn PAUSED section — eyebrow,
      "Saved 17 Aug 2026 · no matches", and a **Resume** action per row.
      Pressed the "Paused 7" tab to get there.
      **6f Account: matches**, plus a row the canvas does not draw — **Delete
      account** — which is correct: App Store Guideline 5.1.1(v) requires it
      (see `project_account_deletion_101lab`). "Offers received" carries no
      count where the canvas shows one; that is documented at the call site — no
      endpoint exposes it, with a `TODO(v2-data)`.
      Net: no new defects on the tab screens. The divergences that exist are
      each a data limitation or a store requirement, each written down at the
      code that causes it.

- [x] **7b / 7c compared against the canvas — and it caught a real data bug.**
      **7c matches** and improves on the drawing: TITLE/BRAND/MODEL/YEAR with
      their AI chips and `e.g. …` placeholders, DESCRIPTION 54/500, all FIVE
      CONDITION chips (New · Used — functional · For parts · Waste disposal ·
      Demolition / removal) with the right one selected from the payload, and
      CATEGORY — which the canvas draws SETTLED but the build also has an empty
      state for: "Not set yet / We could not place this one — a listing needs a
      category" + Choose.
      Also pressed **"Go to Details"** from 7e's verdict: the trip back works.
      **⚠️ BUG FOUND BY THE COMPARISON — the website's blank marker was being
      published as a value.** The canvas shows `e.g. 2018` in YEAR; the device
      showed "—". Sampling the pixel settled it: `#10221B`, the **ink** colour,
      not placeholder grey — so it was a real VALUE, not a placeholder. The
      valuation payload stores a literal em-dash for "unknown", which is fine in
      its own review TABLE and becomes a value the moment it lands in a form
      field. Pressing Submit would have published a year of "—".
      `str()` in the mapper now treats dash-only values (hyphen, en, em, figure,
      horizontal bar) and a lone "n/a" as blank, so the placeholder shows.
      Guarded both ways: a test asserts `HPLC-2000` and `2014` still survive —
      the fix must not eat a legitimate value that merely contains a dash.
      21 mapper tests.
      **7b matches** too, with the marketplace block now deliberately the
      settled 101LAB statement rather than the drawn three-option question (see
      the 101lab-only entry).

- [x] **7d / 7e compared line-by-line against the canvas (2026-09-15).**
      Extracted the visible text from `7d.html` and `7e.html` and diffed it
      against the built screens on real data.
      **7d — full match.** PROFIT INTELLIGENCE + AI chip, SCRAP VALUE BASELINE,
      POTENTIAL PROFIT, "AI estimate — verify before publishing.", PRICE with
      Buy now / Make offer, the amount + quantity stepper, CURRENCY USD/TWD,
      and "More details · Optional · weight, size, CO₂, documents". Only the
      FIGURES differ, because ours are real.
      **7e — matches, and is better than the drawing.** The canvas draws only
      the happy verdict ("Everything required is complete / You can submit
      whenever you are ready"). The build derives both halves from
      `stepCompletion`, so on a draft that is genuinely incomplete it says so:
      **"Details still needs something / Needs a category / Go to Details"** —
      seen on device. A banner reading "complete" over a draft Submit would
      reject is the kind of small lie the screen exists to avoid.
      ⚠️ Footer copy differs on purpose: the canvas puts "Submit listing" on
      BOTH 7d and 7e; the build uses "Continue" until the last step. A step 3 of
      4 whose button says Submit would be wrong.

- [x] **Dev scheme toggle can be dismissed.** Long-press hides it for the
      session (plain state — it returns on reload, because a dev tool you can
      permanently lose is one you stop trusting). Raising it earlier fixed the
      chat composer but not 7e, where it sat on "Go to Details" — the trip back
      that IS the not-ready verdict. There is no fixed corner empty on every
      screen, so it now gets out of the way on demand.

- [x] **7b–7e POPULATED and WALKED END TO END (2026-09-15).** A resumed
      valuation draft, pressed Continue through all four steps in v2 chrome:
      **7b Photos** 25% — real GCS photo, "1 of 1", thumbnail + ADD, and
        MARKETPLACE as a settled 101LAB statement (no radios, no Change).
      **7c Details** 50% — title "Laboratory Spectrophotometer" 28/80 with its
        AI chip, description 54/500, brand/model/year correctly em-dashed, and
        the timeline reading "Needs a category" — which is the mapper's intent,
        since no category travels in a valuation payload.
      **7d Pricing** 75% — "Nothing left on this step", real price USD 2000,
        Buy now / Make offer, currency pills, quantity stepper.
      **7e Location** 100% — all four steps green, LOCATION + country,
        INSTALLATION "Deinstalled", "Ready to ship today", Submit footer.
      `Submit listing` was NOT pressed: it is a real write.
      **A gap in my own mapper, found by looking at 7d.** The Profit
      Intelligence card said "No price estimate — we did not get a resale range
      for this item" on a lot priced at $2,000, while the payload carried
      `fmv`, `scrap` AND `newBand` all along. The first pass took `fmv.low` for
      the price and discarded the rest. `aiPrices` is now mapped from all three
      (`{low,high}` → `{min,max}`; a one-ended band becomes a point estimate,
      `min === max`, which is what the card already renders as a single figure).
      After: **SCRAP VALUE BASELINE USD 50 – USD 150**, **POTENTIAL PROFIT
      +USD 1,850 – +USD 3,950**. 19 mapper tests.
      ⚠️ Only the SINGLE-product path is covered. A grouped valuation draft
      still routes to the shipped grouped review, because v2 has no grouped
      screen — unchanged, and stated at `v2ResumeRoute`.
- [ ] `BLOCKED(device)` **Small-screen check at 360dp — BLOCKED on this device, partly cleared statically.**
      The connected phone (`BQCA9TNVEY4PSSSK`, 1080x2400) runs a display-size
      **override density of 408**, so it is **423dp wide** — every v2 screen
      checked so far was checked WIDER than the 390pt the design is drawn at,
      and far wider than Android's common 360dp floor. The narrow case has
      never been on glass.
      `adb shell wm density 480` (which would give exactly 360dp) fails on
      ColorOS with
      `SecurityException: Must hold permission android.permission.WRITE_SECURE_SETTINGS`
      — and **fails SILENTLY without `-d 0`**: no error, no effect, the
      override stays 408. Do not trust its exit code; assert the readback.
      Routes that remain: the user setting Settings → Display → Display size by
      hand, or a 360dp emulator (ruled out — CPU).
      **What IS cleared:** a static sweep of every fixed width in `app/v2` +
      `src/features/v2` found nothing that can overflow 360dp. The only hard
      widths are `voice.tsx` 190 (3a's photo thumb) and `camera.tsx` 104 (the
      bottom-bar side cells); everything else is a `maxWidth` cap (300, 280,
      250). Content width at 360dp is 312 after gutters, so all clear.
      **What is NOT cleared:** text fit — 2a's 2×2 spec grid, 2b's three
      quick-bid pills, the lot title, and any long category string. Those were
      sized by ARITHMETIC (312 − 2 gaps ÷ 3 ≈ 94.7pt per pill, ~64pt of it for
      the label), not by observation. Treat the numbers as calculated.
- [ ] `BLOCKED(device)` iOS

## Gates

- [x] `npx tsc --noEmit` clean
- [x] `npx eslint app/v2 src/features/v2 src/theme/v2` clean
- [x] Full suite — 134 suites / 1,325 tests
- [x] No regressions in the shipped app

## ⚠️ The two detection mechanisms — a fork that needs a decision

Found 2026-09-14 by taking two photos in the new camera and pressing Review.

  `useSmartDetect`     POST /wp/analyze-smart-detection-v2 (SSE).
                       What `app/scan/processing.tsx` runs. Works today; it is
                       how every real scan in this app happens.
  recognition-jobs     POST /recognition-jobs, then tail
                       GET /recognition-jobs/:id/stream. What **7a was built to
                       WATCH** — it takes `?job=<id>` and follows it.

**7a only observes.** Starting a run is one of its deferred writes, so routing
the camera at `/v2/scan/analyzing` with no job id lands on "No scan running" —
a dead end for someone holding two photos they just took. I shipped that for
about ten minutes before pressing it.

The v2 camera therefore hands to `routes.scanProcessing` for now: the shipped
processing + detection screens run, and my single-product handoff on 7a is not
in that path, so a v2 scan currently leaves v2 after the camera. Same
compromise Browse makes — a working flow in mixed chrome beats a v2-pure dead
end.

- [ ] `BLOCKED(you)` **DECIDE: which mechanism does v2 use?** Either (a) wire `POST
      /recognition-jobs` so 7a can start its own run and the v2 chain closes,
      or (b) rebuild 7a around `useSmartDetect` and drop the job-tailing. (a)
      is the drawn design and needs background recognition enabled server-side;
      (b) is less work and uses the path that is proven in production.

## Wiring — started 2026-09-03, against the TEST endpoint

`.env` points at `https://testapi.greenbidz.com/api/v1` — the DEV backend on
`greenbidz_test`. (An earlier note in this session said it pointed at prod;
that was wrong.) Still live, and read-only: the Browse WebView (`101lab.co`).

- [x] **The scan handoff.** 7a's "Review N items" now calls
      `applySmartDetection(mapped, photos)` — the hinge that turns a detection
      into the `current`/`queuedItems` that `wizardState.useReviewItem()` reads
      — and routes to `/v2/scan/review/photos`. Device-local only: Zustand +
      MMKV, no network. This is what makes 7b–7e reachable at all.
      ⚠️ SINGLE-PRODUCT ONLY, deliberately. With several products the old
      screen first runs a grouping wizard (assign photos per product, rename,
      override single/grouped); skipping it would silently accept the AI's
      grouping for a whole batch. Whether 7b's photo step should absorb that is
      a canvas question, so multiple products still hand back to the shipped
      wizard. A mapping/photo-count mismatch also falls back there rather than
      dead-ending.
- [x] **Verify the handoff with a real scan — DONE 2026-09-15.** Shot a photo
      on 3b, pressed "Review 1", and it handed off to the shipped processing
      screen, which ran a real detection against testapi ("Analyzing your
      items…", STEP 1 OF 5, "GREENBIDZ VISION AI"). `start()` created the draft
      and 7b then rendered it. The photo was a black frame (lens down), so the
      DETECTION RESULT proves nothing — what is proven is the handoff, the
      draft creation, and 7b reading it.
      ⚠️ Found while doing it: `takePictureAsync` **hung indefinitely** on the
      first camera session — shutter latched disabled, no error, no timeout, and
      it never resolved. A fresh session worked. The untouched flash control
      still responded during the hang, so the JS thread was alive and the hang
      is inside expo-camera.
      **GUARDED 2026-09-15.** The call is now raced against a 12s timeout
      (a real capture on this device takes ~2s, so a timeout means genuinely
      stuck). The `finally` re-arms the shutter either way, which is what makes
      the screen recoverable instead of a dead end, and a hung sensor gets its
      OWN message — "The camera did not respond · Close the camera and open it
      again" — because the way out differs from a failed write.
      ⚠️ The guard is NOT device-verified: reproducing the hang needs a cold
      camera session in the state that caused it, which I could not summon on
      demand. tsc and lint pass; the timeout path itself is unexercised.
- [ ] `BLOCKED(you)` **A scan of a REAL nameplate** — still outstanding, and distinct from the
      handoff above. The black-frame run proved the plumbing; it produced no
      title, no specs and no price.
      ⚠️ PARTLY STALE: this used to say "7b–7e have still only been seen holding
      an empty draft". They have now been seen FULLY POPULATED — from a resumed
      valuation draft, not a scan. What a real nameplate would still add is the
      AI DETECTION path end to end (camera → smart-detect → applied draft),
      which the resume route bypasses entirely.
- [ ] `BLOCKED(you)` Grouped/multi-product handoff — blocked on the canvas question above.

## Writes still deferred

### What the app actually calls — endpoint inventory (derived 2026-09-15)

Enumerated from the source, not from memory, because "there is no listings
endpoint" is load-bearing for THREE items (2a, 2b, 6c Browse) and had never
been checked:

```
/auth/login                         /drafts
/auth/recheck-approval              /drafts/{id}
/batch/{batchId}/products           /drafts/{id}/published
/batch/seller/{sellerId}            /mobile-config
/chat/buyer/{buyerId}/sellers       /notifications/{userId}
/chat/conversation/{id}/messages    /notifications/read_by_batch
/recognition-jobs                   /seller-upgrade/my-status
/recognition-jobs/{jobId}           /seller-upgrade/request
/recognition-jobs/{jobId}/detach    /seller/listings/{productId}
/user/me  /user/complete-signup     /seller/listings/{productId}/edit
/user/forgot-password/{send-otp,verify-otp,reset}
```

Two conclusions, both now evidence-backed rather than assumed:

1. **There is genuinely no public/buyer listings endpoint.** Every listing route
   is `/seller/...` or `/batch/seller/...`. So 2a and 2b really do have nowhere
   to get a lot from, and 6c Browse really does have to stay a WebView. That
   blocker is REAL.
2. **`/drafts` exists** — so "save draft" was never backend-blocked, which the
   table below now reflects.


All marked `TODO(v2-writes)` in code — rendered but inert.

⚠️ **Re-checked 2026-09-15, and these were mis-tagged as `BLOCKED(backend)`
earlier the same day — that tag was my invention and it was wrong.** This
section never claimed the endpoints were missing; it said "rendered but inert",
which is a build-sequencing choice (screens first, then wire), not a blocker.
Four of the five have a WORKING app-side hook already:

| write | app-side hook | really blocked? |
|---|---|---|
| Publish | `src/features/scanner/useCreateListing.ts` | no |
| Save draft | `listing-drafts` via `detail/DetailFooter.tsx` | no |
| Send message | `features/lab/messages/{chatApi,socket}.ts` (LIVE) | no |
| Profile / delete account | `useDeleteAccount()`, `useDeletionPreview()` | no |
| **Place bid** | none found in the app | **yes** |

So the tag below is `READY(needs go)`: I can wire these, but each is a REAL
write against real data — publishing a live listing, deleting an account — so
none gets wired without an explicit go, and not before the screens are signed
off. That is a different conversation from "we need a backend".

- [ ] `READY(needs go)` Publish / save draft — hooks exist (`useCreateListing`,
      `DetailFooter`'s draft path). Wiring is v2 screens → existing hooks.
- [ ] `BLOCKED(backend)` Place bid — the ONE genuinely missing write. No
      place-bid path exists anywhere in the app; `/bid` appears only inside
      `chat/cards.tsx` and `cardKit.tsx`, which RENDER bid lists, they do not
      place bids. Whether the API exposes one is unverified from here.
- [ ] `READY(needs go)` Send message — `chatApi.ts` + `socket.ts` are live and
      already power the shipped Deals inbox.
- [x] **Resume a paused want** — `PATCH /wtb/{id} { status }` through a new
      `useWantStatus()`. Optimistic, because a toggle on the row under your
      finger has to move immediately; the ROLLBACK is the part that matters, so
      a failed request puts the old list back rather than leaving a want
      claiming to watch the market when the server has it paused. Invalidates
      `wantMatchesAll()` (the PREFIX), not one want's matches — the narrow key
      is the omission that helper exists to prevent. Three tests, including the
      failure path.
- [ ] `BLOCKED(design)` Save a new want (needs the v2 composer, which is not drawn) / pause from
      the active list
- [x] **Sign out** — `useLogout()`, not a hand-rolled auth reset. The hook also
      wipes the React Query cache and the lab chat/session/composer stores;
      without that, signing out and in as another account left the PREVIOUS
      user's wants, matches and badge counts on screen until each query
      refetched (found on device 2026-08-13). No confirm step: it is
      reversible, and deleting the account is the one that asks.
- [ ] `READY(needs go)` Profile save, delete account — `useDeleteAccount()`
      and `useDeletionPreview()` exist and are the ones the shipped Account
      screen uses. Deleting an account is irreversible, so this one needs the
      go in writing, not just a nod.

## Kit gaps still open (reported by screen builds, not yet reconciled)

- [x] **Message bubbles → `Bubble`.** Built for 3a, which was the second screen
      to need one. Assistant left on `fill`, user right on `accentWash`, and one
      corner dropping to `space.sm` on the speaker's side — the tail is what
      makes two voices legible when the grounds are close, so it is not
      configurable. ⚠️ `chat.tsx` is NOT migrated onto it and should not be
      migrated mechanically: it boxes only the user on purpose ("space instead
      of boxes", right for a long written answer), while a voice transcript
      needs both sides boxed. Migrating is a design call about the two
      assistant modes, tracked with the 3a/chat reconciliation above.
- [ ] `HELD` **markdown-lite prose renderer — HELD local on purpose, reviewed 2026-09-15.**
      `Prose` + `InlineProse` in `app/v2/chat.tsx:293` handle headings, bullets,
      blank-line gaps and inline emphasis, and they work. ONE consumer.
      Not promoted: this kit's rule is that a primitive earns its place after
      two or three screens have independently rebuilt it (`Bubble` was promoted
      the day 3a became the second caller). 3a renders plain speech, not
      markdown, so there is no second caller yet. Promote it the moment the
      voice screen is wired to real answers and needs the same parsing — not
      before, or the kit fills up with single-use code.
- [x] **`PillButton tone="filled"`** — a 34pt filled `accent` action for the ONE
      thing inside a card, where `PrimaryAction`'s 54pt slab outweighs the card
      holding it (3a's "Use this" beside a $4,600 headline). Same measure as
      `soft`, so a row can mix them; the difference is weight, not size.
- [x] **`ScrimPill tone`** — `light` (the banner CTA, `rgba(255,255,255,.94)`)
      vs `scrim` (a caption on a photo, `rgba(22,38,31,.82)` + white). Both sit
      on photography; the choice is WEIGHT. Added after 2a and 3b both shipped
      with the two inverted — see `MISTAKES.md` 2026-09-14.
- [x] Timeline / stepper (`on="wash"` — the connector is invisible on the header sheet)
- [x] Shimmer / skeleton row
- [x] `EnterOnMount` fade-and-rise wrapper
- [x] `Screen keyboard` — lifts scroll + footer over the keyboard (7c is 4 inputs)
- [x] Promoted from `reviewKit.tsx` → kit: `PillButton` (+ `role="checkbox"`),
      `Stepper`, `SoftPanel`. `StepHeader` + `Eyebrow` stay — both know about
      `ReviewStep`, so they are flow chrome, not primitives.
- [x] `EmptyState` — one shared empty screen, and it REQUIRES an action
- [x] `Field` `variant` + `lines` were already there; the read-only half is now
      **`PickerRow`** — a settled choice as a statement with a quiet "Change",
      and an empty state that ASKS. 7b's marketplace and 7c's category were two
      hand-rolled versions of it that had drifted to different type sizes; both
      now use the component. NOT a `Field` mode on purpose — `Field` wraps a
      `TextInput` and the two halves would share nothing but the ground; the
      split is "does the person type into it", which is also what decides
      whether a keyboard appears.
- [x] ~~`Chip` needs `glyph` at `sm`~~ — stale: `glyph` is not gated by size and
      never was. Its docstring already says to size it at `icon.xs`. The
      `FieldIcon` → `GlyphButton` rename is done.
- [x] Fold `Eyebrow` into `SectionHeader` — done. `SectionHeader` gained
      `chip` / `chipTone` / `trailing` / `tone`, and `Eyebrow` is now a
      four-line wrapper so the nine call sites keep `ai={…}` instead of
      spelling out `chip={x ? 'AI' : undefined}`. One layout, not two.
      Its row also moved from `baseline` to `center`: a chip has no baseline to
      share with the label and hung below the text it qualified.
- [x] `ScrimPill` promoted to the kit — it carries the over-photography
      discipline (`scrimPill`/`onScrimPill` DO NOT flip by scheme), which is
      exactly what must not be re-derived per screen.
- [x] `Row` needs `stamp` + `marker` — a messaging row aligns its timestamp on
      the TITLE baseline, not the row centre; `messages.tsx` has a local
      `ThreadRow` for it
- [x] `SectionNote` variant with an INLINE action (its `QuietAction` stacks on
      its own line, which reads as a second paragraph)
- [x] `StagedChip` promoted to the kit. Deliberately NOT a `Chip` mode: `Chip`
      sets `accessibilityElementsHidden` because a score is a value, not a
      control — a component that is sometimes hidden from a screen reader and
      sometimes holds the only undo is the wrong shape.
- [ ] `BLOCKED(design)` **Assistant cards — SIZED 2026-09-15, and it is not a component port.**
      `src/features/lab/chat/cards.tsx` is 2,417 lines holding **21 registry
      entries → 19 distinct renderers**, plus `bid_list` / `received_bids`
      special-cased outside the registry because they pick a renderer by
      `ctx.mode`. **23 wire types in total.** They carry nine interaction
      callbacks between them (`onSend`, `onEditDraft`, `onUploadPress`,
      `onJumpProduct`, `onAdvanceProduct`, `onCombineProducts`,
      `onSplitProducts`, `onPublishBatch`, `onPress`), so most are not display
      surfaces — they are small applications: a draft editor, a multi-product
      queue, a publish gate.
      The wire contract is `{ type: string; data: unknown }` — an OPEN union
      with an opaque payload, so the set above is the authoritative list and a
      v2 renderer cannot guess a shape; each type's `data` has to be read off
      its existing renderer.
      **v2 does not render them and does not silently drop them:** `chat.tsx`
      shows "This answer came with a card the redesign has not drawn yet."
      Honest, but it is user-visible copy admitting a hole, so it is a ship
      blocker in the same family as the `defer()` sentences.
      **BLOCKED ON DESIGN, not on code.** None of the 23 is drawn on any canvas
      screen. Do NOT invent 23 card designs to clear a checkbox — the realistic
      first move is to ask which types a BUYER can actually receive (the app may
      never surface the seller/listing ones), design that subset, and leave the
      rest behind the honest notice.

## Material — adopted for controls and cards, NOT for grounds

Direction agreed 2026-09-03 after a flat-vs-material comparison
(`Docs/v2-design/material-vs-flat.png`). What is settled:

- **Depth goes on things a finger touches, and on cards.** Page grounds, the
  header sheet and anything that scrolls or swipes stay flat — rasterising the
  Home panes measured 4.70% → 9.63% jank.
- **The ramp rule is a contrast rule, not a taste one.** A symmetric ±7% put
  the pill's white label at 3.61:1 and the light subline at 4.48:1. Guarded by
  the ramp-endpoint tests in `v2Contrast.test.ts`.
### The kit, done

Rolled through the KIT rather than screen by screen — screens compose these, so
all twelve pick it up at once and none of them can drift.

- [x] `PrimaryAction` — filled + tinted, the only piece that carries a SHADOW
- [x] `TintedRow` — row ground + the glyph circle
- [x] `Chip` — both tones
- [x] `RowThumb` — the EMPTY tile only; a ramp over a seller's photograph would
      tint the photograph
- [x] `PromoBanner` — the no-photo fallback ground only, same reason
- [x] `SoftPanel` — both grounds
- [x] `IconAction` — the round control: the assistant's send button and
      Matches' add-a-want. Missed on the first pass and caught by LOOKING at
      the assistant screen, not by any test — the send button was the one flat
      control left on a screen full of material ones.
- [x] `Surface` / `MaterialFill` — the two entry points; no screen composes a
      gradient of its own

- [x] **`PillButton`** — added 2026-09-15, and it was an OMISSION, not a
      decision: it appeared in neither this "done" list nor the flat list
      below, having been promoted from `reviewKit.tsx` at the same time as
      `SoftPanel` (which got material) and missed. Exactly the `IconAction`
      failure again — a flat control on screens full of material ones, invisible
      to every test because the ramp tests only check what already ramps.
      Blast radius was SIX files, three of them review screens marked done
      during the material push: `bid.tsx`, `voice.tsx`, `review/details.tsx`,
      `review/location.tsx`, `review/pricing.tsx`, `reviewKit.tsx`.
      `ghost` stays flat (no fill to ramp). No shadow — these ride the review
      flow's scrolling steps. Measured on device: the selected `choice` pill
      runs **#2C7958 → #235F46** down its length, matching `PrimaryAction`.
- [x] **3a's own controls** — the mic, the camera key and the two round top-bar
      keys were hand-rolled `Pressable`s with flat grounds, where `IconAction`
      is the kit equivalent and has material. Given `MaterialFill` directly
      rather than swapped for `IconAction`, because the canvas sizes them at
      38/52pt and `IconAction` is a fixed 46. Mic measured **#2E7C5A → #235F46**.
      `MaterialFill` is now exported from the kit index so a screen never has to
      reach into `Surface` for it.

- [x] **`Stepper`** and **`BrandBar`** — found 2026-09-15 by the new coverage
      test, within a second of writing it, after I had already hand-audited the
      kit twice and missed both. `Stepper` is a filled control
      (`role="adjustable"`, `control.input` tall) and now ramps; `BrandBar`
      paints only a 20pt brand mark and a 7pt unread dot, so it is exempt.
- [x] **`v2MaterialCoverage.test.ts`** — the rollout is now ENUMERATED, not
      listed. Every kit component that paints a palette-role ground must import
      `MaterialFill`/`Surface` or be named in `FLAT_ON_PURPOSE` with a reason,
      and a second test fails on dead exemption entries (a stale name is how a
      renamed component inherits a free pass). A new filled control now fails CI
      the day it is written instead of surviving three sign-offs.
      **This closes the class, not just the instances.** `v2Contrast.test.ts`
      structurally could not catch a flat control — it asserts that things which
      ramp ramp correctly, so no-ramp is invisible to it.
      Two exemptions are marked **PENDING**, not settled: `Field` (is a text
      input a control or a ground?) and `Bubble` (`TintedRow`, its analogue,
      ramps). Both need a call.

- [x] **The SCREENS sweep** — added 2026-09-15, because the kit sweep was
      necessary and not sufficient: screens hand-roll controls (3a's mic, 2a's
      hero buttons, the camera's roll chip) and every one escaped a kit-only
      check. Same hole, one level up. The screen rule is per-LINE: each
      `backgroundColor: c.*` must either ramp or carry a `flat:` reason written
      AT the line. A file-level list would be too coarse to be honest —
      `camera.tsx` paints four grounds, three correctly flat and one a real
      accent button; exempting the file would have hidden the button.
      **31 grounds classified.** Four were real gaps and now ramp:
      `matches.tsx` add-a-want, `camera.tsx` roll chip, `location.tsx`
      pickerRow, `photos.tsx` marketplace option row. The other 27 carry a
      written reason — photography, page grounds, progress indicators, status
      dots, or the two PENDING questions.
      Measured on glass: roll chip **#2B7555 → #246248**, the marketplace row
      **#FBFDFC → #EEF7F2**, the country pickerRow **#FDFEFD → #F7FAF8**, plus
      3a's mic and the pricing screen's pills and Stepper.
      NOT seen: the Matches add-a-want, which only renders for a signed-in
      user — same one-line pattern, tsc and tests green, but not looked at.
      It goes on the signed-in-states list, not the done list.

Left flat on purpose: `QuietAction` and `PrimaryAction variant="quiet"` (no
fill to ramp), `GlyphButton` (an outlined square — same reason), `PillButton
tone="ghost"`, `Hairline`, `Tabs`, and every page ground.

- [x] **`Field` and `PickerRow`** — SETTLED 2026-09-15, and not by taste.
      Ramping `Stepper` the day before had created a visible inconsistency:
      on 7c pricing a `Field` and a `Stepper` sit in the SAME ROW, both 52pt
      filled boxes on `surface`, and only one had depth. Measured before —
      Field `245,249,247` flat (delta 0) beside Stepper `252,253,253 →
      246,249,248`. Measured after — both `252,253,253 → 246,249,248`, delta 4,
      identical endpoints. `PickerRow` follows because it sits with five
      `Field`s on 7c details; a settled choice and an editable one should differ
      in their CONTENT, not in whether they have depth.
      ⚠️ `PickerRow`'s exemption had read "composes Row" — it does NOT, it
      paints its own `surface` ground. A WRONG reason is worse than a missing
      one: it reads as settled and nobody re-checks it. The coverage test
      catches DEAD exemptions but cannot catch false ones, so its comment now
      says so.

Left flat and NOT yet decided — one call remains:
`Bubble` (new 2026-09-15; `TintedRow`, its nearest analogue, has material — but
no bubble currently sits beside a `TintedRow`, so nothing forces it either way).
Correctly flat and not a question: `ScrimPill` and 2a's hero round controls
(material is never drawn over photography; see `RowThumb` and `PromoBanner`),
and 3b's viewfinder chrome (a hole in the app, not a surface of it).

⚠️ **Shadows are on `PrimaryAction` and nowhere else, on purpose.** A shadow is
`elevation` on Android and costs a draw pass on whatever carries it — and the
tinted row, the promo banner and the chips all ride Home's two SWIPING panes,
where rasterising measured 4.70% → 9.63% jank. On a moving surface the depth
comes from the ramp and the lit edge alone.

## Measured, needs a decision — the outlined pill

`PrimaryAction variant="quiet"` draws its outline in `hairlineStrong`:

| | on `base` | on `surface` |
|---|---|---|
| light | **1.27:1** | 1.19:1 |
| dark | **1.89:1** | 1.60:1 |

WCAG 1.4.11 asks 3:1 of a control's visible boundary, so the pill shape is not
perceivable and what is left is a green label with 54pt of padding. It is used
on five screens — `analyzing` ×3, `location`, `pricing` — and on `pricing` it
sits directly beside the filled pill, which is where it matters most.

`variant="tinted"` (added today, `accentWash` ground: ΔE 7.3 light / 15.0 dark,
label 6.1:1 both) is the fix. **Not applied to those five yet** — they are
device-verified screens and this should be flipped with a phone in hand, not
from a contrast table.

- [x] **Flipped, 2026-09-03.** Six uses (not five — `pricing.tsx` had two):
      `analyzing` ×3, `location`, `pricing` ×2. ⚠️ NOT seen on glass: all six
      live in footers that only render with a live scan or a real draft, and a
      guest cold-open shows the empty state instead. Contrast-justified and
      green on every gate, but unverified visually — check when a scan runs.

## Fixed while checking screens on 2026-09-03

- [x] **7a Analyzing's cold open was a dead end.** It drew a `SectionNote`
      whose only control was "Back to home" — a way OUT offered as the only way
      forward, which is exactly what `EmptyState` was built to stop. Now an
      `EmptyState` with **"Scan an item"** (the action that fills the screen)
      and Back to home as the secondary, matching the four review steps.
- [x] **And it said one thing three times** — "Nothing is being analyzed" /
      "Nothing is running at the moment." / "No scan running". The middle
      sentence is gone, and the subline is now render-GUARDED rather than set
      to an empty string: an empty `Text` still carries its `marginTop` and
      would have left a gap where the sentence used to be.
- [x] `IconAction` material — see the Material section.

## ⚠️ Must clear before v2 ships (Guideline 2.1)

- [ ] `PARTIAL 1/5` **Every `defer()` sentence must go — 1 of 5 done.** The review screens
      answer inert controls with an explanation so nothing is a dead button —
      good for development, but App Review reads a visible control that only
      explains itself as an unfinished app. Wire the write or remove the control.

      - [x] **7b "ADD" → WIRED** (2026-09-15). `onAddPhoto` now pushes
            `routes.v2CameraAppend()`; the camera reads `?mode=append` and, on
            commit, calls `updatePhotos([...draft.photos, ...shot])` and
            `router.back()` instead of `start()` + processing.
            **Why this one could be wired while the others cannot:** adding a
            photo was never a server write. `updatePhotos` is a local store
            action that persists the files against the draft id; it only looked
            blocked because it sat next to writes that are.
            `router.back()`, not `replace` — 7b is still underneath with its
            scroll position and unsaved field edits.
            **Pressed on device, full round trip:** 7b "1 of 1" → ADD → camera
            → shutter → "Review 1" → back on 7b reading **"1 of 2"**, two thumbs
            in the strip, and the **"Rearrange" pill now rendered** (it only
            appears at 2+ photos) — so the photo reached the store, persisted,
            and re-rendered the screen.
      - [ ] 7b "Rearrange" — needs a reorder surface. The canvas draws the pill
            but no reorder screen; `/scan/reorder-photos` exists in OLD tokens
            and sending someone there drops them out of v2 (the same trap
            `routes.v2Camera` documents). Either draw it or drop the pill.
      - [ ] 7b "Save as draft" — a real server write (listing-drafts). Blocked.
      - [ ] 7c "Save as draft" — same.
      - [ ] 7c "Change category" — needs the category picker screen, not built.

## Resolved from the canvas (no longer open)

- [x] **6e slot collision.** `6e.html` draws the inbox on the TabBar's
      `active="chat"` slot, so that slot is Messages. The assistant is reached
      from Home's "Ask the assistant" row, which both 6a and 6b draw. No sixth
      tab needed — the slot was just pointed at the wrong screen.

## Open — needs a decision from you

- [x] ~~6e drawing is the wrong screen~~ — resolved, see above.
- [ ] `BLOCKED(backend)` **Buying / Selling tabs on the inbox.** `6e.html` draws the buyer↔seller
      messages inbox (`All 12 / Unread 2 / Buying / Selling`, thread rows), not
      the AI assistant. The assistant was built to brief with its content
      designed, not drawn. So either 6e = inbox and the assistant needs its own
      The drawn inbox has `Buying` / `Selling` tabs, but the only endpoint is
      `/chat/buyer/:id/sellers` and `MOBILE_CHAT_ROLE` is pinned to `'buyer'`,
      so every thread is a buying thread by construction — "Selling" could only
      ever be empty. Needs a seller-side inbox endpoint to mean anything.

- [ ] `BLOCKED(you)` **Palette** — built as drawn (`#2E7D5B`). Brand guide says turquoise `#35C3AA` + navy. Tehreem's call
- [ ] `BLOCKED(you)` **Dark mode sign-off** — canvas has no dark variant, I derived it
- [ ] `BLOCKED(you)` **i18n — SIZED 2026-09-15.** v2 is English literals
      throughout: **6 `t()` calls** across 54 `.tsx` files, against roughly
      **305 string sites** (153 `<Text>` elements + 152 `label=` / `title=` /
      `body=` / `placeholder=` props — an upper bound, since some overlap and
      some carry no literal).
      ⚠️ The app ships **SIX** locales, not the four this line used to claim:
      `en`, `ja`, `th`, **`vi`**, `zh-Hans`, `zh-Hant` (70–72 top-level keys
      each in `src/i18n/locales/`). So the translation cost is ~305 sites × 6,
      not × 4.
      "Gets pricier per screen" was right in direction and vague in size: the
      cost is not the screens, it is that every screen shipped in English is
      another 20-odd strings to extract later. Decide EARLY whether v2 ships
      English-only at launch — deferring is a real choice with a growing price,
      not a free one.
      ⚠️ Read `reference_mobile_i18n_audit` in the auto-memory first: plural
      keys and `t(k, default)` have bitten this codebase, and locale files must
      never be rewritten with `json.dumps`.
- [ ] `BLOCKED(you)` **Browse** — t6 shell around the WebView now, or hold until native browse?

## Small stuff

- [ ] `BLOCKED(you)` Banner photo missing (`uploads/surplus into capital-banner image.webp`) — drop the file in, set one constant
- [x] ~~PromoBanner has no edge in dark~~ — FIXED and seen on glass. Two parts:
      `scrimFallback` lifted `#10221B` → `#1A3A2B` (ΔE from the dark page 7.1 →
      19.6), and the caption GRADIENT is now drawn only over a real photograph —
      on the flat fallback it was taking the bottom of the card below the page
      ground and erasing the card's own edge. Measured off screenshots:
      banner-vs-page **1.09:1 → 1.50:1**. Both banners are in the fallback state
      today because the photographs are not in the repo.
- [x] ~~Two helper modules are registered as ROUTES~~ — `reviewKit.tsx` and
      `wizardState.ts` moved to `src/features/v2/scan/review/`. They can no
      longer appear in expo-router's table (it is built from `require.context`
      over `app/`), so the two per-bundle warnings and the navigable blank
      `/v2/scan/review/wizardState` are both gone by construction.
- [ ] `BLOCKED(build)` **Android nav bar not themed in dark** — a hard seam
      directly under the tab bar. Re-examined 2026-09-15; two corrections.
      **(1) It is NOT a shipping defect today.** `app.config.ts:37` pins
      `userInterfaceStyle: 'light'`, and `ThemeProvider` notes the device scheme
      "returns 'light' unconditionally" while that holds. Dark is reachable only
      through the DEV scheme toggle, so the seam is a dev-mode artefact. It
      becomes real the day the pin is lifted — i.e. it is downstream of the
      dark-mode sign-off, not independent of it.
      **(2) `expo-navigation-bar` may not be needed.** Verified: it is NOT
      installed, `expo-system-ui` exposes only `get/setBackgroundColorAsync`
      (the ROOT VIEW, not the nav bar), and **`androidNavigationBar` is not set
      in `app.config.ts`**. That config key styles the bar at build time with NO
      new dependency — a rebuild either way, but a config line rather than a
      native module. It can only set ONE static style, which is exactly right
      while the app is pinned to light, and insufficient the moment it follows
      the scheme.
      So: cheapest correct fix today is the config key; the runtime-following
      version is a job for whenever dark ships.
- [x] ~~No debug APK on disk~~ — rebuilt 2026-09-03:
      `android/app/build/outputs/apk/debug/app-debug.apk` (109 MB, arm64-v8a).
      Build with `-Xmx2g --max-workers=1`; the committed `-Xmx3g` with two
      workers OOMs this machine once daemons are resident.
- [x] ~~`SignInPrompt` still styled in old-UI tokens~~ — v2 has its own sheet
- [ ] `BLOCKED(you)` **Light `inkSubtle` `#8B9A92` fails WCAG on every ground
      and at every threshold.** Analysed 2026-09-15; the decision is now one
      yes/no, and the value to use has changed.

      | ground | ratio | AA text (4.5) | AA large (3.0) |
      |---|---|---|---|
      | `base` #FFFFFF | 2.94 | FAIL | FAIL |
      | `surface` #F5F9F7 | 2.77 | FAIL | FAIL |
      | `wash` #EDF6F1 | 2.67 | FAIL | FAIL |

      It fails AA-LARGE too, so "these are only small labels" is not a defence —
      no text size rescues it.

      ⚠️ **The fix previously recorded here was wrong.** `#68766E` clears AA only
      on `base` (4.77); on `surface` it is **4.49** and on `wash` **4.33** —
      both short. That figure came from measuring one ground and generalising.

      **Use `#65736B`** — the same hue and saturation as the canvas value, just
      darker, solved against the WORST ground: base **4.98**, surface **4.69**,
      wash **4.52**. Three RGB steps from the value we had written down, so no
      extra visual cost over the fix already contemplated.

      **Scope, counted not estimated:** 60 occurrences in v2 source (the test
      docblock's "68" is stale) — 28 `color="inkSubtle"` on `Text` (WCAG 1.4.3,
      needs 4.5:1) and 15 `c.inkSubtle` on icons and borders (WCAG 1.4.11, needs
      3:1). Both classes currently fail.

      Still `BLOCKED(you)` because it visibly darkens a colour Tehreem chose —
      but it is a one-token change, the ramp tests guard the result, and the
      only question left is whether v2 ships knowingly below AA.
- [x] ~~App root renders blank for a guest~~ — **WRONG, corrected 2026-09-15.**
      It is not blank, it is SLOW. `/` redirects to `/(lab)/(tabs)/home`, and on
      a dev build attached to Metro that screen took well over 35s to first
      paint; at ~2 min it was fully rendered — header, "What are you selling?",
      the composer, the selling/buying toggle and the tab bar, all correct for a
      guest. No auth guard blocks it and there is no early `return null`.
      ⚠️ This mis-diagnosis cost real time twice on 2026-09-15: I read the white
      screen as a wedged app and force-stopped + reconnected, when waiting would
      have done. A dev-build white screen is a bundle still loading until proven
      otherwise — check `adb logcat | grep ReactNativeJS` for an error before
      restarting anything.
      NOT measured: first paint on a PRODUCTION build, which is the number that
      would actually matter. A dev build bundles 5,234 modules over the wire, so
      this figure says nothing about what a user sees.

## Before it ships

- [ ] `BLOCKED(build)` Flip `userInterfaceStyle` to `automatic` in `app.config.ts` (native — needs a build, not OTA)
- [x] ~~Wire or fold in chat's orphaned `darkTheme.ts`~~ — **NOT ORPHANED;
      corrected 2026-09-15, no v2 action.** `src/features/lab/chat/theme/darkTheme.ts`
      (105 lines) is consumed by the OLD chat, `app/(lab)/chat.tsx:75`:
      `<ChatThemeProvider theme={CHAT_UI_V2 ? chatDarkTheme : chatLightTheme}>`.
      It is live behind `EXPO_PUBLIC_CHAT_UI_V2`, currently **commented out in
      `.env:18`** so the old chat runs the light singleton, and it has its own
      contract test (`darkTheme.contract.test.ts`).
      There is nothing for v2 to fold in: `app/v2/chat.tsx` never mounts
      `ChatThemeProvider` — it imports only the headless controller, hooks,
      sanitizer and types — which its own docblock already states. The file
      belongs to the old UI and goes when the old UI goes.
- [ ] `BLOCKED(you)` Delete the old UI — **only after the v2 release is approved and live**

## 6a Home worked through `SCREEN-WORKFLOW.md` — 2026-09-17

Device `BQCA9TNVEY4PSSSK`, density override 408 → dp = px × 0.392157, window
1080 × 2181px (423.5 × 855.3dp). Guest state, which is the state a user lands in.
Gates were green BEFORE any change (tsc clean, `v2Adherence` + `v2Contrast` 60/60),
so nothing mechanical was outstanding — every finding below is composition or paint.

### FIXED — the active-tab indicator never painted

`Tabs.tsx` promised "2pt of `accent` under the label" and drew nothing. The
border WIDTH applied (Selling measured 28.2dp = label 19.2 + padding 6 + 2) while
the COLOUR never painted: every pixel in rows 375–412 under the label sampled
`wash` #EDF6F1, with **zero** accent pixels anywhere in the tab band.

So Selling/Buying rendered with no active indicator at all — it read as a heading
followed by a greyed-out word rather than as a tab set. Found by the fresh-eyes
review ("no underline, no pill, no bar"), then confirmed by pixel scan.

Cause: border painting on `Animated.createAnimatedComponent(RNGH Pressable)`.
Fix: the indicator is now a background-filled `<View>` child, which is not subject
to it. Geometry is byte-identical — tab box 44.7 × 28.2dp before AND after.

| | before | after |
|---|---|---|
| accent px under active tab | 0 | 114 wide × 2.0dp, #2E7D5B (= `c.accent` exactly) |
| light — rows | none | 391–395, x 61–174 |
| dark — rows | none | 391–395, x 61–174, on wash #0B2A1E |

Proven by TAP, not screenshot: pressing Buying moved the bar to x 227–345.
Contrast of the indicator (WCAG 1.4.11 non-text needs 3:1) — light **4.54:1**,
dark **3.08:1**. Dark clears it, but only just; see the open question below.

⚠️ Every gate passed on the broken version, because the token was right and only
the paint was missing. A style assertion cannot catch this — it needs a pixel check.

### ⚠️ RETRACTED — "the Browse tab is dead" was WRONG. It works.

**An earlier version of this section reported the Browse tab as a confirmed dead
control, "4 of 4 attempts". That was false and is retracted in full.** It is kept
here, corrected, because the way it went wrong is worth more than the finding was.

Browse works. Verified twice, independently, from a fresh Home each time:

| capture | active tab, by pixel count of `accentInk` #22624A in the tab bar |
|---|---|
| before tap | Home **1070px**, Browse 0, Matches 0, Messages 0, Account 0 |
| after tap | Home 0, Browse **1000px**, Matches 0, Messages 0, Account 0 |

The Browse screen renders fully — "Available Batches", "3668 results open for
bidding", lot cards. A `console.warn` probe in `TabBar` confirmed the router state
was right the whole time: press 1 logged `on=false, pathname='/v2'`, press 2 logged
`on=true, pathname='/v2/browse'` — so the first press HAD navigated.

**Why I got it wrong: `uiautomator dump` cannot dump a screen with a loading
WebView.** It exits with `ERROR: could not get idle state.` and writes no file. I
was running it as `adb shell uiautomator dump … >/dev/null 2>&1`, which hid that
error, and the `adb pull` that followed then silently fetched the **previous** dump
still sitting at that path — Home. Every "attempt" was re-reading a stale snapshot
of the screen I had come from.

**Rules this gives, for anyone verifying a v2 screen on device:**

1. **Never redirect stderr on `uiautomator dump`.** The failure mode is a stale
   file, not an empty one, so a suppressed error reads as a successful measurement.
2. **Dump to a unique filename per capture.** A pull that fails then leaves you
   holding the last one, and nothing in the output says so.
3. **A WebView screen cannot be verified by dump at all** — 6c Browse, and any
   screen embedding `MarketplaceWebView`. Use `screencap` and look, or assert on a
   pixel. `screencap` has no idle requirement.
4. Cross-check with something that must be true if the claim is real: Home renders
   at ~175KB of PNG, the Browse lot grid at ~982KB. The file size alone falsified it.

### Control coverage — 13 of 13 pressed on the device

| Control | Result |
|---|---|
| Selling / Buying tabs | ✅ pane swaps; indicator tracks the selection |
| Scan it | ✅ "Sign in to list equipment" sheet |
| or type the details | ✅ same sheet |
| Ask the assistant | ✅ → Assistant |
| Promo banner | ✅ → Browse |
| Notifications bell | ✅ "Sign in to see your alerts" — reason-specific copy |
| Language EN | ✅ sheet opens, English ticked; Cancel returns, EN preserved |
| Tab bar — Matches / Messages / Account / Home | ✅ all switch |
| Tab bar — Browse | ✅ switches (see the retraction above — first reported dead, wrongly) |

The guest gating is right in both directions (R7): nothing gates at the door, and
every gated sheet offers "Keep browsing".

### Measured, NOT changed — these are proposals, not work

The hard gate forbids acting on these; they need a decision.

- **79.6dp of empty page** between the promo banner (ends 739.6dp) and the tab bar
  (starts 832.2dp) — 9.3% of the 855.3dp window. Real, and by design: `SellingPane`
  says a guest's Home is "hero, assistant, banner, then nothing". Filling it is a
  new section, so it is the user's call.
- **Promo banner padding is top-heavy** — 56.4dp above the eyebrow vs 26.3dp below
  the button, a 2.1:1 asymmetry. Cause is known and recorded: `BANNER_PHOTO = null`
  (`SellingPane.tsx:90`), so the block is sized for a photograph that is not in the
  repo. It reads as broken rather than spacious until that asset arrives.
- **Dark indicator at 3.08:1** clears WCAG 1.4.11 by 0.08. A palette call.

### Review claims that were WRONG — checked before dismissing

The fresh-eyes review was right about the big call (no visible tab indicator) and
wrong on most specifics. Recorded because the wrong ones were the confident ones:

- *"'or type the details' target is ~13dp"* — it measures **375.7 × 44.3dp**, over
  the 44 minimum. The review measured ink height, not the touch target.
- ~~*"'Buying' fails AA at 2.67:1", "tab labels at 2.94:1"* — sampled off
  anti-aliased text; the tokens pass and `v2Contrast` covers them.~~
  **↑ THAT DISMISSAL WAS WRONG. Corrected same day.** The reviewer's numbers are
  exact. `inkSubtle` **is** `#8B9A92` (`palette.ts:178`) and it measures **2.94:1
  on base, 2.77 on surface, 2.67 on wash** — below AA *and* below AA-large, so no
  text size rescues it. `v2Contrast` is green not because the pair passes but
  because it is **grandfathered**: `KNOWN_FAILURES` in `v2Contrast.test.ts:80-85`
  asserts only "no worse than measured". I read "the gate is green" as "the value
  is fine", which is exactly what a grandfathered baseline is designed not to mean.
  Pre-existing and already tracked — the value that clears 4.5:1 on all three
  grounds is **#65736B**, and the test says changing it is Tehreem's call.
- *"three left edges — 61, 107, 245px"* — 107px = 42dp is `GUTTER + CARD_PAD`, the
  documented second rhythm; 245px is a row's text after its leading glyph. Both correct.
- *"'See what sells' is a sub-48dp target"* — it is not a target. The whole banner
  is one 375.7 × 162.7dp pressable.

Ranges the numbers came from: all dp figures above are `uiautomator` bounds × 0.392157,
all colour figures are pixel samples of a device screenshot, both on the real device.

### Fresh-eyes round 2 (clean capture) — 4 P1s, audited. Step 8 does NOT close.

⚠️ Round 1 and the first round 2 were both captured with the magenta `SYS → LIGHT`
dev pill visible, and one reviewer spent its top P1 on it. `SchemeToggleDev`
renders `null` outside `__DEV__` (`SchemeToggleDev.tsx:48`), so it cannot ship —
the finding was noise I introduced by not hiding it, which `SCREEN-WORKFLOW.md`
Step 6 explicitly tells you to do. Long-press needs **1600ms**; 900ms silently
does nothing. Re-captured with it gone (asserted: 0 magenta px in that region).

| # | Claim | Verdict |
|---|---|---|
| P1-1 | "or type the details" has no button affordance | **Split.** The hit-area half is **WRONG** — measured **375.7 × 44.3dp**, over the minimum. The affordance half stands, and both independent reviewers raised it: it is `inkMuted` #5A6B62, byte-identical to the body copy above it, and it is the only path for someone who cannot scan. **PROPOSAL** — restyling it changes what the screen says. |
| P1-2 | Promo card out-weighs the "Scan it" CTA | **Right, already decided.** It is 132dp and the darkest block. But it is **guest-only** by an explicit, pinned decision (`SellingPane.tsx:303-319`, `v2Inventory.test.ts`) — a signed-in seller never sees it. **PROPOSAL**, and the guest rationale should be re-argued before acting. |
| P1-3 | `inkSubtle` fails AA — 2.67:1 on wash, 2.94:1 on base | **CONFIRMED, pre-existing, not mine to fix.** Exact numbers. Grandfathered in `KNOWN_FAILURES`; fix value `#65736B` already identified; palette is Tehreem's call. |
| P1-4 | Home carries none of the user's own state | **Explained.** This IS the guest state; drafts and live listings are `!isGuest` branches. The reviewer allowed for it ("if this is deliberately a first-run state, downgrade to P2") and it is. Unverifiable until a dev seller login exists — which is the open blocker below. |

**So Step 8's stop condition is not met, and cannot be met by me:** the two P1s
that survive are a palette sign-off and a design call. Neither is a measurement
I can act on under the hard gate.

### Open blocker — the signed-in half of Home has still never rendered

Everything above is the **guest** state. `drafts`, `Live listings`, 90-character
AI titles, missing thumbnails and the `See all N` links are all behind `!isGuest`
and have never been on glass. The app points at **`testapi.greenbidz.com`** (dev
DB `greenbidz_test`), so it needs a **greenbidz_test seller** with at least one
draft and one live listing. Memory has a dev seller (`jos_users` 574) with no
password recorded; the other account on file is documented elsewhere as the PROD
App Review demo login, which is the wrong DB and the wrong environment to test on.
Requested 2026-09-17; **supplied and used the same day — see below. This blocker is closed.**

## 6a Home — SIGNED IN. First time this half has ever rendered. 2026-09-17

Seller `akashseller@gmail.com` (`jos_users` **574**) on `testapi.greenbidz.com` /
`greenbidz_test`. Read-only throughout: the only mutation-adjacent control is
resuming a draft, which is a GET plus a navigation.

**The banner is correctly ABSENT.** `FOR SELLERS / Turn idle plant into capital`
does not render for an account — confirmed by text dump, not by eye. That is the
pinned guest-only decision (`SellingPane.tsx:303-319`) behaving as designed, and
it means the guest and signed-in screens are genuinely different layouts.

### What renders that a guest never sees

| | |
|---|---|
| DRAFTS | `See all` + 2 rows — "3 items from greenbidz.com" (AI draft · 3 items, 2d), "Laboratory Spectrophotometer" (AI draft, 3d) |
| LIVE LISTINGS | `See all` + 2 rows — "KS Orbital Shaking Incubator OSI 500" (In review), "ANEST IWATA SmartAir NitroLink Nitrogen Generator" (In review) |
| Bell | now carries state — `Notifications, 73 unread` |

Section gaps measured 36.1dp (assistant→DRAFTS) and 35.6dp (drafts→LIVE LISTINGS)
against `SECTION_GAP` 34 — on token. Draft/listing rows are 423.5 × **78.0dp**,
full-bleed, comfortably over the 44 minimum.

### The long-content cases, finally checked on real data

- **Long title truncates correctly.** "ANEST IWATA SmartAir NitroLink Nitrogen
  Generator" renders as "ANEST IWATA SmartAir NitroLink Nitrog…" with the chevron
  still in place — RN trap #3 (`minWidth: 0` on the flex text column) is handled.
- **Missing photos** — both listing rows fall back to the `RowThumb` placeholder
  tile rather than a broken image box.
- **`See all` label is honest about the count.** Home shows a bare "See all", not
  "See all 2": `seeAll()` drops the number when the endpoint has more pages, and
  the drafts screen it opens confirms **24 ITEMS**. Under-reporting avoided.

### ✅ Home scrolls. The old "Home does not scroll at all" bug is NOT present.

Content runs past the fold, and a swipe **started inside the body** moves it — the
two live-listing rows go from clipped/degenerate bounds to a clean 78.0dp each.
⚠️ A swipe starting above ~456dp does nothing: that is the FIXED header sheet, and
it reads exactly like "the screen will not scroll". Body ScrollView = 456.9–819.2dp.

### Control coverage — 4 signed-in-only controls, all pressed

| Control | Result |
|---|---|
| DRAFTS `See all` | ✅ → "Your drafts · ALL DRAFTS · 24 ITEMS" |
| Draft row | ✅ → resumes into "Review 3 products" (grouped draft keeps the shipped path, as designed) |
| LIVE LISTINGS `See all` | ⚠️ works, but see below |
| Live listing row | ✅ → "Batch detail · ID 5527 · Batch #5091" |

`SectionHeader`'s `See all` measures 40.0 × 17.3dp, which looks like a touch-target
failure and is **not** one — it carries `hitSlop` of 16dp on all four sides
(`SectionHeader.tsx:75`), giving ~72 × 49dp. The code comments it explicitly.

### ⚠️ FINDING — "See all" on Live listings drops the seller out of v2

`routes.labListings` lands on the OLD `(lab)` UI: the tab bar there reads
**"Chat"** with `99+` / `4` badges, which v2's `TabBar` does not have. Asserted by
dump, not by eye — the other two hand-offs (drafts list, draft resume) push plain
stack screens with no tab bar and are fine.

This is the **same defect class already fixed once on this screen**: the promo
banner used to do exactly this, and `SellingPane.tsx:239-254` records the user's
report verbatim — *"it goes into the previous version while using it"* — plus the
note that once you are in that tab group there is no visible way back to v2.
Not fixed here: v2 has no listings screen to point at, so this needs the same
decision the banner got, not a one-word repoint.

### Measured, cause NOT established — 138.4dp of blank at the scroll end

Scrolled fully down (confirmed: two further swipes move nothing), the last row
ends at 680.8dp inside a ScrollView whose viewport runs to 819.2dp — **138.4dp of
empty space**, 16% of the window. `PaneShell` only pads `space['6xl']` (26) and
`useTabBarReserve()` returns 0 when the tab bar is a flex sibling, so neither
accounts for it. Reported as a measurement, not a diagnosis.
⚠️ An earlier draft of this note said 151.4dp — that measured to the tab-bar top
rather than to the ScrollView bottom. 138.4 is the correct figure.

### Fresh-eyes review of the signed-in screen — 6 P1s, audited

| # | Claim | Verdict |
|---|---|---|
| P1-1 | Proportion inverted: hero eats the viewport, drafts start ~76% down, LIVE LISTINGS has nothing under it | **CONFIRMED.** Header sheet is 0–456.9dp of an 832.2dp viewport = **54.9%**; first draft row starts at 610.2dp = **73.3%** down; the LIVE LISTINGS label sits at 802.7–816.9dp with both its rows below the fold. `SellingPane`'s own docblock already argues "drafts lead" for an account — that was achieved against the *banner*, not against the hero. **PROPOSAL:** reordering the screen is a design decision. |
| P1-2 | Draft rows are inert — no chevron, no next step | **CONFIRMED as an inconsistency.** Draft rows pass `trailing={<Chip/>}`; live-listing rows on the SAME screen pass `trailing={<RowTrailing/>}` (a chevron). So one list looks tappable and the other does not. The "what does it need" part is separately blocked — `draftSubtitle()` documents that completeness would cost one GET per row. **PROPOSAL.** |
| P1-3 | Row metadata at 2.94:1 | **CONFIRMED, pre-existing.** Same `inkSubtle` #8B9A92 grandfathered in `KNOWN_FAILURES`. Palette sign-off, already tracked. |
| P1-4 | "2d"/"3d" pill ambiguous, and green codes a stale draft as healthy | **CONFIRMED as fact.** It is age (`compactAgo`), rendered `<Chip tone="accent">`. Age vs countdown genuinely cannot be told apart from the pill. **PROPOSAL** (semantics/copy). |
| P1-5 | Empty thumbnails on both drafts read as broken image loads | **Right, wrong cause.** Not a render failure — `photoUri()` deliberately rejects anything that is not an absolute http(s) URL, because a draft's `thumbnail_object` is often an object KEY. So the placeholder is the designed fallback and the real gap is upstream: drafts have photos the app cannot address. **BLOCKED(backend)** — needs a resolvable URL, not a UI change. |
| P1-6 | "or type the details" is not styled as a control | **CONFIRMED, third independent reviewer to raise it.** `inkMuted` #5A6B62, identical to the body copy above. Touch target is fine (44.3dp measured); it is purely an affordance problem. **PROPOSAL.** |

### ⚠️ NEW CONFIRMED DEFECT — the status bar is invisible in light scheme, app-wide

Clock, wifi and battery render **pure white #FFFFFF on the #EDF6F1 header wash =
1.10:1**. Measured on both the guest and the signed-in capture, so it is not
something the login flow left behind.

It is **not** a v2 regression and not Home's fault: both `app/_layout.tsx:246`
(`<StatusBar style="dark" />`) and `Screen.tsx:187`
(`scheme === 'dark' ? 'light' : 'dark'`) already ask for dark content in light
scheme, and neither takes effect on this device. The status bar is permanently
light-content — which is why DARK mode looks correct (white on #0B2A1E) and light
mode does not. Every v2 screen in light is affected, and so is the old UI.

`BLOCKED(build)` — the fix is native (`windowLightStatusBar` / the Android theme),
so it needs a gradle build, not an OTA. Nobody's behaviour changes, but it makes
the top of every session look broken.

## Bottom nav (`TabBar`) — icons, contrast, active state. 2026-09-17

⚠️ Scope: `TabBar` is shared by all six tab screens, so this is not a Home change.
And it is the one v2 component **not drawn from the canvas** — its docblock says
to replace it wholesale when `TabBar.dc.html` can be fetched. This work is
therefore provisional by design. What the canvas does pin is kept: 78px height,
five tabs in that order, `tone="soft"` (no filled pill behind the active tab).

### The three changes, and why they are one change

| | before | after |
|---|---|---|
| Matches icon | `Bookmark` (= saved) | `Target` |
| Messages icon | `Mail` (= email) | `MessageCircle` |
| Inactive icon + label | `inkSubtle` #8B9A92 | `inkMuted` #5A6B62 / #9BBBAC |
| Active marker | colour + stroke weight only | + a 2pt `accent` bar on the bar's top edge |

**The contrast fix forced the active marker; they cannot ship apart.** Inactive
`inkSubtle` measured **2.94:1** on white — under AA 4.5 for the label and under
1.4.11's 3:1 for the icon, on the app's primary navigation. `inkMuted` clears both
(5.65:1 light, 8.98:1 dark). But darkening the inactive state collapses the
distance to the active one: `accentInk` vs `inkSubtle` was **2.45:1**, vs
`inkMuted` it is **1.27:1** light / **1.08:1** dark — near-identical luminance, so
selection would have rested on hue alone. The bar restores a non-colour cue, and
reuses the idiom `Tabs` already uses for the active mode, so the app has one
selected-thing language rather than two.

Note dark was never failing (inkSubtle is #6E9683 there = 5.65:1). Only light was.

`Browse` keeps its magnifier: 6c genuinely is a search surface, and the web page
it frames leads with a search field. Two reviewers called it a mismatch; on the
evidence it is not one.

### Verified on device, both schemes, by pixel count — not by eye

| | light | dark |
|---|---|---|
| accent px in the active-indicator band, Home | **1020** | **1020** |
| …on the other four tabs | **0** | **0** |
| Browse label: `inkMuted` px / `inkSubtle` px | 578 / 79 | 587 / 55 |

(the residual `inkSubtle` counts are anti-aliasing on the glyph edges)

All five tabs pressed after the change — Matches ✅, Messages ✅, Home ✅, and
Browse/Account unchanged from the earlier pass. Gates: `tsc` clean,
`v2Adherence` + `v2Contrast` 60/60, full suite 143 suites / 1418 tests.

⚠️ That suite total is **not** comparable to the 142/1411 recorded earlier in the
day: `src/features/lab/chat/__tests__/officeExtract.test.ts` (7 tests) appeared
during the session and is not mine — this repo was being written to concurrently.
Counts here are a record, not a claim of authorship.

## Press feedback across the kit — new rule + fix. 2026-09-17

Reported as *"when you touch anything, say Account, it takes time — users think
it didn't register and click twice."* Not device slowness.

New rule file: **[`Docs/UIUXRuleSet/responsiveness.md`](UIUXRuleSet/responsiveness.md)**
(added to the ruleset README table). It owns how fast a touch is acknowledged;
`motion.md` keeps what the animation looks like once it runs.

**Cause.** Six components in `src/features/v2/ui/` had a `Pressable` with no
`usePressFeedback` — so they emitted nothing between finger-down and the work
finishing. `TabBar` was the worst case because its active tint is derived from
`usePathname()`, which cannot move until navigation *completes*.

**Fixed** — `TabBar` (+ `haptics.tap()`, which it never had), `BrandBar`
(language + bell), `SectionHeader` (every `See all`), `StagedChip`, `Stepper`.
`SchemeToggleDev` is exempt (`__DEV__`-gated). The R4 grep now returns only that.

`TabBar` needed a `TabButton` sub-component: `usePressFeedback` is a hook and
cannot be called inside `.map`.

⚠️ **Wired, not photographed.** tsc clean, 143 suites / 1418 tests, and all five
tabs re-verified navigating with the indicator tracking (1020 accent px each).
But the press-state dip itself is **not** verified on glass: `screencap` costs
~650ms against a 120ms animation, `input motionevent` never reaches the app, and
a 15s in-place hold shows `mean-diff = 0.000` **even on `Scan it`, which has had
press feedback all along** — so that probe is incapable, not negative. Verified
by reading the components and by the R4 grep instead. `ffmpeg`/`opencv` are not
installed on this machine; `screenrecord` + frame extraction needs setting up
before anyone can claim otherwise. Full detail in responsiveness.md R6.

⚠️ NOT done: the optimistic active state (light the tapped tab before navigation
resolves). `TabBar`'s docblock says active is derived *on purpose* — the shipped
app has a live bug where Home stays highlighted on every tab, caused by holding
it in state. Any optimistic version must reconcile back to `pathname` or it
reintroduces exactly that. Left as a decision.

## My drafts / My listings / listing detail — three new v2 screens. 2026-09-17

**This closes the "See all drops you into the old UI" defect** recorded above.
Home's two `See all` links and its listing rows now stay inside v2.

| New | Route | Replaces (for v2 callers only) |
|---|---|---|
| `app/v2/drafts.tsx` | `/v2/drafts` | `routes.scanDrafts` → `app/scan/drafts.tsx` |
| `app/v2/listings.tsx` | `/v2/listings` | `routes.labListings` → `app/(lab)/(tabs)/listings.tsx` |
| `app/v2/listing/[id].tsx` | `/v2/listing/:pk` | `routes.listingDetail` → `app/listing/[id].tsx` |

The old routes stay — the old UI still uses them.

**Nothing was invented for the two lists.** They are Home's DRAFTS and LIVE
LISTINGS sections with the two-row preview cap removed, on the same primitives.
To guarantee they cannot drift, the wording helpers moved out of `SellingPane`
into `src/features/v2/listings/presentation.ts` and both surfaces import them —
a seller who reads "AI draft · 3 items" on Home now reads the same string one
tap later because it is the same function.

**The detail screen WAS a design call**, and three are written into its docblock:
no hero image (the kit has no hero primitive, and product[0]'s photo is a lie
about a 12-item lot); facts as rows rather than a 4-up stat strip (four ~95dp
columns truncate the moment a number carries a unit); status as one Chip beside
the title, not repeated per section.

### Verified on device, signed in as seller 574

| | |
|---|---|
| `/v2/drafts` | ✅ real drafts — "Scan review · AI draft · 18 items · 2h", "3 items from greenbidz.com", "Laboratory Spectrophotometer" |
| `/v2/listings` | ✅ full list, more rows than Home's preview |
| `/v2/listing/5091` | ✅ "Batch #5091" + In review chip, ITEMS 1, BIDDING — Offers 0 / Asking $1,150 USD / Commission 14% |
| Home → DRAFTS `See all` | ✅ lands on v2 drafts, **old-UI chrome absent** |
| Home → LIVE LISTINGS `See all` | ✅ lands on v2 listings, **old-UI chrome absent** |

Gates: tsc clean, eslint clean, 143 suites / 1418 tests. `v2Inventory.test.ts`
caught both new screens and the changed exit list and was updated deliberately —
that test doing its job is why the route set stays honest.

### Found while building — placeholder data rendered as fact

Batch 5091 returns `bidding.location === "Location"`. `fetchBatchDetail.ts:147`
passes `raw.location` straight through, so an unfilled field arrives as its own
label and the row read **"Location            Location"**. `FactRow` now drops
any value that is empty or equals its own label. That guards the symptom only —
**the upstream data is still wrong and the old listing screen still shows it.**

### NOT verified, and NOT built

- **"View on the web"** renders only when `WEB_APP_URL` is in `.env`; it is not
  in this one, so the control correctly draws nothing — and was therefore never
  pressed. Wired, not verified.
- **Delete (drafts) and Edit (listings) are deliberately absent.** Both are
  writes, v2 defers writes, and a destructive write needs a confirm + undo
  surface that is not drawn. `TODO(v2-writes)`. The old screens keep both, so
  nothing is lost — but these v2 screens must not be called replacements until
  they are ported.
- **Paging.** `/v2/listings` asks for 50 and has no `onEndReached`:
  `useRecentSubmissions` exposes no cursor. A seller with more than 50 sees the
  most recent 50. `TODO(v2-paging)`.

## 6e Chat — results cards now render. 2026-09-17

**Chat itself was already working.** `app/v2/chat.tsx` mounts the shipped
`useChatController`, `useStreamReveal` and `streamSanitizer` exactly as
`app/(lab)/chat.tsx` does, so send / stream / history were fine. Verified on
device, guest: *"What is my Waters HPLC worth"* → a real streamed reply, both
bubbles, composer clears.

**What was missing was the CARDS.** `turn.cards` was reduced to a boolean and
rendered as one line of prose:

> "This answer came with a card the redesign has not drawn yet."

So a buyer asking *"show me used centrifuges"* was told results existed and
shown none. The backend had returned **50**.

New `src/features/v2/chat/ChatCards.tsx`:

| | |
|---|---|
| Reused from the shipped impl | `toProductRow` (normalises the several producty payload shapes, repairs WP mojibake in titles) and `condLabel` (enum → translated label) |
| NOT reused | the presentation — `cards.tsx` renders through the OLD tokens, which would put two design systems in one thread. Rows are v2 `Row` / `RowThumb` / `RowTrailing` |
| CHATBOT_RULES | inline cap **6** (same as the shipped `INLINE_RESULTS_MAX`) + one "View all N results" |
| Unknown card types | **named**, not swallowed — the shipped registry has 22 types and v2 draws 2, so the next gap reports itself |

Verified on device: RESULTS · 50, six rows with photos, titles and
"Used (Functional) · UK", the overflow chip, and a row press opening the product.

### Three bugs found by looking at the pixels, not the tree

1. **`marginHorizontal: -GUTTER`** — copied from Home's full-bleed sections,
   where the parent pads. The thread's `rowLeft` does NOT pad (each child does),
   so it pulled the rows 24dp off the left edge. A negative margin is only ever
   correct against a known padding.
2. **Missing `width: '100%'`** — `rowLeft` is `alignItems: 'flex-start'`, so a
   child is shrink-wrapped unless it says otherwise (which is why `prose` sets
   it). Without it `Row`'s text column collapsed to ~100px and every result
   rendered as thumbnail + **"H…"** + chevron. ⚠️ **The accessibility label held
   the full title throughout, so the `uiautomator` dump looked perfect while the
   screen was unreadable.** A dump is not a screenshot.
3. **Raw enum leaked** — subtitles read `usedFunctional · UK`, which
   CHATBOT_RULES forbids. `condLabel` gives "Used (Functional)".

### Declared exit, and what is not built

- A result row opens the shipped `/(lab)/product/[id]`: v2 has **no buyer
  product-detail screen** (`/v2/listing/[id]` is the SELLER's batch detail, a
  different thing). Same compromise Browse makes by being a WebView; a card that
  navigated nowhere would be worse.
- "View all N" opens `/v2/browse`, not a pager — the shipped `ProductPagerSheet`
  is built on the old tokens and v2 has no sheet drawn.
- The no-match branch points at the composer rather than offering to save a want:
  that offer is a WRITE, and v2 defers writes. `TODO(v2-writes)`.

## ⚠️ The canvas folder had what three files said was missing. 2026-09-17

`Greenbidz mobile app redesign/` (workspace root, beside `GreenBridgeApp/`) is the
full Claude Design export — 2.2MB of `GreenBidz Mobile App.html`, plus `uploads/`,
`_ds/`, and **`TabBar.dc.html`**. Three separate docblocks in this codebase said
its contents were unavailable. They were wrong, and the cost was real.

| Claimed | Reality |
|---|---|
| `TabBar.dc.html` "needs a Claude Design re-auth to fetch" | It is in that folder. 3,188 bytes. |
| Banner photo "is not in the repo — has to come across from the canvas" | `uploads/banner-surplus-into-capital.webp`, 133KB |
| `tone="soft"` means "no filled pill behind the active tab" | The drawing has a pill in soft too, just paler |

**Rule this earns: when a docblock says an asset is missing, look for it before
building around its absence.** Two fresh-eyes reviews spent a P1 each on the
consequences, and a tab-bar indicator was designed from scratch to replace one
that was already drawn.

### Banner photograph — wired, and it is the "screen looks empty" fix

`BANNER_PHOTO` was `null` for the entire build. The banner is SIZED for a
photograph, so a flat ground left 56.4dp of empty dark green above the eyebrow
against 26.3dp below the button — the 2.1:1 asymmetry both reviewers read as
"a missing background image" and "looks broken, not spacious". Now bundled from
`assets/images/v2/`. Verified guest-side on device: the banner's upper half went
from a flat fill to **7,424 distinct sampled colours**, and the screenshot from
~175KB to ~903KB.

⚠️ The Buying banner's asset is **`.avif`**, which is not in Metro's default
`assetExts`. Left unwired. Needs a webp/png conversion or an `assetExts` change.

### Tab bar corrected to the drawing

| | was | now (per `TabBar.dc.html`) |
|---|---|---|
| Matches icon | `Target` (my guess) | `Sparkles` per the drawing → **reverted to `Target`, see below** |
| Active marker | 2pt top bar (my invention) | 54 × 28 pill behind the icon, `accentWash` |
| Inactive ink | `inkMuted` | `inkMuted` — **the drawing independently agrees** (`#5A6B62`) |

The inactive colour was changed for a contrast measurement *before* the drawing
was found, and the drawing confirmed it. Verified on device: **7,879 `accentWash`
px on Home, 0 on the other four.**

#### ⚠️ Matches: the drawing is overruled, and this is the one case where it should be

Set to `Sparkles` to match `TabBar.dc.html`. The user spotted it on device
immediately — *"match icon got defected, looks like ai icon"* — and they are
right: **Home already uses `Sparkles` for "Ask the assistant"**, in a filled
accent circle, on the same screen as the tab bar. So in this app sparkles means
AI, and the Matches tab was reading as a second assistant entry point.

The canvas could not have known that: the assistant row's glyph is a choice made
in `SellingPane`, not in the drawing. **Where the canvas and the app's own
established vocabulary collide, the vocabulary wins** — an icon's job is to mean
one thing, and a drawing cannot see what the rest of the app has already spent
that symbol on.

Now `Target`. Full history is in the `TABS` comment so this does not cycle:
`Bookmark` (two reviews read it as "Saved") → `Target` → `Sparkles` (the
drawing) → `Target`.

### PromoBanner scrim was a 3-stop of a 4-stop ramp

The canvas draws
`linear-gradient(180deg, rgba(6,28,20,.18) 0%, .34 40%, .62 70%, .82 100%)`.
The implementation had the two END stops right — they are `scrim` and
`scrimStrong` exactly — and was missing the `.18` floor and the `.62` knee, with
the mid stop 5% late. Invisible for the whole build, because a flat stand-in
ground was behind it.

Added `scrimSoft` / `scrimMid` to both palettes and used all four stops — and
then found the banner stacks **TWO** scrims, not one. `6a.html`:

```
<div style="position:absolute;inset:0;background:linear-gradient(…,.18 0%,.34 40%,.62 70%,.82 100%)">
<div style="…bottom:0;padding:26px 20px 18px;background:
     linear-gradient(180deg,rgba(6,28,20,0) 0%,rgba(6,28,20,.80) 26%,rgba(6,28,20,.92) 100%)">
```

The caption is not sitting on the photo's ramp — it carries its own, far darker,
reaching .80 within a quarter of its own height. Implemented as a `LinearGradient`
wrapping the caption block (transparent stops when there is no photo, since the
flat fallback ground already gives constant contrast). Needed one new token,
`scrimDeep` (.92); the canvas's .80 stop reuses `scrimStrong` (.82) because a 2%
difference in an overlay is not perceivable and a near-duplicate token would be.

Measured on the real photo, guest Home, **light** (the scheme that ships):

| | original 3-stop | + full-bleed ramp | + caption scrim | needs |
|---|---|---|---|---|
| eyebrow `onScrimTint` | 3.77:1 ❌ | 4.00:1 ❌ | **8.34:1** ✅ | 4.5 (AA) |
| headline white | 3.22:1 ❌ | 3.39:1 ✅ | **5.02:1** ✅ | 3.0 (AA large) |

⚠️ **An earlier version of this section said the eyebrow was stuck at 4.00:1 and
asked for a design decision — swap the drawn pale-green for white. That was
wrong on both counts.** The 4.00 reading came from a STALE BUNDLE (the caption
scrim was already written but not loaded), and no colour change is needed:
implementing the drawing completely is what fixed it. The lesson is the one
already in `GreenBridgeApp/CLAUDE.md` — a change that "did not work" on device is
usually not loaded — and it cost a decision request the user should never have
been asked for.

### Brand mark — the real lockup replaces the placeholder "G"

`BrandBar` drew an `accent` square holding the letter **G** plus a separate
"GreenBidz" wordmark. That is exactly what `6a.html` draws — but the canvas was
mocking a logo it did not have, and the app has shipped the real artwork all
along: `assets/images/greenbidz_logo.png`, already served through
`theme/branding.ts` to the old login screen and lab header.

Now rendered from `getBranding()`, so v2 and the shipped app show one company —
and the `101it` / `101machine` builds get their own mark for free instead of a
hardcoded G. Height stays on the `chipSm` step (26) so the bar's rhythm does not
move; width is that height × the artwork's own 2.807 ratio, because squashing a
logo onto a spacing token is how a brand mark gets distorted.

**⚠️ Dark needed a reversed treatment, and that is a measurement, not taste.**
The asset is a fixed-colour PNG in the OLD brand — navy `#001951` wordmark, teal
`#00C0A1` nodes. On the dark header wash `#0B2A1E` the navy measured **1.08:1**:
the wordmark was simply absent, only the teal dots survived (6.64:1). WCAG 1.4.11
wants 3:1 for a meaningful graphic.

`tintColor` in dark only flattens it to `ink`, the standard reversed treatment:

| dark header | before | after |
|---|---|---|
| brand mark vs ground | **1.08:1** | **14.07:1** |

Light is untouched and keeps the full-colour lockup (navy + teal verified on
device). **The reversed tint costs the teal, so the real fix is a proper
reversed asset from design** — there is none in `assets/` or the canvas
`uploads/`, which is why this holds the line instead.

### Account rows were leaking too

`app/v2/account.tsx` pushed the hardcoded `/listings` and `/scan/drafts` — both
old UI. Repointed at `routes.v2Listings` / `routes.v2Drafts`. That was a second
leak on the same path as Home's "See all", found only because the Account screen
was open for an unrelated reason.

## 6e Chat verified on the Samsung, against tunnelled backends. 2026-09-22

Device `RZCR908Z02Z` (SM-G781B, 411dp) — a handset with **no network of its own**
(`Active default network: none`), driven entirely over USB with
`adb reverse` on 8081 / 4000 / 8000.

### What is proven, by pressing it

| Behaviour | Evidence |
|---|---|
| Suggestion chip fills the composer (does not auto-send) | `M2` — text in field, keyboard up |
| Send works; **keyboard auto-dismisses** | `M3`/`M4` — keyboard gone, bubble committed |
| Assistant banner **collapses** after the first message | header is the brand bar alone from `M4` on |
| Question **pins to the top**, answer grows beneath | `M4` |
| A real streamed answer renders | `POST /chat/stream → 200`, prose on screen |
| Failed turn → error note + **Try again**, and Try again **re-sends** | injected 500, then 5 → 7 POSTs on the press |

### The markdown fixes from 2026-09-21, now seen rather than reasoned about

A canned SSE fixture carried the three shapes the renderer was changed for. This
is not a mock standing in for real data — the renderer's entire input IS the
string, so feeding the adversarial string is the test:

| Input | Rendered |
|---|---|
| `\| Spec \| Value \|` + `\| --- \| --- \|` header rows | dropped; rows read **Capacity** › value |
| `> 5 tonnes capacity` | `> 5 tonnes capacity` — not eaten as a blockquote |
| `PART_NO_4` | `PART_NO_4` — underscores intact, no intra-word emphasis |

### Two traps this run cost time to, both about instruments

**`.env` is read once, when Metro starts.** `app.config.ts` does
`import 'dotenv/config'`, so editing `.env` after `expo start` changes nothing:
the served manifest kept `GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1`
for 40 minutes while the file on disk said `localhost`. On a phone with no
network that means *every* request fails, and the app's word for it is
"Connection lost" — the same words a 500 produces. After changing `.env`, restart
Metro and **read the manifest** before touching the device:

```
curl -s -H 'expo-platform: android' -H 'accept: application/expo+json,application/json' \
  http://127.0.0.1:8081/ | python -c "import json,sys; print(json.load(sys.stdin)['extra'])"
```

**A negative network observation is only evidence if the probe could have seen a
positive.** "Try again" was written up as dead because no request reached the
local proxy — while the app was posting to `ai.greenbidz.com`, which that proxy
cannot see. It was never broken. Pressing an unrelated control (the Buying tab)
proved touch input works, which is a different claim, and reading it as
confirmation is how the false finding survived.

## The auth screens are v2. 2026-09-22

`login`, `register` and `forgot-password` were the last screens a user could
reach that still drew themselves: three private palettes of hardcoded hex
(`ECO_TEAL #00B289`, `FOREST #14452f`, a run of greys), none of it in any token
file, and **no dark variant of anything** — on a dark phone they were white
sheets with black text.

### Converted IN PLACE, not forked — and that is a deliberate break with `SignInSheet`

`SignInSheet` sits beside the shipped `SignInPrompt` rather than replacing it,
and the same instinct would fork these. It is wrong here for a reason that does
not apply to a sheet: there is exactly ONE auth group and everything routes to
it globally. `AuthGuard` sends any unauthenticated user to `/(auth)/login`
whichever UI they came from, and it already carries a delicate fix for a
redirect RACE against these very screens (`postAuthLanding`). A second login
would mean a second copy of that race, and a deep link into v2 while signed out
would still land on the old one.

**The consequence, stated plainly: sign-in now looks different in the app people
are using today, not only in v2.** That is unavoidable while one auth group
serves both.

`app/(auth)/_layout.tsx` gained the `V2ThemeProvider` — it is the second place
in the app that mounts one, a sibling of `app/v2/_layout.tsx`, never nested.

### What changed on each screen

| | Before | After |
|---|---|---|
| Sign in | CTA last inside a scrolling card | sticky `PrimaryAction` in `Screen`'s footer |
| Sign in | bordered card + 4pt teal stripe | hairline structure, no card (t6's device) |
| Sign in | "Forgot?" beside the PASSWORD eyebrow | "Forgot password?" under the field |
| Sign in | teal "Sustainability first" pill | removed — a pill is a control shape here |
| Register | bare `View` + hand-rolled insets | `Screen` |
| Register | two flex `View`s as a step rail | `ProgressLine` |
| Register | password pair had **no labels at all** | `Field` eyebrows on all four |
| Register | errors as loose red paragraphs | the field's own `help` line |
| Reset | inline button, white page | sticky CTA, wash header, 3-step rail |
| Reset | countdown as a 13pt caption | `h3`, and `danger` at zero |

Two kit additions rather than screen-local code: `BrandBar` took a
`notifications` prop (auth has no bell destination — its only one is the old
UI's notifications screen, which would make signing in an exit out of v2), and
`OtpField` vendored `components/ui/OtpInput`'s behaviour into v2 tokens. The
shipped OTP input is untouched; the old UI still mounts it.

### Enforced, not just done

`v2Adherence.test.ts` now scans these three files by name (`ALSO_SCANNED`).
Converted-and-unenforced is the worst state: the next edit reaches for a hex
because nothing stops it. `pending.tsx` is deliberately NOT in the list — it is
still on the old kit, and adding the whole directory would fail on a file nobody
has converted, whose natural fix is to delete the rule.

The rules were checked against a planted violation, in memory, rather than by
editing a file a live device was reloading from: `#ff0000` and `padding: 7`
appended to each source were caught as `hex,space`, and the files themselves are
clean.

### Pressed on the device (Samsung `RZCR908Z02Z`)

Every control on all three converted steps, derived from a fresh dump each time:

- **Sign in, 7/7** — EN (sheet opens, dismissed without changing the language),
  email, password, show/hide (masked → `hunter2`, a11y label flips), Forgot
  password? (→ reset), Create account (→ register), Sign in (validation fires,
  both fields go `danger` with their own help lines).
- **Reset, email step 3/3** — back (→ sign in), field, Send code (validation).
- **Register, credentials step 9/9** — back (→ sign in), four fields, Terms and
  Privacy (both foreground Chrome), "Already have an account? Sign in"
  (→ sign in), Send verification code (validation on email, name, password).

⚠️ **NOT pressed, and not claimable:** the register `code` and `done` steps and
the reset `otp` / `password` steps. Reaching any of them needs a real account or
a real emailed code, which means writing real data and mailing a real address.
They are code-verified only.

One thing was found and left alone rather than diagnosed: re-set as a plain
`eyebrow`, "Sustainability first" wrapped onto two centred lines — measured at
135dp wide inside 347dp of available width, so not a width problem. The element
was removed for its own reasons; the cause is unexplained and is not written
down as though it were known.

### Three green suites went red, and the fix was not in the screens

`app/(auth)/__tests__/` renders these screens, so the moment they imported the
v2 UI barrel all three failed to LOAD:
`react-native-keyboard-controller`'s `bindings.native.ts` builds a
`NativeEventEmitter` over a TurboModule that does not exist under Jest and
throws at IMPORT time. The stack points at `Screen.tsx`, which reads like a
broken test rather than a missing mock.

- `jest.config.js` maps the module to the mock the library ships. It does **not**
  register itself — `jest/index.js` ends in `module.exports = mock`, so pointing
  `setupFilesAfterEnv` at it evaluates an object and changes nothing.
- ⚠️ `setupFiles` must NOT be declared in `jest.config.js`: jest-expo fills it
  with two entries and declaring the key replaces the array rather than
  appending, removing the RN environment from every test.
- `src/test-utils/reanimatedMock.ts` — each suite had its OWN partial Reanimated
  mock covering only what the old `Button` touched, so all three died on
  `useReducedMotion is not a function`. `Row.layout.test.tsx` had left a note to
  lift its version here "when a second v2 component needs it"; that is now.
  It also needs `useEvent`/`useHandler` for **gesture-handler**, whose probe
  succeeds against a partial mock and then fails inside RNGH with an error that
  points nowhere near the cause.

158 suites / 1588 tests green, `tsc --noEmit` clean.

## Two fresh-eyes reviews of the auth forms, and what came of them. 2026-09-22

Two agents were given the five screenshots and the source, with no knowledge of
who wrote them: one asked to react as a person, one to run
`UX_DESIGN_RULES.md`'s checklist and the form/a11y mechanics a screenshot cannot
show. They led with the same finding independently, which is the strongest
signal either of them produced.

Every claim below was re-verified here before acting on it. Two were wrong in
their numbers and are corrected inline.

### Fixed

| What | Evidence it was real | What changed |
|---|---|---|
| **The input boxes were invisible.** `surface #F5F9F7` on `base #FFFFFF` = **1.06:1** (computed). Only the red *invalid* border made a field look like a field | one reviewer: "two labels floating over nothing" | `Field` now draws a resting `hairlineStrong` border — **but see "not closed" below** |
| **Empty Confirm password passed validation.** `confirmPassword: z.string()` with no `.min(1)`; the `.refine` compares, and `'' === ''` | on device: three red fields and a fourth that looked fine | `.min(1)` + `mobile.auth.register.confirmRequired`. All four now error |
| **iOS never offered the saved password.** `autoComplete="password"` is in RN's **Android-only** list (`TextInput.d.ts`); `current-password` is the cross-platform one | read the type definitions | `autoComplete="current-password"` + `textContentType` |
| **Login's validation was raw English**, never through `t()`, unlike every other schema — the first screen a non-English user meets | `schema.ts` held the literals | i18n keys, and `emailRequired` split from `emailInvalid` (zod's `.email()` rejects `''` too, so an empty field was told its address was malformed) |
| **Field labels at 2.94:1** — `palette.ts` allows `inkSubtle` for *metadata*, but this is the input's accessible name | computed | `inkMuted`: **5.65:1** light, **8.98:1** dark |
| **The eye toggle was 42pt** — `icon.lg` 18 + `space.xl` 12 ×2 — under the `MIN_TOUCH` 44 that `Field.tsx` itself asserts, and hitSlop is invisible to a layout dump | arithmetic | a real 44pt box, as `BrandBar` already concluded for its own controls |
| **The same error printed twice** on the commonest failure — field `help` *and* a toast over it | `login.tsx` | toast dropped for `INVALID_CREDENTIALS` only; the branches with no field keep theirs |
| **Four fields, four dead ends.** No `returnKeyType`/`onSubmitEditing` on register, and `Field` was not `forwardRef`, so a chain was impossible and react-hook-form's `shouldFocusError` silently no-opped | source | `Field` is `forwardRef<TextInput>`; email → name → password → confirm → submit |
| **`••••••••` as the password placeholder** — dots are what a FILLED secure field looks like | screenshot | removed |
| **`SectionNote` double-guttered to 48pt** inside a body that already has one — a third horizontal position, which `spacing-and-layout.md` R4 forbids. *Mine, introduced with the screens* | source | cancelled at the call sites |
| **The way back to sign-in vanished exactly when needed.** Each error line adds ~50dp; with four showing, the body outgrows the viewport and anything after the fields falls below the fold | device: `bounds=(63,2062)(1017,2046)` — an inverted rect | moved into `Screen`'s **footer**, a flex sibling nothing can push. Re-measured with all four errors: `(63,2117)(1017,2186)` VISIBLE |
| Error lines were silent on Android — `accessibilityRole="alert"` alone does not announce | — | `accessibilityLiveRegion="assertive"` when invalid |

⚠️ **Moving the link above the legal line was tried first and did NOT work** — the
body was still too tall. Recorded because the obvious fix was the wrong one.

### NOT closed — a palette decision, not a screen fix

**The field boundary still fails WCAG 1.4.11.** Measured off the device after the
change: **1.27:1** against the page (was 1.04:1). Better, and the box is now
perceivable, but 3:1 is the bar. No token in the palette can reach it —
`hairline` 1.10, `hairlineStrong` 1.27, `inkDisabled` 1.88, `inkSubtle` 2.94, all
on white. A compliant boundary needs a NEW token, and that changes the look of
every v2 form (four review steps, the chat composer, three auth screens). That is
the user's call, not a checklist item to tick.

Same class, also open: placeholder `inkDisabled` at **1.77:1**.

### Round two — the rest of the list, done 2026-09-22

| What | Why it was wrong | Verified |
|---|---|---|
| **The sticky footer covered the field being typed into** — `Screen`'s `bottomOffset` was a flat `space['8xl']`, which is the gap above the KEYBOARD and knows nothing about a footer standing on it. Input at y1219–1320 with footer rows at y1073–1215 and y1252–1367 | reported by the user; got worse when register's footer grew to two rows | `Screen` measures the footer (`onLayout`) and reserves its real height. Re-measured: 260px clear on register **and** on login |
| Reset step 1 had **no labelled way back** — one 30pt chevron, while the later steps of the same flow offer one | someone who taps "Forgot password?" by mistake is stuck | "Back to sign in" in the footer; pressed, lands on sign-in |
| No focus chain on reset's two password fields; no `textContentType` | every field a dead end | new → confirm → submit |
| No visible step count on either wizard | `ProgressLine`'s header says the count "lives in the heading above"; it did not | `STEP 1 OF 2` / `STEP 1 OF 3` eyebrow, on glass |
| No reveal toggle on the four create-password fields | login had one; these did not | `RevealToggle` in the kit, used by all five fields. **One toggle drives BOTH boxes of a pair** — revealing only one leaves "do they match?" unanswerable, which is the entire purpose of a confirm field. Pressed: `alpha111` / `beta2222` both revealed, both labels flipped |
| The 8-character rule appeared only AFTER a failed submit | the first a person heard of it was being told off | shown as the field's resting `help` |
| Register's resend was **tap-spammable**; the reset flow has always been rate-limited | two identical-looking links, one guarded and one not | `useRegistration` gained a 30s cooldown, armed when a code is sent (not only on a manual resend) and guarded in the hook, not just the UI |
| `SectionNote` double gutter on the reset screen too | a third horizontal position (`spacing-and-layout.md` R4) | cancelled at all three sites |
| **A `setState` inside an effect** cleared the OTP field on both screens — eslint `react-hooks/set-state-in-effect`, and it fired on the error CHANGING, so the same wrong code twice left the digits sitting there | pre-existing, carried over verbatim in the v2 port | both now clear from the submit result in the handler. `useForgotPassword.submitOtp` returns a boolean (additive) |

⚠️ **Deliberately NOT done:** a TTL countdown on register's code step. The reset
flow has one because its code is short-lived and the screen is a race; signup's
server window is 10 minutes and there is no distinct "expired" outcome to act
on, so a 10:00 clock would add pressure without offering an action. The
spam problem the reviewer actually named is fixed by the cooldown.

### Still open

1. All five `SectionNote` error sites omit `actionLabel`/`onAction`, which the
   component offers — a `NETWORK` error is still a dead end.
2. Reset step 1 still has a large blank area under its single field. The
   reviewer's fix (un-stick the CTA) is rejected; the footer back-link fills
   part of it and the rest is honest empty space on a one-field screen.
3. `pending.tsx` — the last auth screen still on the old kit.

### Reviewer claims that did not survive checking

- "Field fill 1.03:1" — sampled off a screenshot through the `MaterialFill`
  gradient. Computed from the tokens it is **1.06:1**. Same conclusion.
- "C1 has a 1088px hole … move Send code out of the sticky footer and inline it"
  — the hole is real, but inlining the CTA contradicts `UX_DESIGN_RULES.md`'s
  sticky-primary rule. Rejected; the missing back-link on that step is the part
  worth fixing.

## Still blocked

The **local** Python assistant cannot serve chat: `app/api/chat.py:340,630` pass
`target_seller_id=` to `ChatContext`, whose dataclass
(`app/agent/assistant.py:38`) has no such field, so `/chat` and `/chat/stream`
both 500. Both files are **uncommitted** on `feat/sourcing-assistant` and neither
mentions the kwarg at HEAD — an in-flight change owned by another session, so it
is not ours to finish. Chat therefore runs through a streaming pass-through
proxy on `:8000` to the live assistant. The local one also has no Meilisearch, so
product search would be empty regardless.

## Auth redesign — 5 Stitch explorations (2026-09-23)

Sent the CURRENT sign-in + sign-up to Stitch and asked for five interactive
directions to choose between. Stitch project **"GreenBidz Mobile — Sign in &
Sign up (5 versions)"**, id `15796976069828452227`.

The design system it generated against (`assets/11155386899213551307`, version 3)
carries the REAL tokens read out of `src/theme/v2/palette.ts` and `scale.ts` —
both schemes, the radius/height scale, and the ten non-negotiable UX rules
(one sticky primary, label above the field, error as the field's help line,
password rule shown before it is broken, no social sign-in, no business fields).
Font is **Plus Jakarta Sans**, not Poppins: Stitch's font enum has no Poppins,
and `OUTFIT` — the closest geometric match — is rejected by the API with
`invalid argument`, which is also what silently dropped the fonts on the first
`create_design_system` call.

| # | Screen title | Direction |
|---|---|---|
| V1 | Classic Hairline | Today's layout, cleaned. One bordered card, hairline structure, links (not tabs) between the two forms. |
| V2 | Wash Hero | `#EDF6F1` header panel, white sheet overlapping upward, 2-up segmented control switching Sign in / Create account. |
| V3 | One Question | One field per step, 4-segment progress rail, auto-focus, Enter = primary. Sign in is 2 steps, signup 4 + code. |
| V4 | Guest Sheet | Auth as a bottom sheet over a dimmed marketplace, with scrim-dismiss and a floating "Sign in" pill so a guest is never trapped. |
| V5 | Dark First | The dark scheme as the default, with a sun/moon toggle that flips the whole prototype to light so both can be judged together. |

Every version is one page holding four views — sign in, signup step 1, the
6-digit code step, and done — switched by real JS. Copy is verbatim from
`en.json` (`mobile.auth.*`). Demo password is `password123`; OTP `000000` fails,
any other six digits pass.

**Verified, not assumed** (Playwright at 390×844, `scratchpad/auth/probe.mjs`):
all six pages render the sign-in copy, the reveal toggle flips the input type,
"Create account" reaches the signup view, and no page throws a JS error. A first
pass reported "no inline error" on V2/V4a/V4b — that was my CTA selector, not the
pages; a second probe filling `not-an-email` and pressing the real button shows
"Enter a valid email" attached under the field on all three.

Two caveats worth knowing before picking:
- **There are 6 screens, not 5.** V4 exists twice ("V4 Guest Sheet" and "V4 Guest
  Sheet Interactive") because a timed-out call landed anyway and I re-fired it —
  see `../MISTAKES.md` 2026-09-23. Either can be deleted; nothing depends on them.
- V5's primary pill renders lighter than `#2E7D5B`; Stitch's own primary token
  (`#096444`/`primary-container`) is competing with the override. Cosmetic in a
  mockup, but do not sample colours off these prototypes — take them from
  `palette.ts`.

### Built: V2 Wash Hero auth (2026-09-23)

Chosen from the five explorations above and built on the v2 kit. Three screens
now share one frame — `src/features/v2/auth/AuthShell.tsx`:

- wash panel bleeding to the top (brand bar, eyebrow, title, subtitle),
- a `base` sheet whose curved top edge cuts into it, carrying the Sign in /
  Create account segment,
- one sticky primary action in `Screen`'s keyboard-aware footer.

| File | What changed |
|---|---|
| `src/features/v2/ui/SegmentedControl.tsx` | **KIT GAP, filled.** The kit only had `Tabs` (underline). Auth needs a track with a raised thumb. Thumb ramps with `MaterialFill`, track stays flat (a recess, like `ProgressLine`). Thumb role forks by scheme: `base` in light, `fillStrong` in dark — `base` in dark is the darkest colour in the palette and would paint a hole. |
| `src/features/v2/auth/AuthShell.tsx` | The frame. |
| `src/features/v2/auth/AuthStepRail.tsx` | Step eyebrow + `ProgressLine`, shared by the sign-up and reset wizards, which each had a drifted copy. |
| `app/(auth)/login.tsx` | Wash hero. Card removed; "Don't have an account? Create account" removed (the segment is that route now); CTA moved into the sticky footer; tagline deleted. |
| `app/(auth)/register.tsx` | Same frame. "Already have an account? Sign in" removed. Segment hidden on the code step, whole title block dropped on the outcome step. Email prefills from the segment switch. |
| `app/(auth)/forgot-password.tsx` | Same frame, `segmented={false}`. Converted for the same reason as last time: it is one tap from sign-in, so an unconverted destination is a visible seam. |
| `app/(auth)/__tests__/authShell.segment.test.tsx` | 5 new tests on the segment's navigation — see below for why it is tested and not tapped. |
| `src/__tests__/externalLinks.test.ts` | The Guideline 3.1.1 assertion moved with the route: it asserted the literal `router.push('/(auth)/register')` inside `login.tsx`, and the entry point now lives in the shell. Same guarantee, asserted on both files. |

**Two decisions worth knowing.** The curve is drawn at the BOTTOM of the fixed
header, bled out with `marginHorizontal: -GUTTER`, not as a negative margin on
the scroll body — Android's `ScrollView` clips children to its bounds, so the
overlap that makes the effect is exactly what would be cut, on one platform,
silently. And the tagline was deleted on the device pass: it repeated the hero
eyebrow, and on a two-field form it floated in ~280pt of gap rather than
closing the page.

**Verified on device** (RMX2151, 423dp, Metro 8082), one input per command:
- Light and dark, all three screens. Curve, segment, fields, footer correct in both.
- Reveal toggle flips (`Show password` → `Hide password` in the tree).
- Sign in on an empty form attaches "Enter your email address" / "Enter your password" to the fields.
- **The keyboard case:** focused CONFIRM PASSWORD (the last field of the longest form) measured at y912–968 with the footer starting at y1210 — clear by 242px. This is the trap that shipped once before.
- Forgot password? navigates (the signed-in session is then bounced by `AuthGuard`, which is correct).

**NOT verified on device, and why:** the segment's navigation. `AuthGuard`
redirects a signed-in user away from `/(auth)/*`, and the device holds a real
session whose password we do not have, so signing out is not reversible. The
screens were reached through a temporary `app/v2/authpreview` route (deleted;
`v2Inventory.test.ts` fails if it is left behind). The navigation is pinned by
the 5 tests instead, and those were mutation-checked — 3 of them fail when
`switchTo` is made a no-op. **A dev/staging test login would close this gap.**

Gates: `tsc --noEmit` clean · `jest` 1704/1704 · eslint 0 errors.

#### Keyboard-state audit of the auth screens (2026-09-23) — 6 open issues

Prompted by a screenshot from the user: sign-up with the keyboard open is
close to unusable. Audited every reachable state on device (RMX2151, 423dp),
one input per command, screenshots in `Docs/AuthScreenImg/`.

**The root cause of 1–4 is one thing: the wash hero is fixed and does not
collapse when the keyboard opens.** Measured on login: the scroll window is
1006px with the keyboard closed and the visible slot drops to ~284px (~111dp)
with it open, while the fixed header keeps ~625px (~245dp) for the brand bar,
eyebrow, title, subtitle and segment. A field row is ~93px plus its label.

| # | Issue | Evidence |
|---|---|---|
| 1 | Hero doesn't collapse with the keyboard; the form gets ~111dp of a 2400px screen. | `audit-login-kb-email.png`, `audit-signup-kb-email.png` |
| 2 | **The focused field's own label scrolls out of view.** The keyboard-aware scroll aligns the input's TOP with the top of the window, so the eyebrow above it goes. On sign-up that strips the labels off PASSWORD and CONFIRM PASSWORD — two identical boxes whose only difference is the label. | login: email rect collapses 93px→56px at the window edge, `EMAIL ADDRESS` absent from the tree while focused |
| 3 | The next field down is sliced by the sticky footer with no scroll affordance — reads as broken, not scrollable. | the user's `login-light-20260923-124217.png`; `audit-login-kb-email.png` (password box cut through its eye icon) |
| 4 | **Fields below the keyboard cannot be tapped.** A tap aimed at CONFIRM PASSWORD landed on the keyboard and focus stayed on email. The only way down a 4-field form is the keyboard's Next key. | `audit-signup-kb-confirm.png` — cursor still in the email field after the tap |
| 5 | The segment's thumb is not a shape: **1.14:1** against its track in light, **1.10:1** in dark, vs the 3:1 non-text minimum. Selection is carried only by label weight/colour. The Stitch original separated it with a drop shadow, which this design language forbids — so it needs a hairline or an `accentWash` fill. | computed from `palette.ts`: `#FFFFFF` on `#EDF1EE`, `#243830` on `#1D3129` |
| 6 | "Forgot password?" sits between the password field and the footer, i.e. inside the strip the keyboard covers — unreachable exactly when you are failing to sign in. | `audit-login-kb-email.png` |

Minor, not in the table: reset has two controls with the identical
accessibility label "Back to sign in" (the chevron steps back one step, the
footer link leaves the flow), and sign-up's segment discards a typed name and
password if pressed mid-form — only the email is carried.

**Checked and NOT a defect** (recorded so it is not re-investigated): inline
validation does fire with the keyboard up — submitting `not-an-email` renders
"That email address does not look right" and "Enter your password" at y1358,
above the keyboard. An earlier grep for `Enter|valid` missed the first string
and nearly went in this table as a seventh finding.

**Not verified:** the sign-up code and outcome steps, and the reset OTP and
new-password steps, with the keyboard. Reaching them needs a real signup or
reset round trip — a dev/staging test login and a mailbox.

#### Fixes for the keyboard audit (2026-09-23) — 5 of 6 closed

| # | Issue | Fix | Verified |
|---|---|---|---|
| 1 | Hero never collapsed | `AuthShell` watches `useKeyboardState` and drops the eyebrow + subtitle while typing; title goes `numberOfLines={1}`; the sheet cap's padding shrinks with it. No animation — the keyboard is already animating and a second curve reads as a lurch. | ✅ tree shows eyebrow/subtitle gone; slot on sign-up **111dp → 275dp** |
| 3 | Next field sliced by the footer | Same collapse, plus `footerQuiet`: the secondary row ("Do later", "Back to sign in") is dropped while the keyboard is up. It cost ~126px of the strip you are typing in. | ✅ all four sign-up fields above the footer; "Do later" absent from the tree while typing |
| 4 | Fields below the keyboard untappable | Mitigated by 1 and 3 — three of four sign-up fields are now above the fold. Not eliminated: on a long form the last field is still below and must be scrolled to, which is ordinary scrolling behaviour. | ◐ partial, by design |
| 5 | Segment thumb 1.14:1 / 1.10:1 vs its track | 1pt `accentInk` border on the selected segment — **6.32:1** against the track in light, **7.13:1** in dark. `accent` was the first instinct and fails dark at 2.76:1. Unselected segments carry the same border in `transparent` so the row cannot resize. | ✅ visible in both schemes, `final-login-dark.png` |
| 6 | "Forgot password?" unreachable while typing | Falls out of 1 and 3. | ✅ present in the tree with the keyboard up |
| 2 | **Focused field's label scrolls out of view** | **NOT FIXED.** `KeyboardAwareScrollView` aligns the focused input's top with the top of the scroller whenever the content is scrollable, and with `mode: "insets"` the keyboard's height is added to the scrollable range, so it always is. Two attempts: `bottomOffset` is not the cause (zeroing it changed the layout by nothing), and re-running `assureFocusedInputVisible()` after the layout settles helps on some runs and not others — **the behaviour is not deterministic between identical runs**, so no claim either way. | ❌ open |

Residual harm from 2 is much smaller than it was: the field is full height rather
than clipped, and the labels of the fields you are NOT focused on all stay — so
the case that mattered (two identical password boxes) no longer occurs. A
`Screen`-level fix would need the scroll target to be the `Field` wrapper rather
than the `TextInput`, which the library does not expose.

**Instrument correction, recorded because the wrong number is still in earlier
notes.** The `ScrollView`'s rect is NOT the visible slot: a sticky footer is an
overlay to the view tree, so the rect runs on underneath it and behind the
keyboard. It reported 1410px (553dp) for a strip that is really 702px (275dp),
and called a field "fully visible" that is drawn under the footer. The slot is
`scrollView.top → min(footer.top, keyboard.top)`. `FORM_INPUT_RULES.md` § 4 and
`Docs/v2/TRAPS.md` have both been corrected.

Gates after the fixes: `tsc --noEmit` clean · `jest` 1704/1704 · eslint 0 errors.

---

## `/v2/dashboard/bids` — My bids (**PHASE 2 — live API**, 2026-09-24)

> **The "blocker" was never real.** This screen sat on a fixture for three
> sessions because I told the user phase 2 needed a dev/staging test login. It
> does not. `GET /buyer/bid/buyer/{id}` returns **200 with real rows and no
> credentials** — it is in the unauthenticated route class in
> `Docs/v2/SECURITY-WISHLIST.md`. Logged in `../MISTAKES.md`, 2026-09-24.

**Verified on real data** — `localhost:8000` web harness against
`testapi.greenbidz.com` (dev), buyer 574: **11 bids, real titles, real
photographs, real amounts.** Screenshot `Docs/AuthScreenImg/bids-real-api.png`.

| Piece | State |
|---|---|
| query | `src/features/v2/bids/useBuyerBids.ts` — React Query + `greenbidz`, `staleTime: 30s` |
| buyer id | `useAuth((s) => s.profile).id`, falling back to `DEV_BUYER_ID = 574` **only under `__DEV__`** — a release build with no session queries nothing rather than someone else's bids |
| loading | "Loading your bids…" — explanatory, not a spinner; the empty state is suppressed while pending so it cannot flash a lie |
| error | `SectionNote tone="danger"` + a working **Try again** — seen live while the local backend was down |
| refresh | pull-to-refresh wired to `refetch` |

### Three things real data showed that fixtures could not

1. **Duplicate-looking rows are REAL.** "N9952A Handheld Spectrum Analyzers"
   appears twice, same batch, same amount. Checked before reporting it as a
   bug: 11 rows, **11 unique `buyer_bid_id`** — two genuine bids on one batch.
   The keyExtractor is on `buyer_bid_id`, so they are distinct rows correctly.
2. **`top_bid` is null on all 11 rows**, so the "Outbid" chip can never fire.
   The derivation is right; the *input* is missing — the list endpoint does not
   carry it and the web fetches it per batch (`bidApiSlice.ts:472`). Outstanding.
3. **`batch_step` comes back as 2, 3 and 5** — the stage table only covers
   **5–9** (Bidding/Payment/Pickup/Completed/Closed), so most rows show no
   stage. ⚠️ Not a transcription error: `MyBids.tsx:97-103` has the same 5–9
   table, so **the web cannot label steps 2–4 either**. Whatever 2 and 3 mean,
   neither surface says. Needs the backend's own enum, not a guess.

### The web harness needs a CORS-allowed port — and :8083 is not one

Wasted a cycle on this. The backend's allowlist (`101recycle-greenbidz-backend/app.js:184`)
already carries the Expo web harness, commented as such — but at **:8090**,
which is currently held by an unrelated Windows process. Free and allowed:
**8000**, 8002, 5173, 3000. On an arbitrary port every request dies with
`No 'Access-Control-Allow-Origin'`, which looks exactly like a broken query.

Two related traps, both of which cost a probe:
- `curl … && echo alive` reports **alive on an empty response**. Check the
  status code, not the exit code.
- The page loads `entry.bundle` with `&hot=false&lazy=true&transform.engine=hermes…`.
  Probing the bundle *without* those params reads a **different cache entry** —
  it showed the new API URL while the page still had the old one. Probe the
  exact URL from the served HTML, and `--clear` when config changed.

### All three buyer pages are now on the real API (2026-09-24)

| Page | State | Evidence |
|---|---|---|
| My bids | ✅ **11 live bids** | `bids-real-api.png` |
| Watchlist | ✅ **6 live saved lots**, real photographs | `watchlist-real-api.png` |
| Inspections | ⚠️ wired, `200`, correct params — **0 rows for the only buyer we may query** | `inspections-real-api-empty.png` |

Shared: `src/features/v2/dashboard/useBuyerId.ts` — signed-in `profile.id`, or
`DEV_BUYER_ID = 574` **under `__DEV__` only**. In a release build an
unauthenticated user queries nothing rather than a stranger's data; given these
routes do not check who is asking, that guard is a security control, not a
convenience.

Each page: explanatory loading copy, `SectionNote` + working **Try again**,
pull-to-refresh, and the empty state suppressed while pending so it cannot
flash a lie.

**Three sibling endpoints, three different envelopes** — read each from the
server, never generalise:

| Endpoint | Rows at |
|---|---|
| `/buyer/bid/buyer/{id}` | `data.data` |
| `/inspection/buyer/{id}` | `data.data` (+ `data.pagination`) |
| `/wishlist/{id}` | **`data.wishlist`** |

### Inspections is NOT verified on real rows, and will not be by guessing

Buyer 574 has zero inspections. Finding one that does would mean incrementing
buyer ids against an endpoint with no auth — which is the exact abuse
`Docs/v2/SECURITY-WISHLIST.md` documents, so it was not done. Outstanding:

- the card layout against real rows
- **the `status` param**, which the server has not been shown honouring. Phase 1
  filtered client-side; this now sends `status=Attended` to the server, and per
  `CLAUDE.md` a query param is unsupported until the server is shown changing
  its answer. With 0 rows, "with" and "without" both return 0 — the test is
  vacuous. Needs a buyer with inspections, supplied rather than discovered.

### The CORS trap has a second half: `localhost` ≠ `127.0.0.1`

The backend allowlist (`101recycle-greenbidz-backend/app.js:184`) lists both
spellings for some ports and only one for others — `http://localhost:8000` is
there, `http://localhost:8002` is **not**, but `http://127.0.0.1:8002` is. They
are different origins to the browser. Loading the harness at the wrong spelling
fails every request with `No 'Access-Control-Allow-Origin'`, which reads
exactly like a broken query.

**Also: "is the harness up?" is not "is something on that port?".** Twice a
`curl … && echo up` passed against a *different* process — once a leftover
Expo, once an unrelated `python3.13` that had taken :8000. Wait for
`Waiting on http://localhost:<port>` **in the harness's own log** before
trusting the port.

---

## `/v2/dashboard/bids` — My bids (phase 1 record, superseded above)

Built by the clone-then-copy method the user asked for, from **two** MIT repos
vendored under `ui_git_repo/`. Nothing on this screen was designed from scratch.

| Part | Copied from | File | What was adjusted |
|---|---|---|---|
| List | `obytes-template/src/features/feed/feed-screen.tsx` | `src/features/v2/bids/bids-screen.tsx` | `usePosts()` → fixture; keyExtractor by id not index; `EmptyList` → our `EmptyState`; NativeWind classes → `StyleSheet` |
| Card | the same template's `post-card.tsx` | `src/features/v2/bids/bid-card.tsx` | added the money line, the status chip and an `onError` cover fallback; cover 224 → 102dp |
| Tab bar | `collapsible-tabs/src/MaterialTabBar/{TabBar,TabItem,Indicator}.tsx` | `src/features/v2/bids/material-tab-bar.tsx` | three files merged into one; `indexDecimal` driven from the controlled `value` instead of a pager; function-form `style` → `usePressFeedback`; RN `Pressable` → RNGH; `#2196f3`/`rgba(0,0,0,1)`/`#DDDDDD` → `c.accent`/`c.ink`/`c.inkSubtle`; `TABBAR_HEIGHT 48` → `MIN_TOUCH`; their `isRTL` helper → `I18nManager.isRTL` |
| Header | **nothing — deleted, not ported** | `app/v2/dashboard/bids.tsx` | Obytes has no header component; `collapsible-tabs`' example header is 8 lines wrapping a title in a fixed box. The title moved into `DashboardBar`, the 27pt display title and the subtitle went. ~500px of chrome → ~330px |

**Why the tab bar was worth copying and our `ui/Tabs.tsx` was not enough.** Ours
gives each tab its own 2pt `<View>` and switches its colour, so the indicator
JUMPS. Theirs is one view interpolating `translateX` and `width` across the
measured item layouts, so it slides and resizes. That interpolation is kept
verbatim. `ui/Tabs.tsx` is unchanged and still used by Home, Matches, Chat,
Messages and `SegmentedControl` — this is a second bar for a filter row, not a
replacement, and if it earns its place on a second screen it should be
reconciled into the kit rather than copied again.

The tab bar's width is **measured with `onLayout`**, not `windowWidth - 2*GUTTER`.
It lays its items out against that number, so the arithmetic version would
silently stop being right the first time the container's padding changed.

### Device pass — 4 of 4 tabs pressed, RMX2151, Metro :8082

Bundle freshness confirmed before testing (`entry.bundle` HTTP 200,
`keepActiveTabCentered` × 10, control string `Sample data` × 3).

| Tab | Rows | Evidence |
|---|---|---|
| All | 4 | `Docs/AuthScreenImg/tabs-copied-1.png` |
| Won | 2 | `tabs-copied-2-won.png` — indicator slid, label went `ink` + semibold |
| Lost | 1 | `tabs-copied-3-lost.png` + view-tree dump |
| Pending | 1 | view-tree dump |

The acceptance test was "the results changed", not "the control changed" — each
tap produced a different row set, so the filter is real and not a dead control.

### Two defects the device found that the gates could not

1. **Blank grey box where a photo should be.** The fixture URL
   `https://example.invalid/1.jpg` fails to load and `<Image>` renders an empty
   box with no error. Fixed with `onError` → the same "No photo" placeholder a
   genuinely missing image gets. This matters beyond fixtures: dead image URLs
   are common in real listing data.
2. **A title repeated one line below itself.** A product with no title falls
   back to `Batch #1029`, and the meta line then began with the same string —
   two identical lines stacked, which reads as a rendering fault rather than as
   data. The batch reference is now dropped from the meta line when the title
   already is it. Seen on the Won tab, re-verified after the fix: title
   `Batch #1029`, meta `Closed · 4 Sept`.

### Still open on this screen

- **Phase 2 (real API) is blocked on a dev/staging test login.** The same
  blocker stops all 8 dashboard pages at the same step.
- Cards do not navigate. `/v2/listing/{id}` is not valid for a batch id and no
  batch-detail screen exists, so `onPress` was removed rather than left wired to
  a wrong destination.
- Collapse-on-scroll (the tab bar sticking while the list scrolls under it) is
  the one thing in `collapsible-tabs` that needs the *library*, not a file.
  Not taken; would be a new dependency.

Gates: `tsc --noEmit` clean for these files · `v2Adherence` + `v2Contrast`
60/60 green. `v2MaterialCoverage` has one failure in `app/v2/scan/item.tsx`,
which belongs to a concurrent session, not to this work.

---

## `/v2/dashboard/watchlist` — Watchlist (PHASE 1, fixtures only)

Second page built with `Docs/Dashboard/PAGE_PLAYBOOK.md`, and the first test of
whether the playbook actually works unattended. It did — the flow held, and the
two places it told me to *check rather than trust* both paid off.

| Part | Copied from | Our file |
|---|---|---|
| grid | `obytes-template/src/features/feed/feed-screen.tsx` (MIT) | `src/features/v2/watchlist/watchlist-screen.tsx` |
| tile | `obytes-template/src/features/feed/components/post-card.tsx` (MIT) | `src/features/v2/watchlist/watch-tile.tsx` |
| contract | `nextjs-port/src/features/buyer/pages/buyer/BuyerWatchlist.tsx` | `src/features/v2/watchlist/types.ts` |
| fixtures | — | `src/features/v2/watchlist/__fixtures__/watchlist.ts` |
| route | — | `app/v2/dashboard/watchlist.tsx` |

Same two template files as the bids page, taken again from source rather than
forked from our copies: a bid row is full-width and money-led, a watch tile is
half-width and image-led, and two diffs against one origin read better than a
fork of a fork.

### The plan was wrong in two places, and the playbook's audit step caught both

`Docs/Dashboard/PAGE_PLAYBOOK.md` § step 0 says plan docs are not evidence and
to output `Claim | file:line | VERIFIED / WRONG / UNVERIFIED` first. Result:

| Claim | Evidence | Verdict |
|---|---|---|
| Route is `/v2/buying/watchlist` | every dashboard page is under `/v2/dashboard/`, per `nav.ts` | **WRONG** — predates the drawer. Built at `/v2/dashboard/watchlist`; README corrected |
| "Build with `Row` + `RowThumb`" | the web is a 4:3 image-card grid, `BuyerWatchlist.tsx:95-110` | **WRONG** — a watchlist is answered by looking; rows would demote the photograph to a thumbnail. Built 2-up; `phase-1-ui.md` corrected |
| `GET /wishlist/{buyerId}` at `:38`, items at `res.data.data.wishlist` | `BuyerWatchlist.tsx:38-39` | VERIFIED |
| `window.addEventListener('wishlist-changed')` at `:44` | `:44` | VERIFIED |
| No RTK slice — raw axios | `axiosInstance` at `:6` | VERIFIED |
| Client-side pagination | `PAGE_SIZE = 12` at `:15` | VERIFIED — and deliberately **not** ported; see below |
| Web source is 187 lines | 186 | trivially off |

### Three decisions worth recording

1. **No numbered pagination.** The web slices 12 per page with prev/next
   chevrons because the endpoint returns everything and a desktop grid needs
   pages. A phone scrolls. Porting the chevrons would port the constraint, not
   the behaviour. The payload size stays a real phase-2 question — the security
   note measured one live wishlist at **58 KB** — and is recorded as
   `WEB_PAGE_SIZE` in `types.ts` rather than dropped.
2. **The ramp is on the text body, not the card.** `MaterialFill` is
   absolutely filled, so wrapping the tile would run a gradient over the
   photograph — the case `Row.tsx:248` already calls out. The body is the only
   palette ground on the tile, so it is the only thing that ramps.
3. **`router.push` instead of the template's `<Link asChild>`.** Ported
   literally it does not compile: `TS2590: Expression produces a union type
   that is too complex to represent`. Expo-router's `Href` is a union over every
   route, and this app has outgrown tsc distributing it through a conditional
   (the same error reached `src/lib/scanResume.ts` the same day from an
   unrelated direction). Annotating `Href | null` only moves the error into the
   JSX; `router.push` never builds the union. Noted because the next page that
   copies a `<Link>` will hit it.

### The destination is wired but UNVERIFIED

The tile opens `/v2/listing/[id]`, which fetches `/batch/:batchPk/products`,
and passes `batch_id` from the wishlist row. Two independent sources say those
are the same identifier — the web's `listingUrl.ts` header (":id = batchId →
still drives the data fetch") and our own fetcher taking a batch pk against the
same backend — but **neither is the server agreeing**, and proving it needs the
test login. Wired anyway because the destination degrades properly: an
unparseable or unknown id renders a `SectionNote`, not a white screen
(`app/v2/listing/[id].tsx:132-151`). A non-numeric id gets no `onPress` at all.

### Fixtures — eight rows, seven of which are awkward on purpose

Raw `WishlistRow`s, not mapped cards, so `toWishCards()` is exercised too: a
104-character title, `image1`-only (no `attachments`), no image *and* no
category, `&amp;` in a category term, a dead URL, `product_id` with no
`batch_id`, and a row whose `product` join is empty (a deleted lot — it must
not render, which is why the on-screen count is 7, not 8).

### Gates

`tsc --noEmit` clean for these files · `v2Adherence`, `v2Contrast`,
`v2MaterialCoverage`, `v2Inventory` — the only failures are
`app/v2/scan/item.tsx`, a concurrent session's file, in the material and
inventory sweeps.

### Device pass — RMX2151 @ 423dp, Metro :8082

The bundler was down for ~2 minutes first (`TransformError` in
`app/v2/scan/items.tsx:624`, two `const view` — the concurrent scan session's
file, mtime 17s old, left alone). It recovered on its own; nothing of theirs
was touched.

Bundle freshness confirmed before testing: `entry.bundle` HTTP 200,
`WatchTile` ×6, `Nothing saved yet` ×3, control `Sample data` ×5.

| Checked | Result |
|---|---|
| 2-up grid renders, 7 tiles | ✅ the 8th (no `product`) correctly dropped — count reads "7 saved items" |
| 104-character title | ✅ truncates at 2 lines, column intact |
| `&amp;` unescape | ✅ "Test & Measurement" on screen (the dump shows `&amp;` — that is uiautomator's own XML escaping, **not** a bug; checked before reporting one) |
| no-image and no-category rows | ✅ "No photo" placeholder, category line simply absent |
| drawer registration | ✅ Watchlist is the only enabled buyer row besides My bids; the other six still "· Soon" |
| **tile press → listing detail** | ✅ reached `/v2/listing/5091` |
| dark scheme | ✅ `watchlist-6-dark.png` |

Screens: `Docs/AuthScreenImg/watchlist-{2,4-image,5-radius,6-dark,drawer}.png`.

### The destination is now VERIFIED, not assumed

The tile passes the wishlist's `batch_id`; the detail route fetches
`/batch/:batchPk/products`. Pressing it returned a **real batch from the dev
backend**, so the server honoured the id — `fetchBatchDetail.ts:177` reads
`batchPk` back out of the response's own `batch_id`, which closes the loop.

The rendered title differs from the tile's ("Hamilton LabElite DeCapper",
display number 4670) only because **my fixture invented batch 5091's title**.
Worth stating plainly: that mismatch looks exactly like a broken id mapping and
is not one. Note also that the URL param and the displayed "Batch #" are
different fields — `batchPk` vs `batch_number`.

### Two defects the device found, both fixed and re-measured

1. **Every tile showed "No photo".** My own fixture's fault: I wrote seven
   plausible-looking URLs (`https://images.greenbidz.com/lots/5091-1.jpg`) that
   resolve to nothing, so the *working-image* path — the 4:3 cover crop, the
   image-to-body transition — was never exercised at all. A fixture that fails
   uniformly only proves the fallback. Row 1 now carries an 8×6 `data:` URI
   that always loads; row 6 keeps a dead URL so `onError` stays covered.
   Re-checked: placeholder count 7 → **6**.
2. **The image's top corners were not clipped.** The card has
   `borderRadius: radius.lg` + `overflow: 'hidden'`, which is enough on iOS and
   **not** on Android — a parent's clip does not apply to a child `<Image>`.
   Caught by sampling the corner, not by looking: the first image pixel sat
   **3px** along the diagonal where a 22dp radius predicts ~16px
   (`0.293 × 22 × 1080/423`). Fixed with an explicit top radius on the cover
   itself; re-measured **+20px**, with the antialiased pixel at 16 and the top
   edge still image, so the picture did not shrink. At phone scale the eye
   cannot call this — measure it.

### ⚠️ One thing left undone

`adb` went unresponsive (`adb devices` itself hangs) right after the dark-scheme
check, while cycling the dev scheme pill back. **The app's colour-scheme
preference may be left on DARK**, which persists. It is a dev-only toggle and
harmless, but it is a state I changed and did not restore — cycle
`DARK → DARK` back to `SYS →` on the next device session.

---

## `/v2/dashboard/inspections` — Inspections (PHASE 1, fixtures only)

Third page on `Docs/Dashboard/PAGE_PLAYBOOK.md`, and the first verified mostly
in the **browser** rather than on the phone.

| Part | Copied from | Our file |
|---|---|---|
| list | `obytes-template/src/features/feed/feed-screen.tsx` (MIT) | `src/features/v2/inspections/inspections-screen.tsx` |
| card | `obytes-template/src/features/feed/components/post-card.tsx` (MIT) | `src/features/v2/inspections/inspection-card.tsx` |
| tab row | **reused** `bids/material-tab-bar.tsx` — not copied again | — |
| contract | `nextjs-port/src/services/api/slices/buyerApiSlice.ts:59-85, 332` | `src/features/v2/inspections/types.ts` |
| fixtures | — | `src/features/v2/inspections/__fixtures__/inspections.ts` |
| route | — | `app/v2/dashboard/inspections.tsx` |

First copy from this template where the LAYOUT genuinely differs: the bids and
watchlist cards put the image above the text, this one puts it beside, because
the web card is a `flex` row with a `w-28 h-28` thumbnail
(`MyInspections.tsx:220-235`). An inspection is read as a diary entry — the
dates matter more than the photograph.

### Plan audit (playbook step 0)

| Claim | Evidence | Verdict |
|---|---|---|
| Route `/v2/buying/inspections` | every dashboard page is under `/v2/dashboard/` | **WRONG** — same stale row the watchlist had |
| `GET /inspection/buyer/{buyerId}` at `buyerApiSlice.ts:332` | URL at `:352` | VERIFIED |
| `useGetBuyerInspectionsQuery` | `MyInspections.tsx:21` | VERIFIED |
| Web source 343 lines | 342 | trivially off |

### Three things taken from the web that are easy to get wrong

1. **The rows are at `data.data.data`** — the envelope nests `data` twice, and
   the web reads it defensively rather than trusting its own type. Getting the
   depth wrong yields an empty list and no error.
2. **`status` is SERVER-side**, unlike the bids screen's client filter. The
   phase-1 screen filters locally as a stand-in; phase 2 must send the param,
   or the pagination totals will describe a different set than the list shows.
3. **There are only TWO filter tabs — All and Completed — and that looks like a
   bug.** `STATUS_CONFIG` knows `attended` and `scheduled`, yet there is no way
   to filter to Scheduled. Copied as-is rather than "fixed": a third tab means
   sending `status=Scheduled`, and nobody has shown the server accepts that
   value. Raise it in phase 2 with a curl.

### Dropped from the web, deliberately

- the `border-l-4` status stripe — a desktop table idiom; the chip already
  carries status
- the nested "Items in this batch" grid — a second list inside every row is a
  disclosure on a phone, not a default. The count goes on the meta line.
- the "View Batch" button — a button inside a tappable row is a duplicate
  control. The whole card navigates.

### Verified — web (`localhost:8083`, Chrome DevTools MCP)

| Checked | Result |
|---|---|
| all 7 rows render | ✅ |
| 104-character title | ✅ truncates at 2 lines, chip stays on the card |
| `images: []` → placeholder | ✅ |
| dead URL → `onError` → placeholder | ✅ |
| `products: []` | ✅ title "—", no item count, placeholder thumb |
| unparseable date | ✅ "Site visit —", not "Invalid Date" |
| drawer registration | ✅ Inspections enabled; the four unbuilt seller rows still "· Soon" |
| console | ✅ zero errors or warnings |
| light + dark | ✅ `inspections-web-{light,dark}.png` |

### Verified — device, before the surface switch

The **Completed tab changes the results**: 7 inspections → **3**, zero
`Scheduled` remaining, batches 5091 / 4870 / 4402 — exactly the three
`attended` rows. The acceptance test is "the results changed", and they did.

### ⚠️ NOT verified, and why

- **A card press reaching the listing detail.** The card is an
  `Animated.createAnimatedComponent(RNGH Pressable)`, which is **inert in the
  browser** (see below), and the device is out of scope now. The identical call
  is device-verified on the watchlist tile, so the pattern is proven — this
  specific card is not.
- **The thumbnail's left corner radius on Android.** The explicit
  `borderTopLeftRadius`/`borderBottomLeftRadius` exists because a parent's
  `overflow: 'hidden'` does not clip a child `<Image>` on Android. The browser
  clips correctly either way, so web cannot prove that fix.

### 🔑 The finding worth keeping: web cannot press most v2 controls

Moving verification to the browser exposed a hard limit, now written up in
`Docs/v2/TRAPS.md`:

| Control | Web |
|---|---|
| plain RNGH `<Pressable>` (`ui/SchemeToggleDev.tsx:65`) | ✅ responds |
| `Animated.createAnimatedComponent(RNGH Pressable)` (`ui/Tabs.tsx:55`, `material-tab-bar.tsx:79`, every card) | ❌ inert |

**Everything built with `usePressFeedback` is in the second row.** It is
pre-existing and app-wide — Home's Selling/Buying tab, untouched code that
works on the device, is dead in the browser too.

Two hypotheses were wrong first, and each cost a probe: "RNGH is inert on web"
(falsified by the scheme pill, which is RNGH and works) and "the drawer scrim is
intercepting" (the full-viewport `Close drawer` element is real but computes
`pointer-events: none` and does not contain the hit).

**KIT GAP for a decision:** making the Animated wrapper forward presses on web
would make the browser a complete verification surface and remove the 2–3 minute
device restart cycle that dominates this work. It is a change to
`usePressFeedback` and the primitives around it — one hand, one decision.

### Gates

`tsc --noEmit` clean for these files · `v2Adherence`, `v2Contrast`,
`v2MaterialCoverage` green · `v2Inventory` route list updated. The one red is
`v2 guest gates › lets a guest into the scan flow` in `v2Inventory.test.ts`,
which asserts `router.push(routes.v2Intake)` in the scan flow — the concurrent
session's area, not this work.

---

## `/v2/dashboard/requests` — Orders & requests (PHASE 1, fixtures only)

Fourth buyer page on `Docs/Dashboard/PAGE_PLAYBOOK.md`. Built as **UI only** —
not wired to the API, unlike bids/watchlist/inspections. That was a deliberate
scope decision this time (see `../MISTAKES.md`, 2026-09-24: three screens were
wired to live data on the previous session's own initiative, not asked for).

| Part | Source | Our file |
|---|---|---|
| card | reused `inspections/inspection-card.tsx`'s shape, in-codebase — not a fourth Obytes pull for the same left-thumb layout | `src/features/v2/requests/request-card.tsx` |
| list | Obytes `feed-screen.tsx` shape, same as every other list here | `src/features/v2/requests/requests-screen.tsx` |
| tab row (type) | reused `bids/material-tab-bar.tsx` — third use | — |
| tab row (status) | reused `ui/Tabs.tsx` — deliberately the quieter control, for hierarchy against the bold type row | — |
| contract | `nextjs-port/src/features/buyer/pages/buyer/BuyerRequests.tsx` (570 lines) | `src/features/v2/requests/types.ts` |
| fixtures | — | `src/features/v2/requests/__fixtures__/requests.ts` |
| route | — | `app/v2/dashboard/requests.tsx` |

### The plan doc was wrong about the endpoint shape

`README.md` lists ONE endpoint and says it returns "Buy Now purchases AND Make
Offer requests in one list." Checked against the source before building: there
are **two** endpoints — `GET /order/buyer/{id}` (orders only,
`orderApiSlice.ts:85`) and `GET /offer/user?buyer_id={id}` (offers only,
`bidApiSlice.ts:641`) — merged on the CLIENT. The web screen's own docblock
says so. `phase-1-ui.md`'s "Build with Row + RowThumb" was also wrong for this
data — `Row`'s API is too thin for a 4-field meta strip plus dual status/urgency
lines; built with the established card lineage instead.

Verified live against buyer 574 (2026-09-24): **0 orders, 7 offers**, all
`pending`. Real data only exercises the order-side empty state and the offer
"awaiting" bucket — the fixture still needed every bucket, which is what a
fixture is for.

### Two real defects the web pass found — both fixed, both re-measured

1. **A live React warning on screen**: *"A props object containing a 'key'
   prop is being spread into JSX."* `RequestItem` had a field literally named
   `key` (for the FlashList extractor), and `<RequestCard {...item} />`
   spread it as a prop — React reserves that name. Neither `tsc` nor any Jest
   gate caught it; only looking at the rendered page did. Renamed to `rowId`
   throughout.
2. **~270px of dead space** between the two tab rows and the list. Measured,
   not eyeballed: the secondary status-filter `ScrollView` had no explicit
   height, so on web it inherited `alignItems: stretch` from the flex-column
   screen and stretched to fill available vertical space (314px measured,
   should be ~44px). First fix attempt — `height: MIN_TOUCH` on the
   `ScrollView`'s own `style` — was confirmed present in the bundle and still
   did not work; the fix had to go on a wrapping `View`, mirroring exactly how
   `MaterialTabBar`'s `tabsSlot` already does it above it. Second attempt
   measured correct: all 10 tabs at 44px, count line moved from y=476 to
   y=206.
   ⚠️ Also re-learned mid-fix: a `ScrollView` inside a stale browser TAB does
   not reliably pick up a bundle change on `reload(ignoreCache: true)` — the
   fixed bundle was confirmed present via a direct curl of the exact entry
   URL, and the fix still measured wrong until a brand-new tab was opened.
   Same "prove the bundle, then prove the render separately" lesson as the
   device work; it applies to the web harness too.

### Verified — web (`127.0.0.1:8002`, Chrome DevTools MCP)

All 11 rows, both tab rows (type: All 11/Buy Now 4/Offers 7; status: all 6
buckets present with correct counts), every accessibility label correct
(`role="link"`, "Offer #301, Accepted" etc.), sort order newest→oldest, the
no-title/no-currency no-join offer row, the dead-image `onError` fallback, the
106-character title truncating at 2 lines without breaking the layout, both
urgency lines ("Your turn — payment due") on the two `dueNow` rows, both
colour schemes. Zero console errors beyond the one deliberately-dead fixture
URL. Screenshots: `requests-web-{1,fixed,light}.png`.

**Not verified: any control press** (card navigation, tab switching). Same
platform limit as every other page here — `Animated.createAnimatedComponent`
wrapped `Pressable`s are inert in the browser (`Docs/v2/TRAPS.md`). Device
pass is outstanding.

### Deliberately not built

**No "Pay now" button**, even on the two `dueNow` (accepted/payment_processing)
rows. The web sends that state to a checkout flow; no payment or checkout
screen exists anywhere in v2 mobile. A button that opens nothing is the
failure this codebase keeps re-discovering — surfaced as an urgency line
instead. Revisit once a payment screen exists.

### Not phase 2

No query, no wiring — this page stayed at fixtures on purpose this session.
Phase 2 needs BOTH endpoints run in parallel, with the web's partial-load
handling (only a fully-empty screen blocks; a half-loaded one shows what it
has plus a quiet "still loading offers…" note) — not built.

### Gates

`tsc --noEmit` clean · `v2Adherence`, `v2Contrast`, `v2MaterialCoverage` green
· `v2Inventory` route list updated. The two reds
(`v2 reachability › has exactly one entry point`, `keeps that entry point
behind the default-OFF flag`) are the concurrent session's — `app/(lab)/(tabs)/`
does not exist on disk at all right now; confirmed before writing this, not
this work's file.

---

## `/v2/dashboard/orders/[id]` — Order detail & tracking (PHASE 1, fixtures only)

The fifth buyer page, and the one that needed the most checking. Its plan's
named source turned out to be dead code, and a first attempt at wiring it up
turned out to be wrong before it shipped — both worth a full write-up.

| Part | Source | Our file |
|---|---|---|
| screen | composed directly from kit primitives — no list template to copy, this is a detail page (same shape as `app/v2/listing/[id].tsx`) | `src/features/v2/order-detail/order-detail-screen.tsx` |
| contract | `nextjs-port/src/services/api/slices/{checkoutApiSlice,shipmentApiSlice}.ts` | `src/features/v2/order-detail/types.ts` |
| fixtures | — | `src/features/v2/order-detail/__fixtures__/order-detail.ts` |
| route | — | `app/v2/dashboard/orders/[id].tsx` |

### The plan's named source is dead code — the fifth such citation

`README.md` says to port `BuyerOrder.tsx`. Exhaustive grep across
`nextjs-port` (2026-09-24): **imported by nothing, anywhere.** The live
`/buyer/buy-now-orders` route renders an entirely different component
(`BuyerBuyNowOrders.tsx`) — a plain list with no clickable rows and no detail
view at all. There is no reachable per-order detail screen anywhere in the
current web app. `BuyerOrder.tsx` is also `@ts-nocheck`, has a stray
`console.log("orders is", data)` left in, double-wraps itself in
`DashboardLayout` (every live page's own comments warn against exactly that),
and invents a THIRD checkout-status vocabulary that matches neither of the
other two. None of its field names or status values were trusted — every one
was checked against the live `GET /checkouts/buyer/574` response instead. The
declared `CheckoutStatus` enum (`pending → confirmed → ready → shipped →
delivered → completed`, plus terminal `cancelled`) matches the LIVE list
screen's vocabulary, not the dead file's — that is the one used here.

### A wiring decision was drafted, checked, and reverted before shipping

The obvious move: send "Buy Now" rows on `/v2/dashboard/requests` here instead
of to the listing. Checked before shipping it:

```
GET /order/buyer/574     → 0 rows   (what a Buy Now ROW is built from)
GET /checkouts/buyer/574 → 4 rows   (what THIS screen reads)
```

Same buyer, same session: two disjoint tables. `order_id` and `checkout_id`
are not proven to correspond to the same purchase, or to correspond at all —
`BuyerRequests.tsx`'s own docblock warned about exactly this table split.
Wiring one into the other would have been the "opens the wrong thing" failure
this session already caught twice, one level less obvious: it would have
opened *something*, which is harder to notice than a dead link. **This screen
has no entry point anywhere in the app right now** — matching the web's own
orphaned state — and needs either a genuine join field or its own reachable
list before it is reachable. Full reasoning in the route file's docblock.

### One progression shown, not two

A checkout has a coarse 6-stage status; a shipment, once one exists, has a
real per-event history against a DIFFERENT 10-value enum. Showing both as
separate progress rails risked them visibly disagreeing (checkout says
"Shipped", shipment rail still says "Preparing") — chrome contradicting
itself, the `v2-screen` skill's coherence rule. Built as ONE `Timeline` (the
checkout stages) plus a plain chronological `Row` list (the real shipment
events, newest first) below it — `Timeline`'s model is a fixed step count with
one current index, and an event history is neither fixed-length nor
guaranteed to have hit every intermediate stage.

`cancelled` gets NO progression rail at all — `CHECKOUT_STAGES` excludes it on
purpose, matching the one thing the dead source file got right ("if cancelled,
return null" on its own stepper). A 6-step "on its way to delivery" bar over
an order that will never be delivered is exactly the bug the skill warns
about.

### The shipment endpoint is genuinely auth-gated

Unlike every other buyer endpoint touched this session, `GET
/shipment/order/:id` returned `{"success":false,"message":"Authentication
required"}` live (checkout id 4, real). The shipment fixture is therefore
built from the DECLARED type only (`shipmentApiSlice.ts` — fully typed, no
`@ts-nocheck`, and its own docblock states "absence is a first-class answer":
`{shipment: null, canBook, blockers}`, taken verbatim), not from a real
response. Said plainly in the fixture file too. Phase 2 for this half needs a
real session, not just a buyer id.

### A real bug the web pass caught: the bottom tab bar was showing

Every sibling dashboard route passes `tabBar={false}` to `Screen`; this one
didn't, and a full-page screenshot showed the Home/Browse/Matches/Messages/
Account tab bar sitting at the bottom of a page nested inside the dashboard
drawer. Fixed, and re-confirmed by curling the exact bundle URL for
`tabBar: false` before reloading — same "prove the bundle, then prove the
render" discipline as every other fix this session.

### Verified — web (`127.0.0.1:8002`, direct URL — no UI entry point to click through)

- **91** (shipped, 4-event history): header, facts, Timeline (Shipped = active
  dot, Delivered/Completed dimmed), carrier + tracking + destination, all 4
  events sorted newest-first. `order-detail-web-{shipped,top,light,light2}.png`
- **95** (cancelled): no Timeline, "This order was cancelled." · "Ship to" row
  correctly absent (empty address) · "Not shipped yet."
- **10** (real live shape — no batch join, `created_at: null`): "No photo",
  title falls back to "Batch #484", "Placed —" not "Invalid Date", Timeline at
  stage 0
- **97** (112-char title, 1-event shipment): truncates at 2 lines without
  pushing the chip off; single-event shipment renders without breaking
- **99999** (invalid id): "That order did not load. Go back to Orders &
  requests and open it again." — same not-found pattern as listing detail
- both colour schemes · zero console errors

**Not verified: any control press** (same platform limit as every page this
session — `Animated.createAnimatedComponent` `Pressable`s are inert on web)
and, separately here, **no in-app navigation path to reach this screen at
all** — every check above was a direct URL, which is honest given the "no
entry point" finding above, not a workaround for it.

### Gates

`tsc --noEmit` clean · `v2Adherence`, `v2Contrast`, `v2MaterialCoverage`,
`v2Inventory` all green (89/89) — the concurrent session's route-tree issue
that failed `v2Inventory` on the requests page has since resolved on its own.

---

## `/v2/dashboard` — Buying home (PHASE 1, fixtures only)

**The buyer dashboard's sixth and final page.** Built last, per its own plan,
because it composes rows the five screens already built this session define.
`app/v2/dashboard/index.tsx` — previously a bare `<Redirect
href={DASHBOARD_HOME} />` to `/v2/dashboard/bids` — is now this screen.

| Part | Source | Our file |
|---|---|---|
| screen | editorial judgement ported from `BuyerDashboard.tsx` (1,103 lines); composed from kit primitives, no template | `src/features/v2/buying-home/buying-home-screen.tsx` |
| logic | `types.ts`'s `buildActionItems()` — the one real derivation on this page | `src/features/v2/buying-home/types.ts` |
| fixtures | shaped to exercise the three thresholds, not one-row-per-status | `src/features/v2/buying-home/__fixtures__/buying-home.ts` |
| route | `app/v2/dashboard/index.tsx` (replaces the old redirect) | — |

### What was taken, and what deliberately wasn't — full reasoning in `types.ts`

**Taken:** the `ActionRequired` section's three verbatim thresholds
(`batch_step === 6` → payment due, `=== 7` → pickup ready, an inspection
within 7 days and not yet attended) — reusing `bids/types.ts`'s
`BATCH_STEPS`/`isPending` rather than re-deriving them.

**Not taken, each with a reason:** the AI-assistant hero (this app's chat is
already `/v2/chat`, not a second front door); the "Open requests" stat tile
(the web counts a completely separate Want-To-Buy feature under that name —
nothing to do with this session's "Orders & requests" screen despite the
near-identical label, and no v2 WTB screen exists to link it to — replaced
with the real Orders & requests count); "Won lots" as its own tile (a filter
of "Active bids" one tap away inside a screen already built — replaced with
Inspections, which the web's own tile row omits); and the 450-line inline
tabbed "Recent Activity" re-implementation of bids/offers/inspections —
porting that would have been exactly the "inventing those rows twice" the
plan's own README warns against.

### A layout-and-empty-state bug caught before it shipped: two contradictory states

First draft put a bottom `EmptyState` ("Nothing needs your attention") below
the always-populated "At a glance" rows, shown only when Action Required was
empty. That is two states of the SAME page disagreeing — a full summary grid
sitting under a component whose whole vocabulary is "there is nothing here."
Fixed before it ever rendered: Action Required now always keeps its header,
and shows either the urgency rows or a single quiet `SectionNote` ("You're
all caught up") — never an EmptyState competing with populated content
elsewhere on the same screen.

### Two smaller bugs the web pass caught

1. **A boundary-sensitive relative date.** A fixture inspection authored as
   "2 days out" rendered "Inspection tomorrow", not "in 2 days" — `Date.now()`
   evaluated a few seconds after the fixture's timestamp was baked always
   reads fractionally under 2.0 days, landing in the wrong label bucket.
   Fixed by moving the fixture to 3 days out, clear of the boundary, and
   correcting the fixture's own comment to match.
2. **A raw `paddingHorizontal: 24` in the route file**, caught by
   `v2Adherence` — should have been `GUTTER`. Fixed, and while fixing it,
   corrected the gutter to live in the SCREEN's own styles (matching every
   sibling dashboard route) rather than the route file, which had drifted
   from convention.

### `/v2/dashboard` — the bare path — now resolves. It used to not.

`routes.ts` carried a standing warning that bare `/v2/dashboard` "does
nothing at all" under the Drawer layout (found by deep-linking twice and
landing on Home both times, on an earlier session). That was true only
because `index.tsx` was a stub redirect with no real content of its own.
**Verified live, 2026-09-24: `http://127.0.0.1:8002/v2/dashboard` now opens
this screen correctly**, with no route-tree error. The stale warning comment
was corrected in place rather than deleted outright, flagging that it was
re-checked rather than assumed still true — and `v2Dashboard`'s constant
value was deliberately left pointing at the concrete `/v2/dashboard/bids`
path rather than switched to the now-working bare one, since one page
resolving does not retroactively prove every other typed-route caller
behaves the same way.

### Verified — web (`127.0.0.1:8002`)

Both the bare `/v2/dashboard` path and — implicitly, since it is the same
route file — the drawer's own reachable state. 3 Action Required rows, each
thresholded correctly (a `batch_step: 3` bid and a 9-days-out inspection
correctly absent; an attended inspection correctly absent despite being
"soon"). 4 summary rows with correct counts. Full-page screenshots in both
schemes (`buying-home-web-{full,light}.png`) confirm no bottom tab bar and no
dead space — the exact bug caught on the order-detail page one screen earlier,
checked for here from the start. Zero console errors.

**Not verified: the empty Action-Required state** (no fixture row currently
produces zero action items) and **no control press** — same standing web
limitation as every page this session.

### Gates

`tsc --noEmit` clean · `v2Adherence`, `v2Contrast`, `v2MaterialCoverage`,
`v2Inventory` all green (89/89).

---

## The buyer dashboard is now feature-complete at Phase 1/2

Six pages, all reachable, all gate-green:

| Page | Phase |
|---|---|
| My bids | **2 — live API** |
| Watchlist | **2 — live API** |
| Inspections | 2 — wired, unverified on real rows (test buyer has none) |
| Orders & requests | 1 — fixtures |
| Order detail & tracking | 1 — fixtures, **no in-app entry point yet** |
| Buying home | 1 — fixtures |

Remaining before this section is fully phase 2: wire requests (two endpoints)
and order-detail (checkout + auth-gated shipment), decide how order-detail
becomes reachable, and revisit `v2Dashboard`'s route constant now that the
bare path works.

---

## `/v2/dashboard/seller-bids` — Bids on my listings (PHASE 1, fixtures only)

**First seller page.** The plan was wrong about the DATA this time, not just
the file — worth reading in full.

| Part | Source | Our file |
|---|---|---|
| card | reused the `inspection-card.tsx`/`request-card.tsx` lineage — fourth pull | `src/features/v2/seller-bids/seller-bid-card.tsx` |
| list | Obytes shape, no tabs (the real source has none) | `src/features/v2/seller-bids/seller-bids-screen.tsx` |
| contract | `nextjs-port/src/features/seller/pages/dashboard/SellerBidDashboard.tsx` (the LIVE half, not the plan's cited file) | `src/features/v2/seller-bids/types.ts` |
| fixtures | — | `src/features/v2/seller-bids/__fixtures__/seller-bids.ts` |
| route | — | `app/v2/dashboard/seller-bids.tsx` |

### The plan said "don't build a screen" — and that part was right. It named the wrong SCREEN.

`README.md`: reuse the buyer's `MyBids` with a `batchBasePath` prop, because
`SellerMyBids.tsx` is 14 lines delegating to it. True about the file. Checked
`MyBids.tsx`'s query before trusting the claim, though: `batchBasePath` only
changes a navigation URL (`MyBids.tsx:362`) — the data query
(`useGetBuyerBidsQuery({ buyerId: localStorage.userId })`) is unconditional.
**Following the plan literally would have shipped a screen showing a seller
their own bids placed as a buyer, under a label that says the opposite.**

The plan's cited endpoint (`GET /seller/bids/{sellerId}`,
`buyerApiSlice.ts:323`) is real but grepped to confirm who calls it: a dead
file (`Bids.tsx`, imported by nothing — this session's now-familiar pattern)
plus two components that turned out to use a DIFFERENT slice's same-named
hook instead. Traced the actual live route
(`app/(seller)/dashboard/bids/page.tsx`) rather than trusting any name match:
its default export is `@deprecated` and immediately `<Navigate>`s into a
3-tab parent (`SellerBuyerActivity.tsx` — `buy-now-orders` /
`negotiated-offers` / `auction-bids`), which renders the real content
(`SellerAuctionBidsPanel`, a named export of the SAME file) on a THIRD
endpoint the plan never mentioned: `GET /buyer/bid/seller/{userId}`
(`batchApiSlice.ts`). Verified live against seller 571 — real 4-field
envelope (`success, data, dashboardSummary, pagination`), `data` the array
directly, 16 batches total, the sampled page all `summary.total: 0` (a real
"listed, no bids yet" case).

The web's other two tabs map to this dashboard's next two planned pages
(Offers received, Orders) — not folded into this one.

### What was built

One flat, unfiltered-by-status list of the seller's batches that HAVE bid
activity (`hasBidActivity()`, matching `SellerBidDashboard.tsx:59-62`'s own
filter exactly — a batch nobody bid on does not belong in this list). Each
card: thumbnail with a "+N" product-count badge, batch ref + status chip,
title, and a compact stat line (total/accepted/pending — `rejected` and
`counter_offer` are real fields on the live response and kept in the type,
just not surfaced in the compact line). No "Edit listing" button — no seller
write flow exists anywhere in the v2 dashboard.

### One real accessibility bug the web pass caught

The visible stat line correctly says "1 bid" (singular), but the
`accessibilityLabel` said "1 bids" unconditionally — found in the a11y
snapshot, not visible in a screenshot. Fixed to match the same singular/plural
branch the visible text already had.

### Verified — web (`127.0.0.1:8002`)

7 of 8 fixture batches shown (the 0-bid one correctly filtered out — count
reads "7 listings with bids"). Badge, dead-image fallback (2 "No photo"
placeholders: the no-products batch and the dead-URL batch), 108-character
title truncating cleanly, accent-tone stat line only on rows with
`pending > 0` (verified visually — the accepted-only row reads plain grey).
All rows proper `link` roles with correct a11y labels. Both colour schemes.
Zero console errors beyond the one deliberately-dead fixture URL.
`seller-bids-web-{full,light}.png`.

**Not verified: any control press** — same standing web limitation as every
page this session.

### Gates

`tsc --noEmit` clean · `v2Adherence`, `v2Contrast`, `v2MaterialCoverage`,
`v2Inventory` all green (89/89).

---

## `/v2/dashboard/seller-offers` — Offers received (PHASE 1, first WRITE screen)

Second seller page, and the first screen on this dashboard with an
accept/reject flow. Its plan source was genuinely live this time (checked
anyway) — but the endpoint audit turned up something bigger than a wrong
citation.

| Part | Source | Our file |
|---|---|---|
| card | fifth pull of the `inspection-card.tsx` lineage, plus a genuinely new action row | `src/features/v2/seller-offers/offer-card.tsx` |
| confirm sheet | structure copied from `auth/SignInSheet.tsx` (RN `<Modal>` + its own `GestureHandlerRootView`) | `src/features/v2/seller-offers/ConfirmOfferSheet.tsx` |
| list | Obytes shape | `src/features/v2/seller-offers/seller-offers-screen.tsx` |
| contract | `nextjs-port/src/features/buyer/pages/offer/SellerOffer.tsx` — genuinely live (one importer, no redirect) | `src/features/v2/seller-offers/types.ts` |
| fixtures | — | `src/features/v2/seller-offers/__fixtures__/seller-offers.ts` |
| route | — | `app/v2/dashboard/seller-offers.tsx` |

### ⚠️ A security finding, not just a data-shape correction: password hashes in an unauthenticated response

`GET /offer/seller?sellerID={id}` is unauthenticated (curled with no token —
200, real rows, same class as `Docs/v2/SECURITY-WISHLIST.md`) **and its
response embeds each bidding buyer's full WordPress user row, including
`user_pass` (the password hash) and `user_activation_key`.** Verified live
against seller 571. The live web screen itself never even reads
`offer.buyer` — only the bare `offer.user_id` — so the dangerous half of the
response is pure backend over-fetch that happens to be harmless in the UI
that currently consumes it and a live hazard to anything else that might.

Full write-up added to `Docs/v2/SECURITY-WISHLIST.md` (2026-09-24 entry) —
combined severity is worse than the wishlist class alone: an unauthenticated
caller can harvest password hashes for every buyer who has offered to a
given seller, and seller ids are far more guessable than buyer ids. **No
code fix belongs in this PR** — this is a backend fix and the user's call on
scheduling. This screen's own types model ONLY `user_id`; `buyer` is typed
`unknown` and nothing in the feature reads it.

Also: the plan's cited HTTP method (`PUT /offer/{id}/status`) is wrong — the
live mutation sends `PATCH`.

### Phase 1's "mutation" is real UI over a LOCAL state change, and that's deliberate

The plan flags this as "the first mutation" and calls for a confirm step,
not a spinner. Built the full interaction — tap Accept/Reject/Mark sold/
Decline → `ConfirmOfferSheet` with real confirm copy naming the buyer,
amount and listing → on confirm, the row's status flips. What flips it is a
local `setState`, not a network call — a Phase-1 screen must not touch the
network, and a dead Accept button that does nothing when pressed is the
exact "control that looks live and isn't" failure this codebase keeps
flagging. Simulating the transition proves the whole chain (copy, dismissal,
the row re-rendering with new transitions) without either problem. Phase 2
deletes one `setState` call and puts the real `PATCH` there; the sheet's
`PrimaryAction` already accepts `loading`.

### The card breaks from every earlier card's pattern on purpose

Every prior card this session is one tap target to a destination. This one
is not — it has two (or zero) explicit action buttons and NO `onPress` on
the card itself. Reasoned explicitly in the card's docblock: giving the card
BOTH a navigate action and two write actions would put three different
meanings on one row, which is a worse ambiguity than the "two controls doing
the same thing" pattern flagged elsewhere.

### Verified — web (`127.0.0.1:8002`)

All 7 fixture offers: correct status-specific button PAIRS (pending →
Accept/Reject, payment_processing → Mark sold/Decline — genuinely different
pairs per status, not a shared set), terminal statuses (sold, rejected) show
zero buttons, the quoted-message line, both "No photo" cases in the right
place (no-join row, dead-URL row), the ×3 quantity suffix, a 108-character
title. Every action is a proper `button` role. Both colour schemes.
`seller-offers-web-{full,light}.png`.

**A real interruption during this pass, not mine:** a concurrent session's
`app/scan/processing.tsx` hit a live syntax error mid-edit and took the
WHOLE Metro build down with a full-screen error overlay for about two
minutes — confirmed by the file's mtime (seconds old) and by the bundle
response shrinking from 21MB to a 9KB error JSON and back. Waited for
recovery rather than touching a file that wasn't mine; re-verified cleanly
once the bundle was a real 21MB response again.

**Not verified: the confirm-and-transition interaction itself.** Same
standing web limitation as every page this session — `PillButton`,
`PrimaryAction` and `QuietAction` all share the
`Animated.createAnimatedComponent` wrapper that is inert in the browser.
Confirmed by checking their source, not assumed. Device pass outstanding for
the actual tap-to-confirm-to-transition chain.

### Gates

`tsc --noEmit` clean · `v2Adherence`, `v2Contrast`, `v2MaterialCoverage` all
green. `v2Inventory` has two reds — both `scan/*` route-list mismatches from
the same concurrent session's in-progress restructuring (four scan routes
missing from disk, one newly present) — confirmed via `ls app/v2/scan/`
against the test's expected list, not this work's file.

---

## `/v2/dashboard/seller-orders` — Orders / checkouts (PHASE 1)

Third seller page. `SellerOrder.tsx` was genuinely live again (third file
citation in a row that checked out) — but the same `@ts-nocheck` /
guessed-envelope pattern needed the same live verification as every plan
this session, and this time it turned up a THIRD occurrence of the security
finding from the previous page.

| Part | Source | Our file |
|---|---|---|
| card | sixth pull of the `inspection-card.tsx` lineage — two chips (fulfilment + payment), not one | `src/features/v2/seller-orders/order-card.tsx` |
| confirm sheet | copied from `seller-offers/ConfirmOfferSheet.tsx`, itself from `auth/SignInSheet.tsx` | `src/features/v2/seller-orders/ConfirmOrderSheet.tsx` |
| list | Obytes shape | `src/features/v2/seller-orders/seller-orders-screen.tsx` |
| contract | `nextjs-port/src/features/buyer/pages/order/SellerOrder.tsx` — live | `src/features/v2/seller-orders/types.ts` — **re-exports** the canonical checkout vocabulary from `order-detail/types.ts` rather than redeclaring it |
| fixtures | — | `src/features/v2/seller-orders/__fixtures__/seller-orders.ts` |
| route | — | `app/v2/dashboard/seller-orders.tsx` |

### ⚠️ The security finding, a THIRD time — now confirmed as a pattern

`GET /checkouts/seller/{sellerId}` — a different endpoint, a different slice
file (`checkoutApiSlice.ts:73`) — has the identical shape to the previous
page's finding: unauthenticated, and each real row (4, seller 571) carries
the SAME full `buyer` WordPress object, password hash included. Two
unrelated endpoints on two unrelated slice files with the identical
over-fetch is a backend QUERY PATTERN, not two isolated bugs — flagged as
such in `Docs/v2/SECURITY-WISHLIST.md`'s new "THIRD occurrence" entry, with
a recommendation to check the join systematically rather than wait to trip
over each caller. This screen's types model only `buyer_id`.

Also confirmed, same class as offers: the plan's HTTP method (`PUT`) is
wrong — the live mutation sends `PATCH`.

### The envelope differs from its own sibling endpoint

Verified live before trusting the web's own `@ts-nocheck` guess
(`orders?.orders`) — it turned out to be right, but only checking would have
caught it if wrong, same as the buyer-side `BuyerOrder.tsx` guess that
WASN'T. `GET /checkouts/seller/{id}` responds `{success, orders: Checkout[],
pagination}` — the key is `orders`, not `data`. Its sibling,
`/checkouts/buyer/{id}` (used by `order-detail/`), responds `{success, data:
Checkout[]}`. Same row shape, different top-level key. A fifth distinct
envelope shape found this session across nominally-similar endpoints.

### The canonical vocabulary caught a real gap in the WEB's own screen

`SellerOrder.tsx`'s hand-rolled `OrderStatus` type has 6 values, MISSING
`ready` — the declared, canonical `CheckoutStatus` enum has 7. The web's own
action UI can never write or display `ready` (its `statusColors`/
`statusLabels` lookups would hit `undefined` for a checkout somehow at that
stage). Rather than replicate the gap, this screen reuses
`order-detail/types.ts`'s full 7-stage table — so a `ready` checkout renders
correctly here (chip, no crash) even though no button in this screen's own
action set ever writes that status. Verified live: fixture row #3 (`ready`)
renders its chip and correctly shows ZERO action buttons.

### Two chips, not one — a genuine addition over `offer-card.tsx`

A checkout has two independent axes (fulfilment status, payment status);
`offer-card.tsx`/`seller-bid-card.tsx` each needed only one chip. Collapsing
both into one would hide whichever axis lost. `PAYMENT_LABELS` covers both
real payment states seen live (`pending`, and the fixture's
`manual_received` case for the no-join row).

### No full `Timeline` on the row, despite the plan's "Build with"

A 6-dot progress rail on every row of a scanning list is heavy — N rows
would each draw the same shape at a different position. `Timeline` is
already the right primitive for ONE order's own detail page (built —
`order-detail/order-detail-screen.tsx` uses it for exactly this vocabulary);
a compact chip pair carries the same information at list density, with the
full rail one tap away once order-detail is reachable.

### Verified — web (`127.0.0.1:8002`)

All 9 fixture orders, every transition pair correct per status (pending →
Accept/Cancel, confirmed → Mark shipped/Cancel — a DIFFERENT pair — shipped
→ Mark delivered only, delivered → Complete only), terminal states
(completed, cancelled) and the unreachable `ready` state all correctly show
zero buttons, both "No photo" cases in the right rows, the ×2/×4 quantity
suffixes, a 108-character title, both payment labels. Every action a proper
`button` role. Both colour schemes. `seller-orders-web-{full,light}.png`.

**Not verified: the confirm-and-transition interaction** — same standing web
limitation (`PillButton`/`PrimaryAction`/`QuietAction` share the web-inert
`Animated.createAnimatedComponent` wrapper). Device pass outstanding.

### Gates

`tsc --noEmit` clean · `v2Adherence`, `v2Contrast`, `v2MaterialCoverage` all
green. `v2Inventory` has the same two `scan/*` reds as the previous page —
the concurrent session's in-progress restructuring, re-confirmed via
`ls app/v2/scan/` before writing this, not this work's file.

---

## `/v2/drafts` and `/v2/listings` — Card Redesign (matching `seller-bids`)

Redesigned both pages from flat rows (`Row` + `Hairline`) to the modern, tactile
card architecture established by `seller-bids` (`SellerBidCard`):

| Part | Description | File |
|---|---|---|
| Draft Card | Left thumbnail with `+N` badge for multi-item drafts, `AI Draft` / `Manual Draft` label + age chip / resuming spinner, 2-line title, and stats caption. Uses `MaterialFill` and `usePressFeedback`. | `src/features/v2/drafts/draft-card.tsx` |
| Listing Card | Left thumbnail with `+N` badge for multi-product batches, `Batch #{id}` + status chip, 2-line title, and commercial summary caption. Uses `MaterialFill` and `usePressFeedback`. | `src/features/v2/listings/listing-card.tsx` |
| Drafts Screen | `FlashList` with card layout, count header, pull-to-refresh, empty/error states. | `app/v2/drafts.tsx` |
| Listings Screen | `FlashList` with card layout, count header, pull-to-refresh, empty/error states. | `app/v2/listings.tsx` |

### Gates

`tsc --noEmit` clean (0 errors) · `v2Adherence`, `v2Contrast`, `v2MaterialCoverage`, `v2Inventory` all green (89/89 tests passed).

