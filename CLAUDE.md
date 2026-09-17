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
- Evidence beats prose. A measured number, a screenshot, a grep — those are the value.
  Confident tone is not: four claims were stated confidently and wrongly in one day.

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
- The device is `BQCA9TNVEY4PSSSK`, Metro on **8082** (8081 is a Vite server). Its display
  override is density 408 → **423dp**, so nothing here has been seen at 360dp; `wm density`
  is blocked by ColorOS (`WRITE_SECURE_SETTINGS`).
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
