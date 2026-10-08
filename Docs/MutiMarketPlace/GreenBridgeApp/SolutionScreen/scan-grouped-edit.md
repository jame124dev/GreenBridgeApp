# Solutions — Item editor, multi-item (`app/scan/grouped-edit.tsx`)

Answers [`../ProblemScreen/scan-grouped-edit.md`](../ProblemScreen/scan-grouped-edit.md).

---

## 1 Currency — the same shared helper

Replace the `CLEARED_CATEGORY_DRAFT_FIELDS` spread at `grouped-edit.tsx:296` with the
`marketplaceChangePatch()` call defined in
[`scan-detail.md`](scan-detail.md) §1. No screen-specific logic; that is the point of the helper.

Worth doing in the same commit as the detail-screen change, because the value of the helper is
that the two cannot drift again, and a helper used by one caller does not deliver that.

---

## 2 Commit the marketplace when it is picked, not at Save

Today `form.watch('marketplace')` and `queuedItems[index].marketplace` disagree between change and
Save (`grouped-edit.tsx:92-98`), and every reader on the screen has to know which is authoritative.

**Recommended: commit immediately.** The v2 twin already does exactly this and says why —
`photos.tsx:466`:

> Device-local only — Zustand + MMKV, no endpoint. Picking a marketplace is a discrete tap with no
> blur to wait for, so it commits at once.

That reasoning applies here unchanged: a marketplace is a discrete tap, not a text field awaiting
blur, so there is nothing to buffer. `patchQueuedItem` is already the write path this screen uses
on Save.

Doing so collapses problems §2, §3 and most of §5 into nothing, because form and store stop
disagreeing.

### Keep the guard that the comment is protecting

The existing `useLabCategories(form.watch('marketplace'))` read must stay correct through the
change. Once the store commits immediately the two agree, but **do not** switch that line back to
a store read as "cleanup" in the same commit — if commit-on-pick is ever reverted, the store read
silently lands `categoryName: null` and drops `category_name` from the payload. Leave the form
read and leave the comment explaining it.

Also preserve the ordering constraint already noted there: `useForm` must stay above that line.

---

## 3 Leaving without saving

Resolved by §2. Once the marketplace commits on pick, backing out — or being bounced by the
`if (!item) router.replace(...)` guard at `:102` — no longer loses the answer.

If §2 is rejected, the fallback is an unsaved-changes prompt on back, which is more code and worse
UX than committing a single discrete value.

---

## 4 Say the category was cleared

Same treatment as [`scan-detail.md`](scan-detail.md) §3 — a transient line in the Category row
naming the new marketplace. The seller is more likely to need it here, because they may be
returning to an item they categorised in an earlier session.

---

## 5 Show that this item differs from its siblings

This screen should say which way the item is going relative to the rest of the batch:
*"3 other items in this batch go to 101LAB"* beside the marketplace control.

For an ordinary grouped submit that is informational — mixed batches file correctly. In **lot**
mode it is the warning that prevents the seller from creating a state the server will reject with
a 400 ([`scan-grouped-review.md`](scan-grouped-review.md) §2). Setting a different marketplace
here is the action that creates it, so here is where it should be said — not two screens later,
after the upload.
