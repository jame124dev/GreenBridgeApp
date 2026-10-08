# Solutions per screen — multi-marketplace

One file per screen, mirroring [`../ProblemScreen/`](../ProblemScreen/README.md) filename for
filename. Each solution is numbered to match the problem it answers, so `scan-detail.md` §1 here
answers `scan-detail.md` §1 there.

Written 2026-10-08, against the problems found the same day. Nothing here has been implemented.

---

## Read this first: three facts that shape every solution below

**1. All of it ships OTA.** Every change proposed in this folder is JavaScript. The live iOS build
is 1.0.4 (25) on runtime `1.0.4` / channel `production`, `expo-updates` is installed with
`checkAutomatically: 'ON_LOAD'`, and `app.config.ts` still says `version: '1.0.4'` — so an
`eas update --channel production` reaches installed users with no build and no App Store
submission. ⚠️ Publish from a branch cut off the shipped commit `023715f7`, **not** this working
tree, which is 11,601 insertions ahead of it. Full detail in
[`../UPDATES.md`](../UPDATES.md) §2.

**2. One shared helper removes four problems at once.** Most marketplace defects below are the
same defect: *"what else must change when the marketplace changes?"* is answered independently at
three call sites, and they have already drifted. A single
`marketplaceChangePatch(next, { changed, currentCurrency, typedAmount })` in
`src/features/scanner/routing/routingState.ts` — which already exports
`CLEARED_CATEGORY_DRAFT_FIELDS`, `CLEARED_CATEGORY_FORM_FIELDS` and `routingPatchFromAi`, so it is
the right home — fixes `scan-detail` §1, `scan-grouped-edit` §1, and the standing duplication in
`v2-scan-review-photos` §4. Do this one first; several other items get smaller behind it.

**3. Some of these are not engineering decisions.** Marked **DECISION** where a product or
business answer is needed before code. Do not let an engineer pick these by default — that is how
the condition taxonomy got into its current state.

---

## Suggested order

| # | work | why here |
|---|---|---|
| 1 | The shared `marketplaceChangePatch` helper | unblocks three screens, smallest diff |
| 2 | [lab-chat](lab-chat.md) §1 — chat stops stamping 101lab | the one defect that mis-files live data |
| 3 | [scan-grouped-review](scan-grouped-review.md) §2 — warn about a mixed **lot** before upload | a 400 after every photo has uploaded |
| 4 | The silences: [scan-success](scan-success.md), [v2-drafts](v2-drafts.md), [scan-detection](scan-detection.md) | cheap, and they are how a wrong route gets noticed |
| 5 | [v2-scan-review-photos](v2-scan-review-photos.md) §2 — decide which flow is canonical | everything above costs double until this is settled |

§1 and §2 are a defensible first OTA on their own.

---

## Open questions that block work

| question | blocks | who answers |
|---|---|---|
| ~~When `?type=` and `allowed_sites` disagree, which wins?~~ | — | **ANSWERED 2026-10-08:** the product's own `allowed_sites` wins (`groupedListingSubmitService.js:180-186`, `:407`). `?type=` only feeds an admin email at `:670`. |
| Should condition options differ per marketplace? | scan-detail §4 | **DECISION** |
| Is "what do you have?" the storefront's catalogue or the federated one? | lab-chat §5 | **DECISION** |
| Which scan flow is canonical, legacy or v2? | all duplication | **DECISION** |

---

## Index

- [scan-detail.md](scan-detail.md)
- [scan-grouped-review.md](scan-grouped-review.md)
- [scan-grouped-edit.md](scan-grouped-edit.md)
- [scan-detection.md](scan-detection.md)
- [scan-success.md](scan-success.md)
- [v2-drafts.md](v2-drafts.md)
- [lab-chat.md](lab-chat.md)
- [v2-scan-review-photos.md](v2-scan-review-photos.md)
