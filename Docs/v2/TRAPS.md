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

## Driving the device

**Reset with a deep link, never with N × BACK.** Six BACK presses walk out of
`/v2` into the *old* lab home, which also has a Home tab, a bell and draft cards
— so the taps that follow land on the old UI while looking like v2.

**Hide the dev scheme pill first** (long-press it). The floating magenta
`SYS → LIGHT` control sits over real controls on several screens and swallows the
touch silently. `uiautomator` cannot see occlusion, so the bounds look clickable
and the tap never arrives. It has done this three times.

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
