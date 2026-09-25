# Traps

Things that cost a day if you do not know them. Each was paid for once.

**Scope.** This file is about VERIFYING a v2 screen — driving the device and
reading the result. The traps in BUILDING one (function-form `style` being
deleted at runtime, `letterSpacing` in points, `minWidth: 0`, safe areas,
unloaded font weights) belong to the `v2-screen` skill at
[`.claude/skills/v2-screen`](../../.claude/skills/v2-screen/SKILL.md), which
also owns the definition of done. Do not duplicate either list into the other.

The agent-facing copy of the device rules lives in
[`GreenBridgeApp/CLAUDE.md`](../../CLAUDE.md) so it loads automatically; this
file is the human version.

## Verifying a screen

**A screenshot proves appearance, not function.** Thirteen v2 controls did
nothing while photographing perfectly. The bar is ⚑ — every control pressed and
its effect observed — and it was raised after a sign-in sheet was signed off
"verified on glass" with all three of its buttons dead.

**The worst bug shape is half-alive, not dead.** Home's Buying tab moved its own
indicator and left the pane behind. A screenshot of that looks *correct*: the tab
you pressed is visibly selected. You have to read what is underneath.

**State the pass condition before you probe.** A "dead control" verdict once came
from comparing screen text before and after — on a tab whose label is identical
in both states. A pass and a fail would have printed the same thing.

## ⚠️ The WEB surface cannot press most v2 controls

Found 2026-09-23 while moving verification off the phone (`npx expo start --web`
on :8083, driven with Chrome DevTools MCP). Web is a supported dev surface here
— `app.config.ts:157` sets `output: 'single'` precisely so screens can be worked
on without competing for the one physical phone — and it is **excellent for
layout, content, fixtures and copy**. It is **not** a control surface.

| Control | Web |
|---|---|
| plain RNGH `<Pressable>` (`ui/SchemeToggleDev.tsx:65`) | ✅ responds |
| `Animated.createAnimatedComponent(RNGH Pressable)` (`ui/Tabs.tsx:55`, `bids/material-tab-bar.tsx:79`, every card) | ❌ **inert** |

**Every control built with `usePressFeedback` is in the second row**, because
that hook needs the Animated wrapper. So Tabs, Row, the bid/inspection cards
and the watchlist tiles all render perfectly and do nothing when clicked.

This is pre-existing and app-wide, not a property of any one screen: Home's
Selling/Buying tab — untouched code, verified working on the device — is dead
in the browser too. The element is hit-testable (`elementFromPoint` returns it)
and nothing is occluding it; the handler simply never fires.

**Two hypotheses were wrong before this one, and both cost a probe.** First
"RNGH is inert on web" — falsified by the scheme pill, which is RNGH and works.
Then "the drawer's scrim is intercepting" — the overlay really is a
full-viewport `Close drawer` element, but it computes `pointer-events: none`
and does not contain the hit. Measure the element at the point and compare a
control you did NOT touch before naming a cause.

**So:** verify layout, every fixture edge case, empty states, both schemes and
the drawer on web; take control presses to the device. A dead control in the
browser is not evidence of a bug.

**KIT GAP, not yet decided:** making the Animated wrapper forward presses on web
would turn web into a complete verification surface and save the restart cycle
that dominates device work. It is a change to `usePressFeedback` and the kit
primitives around it, so it needs one hand and a decision — not a per-screen fix.

## Driving the device

**Reset with a deep link, never with N × BACK.** Six BACK presses walk out of
`/v2` into the *old* lab home, which also has a Home tab, a bell and draft cards
— so the taps that follow land on the old UI while looking like v2.

**Hide the dev scheme pill first** (long-press it). The floating magenta
`SYS → LIGHT` control sits over real controls on several screens and swallows the
touch silently. `uiautomator` cannot see occlusion, so the bounds look clickable
and the tap never arrives. It has done this three times.

**The same blindness applies to the KEYBOARD and to a sticky FOOTER, and it is
worse, because they cover half the screen.** The dump keeps reporting nodes at
their full rects underneath both. In one session this produced: a tap on a
field that landed on the keyboard and left focus where it was; a field called
"fully visible" that is drawn under the footer; and a tap on the scheme pill —
whose rect is at y1877, behind a keyboard starting at y1537 — that typed `ww`
into the email field instead. Before tapping anything, compare the target's rect
against `min(footer.top, keyboard.top)`, and dismiss the keyboard first (drag
the body; `keyboardDismissMode="on-drag"` is on) when the target is below it.

**Parse `bounds=` specifically; reject degenerate rectangles.** A digit-grep over
a node also matches `index=`, which once produced a tap that silently changed a
draft's country to Albania. An inverted or `[0,0][0,0]` rect means the view is
off-layout — scroll and re-measure, never estimate. Guessing a coordinate for an
off-screen "Cancel" once switched the whole app to Vietnamese, which persists.

**Scroll from inside the body.** The review steps have a fixed header sheet AND a
fixed footer; a swipe starting on either does nothing, which reads as "the screen
will not scroll".

**After ANY session or machine restart, restore `adb reverse tcp:8082 tcp:8082`
BEFORE touching the app.** The tunnel dies with the session. Without it the dev
client sits on "Reloading…" forever and Metro's log shows no bundle request at
all — so the phone looks wedged and the bundler looks idle, and neither is
broken. Cost this session: a long detour chasing a dead app. If the app is stuck
on "Reloading…", check `adb reverse --list` first, then force-stop and reconnect
through the Dev Launcher's `localhost:8082` row, which is the reliable recovery.

**Reload before you judge.** Fast refresh silently fails often enough that
several bisect results this session were read off a stale bundle. If a change
"did not work", reload and retest before believing it.

## Verifying a FORM, which is not the same as verifying a screen

Paid for on the auth rebuild, 2026-09-23. Every gate was green and the screen
was signed off; the user opened it, put the keyboard up and the form was close
to unusable.

**Measure the visible SLOT, not "is the footer covering the field".** That was
the question asked, and it passed — the focused field sat 242px clear of the
footer. It is the wrong question. The right one is *how much of the form can
you see at all*: with a fixed header above and a sticky footer below, login's
usable strip was about 284px (~111dp) with the keyboard up. A field row is
~93px plus its label.

**The slot is `scrollView.top` → `min(footer.top, keyboard.top)`, and NOT the
scroller's own rect.** A sticky footer is an overlay to the view tree, so the
scroller's rect runs on underneath it and down behind the keyboard: it reported
1410px (553dp) for a strip that is really 702px (275dp), and called a field
"fully visible" that is drawn under the footer. Take `footer.top` from the
primary button's node. Do not infer either edge from neighbouring views —
"the first wide button" found `Forgot password?`, a BODY control, and reported
536px on a screen that had 894px.

**Check the focused field's LABEL, not just the field.** The keyboard-aware
scroll aligns the input's top edge with the top of the window, so the eyebrow
above it goes out of view. On a form whose two password boxes are distinguished
only by their labels, that leaves two identical boxes. Assert the label string
is still in the dump while the field is focused.

**Try to TAP the field, do not only Next into it.** A tap aimed at the last
field of the sign-up form landed on the keyboard; focus stayed where it was and
nothing looked wrong. The focus chain (`returnKeyType="next"`) made the form
navigable and hid the fact that half of it is untappable. Both routes are real
user behaviour; test both.

**`dumpsys window` will not tell you the keyboard is open.** Parsing the
InputMethod window frame returned "closed" while the keyboard was plainly on
screen in the same screenshot. Use `dumpsys input_method | grep mInputShown`,
which is a single unambiguous boolean. For its top EDGE, sample a pixel column
up the screenshot and find the colour break.

**Settle before you measure.** The keyboard animates in over ~250ms, and on a
screen whose header collapses with it the layout is still moving. A dump taken
straight after the tap reported "no collapse, label present" for a screen that
does collapse and does lose the label. Wait ~1.5s, then dump.

**Contrast a thumb against its track with a number.** A segmented control's
selected chip measured 1.14:1 against its track in light and 1.10:1 in dark,
against the 3:1 non-text minimum — invisible as a shape, with the selection
carried entirely by the label's weight. `v2Contrast.test.ts` does not catch it,
because it checks the things that ramp, and a thumb that is a flat fill is not
one of them. Compute it from `palette.ts` rather than judging it by eye on a
screenshot.

## 6c Browse is the exception to everything above

**`uiautomator` cannot see inside a WebView.** The text dump is byte-identical
before and after every tap on that screen. It is the one place where a
*screenshot* is the only probe that distinguishes a working control from a dead
one — the inverse of every other screen.

## Platform

**RNGH does not reach inside a RN `<Modal>`** without its own
`GestureHandlerRootView`. If one control in a modal works and the rest do not,
compare which `Pressable` each imports.

**`reanimated-tab-view`'s `TabView` is imperative, not controlled.** It seeds
from `navigationState.index` once and ignores it after; drive it with `jumpTo`,
and give it an `initialLayout` width or a mount-time jump is a silent no-op.

**Never put a `return` above a hook.** Gate the hook's input (`enabled`) or its
result.

**An endless reanimated animation can stop a route opening** — see
[STATUS.md](STATUS.md) for the 3a test table. Not proven to generalise, but if a
new screen will not open and nothing is logged anywhere, look at its animations
first.

**A `@gorhom/bottom-sheet` loses the v2 theme.** Its children render into
`BottomSheetModalProvider`, mounted in `app/_layout.tsx` — above the v2 route
group, so above `V2ThemeProvider`. The sheet's own element reads context fine;
the first v2 component in its children throws *"useV2Theme must be used inside
&lt;V2ThemeProvider&gt;"*. Crashed the composer's attach sheet on first open,
2026-09-21.

Wrap the portal subtrees in `V2ThemeBridge` — `backdropComponent` and
`backgroundComponent` each need it too, not just the body:

```tsx
const theme = useV2Theme();            // OUTSIDE the portal
<BottomSheetModal>
  <V2ThemeBridge value={theme}>…</V2ThemeBridge>
</BottomSheetModal>
```

⚠️ Do NOT nest a second `V2ThemeProvider` instead. It owns its own `preference`
state, so the sheet would stop following the scheme — the fork
`app/v2/scan/review/_layout.tsx` already warns about. The bridge re-provides the
value the parent already has, so a toggle still reaches through.

**`flat:` markers must sit within two lines of the ground they excuse.**
`v2MaterialCoverage` looks back only two lines. Prettier reflowing a multi-line
style prop, or a comment growing past two lines, silently moves the marker out
of range and the file starts failing for a reason that is already documented
directly above it. Keep the marker to one line, immediately above.

**Never name a merged/derived row field `key`.** React reserves that prop
name; spreading `{...item}` into JSX when `item.key` exists triggers *"A props
object containing a 'key' prop is being spread into JSX"* — visibly, on
screen, in a red banner. Neither `tsc` nor any Jest gate catches it (found on
`requests/types.ts`, 2026-09-24, only by looking at the rendered web page). If
a merged type needs a stable list identity, call the field `rowId` or `id`,
never `key`.

**A horizontal `ScrollView`'s own `style` height is not reliable on web.**
Without an explicit cross-axis size it inherits `alignItems: stretch` from a
flex-column ancestor and stretches to fill whatever vertical space is left —
measured on `requests-screen.tsx` at 314px where 44px was intended, pushing
everything below it down by 250px+ of dead space. Setting `height: MIN_TOUCH`
directly on the `ScrollView`'s `style` prop did NOT fix it, even confirmed
present in the served bundle. The fix has to go on a plain wrapping `View`
around the `ScrollView` — exactly the `tabsSlot` pattern `MaterialTabBar`
already uses. If a scroll row measures too tall on web, wrap it, do not just
style it.

**A fixed bundle in a stale BROWSER TAB is the same trap as a stale device
bundle.** `reload({ ignoreCache: true })` did not pick up a style fix that was
independently confirmed present in the freshly-served JS (curled the exact
entry-bundle URL and grepped for the new code). Opening a brand-new tab at the
same URL did. When a web fix "isn't working" but the bundle provably has it,
open a fresh tab before doubting the fix.

**A screen nested INSIDE the dashboard Drawer still needs `tabBar={false}` on
its own `Screen` call — it is not inherited from the Drawer layout.** Missed
on `app/v2/dashboard/orders/[id].tsx` (2026-09-24): every sibling dashboard
route passes it explicitly, this one didn't, and the old bottom tab bar
(Home/Browse/Matches/Messages/Account) rendered at the foot of the page. Only
a FULL-PAGE screenshot caught it — the viewport screenshot from the same pass
cropped it out of frame. Check the whole page, not just the fold, on any new
route under `app/v2/dashboard/`.

**A fixture's "N days from now" is a MOVING TARGET, not a fixed offset.** A
relative-date label computed as `(new Date(fixtureTimestamp) - Date.now()) /
86400000` reads a fraction of a day LOWER than the fixture author intended,
because real time has moved on by the time the code runs. A fixture authored
as "2 days out" rendered "tomorrow", not "in 2 days" — the diff was already
fractionally under 2.0. Give a boundary-sensitive fixture value real
clearance (3 days for a "<2 vs. else" threshold, not 2), or the label will be
off by one bucket every single run, not intermittently.

**Two states of ONE screen can contradict each other even when neither is
individually wrong.** An `EmptyState` ("nothing here") placed below an
always-populated summary section, shown only when a DIFFERENT section was
empty, is exactly `v2-screen`'s coherence rule one level up from a single
component: caught before shipping on `buying-home-screen.tsx` by asking "what
does the WHOLE page say" rather than checking each conditional block in
isolation. When two independent conditions can each legitimately render, ask
whether their DEFAULT and EMPTY states, shown together, still make sense as
one page.

**A `@deprecated` default export that `<Navigate>` redirects can hide the
REAL live content in a named export of the SAME file.** On
`SellerBidDashboard.tsx` (2026-09-24): the file's default export is dead —
just a redirect into a 3-tab parent — while the actual panel a seller sees
(`SellerAuctionBidsPanel`) is a named export of that identical file, imported
by the tab parent instead of routed to directly. A plan citing "the file" by
name can be right about the FILE and wrong about which EXPORT is live; trace
the live ROUTE (`app/.../page.tsx` → what it actually renders, following any
redirect) rather than trusting that a file with the right name is the right
code. The buyer/seller dashboard's own web app has at least three list-style
pages behind exactly this shape (a tabbed parent switching several panel
components) — check for it before porting any of them.

**A CONCURRENT SESSION's syntax error takes down the WHOLE Metro build, not
just its own file.** On `app/scan/processing.tsx` (2026-09-24): a mid-edit
JSX error in a file this session never touched surfaced as a full-screen
"Build Error" overlay on every route, including this session's own, freshly
verified page. Two minutes later it was gone with no action taken here. The
tell that it was transient and not this session's fault: the file's mtime
was seconds old (still being edited), and the bundle response SIZE — 21MB for
a real build, ~9KB for the error JSON — flips back and forth with the
error, not just the HTTP status code (both are 200 when using
`-o file -w '%{http_code}'` against a dev-mode error response; check the
byte count, or grep for `TransformError` in the body, before trusting a 200).
Poll and wait; do not touch a file whose mtime says someone else is mid-edit.
