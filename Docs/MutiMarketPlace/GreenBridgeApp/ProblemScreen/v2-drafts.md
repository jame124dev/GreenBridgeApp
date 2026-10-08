# Screen: My inventory — `app/v2/drafts.tsx`

The seller's private list of saved items, with tabs for in-inventory / listed / discarded. Walked
on the device 2026-10-08. Problems below are **multi-marketplace only**. No fixes.

---

## 1 ⛔ A row never shows which marketplace the draft is for

`app/v2/drafts.tsx` contains **zero** references to `marketplace` or `MARKETPLACE_OPTIONS` —
verified by grep, count 0.

Observed on the device: each row shows a photo slot, a source label ("AI Draft" / "Manual Draft"),
the title, an age ("3h"), a delete affordance and a resume hint. Nothing about destination.

Once a seller can list on three marketplaces, "which of these is going to 101IT?" is a question
the inventory cannot answer. The marketplace is on the draft — it is what `RoutingChip` wrote and
what submit will use — it is simply not rendered.

---

## 2 No way to filter or group by marketplace

The tabs partition by **status** (in inventory / listed / discarded) and there is a text search
over titles. There is no marketplace dimension.

A seller who keeps stock for more than one marketplace has no way to see "everything I have for
101MACHINE", which is the natural way to work a mixed inventory. For a seller with a long list the
only route is to open items one at a time.

---

## 3 Submit-from-row commits a marketplace the row never displayed

The row carries its own submit action, and readiness is computed up front
(`useDraftReadiness.ts`) so the row can say whether the item is ready to go.

That means a seller can send an item for listing **without opening it**, and therefore without
ever seeing which marketplace it will go to. For the 1-in-9 of items the AI routed wrongly, this
path removes the last opportunity to notice before the listing exists.

Readiness is computed from the required-field set. `<VERIFY>` whether an unset or unconfirmed
marketplace makes a row "incomplete" rather than "ready" — `missingRouting()` guards the
single-item submit path, but whether the row's readiness check consults the same rule was not
established in this pass. If it does not, a row can read "ready" and submit an item whose
marketplace was never confirmed.

---

## 4 Per-tab counts say nothing about spread across marketplaces

The tabs carry counts ("In my inventory 8 · Listed 0 · Discarded 1") and the code is careful that
*"a count is only shown when it is the whole count"* (`drafts.tsx:134`).

That care is about pagination honesty, not marketplaces. The number tells a seller how much they
have, never how it is distributed — so the screen cannot surface the thing most likely to be wrong
in a multi-marketplace inventory, which is a pile of items all sitting on the default marketplace
because the chip never appeared (see [scan-detail.md](scan-detail.md) §2).

---

## 5 Discarded items keep their marketplace invisibly

Discard is one-way (`drafts.tsx:248` — *"IT IS ONE-WAY FROM HERE. `PUT /drafts/:id` explicitly
refuses to change …"*) and discarded items are retained rather than deleted.

Since no row shows a marketplace, the Discarded tab is a list of items whose destination is
unknowable from the UI. If discards are ever reviewed — for recovery, or to understand what
sellers abandon — the marketplace dimension is not recoverable without opening each one.
