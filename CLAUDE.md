# CLAUDE.md — GreenBridgeApp (mobile)

Workspace-wide rules are in `../CLAUDE.md`. This file adds only what is true here.

## ⚠️ How to reply in this repo

Agreed 2026-09-15, after a day of replies the user was not reading.

- **EVERY reply uses this template. Chosen by the user 2026-09-16 after two rounds of feedback.**

  ```
  Done:  <one line>
  Next:  <one line>
  Need:  <one line — omit entirely if there is nothing to decide>

  (detail: Docs/V2_CHECKLIST.md)
  ```

  The template is the point: it cannot grow into a report, which was the root cause. A finding
  that does not fit goes in the checklist and the reply says so. `Need:` is the only line that
  may be bolded, and only when it is genuinely the user's call.
  Exceptions: a direct question gets a direct answer, and a refusal or a warning is written
  plainly. Neither is licence to go back to paragraphs.
- **No essays.** If a reply is over ~80 words, cut it or move it into the checklist.
  Broken again on 2026-09-16 — a ~350-word reply with nine bold fragments, and the user had to
  ask a second time whether any of it was readable. The test is not "is this accurate", it is
  "would a person read this". Findings go in `Docs/V2_CHECKLIST.md`; the reply says they are there.
- **One decision per reply, and it is the only thing bolded.** If there is nothing for the user
  to decide, nothing is bolded.
- **Stop bolding everything.** When everything is emphasised nothing is.
- **Do not narrate your own carefulness.** "I verified X before Y" is worth saying only
  when the verification CHANGED the answer. Otherwise it is showing work nobody asked for.
- **Keep working.** Decide the obvious calls and carry on; do not check in between steps.
  Stop only for what is genuinely the user's: palette, WCAG sign-off, missing endpoints,
  credentials, anything that writes real data.
- ⚠️ **"Keep working" applies to work already agreed — it does not set new scope.**
  A QUESTION IS NOT AN INSTRUCTION. On 2026-09-24 *"are you plugging the api as well in screen?"*
  was answered and then treated as an order to wire three screens to the live API; the user's
  next message was *"who said for you for api add"*. Answer the question, say what you could do
  next, and stop. Impatient phrasing is a reason to ask, not to assume.
  **And never start new scope in a turn triggered by a system or background-task event** — those
  notifications say in their own text that they are not user input. With no human message, the
  only safe moves are finishing the step already in flight and reporting. See `../MISTAKES.md`,
  2026-09-24.
- **A METHOD the user has stated is not one of those calls — apply it to every item in scope
  without re-deciding it per item.** The dashboard method is *clone a template repo into
  `ui_git_repo/`, copy its files in, then adjust*. It was re-litigated four times in one session,
  the last time by arguing the existing kit's `Tabs` made copying a tab bar unnecessary — before
  reading the candidate, which turned out to be better (a sliding interpolated indicator vs. our
  jumping one). If an application looks wrong, **build it first and say why afterwards, with the
  result in hand.** A reservation is worth something only once the alternative exists and can be
  compared. See `../MISTAKES.md`, 2026-09-23.
- Evidence beats prose. A measured number, a screenshot, a grep — those are the value.
  Confident tone is not: four claims were stated confidently and wrongly in one day.

## Building a dashboard page

**`Docs/Dashboard/PAGE_PLAYBOOK.md` is the flow — follow it, do not re-derive it.**
The user's instruction is `Build <page> following Docs/Dashboard/PAGE_PLAYBOOK.md`
and that is the whole brief. It covers: take the contract (not the markup) from
`../nextjs-port`, clone a React Native template into `ui_git_repo/`, `cp` its
files in and adjust them *in place*, fixtures, the route, the gates, and the
device pass. Page list and order: `src/features/v2/dashboard/nav.ts`.
Worked example: `/v2/dashboard/bids`.

## Where the v2 work is tracked

- `Docs/V2_CHECKLIST.md` — the tick list, a **per-screen progress board**, and a
  "what I am waiting for" table. Update it as work lands; do not report progress only in chat.
- `Docs/V2_UI_SKILLS.md` — the design system's reasoning.
- Mistakes go in `../MISTAKES.md`, never in a daily update.

## Traps that cost time here

- **Dev builds hold a stale bundle.** A change that "did not work" on device is usually not
  loaded. Check `adb logcat | grep ReactNativeJS` for an actual error and confirm Metro
  rebuilt before editing code that is already correct.
- **A white screen on a dev build is a bundle still loading**, until logcat says otherwise.
  Wait before restarting.
- **RNGH does not reach inside a RN `<Modal>`** without its own `GestureHandlerRootView`.
  If one control in a modal works and the rest do not, compare which `Pressable` each imports.
- **Never put a `return` above a hook.** Gate the hook's input (`enabled`) or its result.
- The device is `BQCA9TNVEY4PSSSK`. Its display override is density 408 → **423dp**, so nothing
  here has been seen at 360dp; `wm density` is blocked by ColorOS (`WRITE_SECURE_SETTINGS`).
- ⚠️ **NEVER assume the Metro port — measure which one the device is on.** This row used to say
  *"Metro on 8082 (8081 is a Vite server)"*; on 2026-09-23 **both ports were Metro for this same
  app** (`curl :8081/status` and `:8082/status` each returned `packager-status:running`), and only
  **8082** had the device attached. Ports move whenever someone starts a second `expo start`.
  The positive check, before any bundle probe:
  `curl -s http://127.0.0.1:<port>/json/list` → the right port names
  `com.greenbidz.bridge (realme RMX2151)`; the wrong one returns `[]`.
  This matters because a freshness probe aimed at the unattached Metro returns a **fresh, green,
  entirely irrelevant** answer — it bundles the same source and tells you nothing about what the
  phone is running. (See `MISTAKES.md`, 2026-09-23.)
- **The dev scheme pill eats taps.** `SchemeToggleDev`'s floating magenta `SYS → LIGHT` control
  floats over the bottom-left of EVERY v2 screen and has now sat on top of three real controls
  (chat's camera/attach keys, 7e's "Go to Details", 7e's "Installed" chip). It swallows the touch
  silently, and `uiautomator` cannot see occlusion — the chip's bounds look clickable and the tap
  never arrives, which reads exactly like a dead control. **Long-press it to hide for the session**
  before any control-coverage pass, and assert `SYS →` is gone from the dump.
- **A control you cannot MEASURE is a control you cannot TAP.** `bounds="[0,0][0,0]"` or an
  inverted rect means the view tree does not know where it is — scroll it into view and re-measure,
  or dismiss the surface another way (deep link, BACK). Estimating a coordinate has twice mutated
  state that was not mine to change in one session: a draft's country (Albania) and the app's
  LANGUAGE (Vietnamese, which persists). After leaving any sheet that sets a persisted preference
  — language, currency, colour scheme — re-read the resulting state before moving on.
- **Parse `bounds=` specifically, and reject inverted rectangles.** `grep -o '[0-9]*'` over a
  uiautomator node also matches `index=`/`instance=`, which once produced a bogus tap target that
  silently changed a draft's country. Use
  `grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"'` and skip any rect where `x2<=x1` or
  `y2<=y1` (an inverted rect means the view is clipped by a fixed header/footer — scroll, do not tap).
- **Scroll from inside the body.** The review steps have a fixed header sheet AND a fixed footer;
  a swipe that starts on either does nothing, which looks like "the screen will not scroll".
- **Reset to a screen by DEEP LINK (`greenbridge://v2`), never by N × BACK.** Six BACK presses walk
  out of `/v2` into the old `(lab)/(tabs)` home, which also has a Home tab, a bell and draft cards —
  so the taps that follow land on the OLD UI while looking like v2.
