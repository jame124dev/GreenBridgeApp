# Working on one screen — the whole loop, in order

Hand this file to a session and say: **"Work `<screen>` through `SCREEN-WORKFLOW.md`."**
Nothing else should be needed.

It exists because the work itself is fast and the *rounds* are slow. Every step
below is here because skipping it cost a round.

---

## THE HARD GATE — read before anything else

**You may not add anything the design did not already ask for.**

Allowed without asking:
- Fixing a value that violates a rule in this folder, with the rule cited.
- Fixing something **measured** to be wrong on the device.
- **Removing** an element that is dead, duplicated, or lying about what it does.

Needs the user's word first, every time:
- New copy, new text, a reworded label.
- A new section, card, row, badge, empty state or illustration.
- A new feature, or wiring a control that currently does nothing.
- Anything that needs an endpoint that does not exist yet.
- Any change to what the screen *says* rather than how it *sits*.

If the fresh-eyes review (Step 6) proposes a new thing — and it will, that is its
job — that is a **proposal to relay**, not work to do. Write it down, hand it to
the user, stop. Do not build it because it sounded good.

> The failure this prevents: a screen comes back with three invented features, a
> rewritten headline and a new empty state, and now nobody can tell which change
> fixed the actual problem.

**And never report a fix you have not measured.** "Improved the spacing" is not
a result. "74.0dp → 23.9dp, same nodes, measured twice" is.

---

## Step 0 · Load context (5 min)

```
Skill: v2-screen                  # tokens, primitives, the 5 RN traps, DoD
Docs/UIUXRuleSet/README.md        # which rules win
```

Read the ruleset file matching what you are about to touch — don't read all six.

---

## Step 1 · Run the objective gates FIRST

Cheapest signal available. Do this before opening the screen.

```bash
npx tsc --noEmit
npx jest src/__tests__/v2Adherence.test.ts src/__tests__/v2Contrast.test.ts
```

`v2Adherence` fails on raw hex, raw type properties, direct palette imports,
function-form styles and off-scale radius/spacing. `v2Contrast` fails on colour
pairings below ratio.

**If these are green, the mechanical rules are already satisfied** — and your
problem is composition, hierarchy or measurement. Do not go hunting for raw
hexes; the test already did.

---

## Step 2 · Get the device into a clean, known state

Do all four. Each one has produced a wrong conclusion when skipped.

```bash
adb devices -l                                   # device present?
curl -s http://localhost:8082/status             # packager-status:running
adb reverse tcp:8081 tcp:8082
adb reverse tcp:8082 tcp:8082                    # BOTH. See TRAPS.
adb shell wm density                             # derive dp factor: 160/<density>
```

- **Both reverses.** The dev client's saved server is `http://localhost:8082`;
  with only the 8081 mapping it fails with nothing but *"There was a problem
  loading the project."*
- **Derive the dp factor, never hardcode it.** At density 408, `dp = px × 0.3922`.
- **Hide the dev scheme pill** (long-press it) before any screenshot or tap
  sweep. It has eaten taps four times and it sits on top of real controls.
- **Know which scheme you are in.** The pill's `content-desc` says so.

---

## Step 3 · MEASURE the screen. Do not look at it and guess.

```bash
adb shell uiautomator dump /sdcard/s.xml
adb pull /sdcard/s.xml ./s.xml
```

Then extract `bounds="[x1,y1][x2,y2]"` per element and convert to dp.

**Three rules that decide whether your numbers mean anything:**

1. **Compare like with like.** A text node's box and its clickable ancestor's
   box are different things. Measuring one before a change and the other after
   will tell you a fix made things worse when it did not. *This happened twice
   in one session.* Write down which node type you used.
2. **Measure box-to-box for layout, not text-to-text.** Text-to-text includes
   both components' internal padding and will overstate a gap by 2–3×.
3. **`[0,0][0,0]` means the element is not laid out — it cannot be tapped.**
   Scroll it into view and re-dump.

**What to pull out, every time:**

| Check | How |
|---|---|
| Left rail | every element's `x1` — they should all be `GUTTER` (24dp), or gutter + `CARD_PAD` (42) inside a card |
| Vertical gaps | `y1(next) − y2(prev)`, box-to-box. Flag anything that is not a token |
| Touch targets | every `clickable="true"` node, width × height in dp. **< 44 is a finding** |
| Target spacing | gap between adjacent targets. `hitSlop` is invisible — two slops can overlap and a tap in the overlap is ambiguous |

---

## Step 4 · Fix only what a rule or a measurement justifies

For each change, you must be able to say one of:

- *"`spacing-and-layout.md` R2 — internal (34) was larger than external (24)."*
- *"Measured 38.9 × 41.3dp against the 44 minimum in `touch-targets.md` R1."*

If you cannot cite one, it is a **proposal**, not a fix. See the hard gate.

**Editing rules, both learned expensively:**
- **Never edit source with a script.** Use Edit, once per file, even for the
  same change across files. Offset arithmetic has duplicated 90 lines of a
  shipped screen while printing "success".
- **Prefer the coarse end of the spacing scale.** `3xl`(16) and up between
  distinct elements; `xxs`–`xl` (2–12) only *inside* a component.

---

## Step 5 · Re-measure, and force a fresh bundle when state is involved

```bash
# after the edit
adb shell uiautomator dump /sdcard/s2.xml && adb pull /sdcard/s2.xml ./s2.xml
```

**⚠️ Fast Refresh does not re-run `useState` initialisers.** If your change
touches initial state, a prop read once at mount, or anything seeded on first
render, Fast Refresh will show **no effect** and you will conclude the fix
failed. It did not. Force a cold start:

```bash
adb shell am force-stop com.greenbidz.bridge
adb shell monkey -p com.greenbidz.bridge -c android.intent.category.LAUNCHER 1
# then tap the saved http://localhost:8082 entry in the dev launcher
```

Same trap in reverse: **after a break-test**, restoring the file on disk does
**not** restore the bundle on the phone. Force the reload before believing a
"broken" result.

State the before and after numbers, same node type, in your report.

---

## Step 6 · Fresh-eyes review — no context

Only once Steps 1–5 are done. Reviewing a screen you have not measured wastes
the review on things you could have found yourself.

**Capture cleanly:** correct scheme, dev pill hidden, the real state a user
lands in (usually guest).

Then spawn **one** agent with the image path and **nothing else** — no design
system, no token names, no "we just fixed X", no repo access. Any context you
leak is a finding you will not get.

Ask it for: first impression, visual hierarchy, spacing rhythm, typography,
balance/dead space, the single weakest thing, and anything that looks
unfinished or accidental. Tell it to be blunt and to rank by damage.

---

## Step 7 · Audit the review before acting on it — it WILL be partly wrong

Do not implement the review. Check it first. Typical hit rate: big calls right,
specifics wrong.

For each point, decide and say which:

| Verdict | Meaning |
|---|---|
| **Confirmed** | it matches a measurement or a code fact — cite it |
| **Right, wrong reason** | the symptom is real, the stated cause is false — fix the symptom |
| **Wrong** | check before dismissing. It cannot see the code |
| **Blocked** | correct, but needs something that does not exist yet (an endpoint, an asset) |
| **Proposal** | a new feature or new copy → hand to the user, do not build |

Real examples from the first run of this loop:
- *Confirmed:* "~116px of empty space above the banner eyebrow" — independently measured at 56.5dp.
- *Right, wrong reason:* "the helper link is the same size as the subhead" — it is 12/500 vs 13/400. The affordance point still stood.
- *Wrong:* "the panel is inset 4px" — that was the 34pt corner radius.
- *Blocked:* "show recently sold equipment" — there is no native listings endpoint; that is why Browse is a WebView.

---

## Step 8 · Loop, with a stop condition

Repeat 4 → 7 until the review returns **no P1s** (nothing that changes what a
person does or misleads them). Two rounds is normal. Three means the screen has
a design problem that tuning will not fix — **stop and say so** rather than
grinding.

---

## Definition of done

1. `tsc` clean; `v2Adherence`, `v2Contrast` green; full `npx jest` with no new failures.
2. Every change has a cited rule or a before/after measurement.
3. Every control on the screen **pressed** on the device — not screenshotted. Not
   one, not the easiest. (A sign-in sheet once shipped "verified" with all three
   buttons dead.)
4. Checked in **both** schemes. This design carries its structure in hairlines
   and washes, which are exactly what stop working when the ground changes.
5. Long/empty cases: longest real title (AI titles run past 90 characters),
   missing image, zero items, and the guest state.
6. Fresh-eyes review returns no P1s.
7. The report separates **fixed** (with numbers) from **proposed** (needing a
   decision) from **blocked** (needing something that does not exist).

---

## The report format

Keep it to this. It is what makes a round cheap to read.

```
FIXED      <what> — <before> → <after>, measured. Rule: <file> R<n>.
PROPOSED   <what the review suggested> — needs your call, not built.
BLOCKED    <what> — needs <the missing thing>.
WRONG      <what the review claimed> — actually <fact>, checked at <file:line>.
```

Never write "improved", "cleaned up", "polished" or "better". Numbers or a rule
citation, or it did not happen.
