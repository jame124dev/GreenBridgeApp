# The item-review form: what the research actually says

My own position on `app/scan/detail.tsx`, written 2026-10-07 after reading the
sources at the end rather than from instinct. Companion file:
`FORM_UX_PANEL.md` (three specialists' independent proposals).
Reference screens: `_refs/` (Vinted, Mercari, StockX — real shipped apps).

The trigger was a one-line verdict from the user: **"the form UI is so texty,
it looks weird."** Everything below is an attempt to say precisely why, and
which of the obvious fixes are actually supported.

---

## 0. The headline, before the detail

Our screen is a **form to be filled in**. Vinted's and Mercari's are **a list
of facts about the item**, most of which are already answered. That difference
is not decoration — it decides how much chrome each field needs. A question
needs a label, a marker and a box. A stated fact needs a row.

We photograph a nameplate and let an AI read it. That promise makes this a
confirmation screen. We then render it as a questionnaire.

---

## 1. Two things I got wrong, corrected by the sources

I am recording these first because the rest of the document is less useful if
the corrections are buried.

### 1.1 "Drop the asterisks" — wrong

Looking at Vinted and Mercari I concluded we should stop marking required
fields, because neither of them does. **NN/g says the opposite**, and gives
three reasons: users skip form instructions, they forget them on long forms,
and without per-field marking they guess — *"phone number, they don't really
need that, do they?"* — and fail at submit. The recommendation is explicit:
mark required fields, use an asterisk, make it red and high-contrast.

The references are not a counter-example, they are a different case. Vinted
and Mercari ask for almost nothing optional, so marking everything would mark
nothing. **Our form mixes seven required fields with several genuinely
optional ones** (Year, Brand, Model, the whole "More details" group). That mix
is exactly the condition NN/g's advice is for.

So: the asterisks stay. What was wrong was HOW we drew them — the entire label
turned red, so `PRICE *` shouted error while the checklist below reported
Price as satisfied. Red was carrying "required" and "missing" at once. Fixed
on 2026-10-07: the label stays muted, only the asterisk is red. That is
closer to NN/g than either the old version or my proposed removal.

### 1.2 "ALL-CAPS labels hurt readability" — overstated

The 13–20% reading-speed penalty for all-caps is real but it is measured on
**passages**. NN/g's glanceable-fonts work found that for one or two words
glanced in isolation — which is exactly what a field label is — all-caps
performs about the same as larger lowercase.

So caps is not the legibility problem I claimed. The actual cost is
**cumulative weight**: twelve letterspaced caps labels stacked down a page,
each as visually loud as the value beside it. The fix is emphasis, not case —
lower the contrast and weight so the label recedes behind the answer. Going
sentence case is still defensible for consistency with the v2 kit, but it
should be argued on consistency, not on legibility.

---

## 2. What is actually wrong, ranked

### 2.1 Eight bordered cards doing the work of two dividers

Every field group sits in its own white rounded rectangle with a 1px border.
Stacked, they read as eight equally-important things and none of them groups
with any other.

Mercari uses a grey spacer band with a plain sentence-case heading —
"Details", "Delivery" — and then full-bleed white rows. One divider replaces a
border. GOV.UK's question-pages pattern independently arrives at the same
place: when you do group questions, **use a statement as the heading and style
the labels for scannability**.

This is the single highest-value change and it is presentation only — no
logic, no new fields, no backend.

### 2.2 The label is louder than the answer

`BRAND` in letterspaced caps above `Keithley` in body text. The scaffolding
out-weighs the content. Every reference screen inverts this: grey recessive
label, black prominent value.

### 2.3 A multi-line control for a single-value answer

Condition is five wrapped chips over four lines to capture one choice.
Mercari's equivalent is one row: `Condition    Like new  ›`. Our own Category
field already uses that pattern (`Not set — pick a category   Choose ›`), so
the screen is internally inconsistent as well as tall.

Caveat: chips show the available options without a tap, which has real value
for a seller who does not know the vocabulary. Worth a decision, not an
assumption — and note the taxonomy problem below is tangled with it.

### 2.4 "Condition" contains things that are not conditions

*New*, *Used — functional*, *For parts* are conditions. *Waste disposal* and
*Demolition / removal* are disposal routes. Three independent reviewers
flagged this unprompted. It is a data decision, not a label one — these are
first-class values consumed by the scanner, the chat edit sheet, the gap
filler and the backend — so it needs a product call, not a UI patch.

### 2.5 The progress bar says nothing

A thin green bar above the footer with no number. GOV.UK: avoid elaborate
progress indicators, but a simple **"Question 3 of 9"** counter is fine and
useful. We already compute the number — the removed checklist card said
"REQUIRED: 4 OF 7 DONE". Putting `4 of 7` beside the bar makes the always-
visible footer self-sufficient, which is why the buried card could go.

### 2.6 Price is the one place to ADD, and we subtracted

I removed the empty "No price estimate" card today, which was right — the
honest answer to having no number is silence, not a card announcing silence.
But StockX shows what should be there instead: **"Highest Bid: $254 | Lowest
Ask: $266"** directly above the input, then a fee breakdown to "Total Payout".
Price is the field the seller is least equipped to get right and the one that
most determines whether the listing sells. Comps need a sold-listings query
we do not have; that is the most valuable backend ask on this screen.

---

## 3. What NOT to change, and why

- **One long page.** GOV.UK's default is one question per page, and for a
  government service filled in once that is right. A motivated seller listing
  equipment wants one scroll, which is why no marketplace in `_refs/` splits
  it. Keep the single page; spend the effort on grouping within it.
- **Submit enabled while incomplete.** Verified on a device: pressing it
  alerts *"Some fields are missing — Please add: DESCRIPTION, CATEGORY,
  CONDITION"*. A flat grey disabled button with no reason given was the dead
  end this replaced. Leave it.
- **The sticky footer with the keyboard open.** Measured on an SM-G781B: the
  footer hides itself, the focused field stays fully visible with its label,
  and there is a clear gap to the keyboard. I had flagged a collision; the
  measurement disproved it.
- **Labels above fields.** Already correct, and placeholders are examples
  rather than substitutes for labels — the failure mode NN/g warns about.

---

## 4. If I could make three changes

1. **Replace the eight bordered cards with two or three grey-banded sections**
   with sentence-case statement headings. Presentation only. This is the
   change that answers "texty".
2. **Demote the labels** — lower contrast and weight — so the value reads
   first. Pairs with (1) and costs almost nothing.
3. **Put `4 of 7` on the footer progress bar.** One string, and it makes the
   always-visible bar tell the whole truth.

Everything else on this screen is either a product decision (the Condition
taxonomy, price comps, serial/calibration fields) or already correct.

---

## Sources

- Nielsen Norman Group — [Marking Required Fields in Forms](https://www.nngroup.com/articles/required-fields/)
- Nielsen Norman Group — [Glanceable Fonts](https://www.nngroup.com/articles/glanceable-fonts/)
- GOV.UK Design System — [Question pages pattern](https://design-system.service.gov.uk/patterns/question-pages/)
- LogRocket — [How casing letters enhances visual hierarchy](https://blog.logrocket.com/ux-design/casing-letters-enhances-visual-hierarchy)
- Reference screens in `_refs/` via [Page Flows](https://pageflows.com/): Vinted, Mercari, StockX
