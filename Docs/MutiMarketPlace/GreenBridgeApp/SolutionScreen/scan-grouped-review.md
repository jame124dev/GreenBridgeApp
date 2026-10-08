# Solutions — Review hub, multi-item (`app/scan/grouped-review.tsx`)

Answers [`../ProblemScreen/scan-grouped-review.md`](../ProblemScreen/scan-grouped-review.md).

> **Rewritten 2026-10-08.** The first version of this file planned a large fix — splitting the
> submit into one request per marketplace — for a problem that does not exist. The server already
> files each product by its own `allowed_sites`. What is left is much smaller. See `MISTAKES.md`.

---

## 1 Ordinary grouped submits — delete a comment, fix an email

No routing work. Two small things:

**Delete the false comment.** Above `submitGroupedListings.ts:172`:

> All items in a single grouped submit are assumed to share a marketplace (the grouped-review UI
> doesn't surface a per-item marketplace picker — sellers set marketplace once and items inherit).

Both halves are untrue: the UI does surface it (`grouped-edit.tsx:30`,
`grouped-review.tsx:266-267`), and nothing downstream assumes a shared marketplace. Replace it
with what `?type=` is actually for — the `platform` field of the admin notification at
`groupedListingSubmitService.js:670` — so the next reader is not misled the way this audit was.

**Make the notification honest.** For a mixed batch, `?type=` from `items[0]` makes the admin
email claim one marketplace for a batch that spanned several. Either send the set, or send nothing
and let the notification derive it per product. Internal-only and low priority, but it is a report
someone may act on.

---

## 2 Warn about a mixed **lot** before the upload, not after it

This is the real work on this screen.

A mixed lot is a hard 400 from the server
(`groupedListingSubmitService.js:459-468` — *"A combined lot must be a single marketplace; mixed
marketplaces detected"*), and today the seller learns it only after every photo has uploaded.

The app already knows each item's marketplace the entire time. So:

- when `groupMode === 'lot'` and the selected items span more than one marketplace, block submit
  on this screen, in the same place as the existing `blockedAllMarketplace` condition
  (`grouped-review.tsx:163`);
- name the offending items, not just the count — the seller has to know which one to change;
- say what a lot is, in one clause: *"A combined lot has to be one marketplace."*

Mirror the server's rule rather than inventing a parallel one — if the server's constraint ever
relaxes, this check should be the thing that changes, and it should be obvious that it mirrors
`groupedListingSubmitService.js`.

**Do not block ordinary grouped submits.** They are supported, and blocking them would remove
working behaviour to fix a problem that does not apply.

### Also check the failure path still works

`<VERIFY>` how this screen renders a 400 from submit — whether the server's specific sentence
reaches the seller or is swallowed by a generic failure message. Even with the pre-check above,
that path has to stay good: the pre-check can be bypassed by a stale state, and the server remains
the authority.

---

## 3 Resolve "needs a marketplace" from the hub

Unchanged from the original plan, and now the second-largest item here.

The single-write-path rule (`grouped-review.tsx:266-267`) is sound and should not be abandoned.
The fix is a shorter route to the existing path, not a second one: make the per-item status
*"Pick a marketplace"* tappable, deep-linking into that item's editor, and on save return to the
hub scrolled to the next unresolved item.

A batch of ten with three unrouted items then costs three taps instead of ten round trips.

---

## 4 One source for "what is missing"

Unchanged. `getRequiredStatus` is already described as the single source of truth for the
single-item screen; this screen computes its own strings (`blockedAllMarketplace`,
`statusMissingMarketplace`). Fold the marketplace condition into it — or a sibling both call — so
the checklist card and the progress chips cannot disagree.

If §2 lands, the mixed-lot rule belongs in the same place, for the same reason.

⚠️ Keep `missingRouting()` outside `detailSchema`. `marketplaceConfirmed` is a draft field and
invisible to `handleSubmit` — integration constraint **C4**. Any consolidation must preserve that
guard rather than replace it with a schema rule that cannot see the field.
