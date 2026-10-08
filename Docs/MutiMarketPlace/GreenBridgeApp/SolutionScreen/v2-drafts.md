# Solutions — My inventory (`app/v2/drafts.tsx`)

Answers [`../ProblemScreen/v2-drafts.md`](../ProblemScreen/v2-drafts.md).

---

## 1 Show the marketplace on each row

The value is on the draft already; the row simply does not render it. Label it from
`MARKETPLACE_OPTIONS` (`constants.ts:49-58`).

Place it with the existing source label ("AI Draft" / "Manual Draft") rather than adding a new
line — that row is already dense, and the two are the same kind of fact: where this came from,
where it is going.

**Marketplace logos exist** (`src/features/scanner/marketplaceLogos.ts`, with per-marketplace
aspect ratios and brand colours) if a mark reads better than a word at row scale. Check the
rendered size against the icon scale in `components/detail/metrics.ts` before using them — a logo
is not an icon and will not sit on that four-step scale.

### The honest edge case

A draft whose marketplace was never confirmed should not render as "101LAB". That is the default,
not an answer, and showing it as a fact is what hides the problem in
[`../ProblemScreen/scan-detail.md`](../ProblemScreen/scan-detail.md) §2. Render unconfirmed as
*"Marketplace not set"* — which doubles as the fix for §3 below.

---

## 2 Filter by marketplace

Only worth building once §1 shows a seller there is something to filter.

Do **not** add a second row of tabs — the screen already partitions by status and a second
dimension of tabs is how that becomes unreadable. The existing search field is the cheaper home:
make marketplace names searchable, so typing "101it" narrows the list.

If a real filter is wanted later, a single dropdown beside the search is the pattern this app
already uses elsewhere; a tab row is not.

---

## 3 Readiness must include the routing question

`<VERIFY> first` — establish whether `useDraftReadiness` already treats an unconfirmed
marketplace as incomplete. It may; it was not checked.

If it does not, it must. `missingRouting()` is what blocks the single-item submit path, and it
exists **because** `marketplaceConfirmed` is a draft field invisible to `detailSchema` /
`handleSubmit` — integration constraint **C4**. A readiness check built on the schema alone
therefore cannot see it, and a row would read "ready" for an item whose marketplace was never
answered.

That matters more here than anywhere else, because submit-from-row is the one path that lists an
item **without opening it**. It removes the last place a seller could notice a wrong route, so it
must not also be the one path that skips the routing gate.

Pin it with a test using a real `pending-ai` payload that has no `marketplaceConfirmed`, asserting
the row classifies as incomplete rather than ready.

---

## 4 Counts stay as they are

No change recommended. The per-tab counts are about status and are already careful to show a count
only when it is the whole count (`drafts.tsx:134`).

The useful marketplace signal is not a count on a tab, it is §1 — seeing at a glance that nine of
your ten drafts say 101LAB when you have been scanning IT hardware all morning.

---

## 5 Discarded rows get the same treatment free

Once §1 renders the marketplace on a row, the Discarded tab inherits it — no separate work.

Worth confirming it actually appears there, since discard is one-way (`drafts.tsx:248`) and the
tab is easy to leave out of a test pass.
