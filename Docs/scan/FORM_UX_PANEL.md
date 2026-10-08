# The item-review form: three specialists, adjudicated

Three reviewers were shown screenshots of `app/scan/detail.tsx` and the three
reference apps in `_refs/`, with no access to the codebase and no knowledge of
each other. 2026-10-07. Companion file: `FORM_UX_RESEARCH.md` (my own position,
with sources).

Panel: an **interaction designer** (layout, density, controls), a **content
designer** (language), an **accessibility specialist** (WCAG 2.2 AA).

> **Read the adjudication column, not just the finding.** Four of their items
> are artefacts of the screenshots they were given, and one contradicts the
> research. Those are marked and explained — they are not deletions, because a
> reader should be able to see what was claimed and why it did not survive.

---

## A. Where all three independently agreed

These carry the most weight: three people, three lenses, no contact.

| Finding | Who | Status |
|---|---|---|
| **Everything has the same visual weight.** Eight identical bordered cards; the four fields that block submission look exactly like the four the AI already finished. | Interaction, Content | **Accepted.** Matches my own reading and Mercari's grey-band structure. |
| **"Condition" holds two different questions.** `New / Used / For parts` is condition; `Waste disposal / Demolition` is a transaction type. | Interaction, Content, *and both earlier reviewers* | **Accepted as a product decision.** Five reviewers now. Blocked on a data call — these values are consumed by the scanner, chat edit sheet, gap filler and backend. |
| **The choose-one control is expressed six different ways** — chevron row (Category), 5 wrapping pills (Condition), 2-pill segment (Price mode), pills (Currency), segment (Installation), stepper (Quantity). | Interaction, A11y | **Accepted.** The strongest single observation in the panel. Our own Category row already uses the pattern the others should adopt. |
| **The AI badge explains nothing.** Two letters cannot carry "a machine wrote this and your name is on it." | Content, A11y | **Accepted.** Note the badge is now truthful (it only shows on unedited AI text) but still unexplained. |

---

## B. Accepted — new, and actionable without a product decision

**B1. The footer is a growing, reflowing block.** It wraps from one pill row to
two as fields are completed, moving the Submit button under the seller's
thumb. The interaction designer wants a fixed-height footer: progress bar,
`Save for later`, and `Submit listing · 4 left` opening a sheet. *(Interaction
#1, its pick for "do this first".)*

**B2. The bottom inset is hardcoded against a footer that changes height.**
`detail.tsx` reserves 132pt on the stated assumption the footer is "~112pt
(progress strip + two buttons)" — but the strip grows a second pill row. The
a11y reviewer saw the Currency chips sliced. `FORM_INPUT_RULES.md` already
forbids exactly this: *measure the footer with `onLayout`, never hardcode.*
**Needs a measurement on a device, then a fix.**

**B3. "Deinstalled" is not standard English.** Uninstalled / de-installed /
removed. It has no clean JA or TH equivalent and translators have already
guessed. Proposed: `Still installed` / `Already removed`. *(Content.)*
Touches `constants.ts` plus six locale files.

**B4. Required fields have no legend.** Six asterisks and nowhere does the
screen say `* Required`. *(A11y #8, Content §3.)* Cheap: one line, or set the
required state programmatically and drop the reliance on the glyph.

**B5. The empty Description has no placeholder.** The largest input on the
screen is a blank rectangle. Vinted anchors its equivalent with *"e.g. only
worn a few times, true to size"*. Proposed: *"Hours used, calibration status,
what's included (cables, probes, manuals), any faults."* *(Content.)*

**B6. Selection is signalled by fill colour alone** on four segmented
controls, with no check glyph and probably no radiogroup semantics — so a
screen-reader user cannot hear what they chose or that a choice is required.
*(A11y #5.)*

**B7. Nothing says what happens after the button.** Does "Submit listing" go
live instantly or queue for review? For used industrial equipment that is the
seller's real question. *(Content §4.)*

**B8. `25/80`, `0/500`, `1/1` are bare fractions** with no unit, which are the
hardest strings to localise and ambiguous next to a price field. *(Content.)*

**B9. Non-text contrast on borders, dashed drop zones and the progress track**
looks below 3:1, and placeholder text carrying real state (`Not set — pick a
category`) below 4.5:1. *(A11y #6, #7.)* **Needs measuring, not eyeballing.**

---

## C. Fixed during the review

| Finding | Action |
|---|---|
| **Double arrow on the primary button** — the label string ended in `→` *and* the button renders an arrow icon, so it read `→ Submit listing →` in all six languages. *(Content.)* | **Fixed.** Arrow removed from the string in all six locales; the icon stays. |

---

## D. Rejected, with the reason

**D1. "Delete the red asterisks." (Content §3)**
Rejected on the research. NN/g is explicit: mark required fields, asterisk,
red, high-contrast — because users skip instructions, forget them on long
forms, and otherwise guess and fail at submit. Vinted and Mercari omit them
because almost nothing on their forms is optional; ours mixes seven required
with several optional. The reviewer's real complaint — *"it adds a red mark to
fields that are already filled correctly, which teaches the seller to ignore
red"* — was valid and is already fixed: the label is now muted and only the
asterisk is red. Their other point, the missing legend, is accepted as **B4**.

**D2. "The floating gear covers the Choose chevron and the quantity stepper."
(Interaction #2, A11y #3)**
Not shipping. That is the Expo dev-client menu button, present only in
development builds. Both reviewers were right about what they saw; it does not
exist for a seller.

**D3. "Make offer is selected yet PRICE still shows as missing." (Interaction
#8)**
Artefact of the screenshot set I supplied, which mixed two states. In the
Make-offer screenshot there are three chips and no PRICE; the PRICE chip
appears only in the Buy-now screenshot, where the amount really is empty. The
behaviour is correct.

**D4. "Required labels render red in one screenshot and grey in another."
(A11y #1)**
Both are ours, taken an hour apart, either side of the fix that stopped the
whole label turning red. The underlying criticism — colour as the sole carrier
of "needs attention" — still stands and is accepted as part of **B6**; the
specific inconsistency is already resolved.

**D5. "A sliver of another card implies a horizontal pager with no position
indicator." (A11y #11)**
**Unverified either way.** There is something at the left edge in all three
screenshots. I have not confirmed whether it is a sibling page, a scroll
indicator or a rendering artefact. Do not act on this until someone looks.

---

## E. If you only do three things

The panel's own picks, reconciled with `FORM_UX_RESEARCH.md`:

1. **De-card the layout** — grey section bands with sentence-case headings
   replacing eight bordered cards (my pick, and the interaction designer's #5).
   Presentation only: no logic, no fields, no backend.
2. **One picker idiom** — make Condition, Currency and Installation
   label-value-chevron rows like Category already is (interaction #3). This is
   what actually shortens the form, and it fixes the a11y radiogroup problem by
   removing the chip rows entirely.
3. **Real per-field error text with programmatic required/invalid state, and
   focus moved to the first bad field on submit** (a11y's #1 pick). Today the
   whole completion loop is carried by red hue and a modal.

The interaction designer's own first pick was the fixed-height footer (**B1**).
I would put it fourth: it is cheap and correct, but it treats a symptom of the
form being too long, and items 1–2 shorten the form itself.

---

## F. Deliberately not in scope

Price comps (needs a sold-listings query), AI category suggestion (`AiResult`
has no category field), and serial / calibration / what's-included fields
(new schema + backend). All three were raised by earlier reviewers too. They
are the most valuable things on the list and none of them is a UI change.
