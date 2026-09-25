# Phase 6 — Remove the old flow and close the loop

**Goal.** Nothing in the scan path renders old chrome, no screen is orphaned, no route leads
anywhere the plan does not name, and the guards enumerate exactly what is live.

**Fixes:** P4, P5 (rest), P16, P17. **Depends on:** Phases 1–5 all green on device.

## Remove

| What | Why it can go now |
|---|---|
| `app/scan/detail.tsx` (`:117` hooks bug) | no route reaches it once `processing-v2` exits only to `items.tsx` |
| `app/scan/grouped-review.tsx` | same |
| `app/scan/detection.tsx` (chooser) | Phase 0 D2 — either ported as a sheet in Phase 1 or dropped for "merge" |
| `app/scan/processing.tsx` (flag-off twin of `-v2`) | `EXPO_PUBLIC_SMART_DETECT_V2=1` has been the only tested path; if the flag is retired, so is this — **confirm with the owner first**, the flag exists for a reason |
| `app/v2/scan/analyzing.tsx` — **or** wire it | Phase 0 D1. If wired, it replaces `processing-v2`'s chrome; if not, delete. An orphan is not an option |
| `routes.scanDetail`, `scanGroupedReview`, `scanDetection`, `v2Detected`, `v2Camera`, `v2CameraAppend` | no callers after Phases 1 and 4 — prove with grep, cite the grep in the commit |
| `src/features/scanner/routing/*` used only by the old chooser | `<VERIFY>` nothing in Browse/Matches imports it |
| `useDetailController.ts`, `grouped-review` helpers | old-screen-only — `<VERIFY>` |

Every deletion: `grep -rn "<name>" app src` → 0 **before** the `rm`, pasted into the PR.

## Fix

1. **`SchemeToggleDev` must not sit on the footer** (P16). Move it to the top-left under the status
   bar, or give it `pointerEvents` that do not cover the CTA. Measure: tap the CTA's left third on
   three footered screens → the CTA fires, not the toggle.
2. **`PrimaryAction` reconciliation** (P17, Phase 0 D5): land the disabled-state fix as a kit change
   in its own commit with the two measurements (1.23:1 → 4.96:1) in the message, or revert and hand
   it to the kit owner. Not both.
3. **`spine.ts`** — with the wizard gone, `V2_SINGLE_ITEM_SPINE` is `capture → reviewItem` and
   `V2_BATCH_SPINE` is `capture → items → valuation → review`; relabel `capture` → `intake`
   (its i18n key already says so). Remove `v2ReviewProgress` and its unreached-branch history.
4. **Docs**: `Docs/v2/WEB-PARITY.md`, `V2_CHECKLIST.md`, `STATUS.md`, `TRAPS.md` updated to the new
   structure; `todo/SCANV2_V2UI_REBUILD_WORKORDER.md` §2A ("THE FLOW IS NOT CONNECTED") marked
   closed with the phase that closed it.

## Guards that must pass, and what they prove

| Test | Proves |
|---|---|
| `src/__tests__/v2Inventory.test.ts` | the screen list is exactly: intake, items, valuation, submit, item (editor), published, and analyzing iff D1 = wire |
| `src/__tests__/v2Adherence.test.ts` | no raw hex/type/palette on any new screen |
| `src/__tests__/v2MaterialCoverage.test.ts` | every filled ground ramps or says `flat:` |
| `src/__tests__/v2Contrast.test.ts` | ramps contrast correctly |
| `src/i18n/__tests__/scanv2Keys.test.ts` | every block on every screen in all six locales |
| new `src/features/v2/scan/__tests__/routes.test.ts` | **no file under `app/v2/scan/` imports or routes to `app/scan/*` except `camera` and `processing-v2`**; no route constant in `routes.ts` is unreferenced |
| `npx tsc --noEmit` | 0 |

## Acceptance — the whole flow, once, on device, both schemes, dev DB

Walk `Docs/v2/v2scan/README.md`'s table again and re-capture it as `Docs/v2/v2scan/final/`:
Home → Intake → (photo | PDF | xlsx) → Analyzing → Detected → (Valuation) → Review & submit →
Published → My listings showing the new batch. Three runs, three fixtures. Every control on every
screen pressed at least once (the rule: N controls, N presses). Then the Chanel step from
`v2-screen`: look once more and remove one thing.

## Exit criteria

All guards green · three device walks captured · zero `app/scan/*` references from v2 except the two
allowed · `MISTAKES.md` has an entry for anything that surprised you on the way — the same turn it
surfaced, not at the end.
