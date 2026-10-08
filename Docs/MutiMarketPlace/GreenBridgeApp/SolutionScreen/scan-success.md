# Solutions — Submitted / success (`app/scan/success.tsx`)

Answers [`../ProblemScreen/scan-success.md`](../ProblemScreen/scan-success.md).

The cheapest screen in this folder to fix, and the one that turns a silent mis-route into a
noticed one.

---

## 1 Name the marketplace

The screen already echoes details back — condition via `CONDITION_LABELS` (`success.tsx:74`) and
the price format (`:80`). Add the marketplace to that set, labelled from `MARKETPLACE_OPTIONS`.

Take the value from **what was submitted** — the per-product `allowed_sites` the payload actually
carried (`buildFormData.ts:264`), which is also what the server files on
(`groupedListingSubmitService.js:180-186`). Reading the draft would show the seller what they
chose; reading the payload shows what happened, which is what makes this screen a check rather
than a repetition.

Ignore `?type=` here. It is not the routing value — it only feeds an admin notification
(`groupedListingSubmitService.js:670`) — and echoing it would report the wrong marketplace for
exactly the mixed batches this screen most needs to get right.

---

## 2 This is the catch for a wrong route

No extra work beyond §1 — it is the reason §1 matters.

Routing is right about 89% of the time, confirmation happens **before** submit against the AI's
guess, and the chip is absent entirely when the allow-list has one entry
([`scan-detail.md`](../ProblemScreen/scan-detail.md) §2). So for a meaningful share of listings
this screen is the first and last place the seller could see where the item actually went.

Worth stating the marketplace prominently rather than as a detail line, for that reason.

---

## 3 Per-item outcome for a batch

`headingMulti` reports *"{{count}} items submitted"* and nothing else.

Minimum: when a batch spans more than one marketplace, break the count down —
*"4 items submitted · 3 to 101LAB, 1 to 101IT"*.

This is the one place the app can show that multi-marketplace routing worked. A mixed batch files
each product correctly (`groupedListingSubmitService.js:180-186`), and today the seller is told
only that N items went somewhere. Breaking the count down turns an invisible success into a
visible one — and, when the AI routed something wrongly, into a visible mistake.

The breakdown is derivable from the payload the app already built; it needs no extra response
data.

---

## 4 A way to reach what was created

`<VERIFY>` whether the screen already links to the created listing(s) — not examined.

If it does not, add it, and make the link marketplace-correct: each of the three marketplaces is a
different public site, so "view your listing" has to resolve against the marketplace the item
actually went to, not the build's own site. `marketplaceToPlatform()` (`constants.ts:129`) maps the
key to the backend platform value; the public URL per marketplace is a separate mapping that
`<VERIFY>` may not exist in the app yet.

Without this, confirming where an item landed means leaving the app and finding it manually — and
with §1 showing a marketplace name the seller did not expect, that is exactly what they will want
to do next.
