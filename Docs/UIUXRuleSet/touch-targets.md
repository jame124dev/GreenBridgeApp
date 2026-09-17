# Touch target and accessibility rules

The most testable rules in this folder, and the ones with the clearest external
authority.

---

## R1 · The floor is 44 × 44

**Rule.** Every interactive element is at least **44 × 44** points.

**Source.** [BrowserStack's app-accessibility rule](https://www.browserstack.com/docs/app-accessibility/rule-repository/rules-list/touch-target/touch-target-size)
states **44dp × 44dp** for Android and **44 points × 44 points** for iOS, both
deriving from **WCAG 2.1/2.2 SC 2.5.5 Target Size (Enhanced, Level AAA)**.

**Our token.** `MIN_TOUCH = 44` ([`scale.ts:291`](../../src/theme/v2/scale.ts)).

**The lower legal bar, for when 44 is genuinely impossible.**
[WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
requires **24 × 24 CSS pixels**, with an explicit spacing exception: an
undersized target passes if *"a 24 CSS pixel diameter circle is centered on the
bounding box of each, [and] the circles do not intersect another target or the
circle for another undersized target."*

Treat 24 as the floor you must never go below, and 44 as the target you design
to.

---

## R2 · Which of our controls already pass, and which do not

From `control` ([`scale.ts:269-288`](../../src/theme/v2/scale.ts)):

| Token | Height | Tappable? |
|---|---|---|
| `chipSm` | 26 | ❌ **Below 44. Decorative only — never attach a press handler.** Documented as such at `scale.ts:271`. |
| `chip` | 34 | ⚠️ Below 44 — **requires `hitSlop`**. |
| `avatar` | 40 | ⚠️ Below 44 — requires `hitSlop` if tappable. |
| `thumb` | 46 | ✅ |
| `input` | 52 | ✅ |
| `button` | 54 | ✅ |
| `row` | 66 | ✅ |
| `avatarLg` | 66 | ✅ |

**Checkable:** if a pressable's height is `chip`, `avatar` or smaller, the diff
must also contain a `hitSlop`. No exceptions.

---

## R3 · How to fix an undersized target

**Rule.** Grow the touch area, not the pixels. In React Native:

```tsx
<Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} … />
```

A 34pt chip with 8pt hitSlop on each side is 50pt of touch — comfortably over
44 — while still *looking* like a 34pt chip. Never scale the visual up to hit
the number; that breaks the density the design depends on.

---

## R4 · Targets need space between them, not just size

**Rule.** Two adjacent targets must not have touching or overlapping hit areas.

This is the part people miss: `hitSlop` is invisible, so two 34pt chips 4pt
apart, each with 8pt slop, now **overlap** — and the wrong one fires. WCAG 2.5.8's
spacing exception is built on exactly this circle-intersection test.

**Checkable:** when adding `hitSlop`, check the gap to the neighbour is at least
twice the slop.

---

## R5 · Gesture handler `Pressable`, not React Native's

**Rule.** Inside the v2 pager and any gesture-driven surface, import `Pressable`
from **`react-native-gesture-handler`**, not from `react-native`.

RN's own `Pressable` is silently swallowed there — the control looks right and
never fires. This is recorded in `src/features/v2/home/HomePager.tsx` and has
cost a full debugging session.

**Related trap.** Inside a RN `<Modal>` or portal, gesture-handler controls do
**not** work unless that subtree has its own `GestureHandlerRootView` — the
app-level one does not reach in. If one control in a container works and its
siblings do not, compare which `Pressable` each imports *before* touching the
layout.

---

## R6 · A screen with N controls is verified when N controls have been pressed

**Rule.** Not one. Not the easiest one. All of them.

**This is not theoretical here.** The v2 sign-in sheet — the one screen whose
job is *"do not trap a guest"* — was once ticked as "verified on glass, both
schemes" from a screenshot, while **all three of its buttons were dead.** It
trapped guests. A screenshot proves appearance; only a tap proves function.

**Corollary.** When a control does not respond, immediately press one on the
same screen that your change did **not** touch. That separates "I broke it" from
"it was already broken" in one step.

---

## R7 · Never gate at the door

**Rule.** Browsing, searching and the AI assistant are open to everyone.
Only genuinely account-based actions ask for an identity, and they ask **at the
moment the control is pressed**, via `requireAuth(reason, action)`.

**Source.** App Review rejected build 1.0.3 (21) on **2026-08-24** under
**Guideline 5.1.1(v)**: *"the app requires users to register before browsing
products."* The note is preserved in `app/index.tsx` and
`src/features/auth/signInPromptStore.ts`.

**Both directions are failures**, and a check that guards only one invites the
other:

- gate too **early** → a guest cannot browse → rejected again
- gate too **late** → a guest fills in a bid form and is refused at submit

---

## R8 · Screen reader labels name the action

**Rule.** `accessibilityLabel` describes what pressing does, not what the
control looks like. `accessibilityRole="button"` on anything pressable.

Decorative images and icons that sit beside their own text label should not be
announced separately — see [icons.md](icons.md) R6.
