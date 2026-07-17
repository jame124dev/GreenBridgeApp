# Chat UI Glitch Audit — 2026-07-17

Source: user testing via scrcpy on the Android emulator (pixel_7_api_34, **3-button
navigation**, `show_ime_with_hard_keyboard=1`) + two user screenshots + live repro
frames captured over adb. The physical test phone (Xiaomi, gesture nav) did NOT
show G1/G2 in earlier device passes — these are surfaced by the 3-button-nav +
flaky-IME-events platform config, which real users on button-nav Androids will hit.

| ID | Symptom | Severity | Root cause (short) | Status |
|----|---------|----------|--------------------|--------|
| G1 | Composer floats mid-screen over a huge dead gap (keyboard closed) | **High** | `useReanimatedKeyboardAnimation().height` stuck at open-height after an IME hide that fires no inset animation | **FIXED** (useKeyboardInset) |
| G2 | Composer slides **behind the 3-button nav bar** | **High** | `keyboardVisible` state stuck `true` after a missed `keyboardDidHide` → composer keeps its 8px keyboard-mode padding | **FIXED** (useKeyboardInset) |
| G3 | "Searching the marketplace…" still showing while RESULTS · N + cards are already rendered | Medium | The pre-first-token thinking slot never updates its label once cards land; phase stays "search" until the first text token | **FIXED** (WorkingIndicator labels) |
| G4 | Scroll-down FAB floats detached over the dead gap | Low | Same as G1 (FAB is anchored to the composer, which is displaced) | **FIXED** (with G1) |

---

## G1 — Stuck keyboard padding (dead gap under a mid-screen composer)

**Symptom.** After the keyboard closes, the composer stays roughly a keyboard-height
above the bottom; the area below it is dead canvas. Chat content can end up hidden
behind the raised composer.

**Evidence.** Live-reproduced: frame shows composer at ~55% screen height with the
IME confirmed CLOSED at the OS level (`dumpsys input_method` → `mInputShown=false`)
while the layout still reserves the keyboard's height. Matches the user's second
screenshot exactly.

**Root cause.** `app/(lab)/chat.tsx` (~line 128):

```ts
const keyboard = useReanimatedKeyboardAnimation();
const keyboardAvoidStyle = useAnimatedStyle(() => ({ paddingBottom: Math.abs(keyboard.height.value) }));
```

`useReanimatedKeyboardAnimation`'s `height` shared value is driven by
`WindowInsetsAnimationCompat` callbacks. When Android hides the IME **without an
inset animation** — activity focus change, hardware-key dismissal (scrcpy/emulator
inject hardware events), some OEM IMEs — the final `0` frame never arrives and the
shared value stays at the open height. `Math.abs` protects against sign, not
against a missed terminal frame. (This is the same failure class as the original
MIUI KeyboardAvoidingView bug; the reanimated rewrite narrowed it but the missed-
event edge remains.)

**Proposed fix (one source of truth + a clamp).**
1. Drive BOTH the avoid-padding and the composer inset from the same animated
   value: outer `paddingBottom = max(abs(keyboard.height), insets.bottom)` and
   delete the boolean-driven inset switch entirely (kills G2's mechanism too).
2. Harden against the missed terminal frame: subscribe `KeyboardEvents.
   keyboardDidHide` AND `AppState`/screen-blur, and on either, snap the shared
   value to 0 (`keyboard.height.value = withTiming(0)` or direct set). The events
   and the animation rarely BOTH miss.
3. Regression test: mock the controller, simulate show → (no animation) hide via
   the event listener, assert padding returns to `insets.bottom`.

---

## G2 — Composer behind the 3-button navigation bar

**Symptom.** The input row renders flush to the physical screen bottom, partially
covered by the back/home/recents bar (user screenshot 1).

**Root cause.** `app/(lab)/chat.tsx` (~lines 112-120 + 302):

```ts
const [keyboardVisible, setKeyboardVisible] = useState(false);
// KeyboardEvents.addListener('keyboardDidShow' / 'keyboardDidHide') → setState
...
{ paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 10) }
```

The safe-area inset is applied only when `keyboardVisible === false`. If
`keyboardDidHide` is missed (same flaky-event platform class as G1 — the two
primitives can miss independently, producing either glitch), the composer keeps
its 8px keyboard-mode padding forever → on gesture-nav devices that looks like a
small gap; on **3-button nav** (`insets.bottom` ≈ 48dp) the composer sits under
the buttons.

**Proposed fix.** Delete the boolean entirely (see G1 fix 1): with
`paddingBottom = max(keyboardHeight, insets.bottom)` on one animated container,
the inset can never be "toggled off" by a missed event; the composer keeps a
constant small internal padding.

---

## G3 — "Searching the marketplace…" contradicts visible results

**Symptom.** The indicator bubble keeps saying "Searching the marketplace…" above
an already-rendered `RESULTS · 28` header and product cards (both user
screenshots + live frame). Reads as a hang even though streaming is healthy.

**Root cause.** `src/features/lab/chat/ChatMessage.tsx` (~line 286):

```ts
const isThinking = !text && (streaming || !hasCards);
...
{isThinking ? <WorkingIndicator phase={phase} mode={mode} /> : <MarkdownLite text={text} />}
```

The thinking slot deliberately stays mounted until the first TEXT token (it
reserves the top position so cards can never render above later prose — an
intentional ordering fix). But `WorkingIndicator`'s label is phase-driven and the
phase never advances between "search results landed" and "first token", so the
UI claims to still be searching after the search visibly finished. gpt-4o-mini
often takes 2-4s to start prose after a tool result → the contradiction is
on-screen for seconds on every search turn.

**Proposed fix.** Keep the slot (ordering invariant), swap the copy: pass
`hasCards`/result count into `WorkingIndicator`; once cards exist render
"Putting together a summary…" (or "Found 28 — summarizing…") instead of the
search label. Data-only change to the indicator; no layout impact. Add a
characterization test: data frame before first token → indicator label is the
summarizing variant.

---

## G4 — Scroll-down FAB floats over the dead gap

Anchored to the composer, so it is displaced together with it (visible in the
live G1 frame). No separate fix — resolves with G1.

---

## Repro notes (emulator)

- AVD `pixel_7_api_34`, currently must run **headless** (`-no-window -gpu
  swiftshader_indirect`; the windowed Qt UI crashes on this machine) and mirrored
  with scrcpy. DNS needs `-dns-server 8.8.8.8,1.1.1.1`; stale `*.lock` files in
  the AVD dir hang boot; the AVD keeps re-acquiring a broken `10.0.2.2:9999`
  http_proxy (clear with `settings put global http_proxy :0`).
- `show_ime_with_hard_keyboard=1` is required for the soft keyboard; scrcpy
  typing injects HARDWARE key events, which is exactly the class of IME
  transition that drops inset animations → makes G1/G2 easy to hit here (and
  possible on real devices with hardware keyboards / OEM IMEs / fast toggles).
- The phone (gesture nav, touch typing) rarely hits G1/G2 — do not conclude
  "fixed" from a phone-only pass; verify on a 3-button-nav device/emulator.

## Suggested fix order

1. G1+G2+G4 together — one refactor of the keyboard/inset plumbing in
   `app/(lab)/chat.tsx` (single animated source of truth + hide-event clamp).
2. G3 — indicator copy swap in `WorkingIndicator` + `AssistantMessage` prop.
3. Re-run the audit loop on BOTH the emulator (3-button, hw-keyboard) and the
   phone (gesture nav) before calling it done.


---

## Fix record (same day)

All four fixed, tested, and emulator-verified on the exact repro paths:

- **G1/G2/G4** — `src/features/lab/chat/hooks/useKeyboardInset.ts`: ONE reconciled
  SharedValue from THREE independent native channels (per-frame insets animation;
  discrete didShow/didHide clamps; AppState-active resync via the synchronous
  `KeyboardController.isVisible()/state()` queries). `chat.tsx` now derives its
  padding as `max(inset, safeArea.bottom)` in a single animated style — the
  `keyboardVisible` boolean is deleted, so a missed event can no longer toggle
  the safe-area inset away. 5 unit tests cover every missed-callback combination
  (animation-only, events-only, both-dead-with-AppState-resync, agreeing-channels
  no-op). Emulator-verified via hardware-key dismissal (the flaky path): keyboard
  open → composer rides the IME; dismissal → composer returns to the safe-area
  bottom within the clamp animation, no dead gap, no nav-bar overlap.
- **G3** — `WorkingIndicator` takes `resultsReady`/`draftPending`; once result
  cards are on screen the label flips to "Putting together a summary…" (draft
  hold → "Preparing your draft…"), keyed for a cross-fade. What the user can SEE
  outranks the stream's phase field. Locked by 2 render tests; i18n added for
  en/zh-Hans/zh-Hant (ja/th/vi fall back to English like the rest of their
  `working.*` block — pre-existing backlog).

Suite after fixes: 29 suites / 357 tests, tsc clean, eslint clean.
Remaining verification debt: one pass on the physical phone (gesture nav) to
confirm no regression there — the emulator config covers the failure modes, the
phone covers the happy path.
