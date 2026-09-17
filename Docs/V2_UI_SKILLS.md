# `app/v2/` — what it takes to build 11 screens that look like one app

**Status:** Step 0 built and verified — see § Progress at the end. Screens in progress.
**Design source:** `GreenBidz Mobile.dc.html` — Claude Design project `f76817b9-ab75-46b3-b411-13ffa61839bd`
("Greenbidz mobile app redesign", owner Tehreem).
**Scope assumed:** turn 6 (Home selling, Home buying, Browse, Matches, Chat, Account) +
turn 7 (Analyzing, Review photos / details / pricing / location) = **11 screens**. Turns 1–5 are
superseded iterations of the same six screens.

---

## The short answer

**Skills will not make the UI consistent.** Skills sequence the work and stop it drifting between
sessions. Consistency comes from four artifacts we build *before* the first screen — see Step 0.

The honest risk here is not "will each screen look good". It is "will screen 9, built three days
later in a fresh context, use the same green, the same 12px, the same card as screen 2". Everything
below is aimed at that.

---

## Read this first — the design has no token system

I checked. This changes the plan.

**1. The attached design system belongs to a different product.**
The project ships `_ds/phonics-fun-design-system-13bb44f7…/`. I read its `colors_and_type.css`:

> `--pf-primary: #4A90D9` (friendly blue) · `--pf-bg: #FFF8F0` (warm cream) · Nunito + Quicksand ·
> `--pf-cat-short-vowels`, `--pf-cat-digraphs`, `--pf-cat-blends` …

That is **Phonics Fun, a children's phonics app**. It has no relationship to GreenBidz. It cannot be
used as our token source, and any lint/adherence config shipped with it checks the wrong values.

**2. The canvas has zero CSS variables.** Every colour, size and radius is an inline literal. No file
anywhere states what the v2 palette *is*.

**3. Measured across t6 + t7 only — the 11 screens we would build:**

| | Count | Problem |
|---|---|---|
| Distinct hex colours | **29** | Six near-identical off-whites: `#EDF6F1` `#F2F5F3` `#EDF1EE` `#F5F9F7` `#F7F8F6` `#F3FAF6` |
| Distinct font sizes | **23** | Six are **half-pixel** — `9.5` `11.5` `12.5` `13.5` `14.5` `15.5`. Design-tool artifacts; they do not render meaningfully on Android |
| Distinct border radii | **12** | 2, 4, 5, 8, 10, 12, 14, 16, 20, 22, 24, 999 |

Twenty-nine colours and twenty-three type sizes for eleven screens is not a system — it is a drawing.
Transcribed literally it will look *almost* consistent, which is worse than obviously inconsistent,
because nobody will be able to say why it feels off.

**4. Poppins is not installed.** The design is entirely Poppins. `package.json` ships
`@expo-google-fonts/` **inter**, **hanken-grotesk**, **ibm-plex-sans**, **jetbrains-mono**.
Adding `@expo-google-fonts/poppins` is a JS dependency — no native rebuild — but every weight used
must be loaded in `app/_layout.tsx` or it silently falls back to the system font.
*This has already bitten us: `Inter_500Medium` was referenced in `tailwind.config.js` but never
loaded, so every `font-medium` label rendered as system font.*

**5. The app already has two competing token systems.** v2 must not add a third.

| File | Primary | Type | Consumed by |
|---|---|---|---|
| `src/theme/` (colors, spacing, radius, sizes, typography, shadows) | `#14452f` deep forest | Hanken Grotesk / Inter / IBM Plex | `StyleSheet.create` code |
| `src/constants/theme.ts` | `#10B981` emerald | Inter | **`tailwind.config.js`** → every `className` |

The same screen can render `#14452f` from a StyleSheet and `#10B981` from a Tailwind class.
The new design is a **third** palette again (`#10221B` ink, `#2E7D5B` green, `#EFEFEA`).

---

## Dark mode — required, but the canvas does not contain it

The requirement is **light and dark, following the device setting**. Here is the gap between that and
what exists today.

### What I found

**The canvas is light-only.** Searched all seven turns of `GreenBidz Mobile.dc.html`:

- No `prefers-color-scheme`, no `data-theme`, no dark variant of any screen.
- `#10221B` — the most-used colour in t6/t7, 102 occurrences — is **ink**, not a dark surface. Every
  single occurrence is `color:#10221B`.
- Every page background in t6/t7 is light: off-whites and `#2E7D5B` green.
- The dark values that do appear (`#12503B`, `#0E4034`, `#16261F`, `#202824`, `#0B0F0D`) are the
  **green wash header and banded chrome of the light design** — t4's "two greens, banded" and t7's
  header. They are not a dark theme.

**The app is hard-locked to light.** `app.config.ts:37` — `userInterfaceStyle: 'light'`. iOS and
Android never report dark to this app today, whatever the device is set to.

**A dark theme already exists as dead code.** `src/features/lab/chat/theme/darkTheme.ts` is 105 lines
and complete, but `ThemeProvider.tsx` never imports it — the comment reads *"Phase 2 passes the dark
theme here"*. It has never rendered.

So: if dark mode is in scope, **someone has to design it**. Please either point me at a dark turn I
have missed, or confirm with Tehreem that dark is ours to derive.

### What it changes

Roughly **+40% on Step 0**, and one extra verification pass per screen. Not double — layout, spacing
and type are scheme-independent; only colour forks.

**1. Tokens become semantic roles, and literals are banned outright.** This was already the plan; dark
makes it non-negotiable. No screen may ever name a colour. `surface`, `surfaceRaised`, `ink`,
`inkMuted`, `hairline`, `accent` — resolved through a theme hook, two palettes behind it.

**2. The dark palette must be designed, not computed.** Inverting `#EDF6F1` gives mud. Two specific
problems the light design does not have to solve:

- **Hairlines.** t6's entire thesis is *"space instead of boxes — hairline section breaks instead of
  nested boxed cards"*. A 1px `#DCE7E1` rule reads clearly on white and disappears on near-black. Dark
  UIs normally carry that job with elevation or a translucent overlay, which is a different visual
  device — so the signature idea of the design needs a dark equivalent, not a darker hex.
- **The green wash header.** `#2E7D5B` on `#F5F9F7` is a wash. The same green on a near-black surface
  is a glowing slab.

**3. The adherence test extends** to fail on any colour that is not read through the theme hook.

**4. Primitives take theme from context**, not from a module import, or they will not re-render on a
scheme change.

### The sequencing trap — this is the one that matters

Flipping `userInterfaceStyle` to `'automatic'` affects the **whole binary at once**, including the old
UI, which is hardcoded light on every screen. A dark-device user would get a correct v2 and a broken
everything-else for the entire coexistence period.

Two ways out:

- **Recommended.** Leave `app.config.ts` at `'light'`. Give v2 its own theme context that reads the
  device scheme directly and can be forced for testing. Flip the global to `'automatic'` in the same
  release that deletes the old UI.
- Big-bang: hold dark until v2 fully replaces the old UI, then ship both together.

Either way, note: **`userInterfaceStyle` is native config. Changing it needs a new build — it cannot
go out as an OTA update.**

And when the flip happens, chat's orphaned `darkTheme.ts` either gets wired or folded into the v2
tokens. Left alone it will be the one light screen in a dark app.

---

## Step 0 — the four artifacts that actually produce consistency

Nothing in `app/v2/` gets written until these exist. Roughly one day of work, and it is the whole
ballgame.

**1. `src/theme/v2/` — extracted and *normalised*, not transcribed, and forked by scheme.**
Collapse 29 colours → ~12 **named roles** (`surface`, `surfaceRaised`, `ink`, `inkMuted`, `hairline`,
`accent`…). Collapse 23 sizes → a 7-step scale, half-pixels rounded. Collapse 12 radii → 4 steps.
Roles resolve to `light.ts` or `dark.ts` through one hook; scheme-independent values (spacing, radius,
type) live once. Every value carries a comment naming the screen it came from, so a reviewer can check
the collapse was fair. **The dark palette has to be designed — the canvas supplies none.**

**2. `src/features/v2/ui/` — the primitive kit, built once.**
`Screen`, `SectionHeader`, `Hairline`, `Row`, `Pill`, `PrimaryAction`, `StatValue`, `PhotoTile`.
t6's whole thesis is *"space instead of boxes — hairline section breaks instead of nested boxed
cards"*. If that hairline is re-invented per screen it will be 1px on one and 1.5px on another.
Build it once; screens compose. Primitives read theme from **context**, never a module import, or they
will not re-render when the device scheme changes.

**3. An adherence test — the enforcement.**
A source-level test that fails if anything under `app/v2/**` or `src/features/v2/**` contains a raw
hex, a raw `fontSize:` number, a radius outside the scale, **or any colour not read through the theme
hook**. We already run this pattern successfully: `src/__tests__/noFunctionStyleProp.test.ts` catches
the NativeWind function-style bug that Jest cannot catch at runtime. Same trick, different rule.

**4. A project-local skill: `.claude/skills/v2-screen/`.**
The piece that makes screens built days apart match. One file stating the tokens, the primitives, the
layout rules, "no raw hex", "no half-pixel sizes", "no `style={({pressed}) => …}` on an RN primitive",
"read through existing hooks, defer writes". Every screen build loads it. Without it each fresh
context re-derives the rules slightly differently — which is exactly how `src/theme/` and
`src/constants/theme.ts` came to disagree.

---

## Skills, in the order I would use them

### Setup and planning

| Skill | Used for |
|---|---|
| `superpowers:brainstorming` | Settle Step 0 before any code: which colours collapse into which role, what the kit contains, what the type scale is. Produces a spec under `docs/superpowers/specs/`. Partly done — we agreed scope and the `app/v2/` approach. |
| `superpowers:writing-skills` | Write `.claude/skills/v2-screen/`. **Highest-leverage item in this list** and the direct answer to "consistent and quite same UI". |
| `superpowers:writing-plans` | Turn 11 screens into bite-sized tasks with exact file paths and per-screen interface contracts. |
| `expo:expo-tailwind-setup` | `tailwind.config.js` currently reads `src/constants/theme.ts`. Adding a v2 namespace plus the Poppins families without breaking the existing `className` usages is fiddly; this covers the NativeWind v4 config surface. |

### Building

| Skill | Used for |
|---|---|
| `superpowers:subagent-driven-development` | **One screen per subagent, fresh context, review between each.** The right shape for 11 near-identical screens: every subagent gets the same token contract and the same skill, so drift has nowhere to enter. Slower per screen, far cheaper than finding on screen 9 that screens 1–8 disagree. |
| `expo:building-native-ui` | RN specifics: safe-area insets, `FlatList` vs `ScrollView` for a 2,029-item Browse, keyboard avoidance on the four Review steps. |
| `superpowers:test-driven-development` | The adherence test and the primitive-kit tests. Failing test first — that is how the function-style-prop guard ended up actually working. |
| `expo:native-data-fetching` | Wiring existing React Query hooks into v2 screens read-only. |

### Checking

| Skill | Used for |
|---|---|
| `superpowers:verification-before-completion` | Enforces the standing rule: **verified on a real device, not "tsc is clean"**. We shipped guest mode with clean tsc and 1,278 passing tests and it still opened on the login screen. With dark mode in scope, every screen is checked **in both schemes** on device — a hairline that vanishes on dark is invisible to tsc and to Jest. |
| `superpowers:requesting-code-review` / `receiving-code-review` | Between screens, not at the end. |
| `superpowers:systematic-debugging` | For "this does not match the design and I cannot see why". The `\s`-in-a-template-literal bug cost two wrong guesses before a stub test found it in a minute. |
| `superpowers:finishing-a-development-branch` | Merging `feat/v2-ui`, and — **only after 1.0.4 is approved and live** — deleting the old UI. |

### MCP, not a skill

`DesignSync` — read each screen out of the canvas at build time (`get_file` on
`GreenBidz Mobile.dc.html`, project `f76817b9…`). Read-only; no reason to write back.

---

## Skills I would deliberately *not* use

**`frontend-design`** — mostly not. Its brief is to *originate* a distinctive visual identity and
"take one real aesthetic risk you can justify". We are not originating anything: Tehreem's design is
decided, and a subagent taking an aesthetic risk on screen 7 is precisely the failure mode we are
preventing. I would read it **once**, at Step 0, for its token discipline (4–6 named hex roles, an
explicit type scale) and its writing section — the copy rules are good and t6/t7 supply almost no real
copy. Not loaded per screen.

**`chrome-devtools` / `a11y-debugging` / `debug-optimize-lcp`** — browser tooling, irrelevant to RN.
One exception: if Browse keeps its WebView temporarily, these help debug the injected guard.

**Stitch MCP** — the *current* `src/theme/` was generated from a Stitch design system. t6 supersedes
it. Two design tools driving one app is how we got here.

**`expo:expo-deployment`** — at ship time, not during the build.

**`superpowers:using-git-worktrees`** — `app/v2/` is already isolated by construction. A worktree adds
a second `node_modules` and a second Metro cache for no benefit.

---

## Build order

Read-real / write-later: v2 screens call the **existing read hooks** from day one, so the design meets
real data — 90-character AI titles, missing photos, `&amp;` in a category name, 2,029 results, empty
states. Only the **writes** (publish, bid, send) are deferred.

1. **Step 0** — tokens, primitives, adherence test, `v2-screen` skill
2. **Account** — self-contained, few states, proves the kit
3. **Home (selling)** → **Home (buying)** — the mode split
4. **Matches** → **Chat**
5. **Upload flow** — Analyzing + 4 Review steps; the most business logic
6. **Browse — last.** t6 draws it native; the app currently WebViews `101lab.co`. That is the 2–3 week
   native-browse project, not a reskin. Interim option: build the t6 shell and keep the WebView inside it.

Old UI is deleted **after 1.0.4 is approved and live**, not before. Dead code costs nothing; losing
the rollback path mid-review costs a lot.

---

## Decisions needed before Step 0

1. **Palette conflict — a real one.** Three greens are in play:

   | Source | Primary |
   |---|---|
   | GreenBidz brand guidelines | `#35C3AA` turquoise + `#2F4572` navy |
   | Shipped app today | `#14452f` deep forest (Stitch) |
   | t6 / t7 design | `#10221B` ink + `#2E7D5B` green |

   The design explicitly removes "the navy 101LAB chrome". That is a brand decision, not a code one —
   confirm with Tehreem before tokens are normalised, because everything downstream inherits it.

2. **Who designs dark?** The canvas has no dark variant of any screen (see the dark-mode section).
   Either Tehreem adds a dark turn to the canvas — best, it keeps the design owner owning it — or I
   derive one from the light palette and you review it. Deriving is real design work, not inversion:
   the hairline device that carries the whole t6 look has no direct dark equivalent.

3. **Poppins across the whole app, or v2 only?** v2-only means two font systems in one binary until
   the old UI is deleted, and a heavier bundle. Acceptable, but it should be deliberate.

4. **Browse** — build the t6 shell around the existing WebView now, or hold Browse until native browse
   is funded?

5. **Play first.** Android still serves pre-guest-mode 1.0.3.
   `play-upload/GreenBidz-1.0.3-versionCode-8-guest-EAS.aab` is built and waiting. Upload it before
   this starts, or Android users sit on an old build for the length of the reskin.

---

## Progress

### Step 0 — complete and verified (2026-09-02)

Built, type-clean, 36 new tests green, full suite still green at **134 suites /
1,323 tests**.

| Artifact | Path | What it does |
|---|---|---|
| Palette | `src/theme/v2/palette.ts` | 29 canvas hexes → 18 semantic roles, light + dark, with a per-token collapse log |
| Scale | `src/theme/v2/scale.ts` | Space, radius, type, icon, control heights, motion, responsive |
| Theme context | `src/theme/v2/ThemeProvider.tsx` | Scheme resolution that works while the global light-lock stays on |
| Motion | `src/theme/v2/motion.ts` | Press feedback + timing, Reduce Motion honoured |
| Primitives | `src/features/v2/ui/` | `Screen` `Text` `Hairline` `SectionHeader` `PrimaryAction` `Row` |
| Adherence test | `src/__tests__/v2Adherence.test.ts` | Fails on raw hex, raw type props, direct palette import, function-form style, off-scale radius/spacing |
| Contrast test | `src/__tests__/v2Contrast.test.ts` | WCAG audit of both palettes, with grandfathered exceptions |
| Build skill | `.claude/skills/v2-screen/SKILL.md` | The contract every screen build loads |
| Design source | `docs/v2-design/screens/*.html` | The 11 screens, extracted from the canvas |
| Route group | `app/v2/_layout.tsx` | Parallel folder, own theme provider |
| Fonts | `app/_layout.tsx` | Poppins 400/500/600 loaded |

### What the measurements produced

The normalisation was not cosmetic. Under the 29 colours / 23 sizes / 12 radii
there is a tight system:

- **Three font weights.** 400/500/600 across all 238 styled text nodes. Nothing
  bold, nothing light.
- **A 24pt gutter**, used 71 times — the left edge every screen aligns to.
- **`.16em` tracked 10pt uppercase eyebrow**, 37 uses. With no boxes to group
  content, this label plus the whitespace above it is what makes a section read
  as a section. It is the signature of the design.
- **One shadow** in the entire canvas, and it is on the phone frame, not on any
  element. The design has no elevation.
- **`#F2F5F3` hairline at 1.1:1** — deliberately almost invisible.

Type collapsed 19 sizes → 10, icons 13 → 7, radii 12 → 6, spacing 19 → 14.

### Two contrast findings

Ran a WCAG audit over both palettes rather than assuming.

1. **The derived dark palette passes cleanly** — every text role clears 4.5:1,
   the accent clears the 3:1 UI-component floor on all three grounds. One fix
   was needed to get there: the dark header wash is `#0B2A1E`, not the
   `#12503B` used elsewhere on the canvas, because the filled accent button
   that sits on it scored 1.88:1 against `#12503B` and stopped reading as a
   shape. `#0B2A1E` takes it to 3.08:1. Still one of Tehreem's own colours.

2. **The light palette has a real accessibility failure, and it is in the
   drawn design.** `inkSubtle` `#8B9A92` is **2.94:1 on white** — below AA
   (4.5:1) and below AA-large (3:1). It carries 68 uses of row metadata:
   "Needs 2 photos and a price", timestamps, counts. Changing it alters
   Tehreem's design so it is not my call; `#68766E` would clear AA at 4.77:1
   with the smallest visible change. Kept as drawn, grandfathered in the test
   with its measured baseline so it cannot silently get worse, and raised here.

### First three screens — built, reconciled, deduplicated (2026-09-02)

`app/v2/index.tsx` (6a Home–selling), `app/v2/matches.tsx` (6d),
`app/v2/account.tsx` (6f). Built in parallel by three agents, none permitted to
touch the shared kit.

**The rule earned its keep immediately.** All three independently rebuilt the
brand bar; two built underline tabs; three built the same small pill under
three names. Had any of them been allowed to "just add it to the kit", the tree
would now hold three brand bars and the design would already be inconsistent at
screen three. Instead they arrived as reports and were reconciled in one hand.

Added to the kit from those reports: `BrandBar` `Tabs` `Chip` `QuietAction`
`SectionNote` `TintedRow` `PromoBanner` `ProgressLine` `RowTrailing`
`IconAction`, plus `RowThumb uri`, and `Row` gaining `titleVariant` / `tone` /
`accessibilityLabel`. New tokens: `SECTION_GAP` (the 34pt that was a magic
number on every screen), `ROW_SUBLINE_GAP`, `control.avatarLg`, `badgeDot`,
`PROGRESS_TRACK_HEIGHT`, and `type.label` — a real 12/600/.16em role wrongly
folded into `eyebrow` on the first pass.

Then one agent refactored all three screens onto the shared components:
**2,268 → 1,628 lines, −28%.** No screen still defines a component the kit has.

### Five defects the parallel build exposed

None of these would have been found by building one screen carefully.

1. **`SignInPrompt` was never mounted under `/v2/*`.** `requireAuth()` only sets
   a store flag; a separate component renders the sheet, and it lives in
   `app/(lab)/_layout.tsx`. Every guest gate on every v2 screen would have
   registered the tap and shown nothing. Now mounted once in `app/v2/_layout.tsx`.
2. **`Screen scroll={false}` collapsed any `FlatList` child to zero height** —
   the measure wrapper had no flex. Any list screen would have rendered blank.
3. **`Row` never announced its trailing content.** It is a single accessible
   element, so the 92% match score, the "12", the "Instant" were all silent.
   Same class of bug in `QuietAction` (five identical "Resume" buttons) and
   `BrandBar` (an unread count reduced to "unread").
4. **No `onScrim` colour roles existed**, so the banner caption was substituting
   `onAccent`/`ink`. Those flip by scheme; a photograph does not. In dark mode
   the caption would have gone near-black on a near-black scrim.
5. **`usePressFeedback` failed `react-hooks/immutability`** — the React Compiler
   rejects mutating a shared value that appears in a `useCallback` dependency
   array. Fixed by dropping the memo (a shared value is a stable ref), not by
   suppressing the rule.

**Gates:** `tsc` clean · `eslint app/v2 src/features/v2 src/theme/v2` clean ·
full suite **134 suites / 1,323 tests / 22 snapshots**, the exact baseline.

### Device verification — done, both schemes (2026-09-02)

Realme RMX2151, Android 12, debug dev client, `testapi.greenbidz.com`, guest
session. Proof sheet: `app_debug/v2/v2-light-dark-proof.png`.

All three screens render correctly in light and dark. **Four defects were found
that every automated gate had passed**, which is the argument for this step:

1. **The banner turned into a white slab in dark.** `PromoBanner`'s no-photo
   fallback used `c.ink` — which *flips*, so in dark it is near-white, with the
   scrim smeared across it. Fixed with a non-flipping `scrimFallback`. This is
   the exact failure the `onScrim` roles exist to prevent, in the one place
   they had not been applied.
2. **The dark header sheet barely separated from the page** — `#0B2A1E` on
   `#10221B`. Not fixable by lightening the wash: the "Scan it" accent slab
   sits on it, and every wash light enough to read as a panel drops the accent
   below the 3:1 floor. The ground moved instead — dark `base` is now
   `#08150F`, and every other dark ratio improved with it.
3. **Account said the same sentence twice** — "Browsing as a guest" in the
   header, then "You are browsing as a guest" immediately below.
4. **Matches' empty state floated in ~500pt of dead space**, centred in a
   flex:1 column under a short header. It read as broken rather than empty.
   Now top-aligned.

Also built: `SchemeToggleDev`, a dev-only floating scheme switch. Without it
dark is unreachable on a device — `app.config.ts` pins `userInterfaceStyle` —
and every screen would need a layout edit and reload to check. It renders
`null` outside `__DEV__` and is the single entry in the adherence test's
dev-only exemption list.

A ΔE ground-separation test was added after #2. It uses **CIE76 ΔE, not WCAG
contrast**: the light wash on white is 1.1:1 — apparently a failure — but reads
perfectly, because it differs in hue, not luminance. It is a floor (ΔE ≥ 2),
not a proof; it would not have caught #2, which was subtle rather than absent.
On-device review in both schemes stays the real check.

**Gates after all fixes:** tsc clean · eslint clean · full suite **134 suites /
1,325 tests**.

### Still open

- **Android navigation bar is not themed** — it stays light under a dark v2
  screen. Needs `expo-navigation-bar` (a native module, so a rebuild); worth
  batching with the eventual `userInterfaceStyle: 'automatic'` flip, which
  needs one anyway. Not visible in production today, since dark is unreachable
  there.
- The app's own root route renders blank for a guest before `/v2` is reached —
  noticed while navigating, not investigated. Pre-existing, not v2.
- **No v2 tab bar exists.** The canvas imports it from `TabBar.dc.html`, which
  needs a re-auth (`/design-login`) to fetch. `Screen` reserves its 78pt
  correctly, so all six tab screens currently end in empty space.
- **i18n policy.** All three agents wrote English literals and all three flagged
  it. The app ships en/ja/th/zh. Decision needed before eleven screens diverge.
- **The banner photograph** (`uploads/surplus into capital-banner image.webp`)
  is not in the repo; `PromoBanner` falls back to a flat ground.
- Eight screens remain: 6b, 6c Browse (blocked on native browse), 6e Chat,
  and 7a–7e.
- The palette question under "Decisions needed" is unanswered; built as drawn.
- Dark mode still has no designer sign-off.
