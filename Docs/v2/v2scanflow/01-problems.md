# 01 — Problems

Numbered so phases can reference them. Severity is about the seller, not the code. Every location
was read on 2026-09-23; `<VERIFY>` marks a claim taken from a comment or a report rather than a read.

## A. Structure — the flow does not connect

**P1. Valuation and Review & submit are unreachable from a scan.**
`valuation.tsx` is routed to from exactly one place, `items.tsx:314`; `submit.tsx` from exactly one,
`valuation.tsx:92`. `items.tsx` is reached only by resuming a saved draft
(`openMultiItemDraft.ts:28` ← `useResumeDraft`). A fresh scan goes `processing-v2 → detected.tsx →
reviewStepHref('photos')` (`detected.tsx:155,159,245`) and never sees either screen. Both screens
are built and both are orphaned from the path they exist for.

**P2. Two step-2 screens on two data models.** `detected.tsx` reads the store; `items.tsx` reads
the server draft (`00-current-structure.md` § data models). They render the same step, disagree on
what an item is, and cannot hand off to each other. Everything downstream inherits the split.

**P3. Publish publishes the store, whatever the screen shows.** `usePublishDraft.ts:174-178`
returns `queuedItems`/`[current]`. `submit.tsx:143` labels the CTA "Publish {{count}}" from **server**
rows. `items.tsx:304` hydrates the store from the accepted rows on Continue, so the happy path agrees
— but tapping any row on Valuation (`valuation.tsx:216`) or Submit (`submit.tsx:205`) calls
`openDetectedItem`, which **replaces the whole session with one item**
(`openDetectedItem.ts:169-171`: `mode:'single', current: row, queuedItems: []`). Inspect one row,
come back, press "Publish 5 Listing(s)" → publishes 1. Silent.

**P4. `analyzing.tsx` — the best waiting screen either platform has — is unreachable.** Only
inbound reference is its own `analyzing.tsx:732`. It watches `recognition-jobs` but cannot start one.

**P5. The non-skip detection branch still exits to the old flow.** `processing-v2` routes
`shouldSkipDetectionChoice() === false` (several products AND several images) to
`routes.scanDetection` — the old chooser — which continues into old `detail.tsx` /
`grouped-review.tsx`. A multi-photo, multi-product scan leaves v2 entirely.

**P6. `startV2Scan()` still opens the v2 camera.** `startV2Scan.ts:49` → `routes.v2Camera`. Its
callers are the empty states of `drafts.tsx:182` and `listings.tsx:156`. Home's "Scan it" was
repointed to intake; these two were not, so the same action has two destinations.

## B. The document lane

**P7. Spreadsheets cannot complete.** `applySmartDetection.ts:70` throws
`'No photos to apply smart detection to'` when the result carries no page-images. A PDF renders to
page-images and survives; row data (CSV/XLSX) yields none. **Tested on device with a CSV → died
here.** XLSX not tested on the phone — same lane, same expectation. The web reads the same
spreadsheet into 10 items (`../v2scanweb/xlsx-04-detected-grid.png`).

**P8. Photo-less rows can never publish.** `items.tsx:283` maps `photos = uri ? [...] : []` from
`thumbnail_object`; `usePublishDraft.ts:190` requires `photos.length > 0`. `items.tsx`'s own docblock
says a text-only spreadsheet row having no photo is the normal case. So even if P7 were fixed, every
photo-less row blocks at publish.

**P9. Error copy is photo-centric.** A documents-only failure reads *"We couldn't read your
photos"* / *"Retake photos"* (`../v2scan/06a-error-transient-fetch-failed.png`). The web has the
same tic: *"Uploading your photos 100%"* for a spreadsheet (`../v2scanweb/xlsx-02-uploading.png`).

**P10. Backend MIME accept-list is name-exact.** `officeDocs.js:46-47` + mime-only
`isOfficeDocMime()`. Worked around client-side; not fixed at the source (`00` § MIME).

## C. Screens that exist but are wrong

**P11. `items.tsx` calls hooks after an early return.** `if (!draftId) return …` at `:257-268`,
then `useV2Colors()` at `:270` and `useCallback` at `:277`. Identical shape to `app/scan/detail.tsx:117`
(`if (!draft) return null` above `useState`/`useEffect` at `:125-126`), which threw *"Rendered fewer
hooks than expected"* on the device on 2026-09-22.

**P12. `submit.tsx`'s recovery control is dead for a single item.** `firstIncompleteItem` sets
`itemIndex: items.length > 1 ? i : -1` (`usePublishDraft.ts:196`); `handleGoToStep` returns on
`itemIndex < 0` (`submit.tsx:114`). And its `step` argument is never used — "Go to Pricing" opens
Photos.

**P13. `valuation.tsx` and `submit.tsx` have no translations.** `mobile.scanv2.valuation.*` and
`mobile.scanv2.submit.*` exist in none of the six locales; every string is a `defaultValue`, which
`scanv2Keys.test.ts` forbids by name. Plus literals outside `t()`: `'Opening…'`, `'Submitting…'`,
`` `Go to ${…}` ``, `'Dismiss'`, `'PRODUCT'/'SCRAP'`, `MARKETPLACE_LABELS` (`submit.tsx:45-50`).

**P14. Back controls push instead of pop.** `valuation.tsx:124` and `submit.tsx:150` `router.push`
backwards; the stack grows and system-back walks duplicates.

**P15. `detected.tsx` is thin next to the web's step 2.** Per-row accept/discard and counts only. No
search, no bulk select, no Apply-to-selected, no "List N of M?" confirm. The web's spreadsheet run
needed Apply-to-selected to make 10 rows tractable (`../v2scanweb/xlsx-08`).

**P16. The dev scheme toggle intercepts the footer CTA.** `SchemeToggleDev` floats over the footer
and its hit area covers the left of the primary button; a press aimed at "Extract items" flipped
the theme (`../v2scan/05a-dev-pill-intercepts-cta.png`). Dev-only, but on every footer.

**P17. `PrimaryAction` was edited in-screen.** The disabled-state fix (`PrimaryAction.tsx`, colour
not opacity — 1.23:1 → 4.96:1 measured) is correct and is a **kit edit**, which `.claude/skills/
v2-screen` forbids. Needs reconciling in one hand, not landing from a screen task.

## D. The per-item editor (owner decision: rebuild)

**P18. Four screens per item.** `review/photos → details → pricing → location`, walked once per
item. For a 10-item lot that is 40 screens, with "Step N of 4" resetting each time
(`spine.ts:116-134` records the bar being wired and reverted for exactly this). The owner's call on
2026-09-23: it looks bad and is replaced, not patched.

## E. Web defects that will be inherited if copied blindly

Found while walking `/valuation` on prod; not mobile problems yet, but the port must not import them.

- **W1.** Bulk **Accept** in the selection toolbar does nothing — twice, two click methods, with
  every row complete. Per-row Accept works on the same rows (`../v2scanweb/README.md` § Run 2).
- **W2.** The sticky-footer "Extract items" at 390px reported enabled, clicked, and produced no
  request; the in-card copy fired `gcs/upload` + `analyze` (seen once).
- **W3.** Sticky footer overlaps item rows on Review & submit at 390px (`xlsx-12`).
- **W4.** An un-saved asking-price edit and a submit total of $18,500 that matched neither the
  input, the midpoint, nor the low band (`../v2scanweb/README.md` § 3). Not chased. `<VERIFY>`

---

## P19 — "or type the details" on v2 Home lands in the OLD flow (found 2026-09-23, pressed)

**Status: LIVE. Second confirmed door out of v2 into the shipped chrome.**

`SellingPane.tsx:245` and `startV2Scan.ts:91` both `router.push(routes.scanListingMethod)`
(`/scan/listing-method`). Pressed in the Expo web harness at 390×844: v2 Home → **"or type the
details"** → the old **"Listing method · Single item / Grouped submission"** screen.
Evidence: `Docs/v2/v2scan/web-harness/06-OLD-listing-method-from-v2-home.png`.

The existing `SellingPane.onTypeDetails` comment already admits it: *"TODO(v2-nav): the v2
manual-entry screen is not drawn; this hands off to the shipped listing-method picker."*

**Why it matters.** This is the same class of defect as the detection-chooser intercept (P18) that
produced the owner's repeated *"I still see the old screens"*. Fixing one door does not fix the
others — they have to be **enumerated**, which is what this entry is for.

### The full enumeration of old-flow exits reachable from v2 (2026-09-23)

| Route constant | Referenced from | Live? |
|---|---|---|
| `scanDetection` | `app/v2/scan/analyzing.tsx:707`, `:719` | **dead** — `analyzing.tsx` is unreachable (no router call, no route constant) and Phase 0 D1 says delete it. Would go live the moment anyone wires that screen. |
| `scanListingMethod` | `SellingPane.tsx:245`, `startV2Scan.ts:91` | **LIVE — P19, this entry** |
| `scanHome` | `processing-v2.tsx:671` | **not on this build** — guarded `IS_CUSTOMER ? homeRoute() : routes.scanHome`, and `IS_CUSTOMER` compiles to `true` here. Live for a seller-fork build. |
| `scanDetail`, `scanGroupedReview`, `scanDrafts`, `scanSuccess` | — | 0 references from the v2 path |
| `scanCamera` | `launchSellerScan.ts:43` | **LIVE, but out of v2** — the `(lab)` fork's only scan entry. See the entry-point finding in `MISTAKES.md` (2026-09-23). |

**Fix for P19 is not a one-liner** — it needs the v2 manual-entry screen drawn, which does not exist.
Until it does, the honest options are (a) draw it, or (b) route "type the details" into the intake's
own manual path. Not scoped to a phase yet; **assign before Phase 6 closes**, because Phase 6's exit
criterion is "zero `app/scan/*` references from v2 except the two allowed" and this is one of them.

**Standing rule this produced:** after changing any v2 exit, re-run the enumeration above rather than
checking the one route just edited. A rollout needs an enumerating test, not a spot check
(memory `reference_rollout_needs_enumerating_test`).
