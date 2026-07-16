# Phase 2 — Round-Based Execution Plan

> Continues from `phase-1-progress.md`. Each round is a self-contained unit: it
> ships green (tsc + tests + snapshots/visual + lint), is marked ✅ here, then the
> next round begins. Rounds that need a **design decision** (dark palette, glow,
> reveal cadence) pause for human input rather than guess — that's by design, not
> a gap.
>
> **Legend:** ⏳ not started · 🔵 in progress · ✅ done & verified · ⏸️ needs decision · ⛔ blocked

---

## Round board

| Round | Title | Nature | Status |
|-------|-------|--------|--------|
| **R1** | Phase-1 tail: finish tokens + `cards.tsx` + relocate streaming types | Mechanical / behavior-neutral | ✅ (cleanup done; component-migration + guardrail flip → R2) |
| **R2** | Dark theme + migrate last 2 components onto provider + guardrail flip | Wiring (D1 specifies the palette — no decision) | ✅ palette+components+guardrail+dark live-wiring all done & device-verified |
| **R3** | Motion/streaming feel: word reveal · stream cursor · ambient glow | Design decision + motion | ✅ word-reveal + caret + accent glow, device-verified (behind CHAT_UI_V2) |
| **R4** | Affordances: Stop button · action row (copy/share/feedback) · final device smoke | Feature + polish | ✅ Stop + action row device-verified (Copy activates on next native rebuild) |

Verification gate for every round: `tsc --noEmit` · full jest · snapshots (or visual review for R2–R4) · lint (no new errors) · on-device smoke.

---

## R1 — Phase-1 tail (behavior-neutral)
Closes the one 🟡 from Phase 1. No visual change; snapshots must stay byte-identical.

**Tasks**
1. **Relocate streaming card-payload types** (`QueueData`/`GroupChoiceData`/`QueueItem`) out of `streaming/labStreamTypes` into a component-safe `chat/types/` module, so `cards.tsx` no longer imports `streaming/` (fixes A4 §12.2 coupling). Re-export from the old location for the transport.
2. **Add D1 input/accent tokens** (light values = today's exact values → behavior-neutral): `surface.input`, `border.input`, `text.input`, `text.placeholder` (exists), `text.onAccent` (exists), `accent.iconMuted` (for `primaryAccent`). Dark values added in R2.
3. **Migrate the deferred colors** in `cards.tsx` (WTB `lab.*` inputs, `primaryAccent`) + the `#fff` literals (`cards.tsx` + `ChatMessage`) → the new tokens.
4. **Flip the chat guardrail** `no-restricted-imports` (theme colors) + A4 §12.2 (no `streaming/` in components) from **warn → error** — scoped to `features/lab/chat/` only (the rest of the app still uses `theme.ts` directly and is out of scope).

**Acceptance:** 0 restricted color imports + 0 streaming imports remain in chat components; guardrails at error for the chat scope; tsc 0; all tests + snapshots unchanged; lint clean for the chat scope.

**Status:** ✅ behavior-neutral cleanup complete (component-migration + guardrail flip → R2).
**Done + verified (behavior-neutral, snapshots byte-identical):**
- ✅ Task 2 — added D1 tokens `input.text` / `input.border` / `input.placeholder` /
  `accent.iconMuted` (light values = today's `lab.*` / `brand.primaryAccent`).
- ✅ Task 3 (partial) — **`cards.tsx` fully migrated**: the previously-deferred WTB inputs
  (toggle pills, budget input, stepper, field labels) + both `primaryAccent` placeholder
  icons now use tokens. **`cards.tsx` has 0 restricted color imports** (`brand`/`greenDark`/
  `lab` imports removed).

- ✅ Task 1 (relocate streaming types) — `QueueItem`/`GroupChoiceData`/`QueueData` moved to
  `chat/types/cardPayloads.ts`; `labStreamTypes` re-exports them for the transport;
  `cards.tsx` no longer imports `streaming/`. **Every presentational chat component is now
  A4 §12.2-clean** (only `controllers/`/`types/`/`__tests__/` touch the protocol).

**R1 verdict: the behavior-neutral cleanup is complete.** The remaining two-component
migration + guardrail flip are **resequenced into R2** (decision + rationale below).

_`#fff` literals intentionally kept — they are literals, not restricted imports, so they
don't trip the guardrail (and migrating them to `text.onAccent` would change the snapshot
string `#fff`→`#ffffff` — a false diff). Fold into `text.onAccent` only in R2's dark pass._

---

## R2 — Dark theme + finish component migration + guardrail flip  🔵 in progress
**No design decision after all** — D1 §4 *specifies* the dark palette (dark is the shipping
chat theme: brand-green accent `#34D08C`, forest-black canvas `#0A0F0D`, elevation-degrades-
to-color). So this is deterministic wiring, not a "pick a palette" round.

**Done + verified:**
- ✅ `theme/darkTheme.ts` — `chatDarkTheme` codified from D1 §4 (all 28 `ColorToken`s; the 21
  shipping roles are value-tested against D1, 4 Phase-1-extra tokens get proposed dark values).
- ✅ `darkTheme.contract.test.ts` — pins the palette to D1 (26 suites / 265 tests green).
- ✅ Exported from the theme barrel. Elevation degrades to color (0-opacity shadow).

**Remaining R2 wiring (the hard part — sequential):**
1. 🔵 **Resolve the compat light-pinning.**
   - ✅ Added `phase1CompatDark` (dark values) + exposed compat **through the theme**
     (`theme.compat`, scheme-reactive) — `Theme.compat`, wired into both theme objects.
     tsc + 265 tests green (behavior-neutral: no consumer reads it yet).
   - ✅ **Migrated all 46 `phase1CompatLight[...]` reads → `t.compat[...]`** (workflow `wl2sksdj7`,
     independently verified): cards + cardKit style factories → `t.compat`; the cardKit module-level
     tint maps refactored into an exported `useStatusTints()` hook (theme-reactive `batch`/`bid`);
     cards call sites use `tints.batch/bid`; JSX reads use `useTheme().compat`. **0 `phase1CompatLight`
     reads remain in cards/cardKit.** tsc 0 · 26 suites / 265 tests · snapshots byte-identical.
     → **The whole card surface is now light+dark capable.**
3. Migrate the remaining light-only surfaces onto the provider (else live dark is a
   BROKEN half-dark — dark cards on a light canvas):
   - ✅ **Screen chrome** `app/(lab)/chat.tsx` — DONE (workflow `w9bwtjj0l`): provider-consumer
     split (`LabChat` mounts provider → `LabChatScreen` consumes), `StyleSheet`→`createThemedStyles`,
     added `surface.util`/`border.util`/`icon.util` tokens (light+dark). tsc 0 · 265 tests ·
     snapshots unchanged · **device-verified pixel-identical in light** (header/composer/canvas).
   - ✅ **`LabListingEditSheet` + `LabListingGapFiller`** — DONE (workflow `wwozaw9vu` + 2 follow-up
     agents). Hex-exact token map (light byte-identical by construction); added **8 new tokens**
     (`surface.sheet`, `border.divider`, `status.successSurface/Border`, `status.warningSurface/Border/
     Strong`, `status.warningAccent`) with D1 §4 dark values. **137 dotted refs + 7 flat named imports**
     (`greenDark`/`greenDarkest`/`greenMedium`/`warnAmber`) migrated onto `createThemedStyles`/`useColor`.
     0 restricted color imports remain in either file.
4. ✅ **Provider selects light/dark from `CHAT_UI_V2`** — `LabChat` passes `CHAT_UI_V2 ? chatDarkTheme :
   chatLightTheme`; flag added to `src/lib/flags.ts` (default OFF ⇒ light ⇒ behavior-neutral, snapshots
   unchanged). **Device-verified dark on emulator** (2026-07-15): forest-black canvas, green user bubble
   (sell accent), dark elevated assistant bubble + thinking dots, dark composer/util buttons — fully dark,
   NO half-dark (all components on the provider). `.env` flag reverted to default-off (ship-decision pending).
5. ✅ **Guardrail flipped warn→error** — scoped to PRESENTATIONAL chat components; theme/controllers/
   types/__tests__ exempted (a later config block). `no-restricted-imports` = **0 errors** across the
   chat scope. (3 pre-existing `react-hooks` errors in GapFiller remain — separate rule, not introduced
   here, out of scope.)

This round:
- Adds the **dark values** + `CHAT_UI_V2` toggle. **Decision needed:** the dark palette
  (surfaces, text, accent, borders, status tints) — I'll generate 2–3 candidates on device.
- **Migrates the last two components** (`LabListingEditSheet` ~2000 LOC, `LabListingGapFiller`
  ~1400 LOC; static `StyleSheet` → `createThemedStyles`, ~190 color refs) onto the provider.
  This is done HERE (not R1) because that's when they actually need the provider — to get
  dark values. Add the 2 missing tokens (`bg.sheet`←`brand.background`, `status.warningBorder`
  ←`brand.warningBorder`) + **characterization snapshots for both** first, so the ~190 swaps
  are netted (not blind — value-parity alone can't catch a wrong-token pick).
- **Then flip the guardrail** to error (all chat components on the provider; exempt
  `theme/`/`controllers/`/`types/`/`__tests__/`).

**Resequencing rationale (why not R1):** migrating these two now would be light-only, blind
(no snapshots), ~190 manual swaps — then re-touched in R2 for dark anyway. They currently
work correctly using `theme.ts` directly (light-only app). Folding them into R2 makes the
migration purposeful (dark values), netted (snapshots built for the dark work), and
single-pass instead of double.

## R3 — Motion / streaming feel  ✅ done & device-verified
**Decision (user, 2026-07-15):** word-by-word reveal + subtle accent glow.
- ✅ **Word-by-word reveal** — `useStreamReveal(source, settled, byWord)` gains a `byWord` mode that snaps
  the catch-up to whole-word boundaries (`/\s*\S+\s*/g`, ~1/6 of remaining words per frame). Char-based
  stays the default ⇒ flag-off path byte-identical.
- ✅ **Blinking caret** — a block caret (`▋`) appended to the live text while streaming (flag-on only);
  absent on committed messages (verified on device — no caret after settle).
- ✅ **Subtle accent glow** — a soft green `glow`-token halo (pure boxShadow, no hard fill) behind the
  streaming bubble, slow opacity pulse via reanimated, cancelled on settle. Left-aligned, ~80% width.
- All gated on `CHAT_UI_V2`. Verify: tsc 0 · full jest 26/265 · snapshots unchanged (extended the
  StreamingMessage test's reanimated mock with the glow primitives). Device-verified: glow visible behind
  the streaming bubble, dark cards/WTB-draft render correctly, caret streaming-only.

## R4 — Affordances + final smoke  ✅ done & device-verified
- ✅ **Stop button** — while a turn streams (`CHAT_UI_V2 && chat.liveActive`), the composer's Send
  becomes a filled-square Stop that calls the controller's existing `abort()`. i18n `mobile.labChat.stop`.
  **Device-verified**: square during streaming → back to Send arrow on settle.
- ✅ **Action row** (`MessageActions`, under committed assistant messages, behind the flag): Copy · Share ·
  👍 · 👎. Share = RN `Share`; feedback = local state (A2 row 78 — never persisted); Copy lazy-`require`s
  `expo-clipboard` inside a try/catch so a dev client without the native module still boots (Copy is a
  safe no-op until the next native rebuild, then activates). **Device-verified**: row renders dark under
  the answer, feedback thumb fills accent-green on tap.
- ⏳ **Full device regression + Copy activation** — both await one native rebuild (`npx expo run:android`);
  the stale dev-client also needs it for the camera/scan flows. Not a code gap.

**Phase 2 is functionally complete** — R1–R4 + the buyer-Home "Recent wants" feature, all behind the
default-off `CHAT_UI_V2` flag (dark/reveal/glow/Stop/actions) except the always-on buyer-Home section.

---

## PR log (newest first)

### R4 · Stop button + action row (copy/share/feedback) · ✅ device-verified
- **Stop button** (app/(lab)/chat.tsx): while streaming (`CHAT_UI_V2 && liveActive`) the composer Send
  swaps to a filled-square Stop → `chat.abort()` (controller already owned abort). i18n `mobile.labChat.stop`.
- **Action row** (`MessageActions.tsx`, rendered by AssistantMessage only when `committed && CHAT_UI_V2 &&
  text`): Copy (lazy `expo-clipboard`, guarded), Share (RN `Share`), 👍/👎 feedback (local state, A2 row 78).
  i18n `mobile.labChat.actions.*`. Installed `expo-clipboard` (native side activates on next rebuild).
- Test infra: added root `__mocks__/sonner-native.js` (its reanimated-easing import broke suites that now
  transitively import MessageActions); extended nothing else.
- Verify: tsc 0 · full jest 26 suites / 265 tests / 22 snapshots (flag-off byte-identical) · **device-verified**
  (Stop square↔Send arrow; action row renders dark; feedback thumb toggles accent-green). Copy no-ops safely
  until a native rebuild.

### R3 · motion/streaming feel (word reveal + caret + accent glow) · ✅ device-verified
- `useStreamReveal` gains `byWord` (word-boundary catch-up); `StreamingMessage` appends a streaming-only
  block caret and lays a pulsing green `glow`-token halo (boxShadow) behind the live bubble. All behind
  `CHAT_UI_V2`; char-reveal + no-chrome remains the flag-off default.
- Extended the StreamingMessage test's reanimated mock (useSharedValue/useAnimatedStyle/withRepeat/
  withTiming/cancelAnimation) — the glow hooks run unconditionally before the flag gate.
- Verify: tsc 0 · full jest 26 suites / 265 tests / 22 snapshots (flag-off byte-identical) · device-verified
  on emulator (glow behind streaming bubble; dark product + WTB-draft cards incl. condition pills / budget
  input / stepper render correctly; caret absent on committed messages).

### R2 · dark live-wiring (CHAT_UI_V2 → provider) · ✅ device-verified
- Added `CHAT_UI_V2` flag (`src/lib/flags.ts`, `EXPO_PUBLIC_CHAT_UI_V2`, default OFF). `LabChat`
  (app/(lab)/chat.tsx) now mounts `ChatThemeProvider theme={CHAT_UI_V2 ? chatDarkTheme : chatLightTheme}`.
- Behavior-neutral with the flag off: tsc 0, chat jest 12 suites / 122 tests / 21 snapshots unchanged.
- **Device-verified dark** (emulator, EXPO_PUBLIC_CHAT_UI_V2=1 + Metro restart): the whole `/(lab)/chat`
  subtree renders dark — forest-black canvas, green user bubble, dark elevated assistant bubble + thinking
  dots, dark composer + util buttons. Uniformly dark (no half-dark) ⇒ every component is on the provider.
  Home/tabs stay light (NativeWind, outside the chat theme scope) — as intended.
- `.env` flag reverted to default-off after review (dark stays gated; ship-decision pending).

### R2 · last-two-component migration + guardrail flip · ✅  [workflow wwozaw9vu + 2 agents]
- **Netted workflow** (Map → Tokens → Migrate∥ → Verify) migrated `LabListingEditSheet` (2300 LOC) +
  `LabListingGapFiller` (1557 LOC) onto the ThemeProvider. Safety model: **hex-exact token mapping** —
  every ref maps to a token whose LIGHT value is byte-identical, so light rendering is unchanged *by
  construction* (a mis-map with a different light hex fails the equality check + tsc/grep).
- Added **8 new tokens** (light = exact current hex, dark = D1 §4 proposals, live only behind the
  default-off `CHAT_UI_V2`): `surface.sheet`, `border.divider`, `status.successSurface`,
  `status.successBorder`, `status.warningSurface`, `status.warningBorder`, `status.warningStrong`,
  `status.warningAccent`. Existing tokens reused where hex matched (`accent`←greenDarkest,
  `accent.pressed`←greenDark, `status.success`←greenMedium, `text.muted`, `status.danger`, etc.).
- **The workflow correctly surfaced (did not hide) a real failure:** its Verify agent flipped the
  guardrail to error and reported `lintClean:false` — my Map/Migrate instructions had scoped "restricted"
  to the *dotted* `brand.X` shape, missing the **flat named imports** (`greenDark`/`greenDarkest`/
  `greenMedium`/`warnAmber`) the ESLint rule also restricts. Fixed with 2 follow-up agents (one per file):
  7 flat imports + all their usages migrated to tokens.
- **Guardrail scoping fix:** the error-level rule was catching the theme-definition layer, controllers,
  types, and tests (which legitimately touch raw colors / the transport). Added an exemption config block
  (`theme/**`, `controllers/**`, `types/**`, `**/__tests__/**`, `*.test.*`) so the guardrail applies to
  PRESENTATIONAL components only — per the R2 plan.
- Verify: **tsc 0 · full jest 26 suites / 265 tests / 22 snapshots · `no-restricted-imports` = 0 errors
  across the chat scope · 0 restricted color imports in either component.** 3 pre-existing `react-hooks`
  errors in GapFiller (refs-during-render ×2, setState-in-effect ×1) remain — separate rule, not
  introduced by this work, out of scope.
- NOT yet: dark is codified + gated OFF (`CHAT_UI_V2`); the live light/dark provider selection + on-device
  dark review is the next R2 step.

### Feature · buyer-Home "Recent wants" section · ✅ device-verified
- New `HomeRecentWants` component — the BUYER-mode mirror of `HomeRecentListings`. Renders under
  the composer in buy mode only (`{mode === 'buy' && <HomeRecentWants />}` in `home.tsx`), gated on
  `WTB_ENABLED` via `useWants` (GET /wtb — the SAME cache the Matches tab reads).
- Each row: buyer-blue bookmark tile · want title · `≤ {currency}{budget} · {category}` meta ·
  match-count badge (`info` when >0, `neutral`/"No matches yet" when 0). Header + "See all" → Matches tab.
  Previews up to 4 (`PREVIEW_LIMIT`); hides entirely on error/empty/signed-out/first-load (calm Home).
- i18n keys added (`en`/`zh-Hant`/`zh-Hans`): `recentWants`, `matchOne`, `matchOther`, `noMatchesYet`.
- Verify: tsc 0 · **device-verified on emulator** — buy mode shows "最近求購" with 4 rows out of 8 wants
  ("Used lab centrifuge ≤ USD5,000 / 尚無匹配", "MacBook / 尚無匹配", "Heavy Machin… / 4 個匹配" info badge).
- **Gotcha (not a code defect):** first on-device attempts showed the section empty — root cause was a
  STALE Metro bundle (Windows file-watcher missed the edits; per `[[project_stale_dev_client_native]]`).
  A debug `console.log` never fired → fetched Metro's served bundle (missing the marker) → confirmed stale
  → killed Metro + restarted with `CI=1 npx expo start --dev-client -c` (clean cache) → section rendered.
  **Lesson: after editing lab files, a manual Metro restart (not just app reload) is required here.**

### R2 · screen-chrome migration (chat.tsx → provider) · ✅  [workflow w9bwtjj0l]
- Provider-consumer split: `LabChat` mounts `ChatThemeProvider`, new `LabChatScreen` consumes it.
- Added `surface.util`/`border.util`/`icon.util` tokens (light = `lab.util*`; dark = forest/alpha/ink).
- `chat.tsx` StyleSheet → `createThemedStyles`; header/composer/canvas/util-buttons/accent read
  tokens; removed all raw `lab`/`brand`/`buyBlue`/`greenDarkest` imports.
- Verify: tsc 0 · 26 suites / 265 tests · snapshots unchanged · **device-verified pixel-identical
  in light** (chat header, composer, background, user bubble). Dark NOT wired yet.
- Note: a wedged adb-reverse tunnel (from a reload timeout) white-screened the dev client mid-test;
  fixed by `adb reverse --remove-all` + re-add — a tooling glitch, not a code defect.

### R2 · compat consumer migration (cards + cardKit → t.compat) · ✅  [workflow wl2sksdj7]
- Migrated all 46 `phase1CompatLight[...]` reads onto `t.compat` (factories) / `useTheme().compat`
  (JSX); cardKit tint maps → exported `useStatusTints()` hook (theme-reactive batch/bid tints);
  cards call sites use it. Removed dead module-level tint exports + `phase1CompatLight` imports.
- Ran as a background workflow (fresh context, self-gated on tsc + card snapshots); **independently
  re-verified**: tsc 0 · 26 suites / 265 tests · snapshots byte-identical · 0 compat reads remain.
- Result: the entire card surface (cards + cardKit) now renders correctly under BOTH light and dark
  themes — the compat light-pinning that blocked live dark is resolved.

### R2 · compat exposed through theme (scheme-reactive foundation) · 🔵
- Added `phase1CompatDark` (proposed dark values for the 8 aliases) + `Theme.compat`
  (`Readonly<Record<CompatToken,string>>`); wired `compat` into `chatLightTheme`
  (`phase1CompatLight`) + `chatDarkTheme` (`phase1CompatDark`).
- Behavior-neutral: consumers still read `phase1CompatLight` directly (unchanged) — the
  46-site migration to `t.compat` is the next step (classified in R2 §Remaining #1).
- Verify: tsc 0 · 26 suites / 265 tests · snapshots byte-identical.

### R2 · dark palette codified (D1 §4) · 🔵 partial (wiring remains)
- Added `theme/darkTheme.ts` (`chatDarkTheme`) — D1 §4 dark values (forest canvas, green
  accent, elevation-as-color); dark values for the 4 Phase-1-extra tokens (proposed).
- Added `darkTheme.contract.test.ts` pinning the 21 shipping roles to D1; exported from barrel.
- Verify: tsc 0 · 26 suites / 265 tests · snapshots byte-identical. NOT wired live yet
  (gated on resolving the compat light-pinning — see R2 §Remaining).

### R1 · tokens + cards.tsx + streaming-type relocation · ✅ (component-migration + flip → R2)
- Added 4 D1 tokens (`input.text`/`input.border`/`input.placeholder`/`accent.iconMuted`),
  light values = today's `lab.ink`/`lab.hairline`/`lab.inkFaint`/`brand.primaryAccent`.
- Migrated `cards.tsx` WTB input controls + both `primaryAccent` placeholder icons to
  tokens; removed the `brand`/`greenDark`/`lab` imports from `cards.tsx`.
- Relocated card-payload types (`QueueItem`/`GroupChoiceData`/`QueueData`) →
  `chat/types/cardPayloads.ts` (re-exported by `labStreamTypes`); `cards.tsx` is now
  protocol-import-free → **all presentational chat components satisfy A4 §12.2**.
- Verify: tsc 0 · 25 suites / 242 tests · **snapshots byte-identical** · guardrail still
  at warn (flip gated on R1b — the two remaining components).
