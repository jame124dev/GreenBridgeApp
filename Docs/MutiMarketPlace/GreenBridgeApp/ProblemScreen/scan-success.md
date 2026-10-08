# Screen: Submitted / success — `app/scan/success.tsx`

The confirmation after a listing or batch is submitted. Problems below are **multi-marketplace
only**. No fixes.

---

## 1 ⛔ Never says which marketplace the item went to

`app/scan/success.tsx` contains **zero** references to `marketplace` or `MARKETPLACE_OPTIONS` —
verified by grep, count 0.

What it does show (`:103-115`): a heading, either `mobile.success.heading` or
`headingMulti` — *"{{count}} items submitted"* — and a caption. It also echoes the **condition**
(`:74`, `CONDITION_LABELS`) and the price format (`:80`, `mobile.success.makeOffer`). So the screen
is willing to confirm details back to the seller; marketplace is simply not among them.

This is the last screen in the flow and the only moment where the routing decision could be
confirmed as a fact rather than a prediction. A seller who was asked "which marketplace?" earlier
is never told what the answer ended up being.

---

## 2 It is the only place a wrong route could be caught, and it is silent

Routing is right roughly 89% of the time, which is why the flow asks for confirmation. But
confirmation happens **before** submit, against the AI's guess. After submit the item is live on
whichever marketplace the payload named.

Because this screen names no marketplace, a seller who confirmed the wrong one — or who never saw
the chip at all, because the allow-list had one entry (see [scan-detail.md](scan-detail.md) §2) —
has no signal here that anything is off. The error surfaces later, if at all, when the listing does
not appear where they expected.

---

## 3 For a batch it cannot report a per-item outcome at all

`headingMulti` reports a count — *"{{count}} items submitted"* — and nothing per item.

A mixed batch files correctly per product ([scan-grouped-review.md](scan-grouped-review.md) §1),
so for once the data is right — but the seller is told nothing about it. They set 101IT on one of
four items, all four went where they should, and the screen reports only that 4 items were
submitted. The one case where the app got multi-marketplace routing right end to end is also the
one it never reports.

---

## 4 No way to reach what was just created, on any marketplace

`<VERIFY>` — not examined in this pass: whether the screen offers a link to the created
listing(s). If it does not, then combined with §1 there is no path from here to confirming where
the item landed, and the seller must go to the marketplace site to find out.
