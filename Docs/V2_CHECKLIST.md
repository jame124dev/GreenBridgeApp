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
  `<global> (app2oice.tsx)` — a module-scope failure, which is exactly the
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
