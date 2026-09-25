# Phase 4 — The item editor: one mobile-native sheet

**Goal.** Replace the four-screen wizard (Photos · Details · Pricing · Location) with one screen
that edits one item, tells the seller exactly what is still missing, and returns them to the step
they came from. Designed for a thumb, under `UX_DESIGN_RULES.md` and `.claude/skills/v2-screen`.

**Fixes:** P18, and closes P3 by removing `openDetectedItem`. **Depends on:** Phase 1 (rows are
server items with a `draftId`), Phase 3 (the `Needs:` predicate it shares).

## Owner's brief (2026-09-23)

> "Per-item editing current looks bad — we make new for mobile as per mobile UX/UI."

Not the four screens kept. Not the web's drawer copied. One screen, the phone's shape.

## What it must carry

Everything both surfaces already show for one item, in this order (top = what the seller checks
first; bottom = what they decide last):

1. **Head** — title (editable), `1 of N`, close. For N = 1 this screen IS step 2+3 (the collapse):
   head reads *"Review your listing — The scan found one item. Check what it read, then continue."*
2. **Photos** — cover, horizontal strip, reorder, remove, **ADD** → shipped camera / picker (this
   replaces `v2CameraAppend`; the v2 camera can then go).
3. **Item details** — title · brand · model · category → subcategory · year · quantity. Every
   AI-filled field carries the "AI" chip (`Chip tone="accent"` — both surfaces do this).
4. **Condition & handling** — condition · **installed / removed** · operation status. These two are
   what blocked all 10 web rows; they sit above the fold of this section.
5. **Where it is** — location · country · "Use my location".
6. **Worth** — market band · scrap floor · **asking price** with **"Use market price (X)"** (the web's
   one-tap; mobile lacks it) · "Priced within market" when true. Only what the payload has — no
   invented basis/demand (`AiResult`, `scanDraftStore.ts:49-95`).
7. **Footer, sticky** — live line **"N more to publish: Location, Operation status"** (the web's; it
   is the best copy in the flow) · **Accept & next** (primary) · **Done**. When complete: the line
   becomes "Ready to list".

## Rules that bite on exactly this screen

- **Keyboard.** The footer must not cover the field being typed into — measure with the keyboard
  open on the LAST field (CLAUDE.md records the v2 signup shipping with exactly this bug after a
  9-of-9 control pass). `Screen keyboard` + `onLayout`-measured offset; never a hard-coded one.
- **One primary.** Accept & next is the one green pill. Done is `QuietAction`.
- **Long titles.** AI titles run past 90 characters; `minWidth: 0` on the text column.
- **Both schemes** on device before "done".
- **Kit gaps → report, don't edit the kit.** Likely gaps: a segmented control for condition, a
  bottom-sheet primitive for Apply-to-selected / category picker, a money field. List them with
  the code; do not fork `PrimaryAction` again (P17).

## Data

Reads and writes the **server item** (`/drafts/:id/items/:itemId`, optimistic-concurrency token per
`draftItemsApi.ts:166` comment — `<VERIFY>` the per-field patch endpoint exists; `items.tsx` today
only changes status via the bulk route). Local edits buffer in component state and flush on Done /
Accept & next / blur, the way the web's drawer autosaves (~800 ms, 409 reconcile —
`ScanV2ReviewGrid.tsx` docblock). No `hydrateFromServer`, no store clobber.

## Navigation

Reached from a row tap on `items.tsx`, `valuation.tsx`, `submit.tsx`, each passing `draftId` +
`itemId` + `returnTo`. **Accept & next** → next `needs_review` item (Phase 0 D4). **Done** → back to
`returnTo` with the list refetched (invalidate the `['draftItems', draftId]` query — and assert it,
this is the stale-landing trap).

## Remove

`app/v2/scan/review/photos.tsx`, `details.tsx`, `pricing.tsx`, `location.tsx`, `_layout.tsx` ·
`review/wizardState.ts` · the step chrome in `review/reviewKit.tsx` (keep any primitives the editor
reuses) · `review/spine.ts`'s per-item progress helper · `openDetectedItem.ts` ·
`app/v2/scan/camera.tsx` and `routes.v2Camera` / `v2CameraAppend` (once ADD uses the shipped camera) ·
their tests, and the `v2Inventory` rows.

The **valuation "worth" block** from the retired `detected.tsx` moves here (section 6). The Profit
Intelligence maths in `pricing.tsx` (`formatTier`, scrap → profit) moves to a pure module and is
reused.

## Acceptance — device, dev DB

1. From `items.tsx` (10-row lot) tap the KUBOTA row → editor opens with photo, AI fields, chips.
2. Type a location on the **last** field with the keyboard open → the field is visible above the
   footer (screenshot with keyboard up).
3. Footer reads "2 more to publish: …" → set installed + operation status → reads "Ready to list".
4. **Accept & next** → the Labomed row (the next `needs_review`), not the next in order.
5. **Done** → back on `items.tsx`, the KUBOTA row now `Accepted`, counts updated **without a manual
   refresh**.
6. Single-PDF scan → lands directly on this screen in collapse mode with the worth block →
   Continue → `submit.tsx`.
7. ADD → shipped camera → capture → back in the editor with the new photo in the strip.
8. `grep -rn "review/photos\|v2CameraAppend\|openDetectedItem" app src` → 0.

## Exit criteria

All eight above screenshotted (both schemes) into `Docs/v2/v2scan/phase-4/`; KIT GAP list filed;
`tsc` clean; `jest` green with the wizard tests removed and an enumerating test for the editor's
sections added.
