# Responsiveness rules — acknowledging a touch

How fast the app must *answer* a finger. Distinct from [motion.md](motion.md),
which owns what the animation looks like once it runs; this file owns **whether
anything happens at all, and when**.

Helpers: [`src/theme/v2/motion.ts:70`](../../src/theme/v2/motion.ts) (`usePressFeedback`),
[`src/lib/haptics.ts:50`](../../src/lib/haptics.ts) (`haptics`).
Values: [`src/theme/v2/scale.ts:338`](../../src/theme/v2/scale.ts) (`duration.press`),
[`scale.ts:394-397`](../../src/theme/v2/scale.ts) (`press`).

> Written 2026-09-17 after a report that tapping a tab "takes time, so users
> click twice". It was not device slowness — see R6.

---

## R1 · Every control acknowledges the touch within 100ms

**Rule.** A press produces a visible or tactile change within **100ms** of
finger-down — regardless of how long the actual work takes.

**Source.** 100ms is the ceiling for an interface to feel instantaneous
(~6 frames at 60Hz) —
[UI latency fixes users actually feel](https://medium.com/@1nick1patel1/10-ui-latency-fixes-users-actually-feel-2545cdfcac59).
Measured perceived-quality thresholds are tighter still: quality drops between
**70–100ms** for tactile/audio feedback and **100–150ms** for visual —
[*Towards the Temporally Perfect Virtual Button*, ACM TAP](https://dl.acm.org/doi/10.1145/2611387).

**You do not get the whole budget.** Commercial touchscreens already spend
**50–200ms** end-to-end before your code runs —
[User-Acceptance of Latency in Touch Interactions](https://link.springer.com/chapter/10.1007/978-3-319-20681-3_13).
Treat the hardware as having spent most of it already.

---

## R2 · Silence past ~250ms produces a double tap, mechanically

**Rule.** If nothing happens within about a quarter-second, assume the user taps
again — and assume the second tap is destructive.

**Source.** The OS double-tap window defaults to **250ms** on iOS
([Single-tap Latency Reduction](https://arxiv.org/pdf/2408.02525)). Past that,
the user's retry is not a "double tap" the app can ignore; it is a second,
separate press that fires the handler twice.

**Checkable.** Any handler that can be pressed twice inside 250ms and would
misbehave must be guarded. `SellingPane`'s draft resume already does this —
`if (resumingId) return;` — with the reason written down: *"`resume` is a GET
followed by a push, so a second tap while the first is in flight navigates
twice."*

---

## R3 · Feedback is not completion. Never gate it on the work finishing.

**Rule.** The acknowledgement fires on **`onPressIn`**, not on success, not on
navigation, not on a response.

`usePressFeedback()` is built this way already — `onPressIn` starts the
animation immediately. Use it rather than reimplementing press state.

**The failure this prevents, from this codebase.** `TabBar` derives its active
tab from `usePathname()`. That is correct for correctness — it is why the
selected tab cannot drift out of step with the route — but it means the
*visual* selection cannot move until navigation **completes**. Combined with a
`Pressable` that had no press feedback at all, the bottom nav emitted **nothing**
between finger-down and screen-change. That is the report this file was written
for.

**Corollary.** "Derived state is the source of truth" and "the press is
acknowledged instantly" are not in conflict — the first governs what is
*selected*, the second governs what is *pressed*. A control needs both.

---

## R4 · Every pressable carries feedback, and the kit already has it

**Rule.** No bare `Pressable` in v2. Wrap with `usePressFeedback()`
([`motion.ts:70`](../../src/theme/v2/motion.ts)), which applies
`press = { scale: 0.97, opacity: 0.9 }` ([`scale.ts:394-397`](../../src/theme/v2/scale.ts))
over `duration.press` = **120ms** ([`scale.ts:338`](../../src/theme/v2/scale.ts)).

Pass `{ scale: false }` where a transform would look wrong — a full-width row, a
tab — and let the opacity dip carry it. `Tabs` does exactly that.

**Checkable, and cheap:**

```bash
# every v2 component with a Pressable should also name usePressFeedback
grep -rl "Pressable" src/features/v2/ui/*.tsx \
  | xargs -I{} sh -c 'grep -q usePressFeedback {} || echo "NO FEEDBACK: {}"'
```

On 2026-09-17 this check found **six** offenders in the kit:

| File | Controls affected |
|---|---|
| `TabBar.tsx` | the five bottom tabs — the most-tapped control in the app |
| `BrandBar.tsx` | the language button and the notification bell, on every tab screen |
| `SectionHeader.tsx` | every `See all` link |
| `StagedChip.tsx`, `Stepper.tsx` | review-flow controls |
| `SchemeToggleDev.tsx` | dev-only, `__DEV__`-gated — exempt |

⚠️ **Run the grep; do not hand-pick a list.** The first pass at this audit
checked eight components chosen by eye, found only `TabBar`, and that number was
reported to the user as "the only one". It was wrong by five. A curated sample
is not an audit — the whole point of a checkable rule is that the check
enumerates the population for you.

---

## R5 · Haptics: pick the verb, never call `expo-haptics` directly

**Rule.** Go through [`src/lib/haptics.ts:50`](../../src/lib/haptics.ts). It
gates platform (web is silent, never throws), swallows failures, and gives one
dial for a future "reduce haptics" setting.

| Verb | Use |
|---|---|
| `tap()` | selection: tab change, chip toggle, sheet option, list pick |
| `impact()` | confirmation: primary CTA — Submit, Sign in, Save |
| `heavy()` | significant/irreversible: camera shutter, destructive confirm |
| `success()` / `warning()` / `error()` | system-level outcome, not a press |

**Rule.** A haptic accompanies a press; it never replaces the visual. Haptics
are off for some users and absent on web, so anything carried *only* by a buzz
is carried by nothing.

Note the tighter budget: tactile feedback degrades from **70ms**, earlier than
visual (R1). Fire it in the handler, not after an await.

---

## R6 · Do not measure tap latency with `screencap`

**Rule.** Before quoting a latency number, measure your measuring tool.

`adb shell screencap` + `adb pull` costs **621–686ms** per frame on the project
device (three runs, 2026-09-17). That is slower than everything it would be
measuring, so any "tap took Nms" derived from polling screenshots is a number
about the harness, not the app. A first changed frame at 779ms means the app
changed *somewhere under ~130ms* — or had already finished before the first
capture completed. It cannot distinguish them.

**Use instead:** `adb shell screenrecord` (real frame timing), a JS timestamp
logged at `onPressIn` and again at the effect, or the React DevTools profiler.
If none are available, **say the latency is unmeasured** rather than quoting the
polling number — and fix the missing feedback anyway, because R1 is about the
absence of an answer, not its speed.

### You cannot screenshot the press STATE either. Two methods that do not work.

Both were tried on 2026-09-17 and both failed:

- **`adb shell input motionevent DOWN` / `UP`** — never reached the app at all.
  The tap did not even navigate, so nothing was being held.
- **`adb shell input swipe X Y X Y 15000`** (a 15-second in-place hold) — the
  app receives it, but a screencap taken mid-hold shows **zero** pixel
  difference.

**The second one was proved incapable, not negative.** Holding `Scan it` — which
has carried `usePressFeedback` since long before this work — produced
`mean-diff = 0.000` and `bbox = None`. A probe that cannot see the effect on a
control that definitely has it cannot be used to claim another control lacks it.

**Therefore:** press feedback is verified by reading the component (does it call
`usePressFeedback` and spread `animatedStyle`?) plus the R4 grep, **not** by
screenshot. If you need it on glass, use `screenrecord` and a frame extractor —
and note that neither `ffmpeg` nor `opencv` is installed on this machine, so
that needs setting up first. Until then, say "wired, not photographed".

---

## R7 · Native tab bars and ripple, if this is revisited

Android's ripple is the platform's own answer to R1 and is available on
`Pressable` via `android_ripple`; it is Android-only, so it supplements
`usePressFeedback` rather than replacing it.

React Navigation's native bottom tabs use platform components, which get the
platform's feedback for free —
[Native Bottom Tabs Navigator](https://reactnavigation.org/docs/native-bottom-tab-navigator/),
and Expo's own `HapticTab` pattern in
[how to build beautiful React Native bottom tabs](https://expo.dev/blog/how-to-build-beautiful-react-native-bottom-tabs).
Relevant because `TabBar` is the one v2 component **not** drawn from the canvas
and is marked for wholesale replacement — if that replacement happens, prefer
the native navigator over re-deriving press feedback by hand.
