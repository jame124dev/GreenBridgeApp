# Motion rules

Values: [`src/theme/v2/scale.ts:336-397`](../../src/theme/v2/scale.ts).
Helpers: [`src/theme/v2/motion.ts`](../../src/theme/v2/motion.ts).

---

## R1 · Motion answers what a person did, and is otherwise absent

**Rule.** Animate in response to an action. Do not animate on arrival.

No ambient drift, no fade-and-slide-up on every section, no hover-equivalent on
every card. The design is quiet — *"space instead of boxes"* — and motion
follows (`scale.ts:326-334`).

**There is exactly one orchestrated moment in the app:** screen 7a, "Analyzing",
where the person is waiting and the motion *is* the content. If you are adding a
second one, that is a design decision, not an implementation detail.

---

## R2 · Durations

| Token | ms | Use |
|---|---|---|
| `press` | **120** | Press feedback. Fast enough to feel like the surface, not an animation. |
| `release` | **180** | Press release — slower than the press so it settles rather than snaps. |
| `base` | **220** | Default transition: expand, reveal, tab change. |
| `slow` | **320** | Sheet, modal, screen-level change. |
| `ambient` | **1800** | One cycle of a loop — a pulse. |
| `ambientFast` | **900** | A faster loop — a shimmer sweeping a placeholder. |

(`scale.ts:336-355`)

**Why the loop values are an order of magnitude slower.** A loop is background
texture, not a response. Anything from the transition steps **strobes** when
repeated.

---

## R3 · Easing

Cubic-bezier control points (`scale.ts:362-369`):

- `standard` `[0.2, 0, 0, 1]` — decelerate. Things **entering** or settling.
- `exit` `[0.3, 0, 1, 1]` — accelerate. Things **leaving**.
- `inOut` `[0.4, 0, 0.2, 1]` — symmetric. Things moving **between two on-screen states**.

**Rule.** Enter and exit do not share a curve. A sheet that leaves on `standard`
feels like it is being dragged away.

---

## R4 · Anything a finger throws uses a spring, not a duration

**Rule.** A pager, a swipe, a drag settles with a **spring seeded from release
velocity** — never `withTiming`.

```
spring.page = { damping: 20, stiffness: 180, mass: 0.5, overshootClamping: true }
```
(`scale.ts:384-391`)

**Why, concretely.** A fixed duration discards how fast the finger was moving,
so a hard flick and a slow drag take exactly as long to land. That reads as
mechanical no matter which easing curve you pick — and it was the actual reason
the first Home pager did not feel smooth.

`overshootClamping: true` because a pager must not travel past its last pane and
reveal the ground behind it. The bounce that makes a spring pleasant elsewhere
is a rendering bug here.

---

## R5 · Press feedback is subtle

```
press = { scale: 0.97, opacity: 0.9 }
```
(`scale.ts:394-397`)

**Rule.** 3% scale, 10% opacity. The surfaces here are flat and large; a bigger
press transform reads as a toy.

---

## R6 · Reduced motion is mandatory

**Rule.** Every animation consumer respects `useReducedMotion()` — see
`motion.ts`. Ambient loops in particular are gated on `useMotionEnabled()`.

`scale.ts:334` states it as a requirement, not a nicety: *"Every consumer must
respect `useReducedMotion()`."*

**Checkable:** with reduced motion on, the screen must still be fully usable and
every state still reachable. Reduced motion means *no animation*, not *a faster
animation*, and never *a missing state*.

---

## R7 · Two React Native traps

**`timing()` is not a worklet.** Build the easing object on the JS thread and
let the worklet capture it. Calling it from the UI thread throws. This is why
v2 components compute `const enter = timing(duration.slow, easing.standard)` in
the render body, not inside `useAnimatedStyle`.

**A fresh object every render restarts the animation.** `enter` is a new object
each render, so a mount animation keyed on it will re-fire on any unrelated
re-render. Depend on `[]` for a mount animation and say why in a comment — this
is the one place an exhaustive-deps disable is correct.

---

## R8 · Do not blame an animation for a routing bug

Recorded because it cost two days: a seven-row test table appeared to prove that
an endless animation stopped a route from opening. It did not — **a `useEffect`
cannot unregister a route**, and the router's own sitemap listed it. Every row
of that table came from editing the file while the app was running, so the
*edit* was the variable, not the animation.

If a screen will not open, check the router before the animation.
