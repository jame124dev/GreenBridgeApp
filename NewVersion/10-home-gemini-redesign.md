# 10 — Home Redesign: Gemini-First + Morph-Into-Chat

> **Status:** Plan (not yet implemented). Supersedes the header/layout portions of
> [`01-home-tell-ai.md`](./01-home-tell-ai.md) for the `(lab)` customer app.
> **Authored from:** a 3-role research pass — web/UX researcher (Gemini + leading AI apps),
> product UX designer (IA + transition), RN motion/typography engineer (implementation).
> **Grounded in the actual code:** `app/(lab)/(tabs)/home.tsx`, `app/(lab)/chat.tsx`,
> `src/features/lab/components/homeLabHeader.tsx`, `homeAiComposer.tsx`,
> `src/animations/recipes.ts`, `src/constants/theme.ts`.

---

## 1. Goal & user intent (verbatim)

Three asks, in the user's words:

1. **"remove the 3 matches text, move the location at right"** — kill the "N new matches" pill; the location chip becomes the sole right-side element.
2. **"I need homepage looks Gemini first — image first"** — a calm, typographic, prompt-forward home in the style of Google Gemini's 2025 redesign.
3. **"chat window after first message become full chat start but I need well behaviour"** — sending the first message should smoothly turn the home into the full chat conversation, not hard-jump to a separate screen. The transition must feel premium ("well behaviour").

Plus the quality bar: **"use web researcher, UI/UX expert, RN expert for typography, font, space, smoothness, animation."**

---

## 2. Current state (facts, so the diff is unambiguous)

| Area | Today |
|---|---|
| **Home** | `app/(lab)/(tabs)/home.tsx` — a **tab** screen (tab bar shows). Renders `LabHeader` → 2-line 38px marketing H1 → long subcopy → `ModeToggle` → `AiComposer` → `AttachmentChips` → trust caption. |
| **Header** | `homeLabHeader.tsx` — brand lockup (left) + right cluster `HStack[ LocationChip, MatchesPill ]`. `MATCH_COUNT = 3` hardcoded in `home.tsx`. |
| **Send** | `onSend` does `startTurn()` + `labTurn.start(message)` + **`router.push('/(lab)/chat', { q })`** — a hard screen swap. |
| **Chat** | `app/(lab)/chat.tsx` — a **stack** screen (tab bar hidden). Owns `messages`, seeds the first user bubble from `params.q`, re-instantiates `useLabTurn`, renders thread + `LiveBotBubble` + gap filler + composer pinned bottom. Has its **own local composer** (not `AiComposer`). |
| **Shared spine** | Both screens already share `composerStore` (mode/input/attachments), `threadStore` (single in-flight `turn`), `useLabTurn`. **The SSE stream is already in flight before navigation** — the key asset for a seamless morph. |
| **Motion** | `src/animations/recipes.ts` — `useRise/usePop/usePulse/useSpin/useSlideX/usePressScale/useProgress/usePopBounce`; `DURATIONS`, `RISE_SPRING {damping:20,stiffness:180}`, `POP_SPRING {damping:12,stiffness:220}`, `MATERIAL_DECEL`. All reduced-motion safe. |
| **Tokens** | `theme.ts` — `lab.*`, `spacing.*` (4px grid), `radius.*`, `fonts.*`, `greenDarkest`, `buyBlue`, `brand`, `motion.*`. |

---

## 3. Research synthesis — what "Gemini-first" actually is

From the 2025 Gemini Android redesign (and cross-checked against ChatGPT / Claude / Perplexity):

- **Typographic minimalism.** Hierarchy comes from **type size + whitespace**, not color or borders. Google *de-saturated* the hero greeting (dropped the branded blue → plain near-black/white). Big warm greeting owns the top third.
- **The composer is persistent and bottom-pinned on BOTH home and conversation.** It never teleports. This single fact is ~80% of the "morph-in-place" feel across all four apps.
- **On first send, the hero + suggestion chips fade/translate out** while the composer holds position and the user's message springs in just above it. It reads as "the same screen filling with a conversation."
- **Color is reserved for motion**, not static chrome — e.g. Gemini's animated gradient "thinking" state instead of a static spinner.
- **Type/space targets:** hero ~30–38pt, tight leading (~1.10×), slightly negative tracking; body 14–17pt at 1.5–1.6 line-height; everything on an 8/4px grid; ≥32px gap under the hero.
- **Motion:** springs (damping 0.7–1.0) read more premium than timing curves; entrances ~300–350ms; animate only `transform`/`opacity`; **never re-layout on every streamed token** (buffer, grow container, don't shift siblings); honor Reduce Motion.

*(Sources gathered live: Gemini home redesign & dark-theme coverage, Reanimated shared-element docs, Material 3 easing/duration tokens, iOS 26 motion guide.)*

---

## 4. Header changes

**File:** `homeLabHeader.tsx` + `home.tsx`.

### Remove
- The **`MatchesPill`** sub-component, its `matchCount` / `onPressMatches` props, and the `pill`/`dotRing`/`dot`/`pillText` styles.
- In `home.tsx`: the `MATCH_COUNT = 3` const, the `matchCount`/`onPressMatches` props on `<LabHeader>`, and the `router.push('/(lab)/(tabs)/matches')` handler.
- Matches remain reachable via the **bottom tab** — no navigation path is lost, only the redundant header shortcut.

### Move / confirm
- **Location → far right, for free.** With the pill gone, the location chip becomes the sole trailing child of the `space-between` row and lands at the far-right edge. Keep `rightCluster: { flexShrink: 1 }` so a long label can't shove the lockup off-screen on ≤375px. Drop the now-vestigial 1-child inner `HStack` wrapper (render the chip directly as the second child).

```
BEFORE:  [◆ 101LAB / BY GREENBIDZ] ········· [📍 Bangkok] [● 3 new matches]
AFTER:   [◆ 101LAB / BY GREENBIDZ] ···························· [📍 Bangkok]
```

### Edge cases (already handled by the two chip variants — preserve)
- No cache + native module present → `LabSetLocationChip` "Set location" at far right.
- No cache + stale dev-client → `detect()` resolves `unavailable`, chip self-hides → right side empty, no gap-jump (trailing child returns `null`). Correct, no dead control.
- Detecting → spinner; Resolved → label + POP-bounce + `haptics.success()` (keep `onLocationPress` verbatim).

---

## 5. Gemini-first home layout

One calm, centered, prompt-forward column. The **composer is the hero**, not the headline. Kill the landing-page density (dual persuasion copy). Spacing in `spacing.*` units.

### Element order (top → bottom)
1. **Header** (`LabHeader`, minimal per §4). ↓ `spacing.4xl` (40) — big top void is the Gemini tell (was `2xl`/24).
2. **Hero mark + greeting** *(new — the "image-first" anchor)*
   - Centered **`OrbitLogo`** rendered large (~56–64px) in a soft mint halo. Reuses the existing SVG from `homeOrbitLogo.tsx` — **no new asset**. ↓ `spacing.lg` (16).
   - **Mode-aware greeting** replacing the 2-line marketing H1 — shorter, warmer, single line, `fonts.headingBold`, centered: `What are you selling?` (sell) / `What are you looking for?` (buy). Pull from `COMPOSER_COPY[mode]` (add a `greeting` key). Keep the `greenDarkest` accent on the last word (optionally `buyBlue` when `mode==='buy'`). ↓ `spacing.3xl` (32).
   - **REMOVE** the current 38px 2-line H1 and the long subcopy paragraph.
3. **`AiComposer`** — the **visual hero**. Full-width, elevated, largest/highest-contrast element. Keep accent border + `lab.composerShadow`; consider a taller default `minHeight` (~2.5 lines) so it reads as an inviting canvas. ↓ `spacing.md` (12) → `AttachmentChips` (only when staged).
4. **`ModeToggle`** — **moved BELOW the composer** (was above). Prompt-first; sell/buy is a scoping refinement. Center at ~72–80% width. ↓ `spacing.xl` (20) above it. Keep the SLIDE-X sliding thumb as-is — just re-order in JSX.
5. **Suggestion chips** *(new, recommended)* — one horizontally-scrollable row of 2–3 **mode-aware prompt pills** (reuse the existing `demo` strings from `01-home` §5). `radius.full`, `lab.pillBg`, 13px label, no icon tiles. **Tap = fill the composer** (`setInput` + focus), not auto-send — user edits before committing (matches Gemini). ↓ `spacing.2xl` (24) above.
6. **Trust caption** — **REMOVE from the hero** (third piece of persuasion copy fights minimalism). If product insists, demote to a single 11.5px muted line at the very bottom.

### Stays / changes / removed
| Element | Verdict |
|---|---|
| Brand lockup | Stays |
| Location chip | Stays → far right |
| Matches pill | **Removed** |
| 2-line 38px H1 | **Removed** → centered mode-aware greeting (~28px) |
| Long subcopy | **Removed** |
| Centered large `OrbitLogo` hero | **New** (reuses existing SVG) |
| `AiComposer` | Stays, promoted to hero |
| `ModeToggle` | Stays, moved below composer, narrower |
| Suggestion pills | **New** (fill-only) |
| Trust caption | **Removed** from hero (optional footer) |

### Layout mechanics
- Keep `Screen scroll padded={false} keyboardAware edges={['top']}` on `lab.bg`.
- Content container: `paddingTop: insets.top + 40`, `paddingHorizontal: 22`, `paddingBottom: insets.bottom + 110`.
- On tall devices, `flexGrow:1` + `justifyContent:'center'` on the content container so the composer sits near optical center; still scrolls on SE (verify 375×667 clears the keyboard).
- Center-align hero mark / greeting / chip row; composer + toggle are centered full-width blocks.

---

## 6. Home→chat transition — the decision

**User intent:** the composer the user just touched should *persist* and the screen should *become* the chat. That rules out a hard route push.

### Options considered
| Option | How | Effort | Risk | Smoothness ceiling |
|---|---|---|---|---|
| **(a) Navigation morph** | Keep 2 routes; set `chat` transition to `slide_from_bottom` (~280–320ms) + matched composer styling. | Low | **Med-High** | **Medium** — a good illusion, but two separately-mounted trees measure layout independently; the keyboard (`react-native-keyboard-controller`), header, and safe-area insets differ between the tab screen and the full-screen push → a visible seam. `sharedTransitionTag` in Reanimated 4 is unstable and does not compose with KAV. |
| **(b) Single route, two states** | Merge home + chat into ONE screen with `hasThread` state. Composer **never unmounts**; Reanimated `LinearTransition` reflows it from centered-hero to pinned-bottom while the hero exits and the thread enters. | Med-High | Low-Med | **High** — same mounted node, single layout pass, all UI-thread. Composer + keyboard + in-flight stream are *provably* continuous. |
| **(c) In-home overlay** | Keep files separate but mount the thread as an absolutely-positioned `Animated.View` **overlay inside home**, rising in while the composer docks down. A lighter (b) that avoids the risky file merge. | Med | Low | **High** |

### Recommendation — **ship (c) → converge to (b)**

Both (b) and (c) share the **same motion design** (§7) and the **same persistent-composer principle** the research says is essential. The RN-engineer de-risking path:

1. **Phase 1:** land the motion primitives (§7) + a `compact` prop on `AiComposer` so one composer serves both states.
2. **Phase 2:** ship **(c) in-home overlay** to validate the animation feel end-to-end with no risk to `chat.tsx`'s working streaming/dedup/gap-filler/batch logic.
3. **Phase 3:** converge to **(b)** — fold the thread body into a `<LabThread/>` component mounted in the home tree; delete/redirect `chat.tsx`.

*(a) is the documented fallback if we must not touch the thread logic at all — accept the seam.)*

Because the turn is **already streaming before the state flip**, removing the navigation makes the composer, keyboard, and stream continuous and **deletes the `params.q` re-seed + `didInitRef` mount-kick** (they only existed for the separate route).

---

## 7. Motion & animation spec

**Reuse the existing vocabulary — do not invent curves.**

### Reused as-is
- `useRise()` — thread container entrance when `hasThread` flips true.
- `usePop()` — first user-bubble reveal; send-button label enter/exit during morph; inline cards `pop(i * POP_STAGGER_MS)`.
- `FadeIn.duration(200)` — `LiveBotBubble` (keep).
- `usePulse()` / `ThinkingDots` — pre-first-token indicator.
- `usePressScale()` — all buttons.
- `reducedFade()` — reduced-motion branch for every entrance.

### New primitives in `recipes.ts` (aliases of existing constants)
```ts
export const LAYOUT_SPRING = { damping: 20, stiffness: 180, mass: 1 } as const; // == RISE_SPRING

export function useLayoutTransition() {
  const reduced = useReducedMotion();
  return reduced ? undefined
    : LinearTransition.springify().damping(20).stiffness(180).mass(1);
}

export function useCollapse(delayMs = 0) { // hero block exit: mirror rise() reversed
  const reduced = useReducedMotion();
  return reduced ? FadeOut.duration(DURATIONS.reduced) : /* exiting worklet: opacity 1→0, translateY 0→−10 over DURATIONS.rise */;
}
```
- **Composer morph:** wrap the composer in `<Animated.View layout={useLayoutTransition()}>`, kept mounted in both states. Hero state = composer in normal flow (upper-middle); thread state = `ScrollView` takes `flex:1` and composer is the last flex child pinned bottom inside the KAV. The parent-flex change → `LinearTransition` interpolates translate+resize on the UI thread. **No manual `measure()`/`translateY` math** (that's what makes it robust).
- **One composer, state-driven chrome:** rather than cross-fade two components, give `AiComposer` a `compact` prop — thread state shrinks padding (16/13→10), radius (`2xl`→`xl`), and collapses the send label into the `ArrowUp` icon (animate the label with `usePop`/exit). `LinearTransition` carries the size change → the morph is a *resize of one identity*, not a swap.
- **Keyboard interplay:** keep `KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top}`; composer stays **inside** it in both states. **Single-owner rule:** KAV owns the vertical keyboard offset; `LinearTransition` owns the hero→thread reflow. Never put both on the same node's transform.
- **Tab-bar dismiss** (only relevant to (b)): drive `FrostedTabBar`'s exit with a `translateY`/opacity `withTiming(barH, { duration: DURATIONS.slideX, easing: MATERIAL_DECEL })`; reduced-motion → instant.

---

## 8. Typography system

Keep the existing responsive headline rule and the `−0.035 × fontSize` tracking; formalize leading at **1.10×**.

| Role | Font | Size / Line | Tracking | Notes |
|---|---|---|---|---|
| Hero greeting (≥376px) | `fonts.headingBold` | 34 / 38 | −1.19 | Warmer single-line greeting (down from the old 38px billboard). |
| Hero greeting (≤375px) | `fonts.headingBold` | 30 / 34 | −1.05 | Same 1.10× ratio, SE-safe. |
| *(If keeping a 2-line hero)* | `fonts.headingBold` | 38 / **42** · 34 / **38** | −1.33 · −1.19 | Bump the old 39/35 leading to 42/38 (1.10×) for more air. |
| Accent span | same | inherit | inherit | `greenDarkest`; optionally `buyBlue` in buy mode. |
| Subcopy (if retained) | `fonts.regular` | 14 / 20 (`bodySm`) | 0 | `lab.inkSub`, `maxWidth:300`. |
| Bubble body (user/bot) | `fonts.regular` | 14 / 20 | 0 | Matches composer input. |
| Chat header title | `fonts.bold` | 16 | 0 | Keep. |

**Rules to codify:** headline leading = `round(1.10 × size)`; headline tracking = `−0.035 × size`; body/caption use the type tokens verbatim (`bodySm` 14/20, `caption` 12/16) — no per-screen font sizes; align the chat composer input to `fontSize.lg` + `lineHeight.normal` (parity with the home composer); one display family for the hero (`headingBold`), never mix Inter into the headline.

---

## 9. Spacing & rhythm

- **Unify the horizontal gutter to 22px across both states** — home already uses 22; chat uses `spacing.lg` (16). If they differ, `LinearTransition` animates a left/right shift during the morph (visible jump). Set `threadContent.paddingHorizontal: 22`.
- **Hero rhythm:** header→greeting `spacing.2xl` (24) · greeting→composer `spacing.3xl` (32) · composer→toggle `spacing.xl` (20) · toggle→chips `spacing.2xl` (24). Composer sits upper-middle via natural flex (not absolute positioning — that breaks the layout morph).
- **Thread:** `paddingTop: spacing.md`, `gap: spacing.md`, `paddingBottom: spacing.2xl`. Composer bottom inset `Math.max(insets.bottom, 10)`; under keyboard, KAV supersedes — don't double-count. Scroll-down pill at `(composerHeight || 92) + spacing.sm`.
- **Safe area:** `edges={['top']}` for the hero; composer owns the bottom inset.

---

## 10. First-message reveal choreography

Stream is already in flight before the flip, so this is purely presentational:

1. **Flip `hasThread`** on send (no navigation). Hero block plays `useCollapse()` (fade + slide-up, `DURATIONS.rise`); thread `ScrollView` mounts with `entering={useRise()}`.
2. **User bubble** (from the just-sent text, read from the send handler — not `params.q`) enters with **`usePop()`** — reads as the message materializing.
3. **Bot bubble** enters with `FadeIn.duration(200)`; `ThinkingDots` (via `usePulse`) until first token, then `useTypewriter`.
4. **Stagger:** keep total < ~350ms (user bubble delay 0, or +`POP_STAGGER_MS` after hero collapse begins for an explicit beat).
5. **Autoscroll:** reuse `scrollToEnd` + `onContentSizeChange` + `atBottomRef` (starts true → stays pinned during growth). `scrollEventThrottle={16}`.
6. **Inline cards:** `renderCard` unchanged; reveal with `pop(index * POP_STAGGER_MS)`.

---

## 11. Performance & correctness

- **All motion on the UI thread** (`LinearTransition`, `entering`/`exiting`, shared-value styles). Only JS-thread work is the one-shot `setHasThread`/`setMessages`. Never animate `width`/`height`/`bottom` via `setState` loops — the composer resize is `LinearTransition`, not re-renders.
- **Worklet safety:** `useCollapse` builder is a `'worklet'` (mirror `rise()`); `LAYOUT_SPRING` is a frozen plain object.
- **Reduced motion:** every new path branches on `useReducedMotion()` — `useLayoutTransition()` → `undefined` (instant layout), hero → `FadeOut`, user bubble → `reducedFade`, tab bar → instant. No motion without a static fallback (matches the recipes.ts contract).
- **No double-owners:** keyboard offset = KAV only; hero→thread reflow = `LinearTransition` only; keep the 22px gutter identical across states.
- **Don't `layout`-animate the thread rows or the ScrollView** (fights autoscroll + jitters during streaming). Apply `layout` to the **composer** and **hero wrapper** only; rows use `entering` only.
- **Don't re-layout on every token:** text grows inside a fixed-radius bubble; only opacity/entering animates. The typewriter already throttles.
- **Don't restart the turn:** delete `params.q` re-seed + `didInitRef` mount-kick; the send-handler turn is the one that renders. `committedRef` guards double-commit.
- **Cancellation:** in (b), Android hardware back in thread state collapses to hero (`setHasThread(false)` + `labTurn.abort()`), not `router.back()` out of the tab. Update the `BackHandler` effect.

---

## 12. Implementation steps (file-by-file, phased)

**Phase 1 — primitives (safe, isolated)**
1. `src/animations/recipes.ts` — add `LAYOUT_SPRING`, `useLayoutTransition()`, `useCollapse()`; import `LinearTransition`, `FadeOut`.
2. `homeAiComposer.tsx` (+ `homeComposerSendButton.tsx`) — add `compact?: boolean` (thread chrome: padding 10, radius `xl`, label→icon send with `usePop` enter/exit). Align input font to `fontSize.lg` + `lineHeight.normal`.
3. `homeLabHeader.tsx` + `home.tsx` — **§4 header changes** (remove matches pill; location to right). *(Ships independently — smallest, highest-confidence PR.)*

**Phase 2 — Gemini layout + overlay transition (option c)**
4. `home.tsx` — reorder to hero mark → greeting → composer → toggle → suggestion chips; drop H1/subcopy/trust; add centered `OrbitLogo` + mode-aware greeting; apply §8 typography + §9 rhythm.
5. `home.tsx` — mount the thread as an in-home `Animated.View` overlay; `onSend` flips `hasThread` + appends user msg + `startTurn()` + `labTurn.start()` (keep the flag-off `router.push('/(lab)/processing')` path). Composer wrapped in `layout={useLayoutTransition()}`.
6. `demo.ts` (`COMPOSER_COPY`) — add `greeting` per mode; suggestion pills reuse existing `demo` strings.

**Phase 3 — converge to single route (option b)**
7. Extract the thread body (messages/`send`/`onRetry`/`collapseSupersededCards`/`computeLatestDraft`/gap filler/batch/edit sheet/`LiveBotBubble`/`ScrollDownPill`) into `src/features/lab/chat/LabThread.tsx`, mounted in the home tree.
8. `chat.tsx` → `<Redirect href="/(lab)/(tabs)/home" />` (keep deep-link compat) or delete + drop from `_layout.tsx`. Remove `params.q` seed + `didInitRef`.
9. `FrostedTabBar` — subscribe to a "chat active" selector; animate out (SLIDE-X curve) when `hasThread`; reduced-motion instant.
10. `home.tsx` `BackHandler` — collapse to hero instead of `router.back()`.

**Files:** `recipes.ts` · `home.tsx` · `chat.tsx` · `_layout.tsx` · `homeAiComposer.tsx` · `homeComposerSendButton.tsx` · `homeLabHeader.tsx` · `FrostedTabBar` · `theme.ts`(+`theme/sizes.ts`,`typography.ts`) · `data/demo.ts`.

---

## 13. Open decisions for the user

1. **Transition depth:** ship **(c) overlay** now and converge to **(b) single-route** later *(recommended)*, or accept **(a) navigation morph** with its seam if we must not touch `chat.tsx` at all.
2. **Suggestion chips:** include them (fill-only) *(recommended)*, or keep the home chip-free (composer as the single entry, as today).
3. **Greeting:** mode-aware "What are you selling/looking for?" *(recommended — reinforces the toggle now that it sits below)*, or one fixed greeting (less to localize zh/ja/th).
4. **Clear composer input on send:** clear it *(recommended — clean return on back)*, or preserve the text.
5. **Hero mark:** large centered `OrbitLogo` *(recommended, reuses existing SVG)*, or no mark (greeting-only, even more minimal).

---

## 14. Verification

- **Emulator first** (motion doesn't need native): Metro `CI=1 npx expo start --dev-client` (restart after each edit); verify header (no pill, location right), Gemini layout, and the send→morph feel + reduced-motion fallback.
- **On-device after `npx expo run:android`** — the test device's dev-client is stale (expo-camera/expo-location); the composer's camera picker needs the rebuild, the morph itself does not.
- **Checks:** no X-shift during morph (22px gutter both states); keyboard stays up through the flip; stream renders with no dead wait; back collapses to hero (b) without aborting the wrong thing; SE-height (375×667) composer clears the keyboard.
- Mobile changes are **local/uncommitted** (ship in the next app build; not git-deployed like the assistant).
