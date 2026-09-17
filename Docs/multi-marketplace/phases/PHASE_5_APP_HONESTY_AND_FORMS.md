# Phase 5 — App: stop overclaiming, and make the form completable

**Date:** 2026-08-18 · **Status:** ready to implement · **Target release:** app **1.0.4** (store binary, NOT an OTA)
**Implements:** `MULTI_MARKETPLACE_PLAN.md` §7 Stage 1 tasks **M-5, M-7, M-8, M-9, M-10, M-11**
**Repo:** `c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp` (Expo / React Native). **No backend file is touched.**

Everything below was opened and re-checked on 2026-08-18 against the working tree at app commit
`11ef609` (`git log --oneline -1`). Where the approved plan's `file:line` had drifted, the correct
reference is given here and listed in §2.2.

---

## 1. What this phase is, in one paragraph

Two independent problems, both in the single-item scan editor, both made worse by the marketplace
unlock that lands in the sibling phases:

1. **The profit card overclaims.** It shows a fabricated `$12,500 / $4,200 / 33%` when the AI returns
   no price tiers, and when the AI *does* return tiers it renders a percentage that hits a 999 display
   cap in 63% of real responses. It also derives its "AI-suggested marketplace" from the seller's own
   marketplace choice, which becomes circular the moment the marketplace is AI-driven. (**M-5**)
2. **The form can block on a field the seller cannot see.** `detailSchema` gates Submit on 14
   unconditionally-required fields; the checklist surfaces 7 rows and maps only 6 of them, so a draft
   that fails on `operationStatus` (which has no UI anywhere in the editor) shows **every visible row
   green with Submit greyed out and no explanation**. Plus the checklist that explains the gate is the
   last card of a ~3,200 px scroll while the CTA is pinned in the footer, the single-item editor's
   `handleSubmit` has no `onInvalid`, and the footer sits behind the keyboard for much of the editing
   session. (**M-7, M-8, M-9, M-11**)

Plus one small piece of groundwork the marketplace sheet (M-3, another phase) consumes: per-marketplace
one-line descriptions and the AI badge on the category label (**M-10**).

**Nothing in this phase requires production access.** Every server call it makes is a read against
**dev** (`https://testapi.greenbidz.com`). No listing is submitted, published or deleted.

---

## 2. Read first, and how to re-verify before you start

### 2.1 Source of truth

| Document | What you need from it |
|---|---|
| `../MULTI_MARKETPLACE_PLAN.md` | §1 item 3 (why M-5 is a blocker), §6.3 (what of the review-screen restructure lands in v1), §7 Stage 1 (the task table), §8.2 (1.0.4, **no OTA while 1.0.3 is in review**), §9 (what is deliberately out) |
| `../SCAN_FLOW_BACKEND.md` | §3 (`:333-424`) — where the scrap number comes from: `ProfitIntelligenceCard.deriveFigures` computes `percent = round(profitMid / scrapMid × 100)` capped at 999; **median 999 over 72 runs, 45/72 (63%) capped** (`:389`); 100% of scrap figures are model guesses (`:352-355`) |
| `../SCAN_FLOW_UX.md` | §6.2 (`:368-380`) the keyboard/CTA structural claim, §7 P1-1 / P1-5, and the honest note at `:74-76` that the keyboard coverage is **inferred from structure, not observed** |
| `c:/Users/Pc/Desktop/greenBridge/UX_DESIGN_RULES.md` | Mandatory. The rules this phase is judged against: one dominant action, sticky progress+validation on long forms, adaptive UI, no invented information, feedback on every action, error recovery, empty states |

Where the two audits disagree, `MULTI_MARKETPLACE_PLAN.md` §10 wins.

### 2.2 Citation drift found on 2026-08-18 (use these, not the plan's)

All M-5 references in the plan are exact. These are off:

| Cited in the brief / plan | Actually | Note |
|---|---|---|
| "`detailSchema` has **22 fields** (`schema.ts:20-114`)" | The object literal has **26 keys**; **14** are unconditionally required, **3** more (`pricePerUnit`, `parentCategoryId`, `customSubcategory`) are conditionally required by the `superRefine` at `schema.ts:62-114` | The line range is right; the count is not. Counted key by key at `schema.ts:21,22,23,26,31,32,33,34,35,36,37,38,39,44,45,47,48,49,50,51,52,54,55,57,58,61` |
| `grouped-edit.tsx:130-161` (the `onInvalid` to copy) | `onInvalid` is **`grouped-edit.tsx:127-160`**; its field-label map is `:84-96`; the photos guard in `onValid` is `:105-117`; the wiring `const onSave = form.handleSubmit(onValid, onInvalid)` is **`:162`** | The cited range starts inside the function body |
| `grouped-review.tsx:355-401` (footer to mirror) | Footer block is **`:355-423`**: progress track `:360-368`, ready counter `:381-404`, `SellerApprovalNotice` `:408`, CTA `:413-421` | |
| `DetailFooter.tsx:112-121` (M-8) | The Submit `FooterButton` is **`:114-122`**; `:108-113` is its comment. The disabled predicate the brief means is `DetailFooter.tsx:117` — that one is correct | |
| `grouped-edit.tsx:263` (M-11 footer) | The footer wrapper `View` is **`grouped-edit.tsx:233-296`**; `:263` is a line inside the CTA's inline `style` object | |
| `constants.ts:41-48` (`MARKETPLACE_OPTIONS`) | Declaration starts **`:40`**, entries `:44-47`, closes `:48`. Its type is `{ value; label }[]` — **no `description` field today**, so M-10 must widen the type, not just the data | |
| `requiredStatus.ts:42-61` "maps only 6" | Correct: 7 `case` labels collapse to **6 row keys** (`locations` and `locationCountries` both → `location`) | No drift |

**Reviewer spot-check 2026-08-18 (independent, 20+ references opened):** every correction in the table
above is right, and the "exact" list below re-confirmed. Three further off-by-a-few cites, all cosmetic,
corrected in place in §7/§8: `tailwind.config.js:91` for `font-label` → **`:92`**;
`FooterButton.tsx:39-44` → the `isDisabled` predicate is **`:38`** and the flat grey `#d4d8df` is
**`:41`** (the cited range does contain it); `grouped-edit.tsx:149-159` for the `setFocus` block →
**`:152-159`**. Independently reproduced: `npx tsc --noEmit` exit 0 / no output; `npx jest --silent` =
**92 suites / 825 tests / 22 snapshots**, all passing, with the same worker-teardown warning; all six
locale CRLF counts (5290 / 5262 / 5262 / 5195 / 5179 / 5280), `dups=['close']` in all six, and the
`"profitIntelligence":` anchor unique at en:3805 zh-Hans:3791 zh-Hant:3791 ja:3726 th:3710 vi:3807.

Exact and re-confirmed today: `ProfitIntelligenceCard.tsx:18-20`, `:64-118`, `:154-158`, `:303-308` ·
`requiredStatus.ts:11-19`, `:42-61`, `:128-137` · `useDetailController.ts:94`, `:136`, `:144`, `:152` ·
`DetailFooter.tsx:117` · `FooterButton.tsx:39-44` · `CategoryConditionCard.tsx:203` ·
`FieldLabel.tsx:28-33` · `MarketplaceCard.tsx:22` · `app/_layout.tsx:176` · `app/scan/detail.tsx:127`
(`IdentityCard`), `:139` (`RequiredChecklist`, last card), `:144` (`DetailFooter`).

### 2.3 Re-verify before you edit (the tree may have moved)

Run this first. If a line differs from the "expect" column, find the new one — do not edit blind.

```bash
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
git log --oneline -1                                   # expect 11ef609 (or newer — see below)
grep -n "STATIC_SCRAP_BASELINE_USD\|STATIC_PROFIT_PERCENT\|STATIC_SUGGESTED_MARKETPLACE" src/features/scanner/components/detail/ProfitIntelligenceCard.tsx   # expect :18 :20 :23
grep -n "percent: Math.min(rawPct, 999)" src/features/scanner/components/detail/ProfitIntelligenceCard.tsx   # expect :97
grep -n "profitInsight" src/features/scanner/components/detail/ProfitIntelligenceCard.tsx                    # expect :303
grep -n "export const REQUIRED_ROWS\|function rowForPath\|const allComplete" src/features/scanner/requiredStatus.ts  # expect :11 :42 :137
grep -n "handleSubmit(" src/features/scanner/components/detail/useDetailController.ts                        # expect :94 :136 :144 :152
grep -n "disabled={!allRequired && canPublish}" src/features/scanner/components/detail/DetailFooter.tsx      # expect :117
grep -n "RequiredChecklist\|<DetailFooter\|KeyboardAwareScrollView" app/scan/detail.tsx                      # expect :139 / :144 / :115,:140
grep -n "MARKETPLACE_LOCKED" src/features/scanner/components/detail/MarketplaceCard.tsx                      # expect :22 (= true) and :29
grep -n "form.handleSubmit(onValid, onInvalid)" app/scan/grouped-edit.tsx                                    # expect :162
grep -rn "KeyboardStickyView" src app                                                                        # expect: no matches
```

If `git log` shows something newer than `11ef609`, someone landed app work: re-run those greps and
re-read the hunks in §7 before editing. Nothing in this phase depends on backend `main`, so the backend
churn (Buy Now orders, DHL shipments, reseller storefronts) cannot affect it.

---

## 3. Environment: dev only, and put `.env` back

`.env` line 1 currently reads `GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1`
(**production**). Point it at dev for the whole of this work and restore it when you finish. `.env` is
gitignored (`.gitignore:34`), so git will not protect you — an earlier session left this file on a
localhost URL and it had to be recovered from a backup. Do these four steps literally.

**E1 — back it up, outside the repo:**
```bash
cp c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/.env \
   "C:/Users/Pc/AppData/Local/Temp/claude/env.prod.backup.$(date +%Y%m%d%H%M%S)"
```

**E2 — point at dev.** Edit line 1 only, leaving every other line untouched:
```
GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1
```

**E3 — prove the bundle will carry dev** (this resolves `app.config.ts` + `.env` exactly as Metro will):
```bash
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp && npx expo config --type public | grep GREENBIDZ_API_URL
# expect: GREENBIDZ_API_URL: 'https://testapi.greenbidz.com/api/v1'
curl -s -o /dev/null -w "%{http_code}\n" "https://testapi.greenbidz.com/api/v1/product/category?lang=en"
# expect: 200   (checked read-only on 2026-08-18)
```
`GREENBIDZ_API_URL` reaches the app through `app.config.ts:255` → `extra` → `src/api/greenbidzClient.ts:19`,
so the value is baked at bundle time: **restart Metro** after changing it (CI-mode Metro does not
hot-reload — see §3.1).

**E4 — restore at the end, and prove it:**
```bash
cp "C:/Users/Pc/AppData/Local/Temp/claude/env.prod.backup.<stamp>" c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/.env
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp && npx expo config --type public | grep GREENBIDZ_API_URL
# expect: GREENBIDZ_API_URL: 'https://api.101recycle.greenbidz.com/api/v1'
```

**Hard rules for this phase:** no `git commit` / `push` / branch switch / `stash` / `reset` / `clean`
(sibling trees hold other agents' uncommitted work); **no `eas update` of any kind** — 1.0.3 is in App
Review (build 19) and `runtimeVersion` is `appVersion` (`app.config.ts:34`, `:90-92`), so an OTA would
land on the very build Apple is testing; no production write; no publish/submit from the app on any
endpoint. Do not touch `greenbidz-ai-assistant/`.

### 3.1 Emulator recipe (used by S1 and by the final device pass)

```bash
# boot — the -dns-server flags are load-bearing: without them hostname resolution silently breaks
# and every API call fails in a way that looks like an auth bug
"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd pixel_7_api_34 -no-snapshot-save -gpu auto -dns-server 8.8.8.8,8.8.4.4 &
adb wait-for-device shell 'while [ -z "$(getprop sys.boot_completed)" ]; do sleep 2; done'
# Metro — CI=1 avoids the watcher crash; CI-mode Metro does NOT hot-reload, so restart it after edits
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp && CI=1 npx expo start --dev-client --clear &
MSYS_NO_PATHCONV=1 adb reverse tcp:8081 tcp:8081
MSYS_NO_PATHCONV=1 adb shell am start -a android.intent.action.VIEW \
  -d "greenbridge://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
# read state / screenshots
MSYS_NO_PATHCONV=1 adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml > ui.xml
adb exec-out screencap -p > shot.png
```

Reaching the editor: this build is the **customer fork** (`.env: EXPO_PUBLIC_USER_TYPE=customer`), so
the scan flow starts from the lab home's photo/attach buttons (`app/(lab)/(tabs)/home.tsx:130`, `:139`
→ `launchSellerScan()` → `routes.scanCamera`). Take **one** photo: the single-item path skips the
detection screen (`smartDetectionRouting.ts:19-28`) and lands on `app/scan/detail.tsx`. Deep-linking
`greenbridge://scan/detail` does **not** work from a cold store — `useDetailController` bounces to home
(`useDetailController.ts:58-62`). `adb input tap` is dropped ~half the time on this emulator; read state
from the `uiautomator` dump (RN `Pressable`s expose `accessibilityLabel` as `content-desc` plus exact
`bounds`) and tap bounds centres.

---

## 4. File structure

### 4.1 Created (8 files)

| File | Responsibility |
|---|---|
| `src/features/scanner/requiredRowLabels.ts` | `useRequiredRowLabel()` — the single place a `RequiredRowKey` becomes a translated field name. Extracted verbatim from the switch inside `HubRow` (`app/scan/grouped-review.tsx:542-567`) so the hub chip, the new footer chips and the new invalid-submit alert never name a field two different ways. |
| `src/features/scanner/components/detail/RequiredProgressStrip.tsx` | The sticky strip: 4 px completion track + one tappable chip per still-missing field. Returns `null` when nothing is missing. Pure props (no form context) so it also works in a footer that sits outside `FormProvider`. |
| `src/features/scanner/components/detail/useRowScroller.ts` | `scrollRef` / `registerRow(key)` / `scrollToRow(key)` — the scroll-to-card plumbing shared by the strip chips (M-8) and the invalid-submit alert (M-9). |
| `src/features/scanner/__tests__/requiredStatusGap.test.ts` | M-7: proves the invisible-required-field gap, then locks it shut (every schema-required path is either a checklist row or a guaranteed-valid default). |
| `src/features/scanner/components/detail/__tests__/ProfitIntelligenceCard.test.tsx` | M-5: no stub numbers, no percent sentence, honest empty state, disclaimer present, no marketplace name. |
| `src/features/scanner/components/detail/__tests__/RequiredProgressStrip.test.tsx` | M-8: chips name the missing rows and fire `onPressRow`; renders nothing when complete. |
| `src/i18n/__tests__/phase5Keys.test.ts` | The 7 new keys exist in all six locales and are actually translated (not English) in the five non-English ones. |
| `src/i18n/_phase5_keys.py` | The **text-mode** locale editor for the 7 new keys × 6 files. Never uses `json.load`/`json.dump`: a round-trip deletes the duplicate `close` key (`en.json:4298` and `:4313`, both inside `mobile.labCommon` — present in all six files, verified today) and rewrites CRLF → LF. Two earlier attempts corrupted the files exactly that way. Sits beside the existing precedent `src/i18n/_seed_keys.py`. |

### 4.2 Modified (16 files + 6 locale JSONs)

| File | Change | Task |
|---|---|---|
| `src/features/scanner/components/detail/ProfitIntelligenceCard.tsx` | delete the static stub, the percent sentence and the circular marketplace derivation; add an honest empty state + the "AI estimate" disclaimer | M-5 |
| `src/features/scanner/mapAnalyze.ts` (`:57`), `mapSmartDetection.ts` (`:113-116`), `smartDetectionTypes.ts` (`:126-130`), `src/stores/scanDraftStore.ts` (`:163-167`, `:257-262`, `:320-323`) | comment-only: six sites still promise "the card falls back to its static stub" | M-5 |
| `src/features/scanner/components/detail/formMapping.ts` | `draftToFormValues` becomes the coercion seam: every schema-required field without a checklist row gets a guaranteed-valid value | M-7 |
| `src/features/scanner/requiredStatus.ts` | delete the duplicated `draftToFormInput`; map `parentCategoryId` + `customSubcategory` to the `category` row; export `rowForPath` | M-7 |
| `app/scan/grouped-review.tsx` | `HubRow` uses `useRequiredRowLabel()` instead of its private switch (behaviour identical) | M-7/M-8 |
| `src/features/scanner/components/detail/DetailFooter.tsx` | split wrapper/row so the strip can live above the buttons; new optional `required` + `onPressRow`; single-mode Submit stops being greyed out with no reason | M-8/M-9 |
| `app/scan/detail.tsx` | scroll ref + per-card `onLayout` registration; pass strip props; wrap notice+footer in `KeyboardStickyView` | M-8/M-11 |
| `src/features/scanner/components/detail/useDetailController.ts` | `onInvalid` on all four `handleSubmit` calls + a zero-photos guard on the single-submit valid path | M-9 |
| `src/features/scanner/constants.ts` | `MARKETPLACE_OPTIONS` gains `description` | M-10 |
| `src/features/scanner/components/detail/MarketplaceCard.tsx` | render the selected marketplace's description (mirrors `LocationCard.tsx:320-327`) | M-10 |
| `src/features/scanner/components/detail/CategoryConditionCard.tsx` (`:203`) | AI badge on the category label | M-10 |
| `app/scan/grouped-edit.tsx` | wrap the footer in `KeyboardStickyView` | M-11 |
| `src/features/scanner/components/detail/index.ts` | barrel: export the two new modules | M-8 |
| `src/i18n/locales/{en,zh-Hans,zh-Hant,ja,th,vi}.json` | +7 keys each (3 profit-card, 4 marketplace descriptions) | M-5/M-10 |

### 4.3 Explicitly NOT modified

`src/features/scanner/schema.ts` — no schema change is needed and none is wanted (plan §3: `marketplace`
already accepts all four) · `MarketplaceCard.tsx:22` `MARKETPLACE_LOCKED` — that flip is **M-4**, a
different phase · `RequiredChecklist.tsx` — stays exactly where it is (§5.4) · anything under
`101recycle-greenbidz-backend/` or `greenbidz-ai-assistant/`.

---

## 5. Design decisions — settled, do not re-litigate mid-implementation

**5.1 The profit card keeps both money ranges and loses the percentage.** Plan §11 decision 4: keep the
range, label it "AI estimate — verify before publishing", drop the percent until the scrap figure is
grounded. Grounding the scrap value needs a price feed and is its own project (plan §9) — do not attempt
it here.

**5.2 `operationStatus` gets a default, not a checklist row.** It has no control anywhere in the scan
editor (the only writers are `emptyDraft` `scanDraftStore.ts:229`, `manualEntryDefaults`
`constants.ts:143` and the AI mappers) **and it is never submitted** — `buildFormData` derives
`operation_status[]` from `installation` instead (`buildFormData.ts:185-187`, `:263`). A checklist row
pointing at a field with no control and no wire presence is a dead end. Same reasoning for
`listingDurationDays` (deliberately has no UI, `schema.ts:59-61`).

**5.3 `parentCategoryId` / `customSubcategory` get a row mapping, not a default.** These *are*
user-reachable: choose "Other (type brand)" in `CategoryConditionCard` and leave the brand box empty and
`schema.ts:74-92` blocks Submit on two paths `rowForPath` currently maps to `null`. They belong to the
existing `category` row.

**5.4 `RequiredChecklist` stays in the scroll.** The UX audit's P1-1 wanted it *moved* into the footer
(−460 px). This phase adds the strip and keeps the card, because they are different objects: the card is
a per-field **review summary with values** ("Titanium mixer", "USD 4500", "Taipei, Taiwan") at the end
of the scroll; the strip is an always-visible **gate indicator + jump navigation**. Neither is a control,
so `UX_DESIGN_RULES.md` → "Remove duplication" is not violated — and to stop the same *copy* appearing
twice the strip carries **no header text** (the bar is the progress, the chips are the names). Moving or
deleting the card belongs to the ten-cards→three-steps restructure that plan §9 defers.

**5.5 The strip goes in `detail.tsx` only.** `grouped-edit.tsx` keeps its checklist card and its
existing named-fields alert, and its flow already has a footer-level progress summary one screen up
(`grouped-review.tsx:355-423`). Adding the strip there would also force a `form.watch()` subscription
onto that screen (a per-keystroke re-render of ten cards) for no new information. M-11 still touches both
editors.

**5.6 M-9 un-disables the single-mode Submit; the grouped-mode buttons keep their disabled state.**
Today `disabled={!allRequired && canPublish}` (`DetailFooter.tsx:117`) gives an approved seller with one
missing field a flat grey `#d4d8df` button and no reason (`FooterButton.tsx:39-44`) — and it means the
`onInvalid` this task adds could never fire for them, because the press never happens. The pattern the
brief tells us to copy is `grouped-edit.tsx`, whose Save CTA is **never** disabled (`:243-246` hardcode
`loading = false; disabled = false;`) and relies entirely on `onInvalid`. So: single-mode Submit is
disabled only while `submitting`; validity is still enforced by `detailSchema` inside `handleSubmit`
(which cannot be bypassed) plus an explicit zero-photos guard, exactly as `grouped-edit.tsx:105-117`
does. The grouped-mode "Review group" / "Add another" buttons keep `disabled={!allRequired}` — out of
scope, and the strip now names what is missing directly above them.

**5.8 (reviewer addition 2026-08-18) One line of S4 repairs a field that *does* own a row — on purpose.**
S4's rule is "fields WITH a checklist row are deliberately NOT repaired here", but
`locationCountries: locations.map((_, i) => countriesRaw[i] ?? '')` pads a field that `rowForPath` maps to
the visible `location` row (`requiredStatus.ts:56-58`). That is correct and deliberate: the only thing
being repaired is the parallel-array **length invariant** (`schema.ts:107-113`, whose own message says
"Internal: …"), never a value the seller typed. An empty country string stays empty and still shows,
because the schema does not require a per-row country. The visible consequence is narrow but real: a
draft whose arrays are out of sync today shows the Location row red; after S4 it shows green with an
empty country. Nothing the seller entered is discarded, and the alternative — surfacing an internal
invariant as a red row the seller has no way to fix — is the dead end this whole task removes. The
`'locationCountries parity'` case in S3 encodes this switch from "visible" to "repaired", which is why it
is the one it.each case the doc says passes **before** the fix as well as after.

**5.7 The category AI badge is unconditional.** Nine labels already carry it unconditionally
(`IdentityCard.tsx:42`, `:68`, `:86`, `:107`; `DescriptionCard.tsx:23`; `SpecsCard.tsx:30`, `:48`,
`:66`; `CategoryConditionCard.tsx:436`) — in this codebase the badge means "this field is AI-assisted",
not "this exact value came from the AI". Category joins them the same way. Making all ten conditional on
provenance is a separate, larger honesty item; do not half-do it here.

---

## 6. Interfaces this phase publishes (later phases consume these — exact names and types)

```ts
// src/features/scanner/requiredRowLabels.ts
export function useRequiredRowLabel(): (key: RequiredRowKey) => string;

// src/features/scanner/requiredStatus.ts   (now exported; signature unchanged)
export function rowForPath(path: PropertyKey[]): RequiredRowKey | null;

// src/features/scanner/components/detail/useRowScroller.ts
export type RowScroller = {
  scrollRef: React.RefObject<KeyboardAwareScrollViewRef | null>;
  registerRow: (key: RequiredRowKey) => (e: LayoutChangeEvent) => void;
  scrollToRow: (key: RequiredRowKey) => void;
};
export function useRowScroller(): RowScroller;

// src/features/scanner/components/detail/RequiredProgressStrip.tsx
export function RequiredProgressStrip(props: {
  rows: RequiredStatus['rows'];
  doneCount: number;
  total: number;
  onPressRow: (key: RequiredRowKey) => void;
}): JSX.Element | null;

// src/features/scanner/components/detail/useDetailController.ts  (argument added, return unchanged)
export function useDetailController(opts?: {
  scrollToRow?: (row: RequiredRowKey) => void;
}): DetailController;

// src/features/scanner/constants.ts  (widened)
export const MARKETPLACE_OPTIONS: {
  value: '101lab' | '101machine' | '101recycle' | '101it';
  label: string;
  description: string;   // NEW — English fallback; the i18n key is
                         // `mobile.detail.marketplaceOption.<value>.description`
}[];
```

**M-3** (routing chip + marketplace sheet, another phase) consumes `MARKETPLACE_OPTIONS[].description`
and the `mobile.detail.marketplaceOption.<value>.description` keys — both land here, so M-3 adds no
locale keys for the option list. **M-4** flips `MARKETPLACE_LOCKED`; the description line M-10 adds to
`MarketplaceCard` becomes visible at that moment with no further work. **M-6** (consume the routing
signal) touches `mapSmartDetection` / `smartDetectionTypes` — the only overlap with this phase is the
stale stub comments M-5 rewrites at `mapSmartDetection.ts:113-116` and `smartDetectionTypes.ts:126-130`;
land M-5 first or expect a two-line conflict there.

---
## 7. Steps

Do them in this order. **S1, S3, S6, S10 and S13 prove the problem before it is fixed** — run them
and see the failure/observation first, so you know the fix worked.

### S0 — Baseline (both green before you change anything)

```bash
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx tsc --noEmit                          # expect: no output, exit 0
npx jest --silent 2>&1 | tail -5
# expect: Test Suites: 92 passed, 92 total
#         Tests:       825 passed, 825 total
#         Snapshots:   22 passed, 22 total
```
Both verified on 2026-08-18. The `A worker process has failed to exit gracefully` line printed before
the summary is pre-existing noise, not a failure.

---

### S1 — M-11 evidence: watch the keyboard on the emulator BEFORE changing anything

The structural claim is verified — in both editors the footer is a **sibling** of
`KeyboardAwareScrollView` (`detail.tsx:115-140` then `:143`/`:144`; `grouped-edit.tsx:207-230` then
`:233`), a repo-wide grep finds **no** `KeyboardStickyView` anywhere in `src/` or `app/`, and
`KeyboardProvider` *is* mounted (`app/_layout.tsx:176`). The **visual** consequence is not verified —
`SCAN_FLOW_UX.md:74-76` says so itself. Android may already lift the footer by resizing the window, in
which case an unconditional `KeyboardStickyView` would *double*-lift it and float the CTA in mid-screen.
So look first.

1. Boot the emulator + Metro (§3.1) and reach `app/scan/detail.tsx` with one photo.
2. Keyboard **closed**, capture the CTA node:
   ```bash
   MSYS_NO_PATHCONV=1 adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml > ui.closed.xml
   grep -o 'content-desc="[^"]*"[^>]*bounds="[^"]*"' ui.closed.xml | grep -i "submit\|seller details"
   ```
   (The label depends on approval state — `useSubmitCtaLabel` — so grep for the label you actually see.)
3. Tap the TITLE input so the keyboard opens, then re-dump to `ui.open.xml`, grep the same node, and
   `adb exec-out screencap -p > kb.open.png`.
4. Record which you saw (put it in the commit message):
   - **(a) CTA covered** — bounds unchanged and the screenshot shows the keyboard drawn over it → S11 step 6 and S18
     wrap the footer for **both** platforms.
   - **(b) CTA already above the keyboard** — bounds moved up / the window shrank → S11 step 6 and S18 wrap with
     `enabled={Platform.OS === 'ios'}`, and the iOS behaviour remains **unverified on this machine**
     (win32, no iOS simulator). Say so explicitly and hand it to whoever builds 1.0.4 on a Mac.

Do not skip this. "Fixing" case (b) unconditionally is a visible regression on the only platform we can
actually test here.

---

### S2 — M-7: extract the row-label map → `src/features/scanner/requiredRowLabels.ts`

```ts
import { useTranslation } from 'react-i18next';

import type { RequiredRowKey } from './requiredStatus';

/**
 * One translated label per required-checklist row.
 *
 * Extracted verbatim from the `labelForKey` switch inside `HubRow`
 * (`app/scan/grouped-review.tsx`, the `missingLabel` IIFE) so the review hub's
 * "Missing: price, condition" chip, the detail footer's missing-field chips
 * (`RequiredProgressStrip`) and the single-item editor's invalid-submit alert all
 * name a field the same way.
 *
 * These keys ship in all six locales (verified 2026-08-18); the `defaultValue`s
 * are the English fallbacks — and they are what Jest sees, because react-i18next
 * is not initialised in the test environment.
 */
export function useRequiredRowLabel(): (key: RequiredRowKey) => string {
  const { t } = useTranslation();
  return (key: RequiredRowKey): string => {
    switch (key) {
      case 'photos':
        return t('mobile.detail.colPhotos', { defaultValue: 'Photos' });
      case 'title':
        return t('mobile.detail.sectionTitle', { defaultValue: 'Title' });
      case 'description':
        return t('mobile.detail.sectionDescription', { defaultValue: 'Description' });
      case 'category':
        return t('mobile.detail.sectionCategory', { defaultValue: 'Category' });
      case 'condition':
        return t('mobile.detail.sectionCondition', { defaultValue: 'Condition' });
      case 'price':
        return t('mobile.detail.sectionPrice', { defaultValue: 'Price' });
      case 'location':
        return t('mobile.detail.sectionLocation', { defaultValue: 'Location' });
    }
  };
}
```

Then point `HubRow` at it. In `app/scan/grouped-review.tsx` add the import beside the others:
```ts
import { useRequiredRowLabel } from '@/features/scanner/requiredRowLabels';
```
inside `HubRow`, right after `const { t } = useTranslation();` (`:515`):
```ts
  const labelForRow = useRequiredRowLabel();
```
then in the `missingLabel` IIFE (`:541-576`) delete the whole local `labelForKey` switch (`:542-567`)
and change `:568` to:
```ts
    const names = missingKeys.map((k) => labelForRow(k).toLowerCase());
```
Nothing else changes in that file; `t` is still used at `:519`, `:526`, `:530`, `:572`, so the
`useTranslation()` call stays.

---

### S3 — M-7: write the failing tests (prove the gap)

Create `src/features/scanner/__tests__/requiredStatusGap.test.ts`:

```ts
import { describe, it, expect } from '@jest/globals';

import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import {
  draftToFormValues,
  emptyDetailDefaults,
} from '@/features/scanner/components/detail/formMapping';
import {
  REQUIRED_ROWS,
  getDraftRequiredStatus,
  getRequiredStatus,
  rowForPath,
} from '@/features/scanner/requiredStatus';
import { detailSchema } from '@/features/scanner/schema';
import type { DraftItem } from '@/stores/scanDraftStore';

// Every field `detailSchema` can require, split by HOW the seller is told.
//   ROW_MAPPED — `rowForPath` turns a zod issue on this path into a visible
//                checklist row, so the seller can see it.
//   DEFAULTED  — no row, and (operationStatus / listingDurationDays) no UI at
//                all, so the value must be guaranteed valid before the form is
//                ever mounted. See PHASE_5 §5.2.
// A required field that is in NEITHER list is an invisible Submit blocker.
const ROW_MAPPED = [
  'title',
  'description',
  'categoryId',
  'condition',
  'pricePerUnit',
  'locations',
  'locationCountries',
  'parentCategoryId',
  'customSubcategory',
];
const DEFAULTED = [
  'operationStatus',
  'priceFormat',
  'priceCurrency',
  'quantity',
  'grade',
  'marketplace',
  'installation',
  'listingDurationDays',
];

/** A complete, submittable draft. */
function validDraft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    photos: [{ uri: 'file:///a.jpg', width: 10, height: 10 }],
    ai: null,
    productIds: [],
    title: 'Benchtop centrifuge',
    description: 'Working, single owner',
    categoryId: '5371',
    categoryName: 'Lab Infrastructure & Essentials',
    customSubcategory: '',
    parentCategoryId: '',
    parentCategoryName: '',
    condition: ['usedFunctional'],
    operationStatus: ['working'],
    pricePerUnit: '4500',
    priceCurrency: 'USD',
    priceFormat: 'buyNow',
    quantity: 1,
    locations: ['Taipei'],
    locationCountries: ['Taiwan'],
    documents: [],
    allowedSites: [],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
    brand: '',
    model: '',
    year: '',
    weight: '',
    dimensions: '',
    co2Emissions: '',
    grade: 'A',
    serialNumber: '',
    marketplace: '101lab',
    installation: 'deinstalled',
    listingDurationDays: 90,
    aiPrices: null,
    ...overrides,
  } as DraftItem;
}

describe('required-status: no invisible Submit blockers', () => {
  it('sanity: a complete draft is submittable', () => {
    expect(getDraftRequiredStatus(validDraft()).allComplete).toBe(true);
  });

  // THE BUG. A draft written by an older build — or resumed from the server,
  // where `hydrateScanDraftFromPayload` CASTS the stored blob without validating
  // it (services/drafts/draftPayload.ts:41-45) and `migrateDraft`
  // (stores/scanDraftStore.ts:293-353) backfills grade/marketplace/installation/
  // listingDurationDays but NOT operationStatus, quantity, priceFormat or
  // condition — fails `detailSchema` on a field with no row and no UI. Result:
  // every visible row reads green and Submit is dead with no explanation.
  it.each([
    ['operationStatus', { operationStatus: [] }],
    ['quantity', { quantity: undefined as unknown as number }],
    ['grade', { grade: 'Z' as unknown as DraftItem['grade'] }],
    ['marketplace', { marketplace: 'shopify' as unknown as DraftItem['marketplace'] }],
    ['installation', { installation: undefined as unknown as DraftItem['installation'] }],
    ['listingDurationDays', { listingDurationDays: 0 }],
    ['priceCurrency', { priceCurrency: 'JPY' as unknown as DraftItem['priceCurrency'] }],
    ['locationCountries parity', { locationCountries: [] }],
  ])('a legacy draft broken on %s never reads "all rows done, Submit dead"', (_label, patch) => {
    const status = getDraftRequiredStatus(validDraft(patch as Partial<DraftItem>));
    const anyRowFalse = REQUIRED_ROWS.some((k) => !status.rows[k]);
    // Either it is submittable (the value was repaired) or the seller can SEE
    // which row is blocking. Never both false.
    expect(status.allComplete || anyRowFalse).toBe(true);
  });

  it('"Other" with no typed brand blocks Submit AND fails the Category row', () => {
    const values = {
      ...emptyDetailDefaults(),
      title: 'Laptop',
      description: 'desc',
      condition: ['usedFunctional'],
      locations: ['Taipei'],
      locationCountries: ['Taiwan'],
      pricePerUnit: '500',
      categoryId: OTHER_SUBCATEGORY_ID,
      parentCategoryId: '5371',
      customSubcategory: '',
    };
    const status = getRequiredStatus(values, 1);
    expect(status.allComplete).toBe(false);
    expect(status.rows.category).toBe(false);
  });

  it('every path detailSchema can require is either a row or a defaulted field', () => {
    const parsed = detailSchema.safeParse({});
    expect(parsed.success).toBe(false);
    const paths = parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect([...ROW_MAPPED, ...DEFAULTED]).toContain(p);
    }
  });

  it('rowForPath maps every ROW_MAPPED path to a visible row', () => {
    for (const p of ROW_MAPPED) {
      expect(rowForPath([p])).not.toBeNull();
    }
  });

  it('emptyDetailDefaults() is already valid for every DEFAULTED field', () => {
    const parsed = detailSchema.safeParse(emptyDetailDefaults());
    const failing = parsed.success
      ? new Set<string>()
      : new Set(parsed.error.issues.map((i) => String(i.path[0])));
    for (const f of DEFAULTED) expect(failing.has(f)).toBe(false);
  });

  it('draftToFormValues repairs junk in every DEFAULTED field', () => {
    const junk = validDraft({
      operationStatus: [],
      quantity: undefined as unknown as number,
      grade: 'Z' as unknown as DraftItem['grade'],
      marketplace: 'shopify' as unknown as DraftItem['marketplace'],
      installation: undefined as unknown as DraftItem['installation'],
      listingDurationDays: 0,
      priceCurrency: 'JPY' as unknown as DraftItem['priceCurrency'],
      priceFormat: undefined as unknown as DraftItem['priceFormat'],
      locationCountries: [],
    });
    const parsed = detailSchema.safeParse(draftToFormValues(junk));
    const failing = parsed.success
      ? new Set<string>()
      : new Set(parsed.error.issues.map((i) => String(i.path[0])));
    for (const f of DEFAULTED) expect(failing.has(f)).toBe(false);
    expect(parsed.success).toBe(true);
  });
});
```

Run it:
```bash
npx jest src/features/scanner/__tests__/requiredStatusGap.test.ts 2>&1 | tail -40
```
**Expected BEFORE the fix — these failures are the proof:**
- `rowForPath maps every ROW_MAPPED path…` fails on `parentCategoryId` and `customSubcategory`
  (`requiredStatus.ts:59-60` returns `null`).
- `"Other" with no typed brand…` fails: `rows.category` is `true` while `allComplete` is `false`.
- `a legacy draft broken on …` fails for `operationStatus`, `quantity`, `grade`, `marketplace`,
  `installation`, `listingDurationDays`, `priceCurrency` — each one: `allComplete` false, every row true.
- `draftToFormValues repairs junk…` fails.
- `sanity`, `every path detailSchema can require…`, `emptyDetailDefaults() is already valid…` and
  `locationCountries parity` should **pass already** (they are the lock, not the bug). If
  `locationCountries parity` fails, something else regressed — that path *is* mapped today.

---

### S4 — M-7: make `draftToFormValues` the coercion seam

In `src/features/scanner/components/detail/formMapping.ts`, widen the import at `:1`:
```ts
import {
  DEFAULT_OPERATION_STATUS,
  marketplaceFromSiteType,
} from '@/features/scanner/constants';
```
and replace `draftToFormValues` (`:49-77`) with:

```ts
const GRADES: readonly string[] = ['A', 'B', 'C', 'D'];

/**
 * DraftItem -> RHF values, and the ONE place a persisted draft is made
 * schema-valid.
 *
 * Why the coercion lives here: `detailSchema` gates Submit on 14 fields
 * (schema.ts:20-61) but the checklist shows 7 rows and `rowForPath`
 * (requiredStatus.ts:42-61) maps 6 of them, so a draft that fails on
 * `operationStatus` — which has NO control anywhere in the editor — renders with
 * every visible row green, Submit dead, and no explanation. That is reachable,
 * not theoretical: `hydrateScanDraftFromPayload` CASTS the server-stored blob
 * without validating it (services/drafts/draftPayload.ts:41-45) and
 * `migrateDraft` (stores/scanDraftStore.ts:293-353) backfills grade / marketplace
 * / installation / listingDurationDays but not `operationStatus`, `quantity`,
 * `priceFormat` or `condition`.
 *
 * Fields WITH a checklist row are deliberately NOT repaired here — an empty title
 * must stay empty so the seller is asked for it.
 */
export function draftToFormValues(draft: DraftItem): DetailFormInput {
  const locations = Array.isArray(draft.locations) ? draft.locations : [];
  const countriesRaw = Array.isArray(draft.locationCountries) ? draft.locationCountries : [];
  return {
    title: draft.title ?? '',
    description: draft.description ?? '',
    categoryId: draft.categoryId ?? '',
    customSubcategory: draft.customSubcategory ?? '',
    parentCategoryId: draft.parentCategoryId ?? '',
    parentCategoryName: draft.parentCategoryName ?? '',
    condition: Array.isArray(draft.condition) ? draft.condition : [],
    // No UI in the editor, and never submitted — buildFormData derives
    // operation_status[] from `installation` instead (buildFormData.ts:185-187, :263).
    operationStatus: draft.operationStatus?.length
      ? draft.operationStatus
      : [...DEFAULT_OPERATION_STATUS],
    priceFormat: draft.priceFormat === 'offer' ? 'offer' : 'buyNow',
    pricePerUnit: draft.pricePerUnit ?? '',
    // PricingCard offers exactly these two (CURRENCY_OPTIONS); legacy drafts may
    // still hold HKD/CNY/JPY/THB from before the list was narrowed.
    priceCurrency: draft.priceCurrency === 'TWD' ? 'TWD' : 'USD',
    // The stepper already clamps at 1 (PricingCard.tsx:98); this covers drafts
    // persisted before `quantity` existed.
    quantity:
      typeof draft.quantity === 'number' && Number.isFinite(draft.quantity) && draft.quantity >= 1
        ? Math.floor(draft.quantity)
        : 1,
    locations,
    // schema.ts:107-113 requires one country slot per location row.
    locationCountries: locations.map((_, i) => countriesRaw[i] ?? ''),
    brand: draft.brand ?? '',
    model: draft.model ?? '',
    year: draft.year ?? '',
    weight: draft.weight ?? '',
    dimensions: draft.dimensions ?? '',
    co2Emissions: draft.co2Emissions ?? '',
    grade: GRADES.includes(draft.grade) ? draft.grade : 'A',
    serialNumber: draft.serialNumber ?? '',
    // Accepts all four canonical values and repairs anything else. '101lab' is
    // this app's own legacy lenient fallback (scanDraftStore.ts:211-212).
    marketplace: marketplaceFromSiteType(draft.marketplace) ?? '101lab',
    installation: draft.installation === 'installed' ? 'installed' : 'deinstalled',
    listingDurationDays:
      Number.isInteger(draft.listingDurationDays) && draft.listingDurationDays > 0
        ? draft.listingDurationDays
        : 90,
  };
}
```

Leave `emptyDetailDefaults` (`:19-47`) and `buildDraftPatch` (`:86-125`) untouched.

---

### S5 — M-7: delete the duplicate projection and map the two "Other" paths

In `src/features/scanner/requiredStatus.ts`:

1. Add the import after the `./schema` import (`:3`):
   ```ts
   import { draftToFormValues } from './components/detail/formMapping';
   ```
   No cycle: `formMapping` imports only `constants`, `schema` and a **type** from `scanDraftStore`, and
   `scanDraftStore` imports neither module (checked: `scanDraftStore.ts:1-18`).

2. Delete `draftToFormInput` entirely (`:64-103`). It is a hand-copy of `draftToFormValues` and already
   carries the comment "Mirrors formMapping.draftToFormValues" (`:79`) — exactly the drift this task
   exists to kill.

3. Rewrite `getDraftRequiredStatus` (`:110-112`) as:
   ```ts
   export function getDraftRequiredStatus(draft: DraftItem): RequiredStatus {
     return getRequiredStatus(draftToFormValues(draft), draft.photos?.length ?? 0);
   }
   ```

4. Export `rowForPath` — change `:42` from `function rowForPath(` to `export function rowForPath(` — and
   add the two "Other" paths immediately before `default:` (`:59`):
   ```ts
       // "Other (type brand)": schema.ts:74-92 blocks Submit on these two when
       // categoryId is the OTHER sentinel. Both are user-reachable (pick Other,
       // leave the brand box empty) and belong to the visible Category row.
       case 'parentCategoryId':
       case 'customSubcategory':
         return 'category';
   ```

5. Replace the comment at `:39-41` so the invariant is written down where the next person will look:
   ```ts
   // Map a zod issue's top-level path to a visible bar row. The fields that still
   // return null (operationStatus, priceFormat, priceCurrency, quantity, grade,
   // marketplace, installation, listingDurationDays) have no row BY DESIGN:
   // `formMapping.draftToFormValues` guarantees each of them a schema-valid value
   // before the form mounts, so they cannot block Submit invisibly. If you add a
   // required field to detailSchema it needs a row HERE or a default THERE —
   // `__tests__/requiredStatusGap.test.ts` enforces exactly that.
   ```

6. Re-run the tests:
   ```bash
   npx jest src/features/scanner/__tests__/requiredStatusGap.test.ts 2>&1 | tail -12
   # expect: all pass
   npx jest src/services/scanner/__tests__/otherSubcategory.test.ts 2>&1 | tail -6
   # expect: pass — it calls getDraftRequiredStatus and is the regression guard for step 3
   ```

---

### S6 — M-8: see that the footer says nothing today

No test — observe it (the emulator is already up from S1):
1. On `app/scan/detail.tsx` with one photo, clear the TITLE field.
2. `adb exec-out screencap -p > footer.before.png`.
3. Confirm the footer shows a flat grey Submit with **no** indication of what is missing, and that
   finding out means scrolling to the last card (`detail.tsx:139`). Keep the screenshot for the PR.

---

### S7 — M-8: scroll plumbing → `src/features/scanner/components/detail/useRowScroller.ts`

```ts
import { useCallback, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

import type { RequiredRowKey } from '@/features/scanner/requiredStatus';

/** Breathing room above the card we jump to, in px. */
const SCROLL_MARGIN = 12;

export type RowScroller = {
  scrollRef: React.RefObject<KeyboardAwareScrollViewRef | null>;
  /** onLayout handler for the wrapper View around the card that owns `key`. */
  registerRow: (key: RequiredRowKey) => (e: LayoutChangeEvent) => void;
  scrollToRow: (key: RequiredRowKey) => void;
};

/**
 * Scroll-to-card plumbing for the detail editor: the footer's missing-field chips
 * (RequiredProgressStrip, M-8) and the invalid-submit alert (M-9) both need to
 * jump to the card that owns a required row.
 *
 * `KeyboardAwareScrollViewRef` extends RN's `ScrollView`
 * (react-native-keyboard-controller 1.21.6,
 * lib/typescript/components/KeyboardAwareScrollView/types.d.ts:25-27), so
 * `.scrollTo` is available on the ref. The offsets come from each card's own
 * onLayout `y`, which is relative to the scroll content — exactly what scrollTo
 * expects.
 */
export function useRowScroller(): RowScroller {
  const scrollRef = useRef<KeyboardAwareScrollViewRef | null>(null);
  const yByRow = useRef<Partial<Record<RequiredRowKey, number>>>({});

  const registerRow = useCallback(
    (key: RequiredRowKey) => (e: LayoutChangeEvent) => {
      yByRow.current[key] = e.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToRow = useCallback((key: RequiredRowKey) => {
    const y = yByRow.current[key];
    if (y == null) return; // never laid out (card not mounted) — do nothing
    scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN), animated: true });
  }, []);

  return { scrollRef, registerRow, scrollToRow };
}
```

---

### S8 — M-8: the strip → `src/features/scanner/components/detail/RequiredProgressStrip.tsx`

```tsx
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useRequiredRowLabel } from '@/features/scanner/requiredRowLabels';
import {
  REQUIRED_ROWS,
  type RequiredRowKey,
  type RequiredStatus,
} from '@/features/scanner/requiredStatus';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';

interface Props {
  rows: RequiredStatus['rows'];
  doneCount: number;
  total: number;
  onPressRow: (key: RequiredRowKey) => void;
}

/**
 * Sticky required-progress strip for the single-item editor's footer: a 4 px
 * completion track plus one tappable chip per still-missing field. Tapping a chip
 * scrolls to the card that owns it.
 *
 * Mirrors the review hub's pinned footer (app/scan/grouped-review.tsx — track at
 * :360-368) so the two screens read the same, and carries NO header text: the bar
 * is the progress and the chips are the names, so nothing here repeats the
 * RequiredChecklist card's copy at the end of the scroll.
 *
 * Renders null once every row passes — at that point the footer is just the CTA
 * (UX_DESIGN_RULES "Adaptive UI") and the collapsed green checklist strip already
 * says "complete".
 *
 * Props, not form context: in `grouped-edit.tsx` the footer lives OUTSIDE the
 * FormProvider, so a context-reading version could not be reused there later.
 */
export function RequiredProgressStrip({ rows, doneCount, total, onPressRow }: Props) {
  const labelForRow = useRequiredRowLabel();
  const missing = REQUIRED_ROWS.filter((k) => !rows[k]);
  if (missing.length === 0) return null;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <View>
      <View style={{ height: 4, backgroundColor: brand.divider }} accessible={false}>
        <View style={{ height: 4, width: `${pct}%`, backgroundColor: brand.primaryDim }} />
      </View>
      <View className="flex-row flex-wrap gap-1.5 px-lg pt-2.5">
        {missing.map((key) => {
          const label = labelForRow(key);
          return (
            <Pressable
              key={key}
              onPress={() => {
                haptics.tap();
                onPressRow(key);
              }}
              className="flex-row items-center gap-xs px-md rounded-pill border border-brand-destructive bg-brand-surface"
              style={{ minHeight: 32, paddingVertical: 4 }}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <MaterialIcons name="error-outline" size={13} color={brand.destructive} />
              <Text
                className="font-label text-brand-destructive"
                style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

Every token used exists: `brand.divider` (`src/constants/theme.ts:87`), `brand.primaryDim` (`:74`),
`brand.destructive` (`:92`), `rounded-pill` (`tailwind.config.js:75`), `gap-1.5` (`:63`), `px-lg` /
`px-md` / `gap-xs` (spacing, `theme.ts:167-170`), `border-brand-destructive`
(`tailwind.config.js:40`), `font-label` (`:92`).

Add to the barrel `src/features/scanner/components/detail/index.ts`, keeping its existing order
(components alphabetical, then the hooks). **Reviewer fix 2026-08-18:** the component export goes after
`RequiredChecklist` (`:19`), not after `PricingCard` (`:17`) — `RequiredProgressStrip` sorts after
`RequiredChecklist`, and the hook exports belong with `useDetailController` at the end (`:22-23`).

After `:19` (`export { RequiredChecklist } from './RequiredChecklist';`):
```ts
export { RequiredProgressStrip } from './RequiredProgressStrip';
```
After `:23` (`export type { DetailController } from './useDetailController';`):
```ts
export { useRowScroller } from './useRowScroller';
export type { RowScroller } from './useRowScroller';
```

---

### S9 — M-8 + M-9: rewire `DetailFooter.tsx`

Two changes: the wrapper/row split so the strip can live inside the same pinned block, and the
single-mode Submit stops greying out on missing fields (§5.6).

Imports to add at the top:
```ts
import type { RequiredRowKey, RequiredStatus } from '@/features/scanner/requiredStatus';

import { RequiredProgressStrip } from './RequiredProgressStrip';
```
Props to add (`:10-26`):
```ts
  /** M-8: when provided, the footer renders the sticky required-progress strip
   *  above the buttons. Omit it (grouped-edit's own footer, unit tests) to get
   *  just the buttons — the previous behaviour. */
  required?: RequiredStatus;
  onPressRow?: (key: RequiredRowKey) => void;
```
Then replace the body `:50-125` with:

```tsx
}: Props) {
  const { t } = useTranslation();
  const submitLabel = useSubmitCtaLabel(t('mobile.detail.submitListing'));

  // Split from the old single `footerCls`: the top border + surface now belong to
  // the wrapper so the required-progress strip sits inside the same pinned block.
  const wrapperCls = 'border-t border-brand-border-strong bg-brand-surface';
  const rowCls = 'flex-row items-center gap-sm px-lg pt-2.5 pb-2.5';

  const actions = (() => {
    if (isGrouped) {
      if (editingGroupedItem) {
        return (
          <FooterButton
            label={t('mobile.detail.saveAndReturn')}
            onPress={onSaveAndReturnToReview}
            disabled={!allRequired}
            primary
            flex={1}
          />
        );
      }
      return (
        <>
          <FooterButton
            label={t('mobile.detail.reviewGroup', { count: queuedCount + 1 })}
            onPress={onReviewGroup}
            disabled={!allRequired}
            flex={1}
          />
          <FooterButton
            label={t('mobile.detail.addAnother')}
            onPress={onAddAnother}
            disabled={!allRequired}
            primary
            flex={2}
          />
        </>
      );
    }
    return (
      <>
        {/* When drafts are off there is no second action to offer. The fallback
            here used to be a "Preview" button that only alerted "coming soon" — a
            visible control that does nothing is an App Store Guideline 2.1 (App
            Completeness) rejection risk, so render nothing and let Submit take the
            full width instead. */}
        {draftsEnabled() && onSaveDraft ? (
          <FooterButton
            label={t('mobile.detail.saveDraft', { defaultValue: 'Save as draft' })}
            onPress={onSaveDraft}
            loading={!!savingDraft}
            disabled={!!submitting}
            flex={1}
          />
        ) : null}
        {/* M-9: no longer disabled on missing fields. A flat grey button with no
            reason given (FooterButton.tsx:39-44) was the dead end this phase
            removes; the press now runs `handleSubmit`, which alerts the named
            missing fields, scrolls to the first one and focuses it
            (useDetailController.onInvalid) — the pattern grouped-edit.tsx has used
            since note R-1, where the CTA is likewise never disabled (:243-246).
            Validity is still enforced by `detailSchema` inside handleSubmit, which
            cannot be bypassed, plus an explicit zero-photos guard, so nothing
            invalid can reach the backend. `canPublish` no longer changes the
            enabled state either: an unapproved seller could already press this
            (onSubmitSingle routes them to the seller form) and
            `SellerApprovalNotice` above the footer plus `useSubmitCtaLabel` still
            tell them what will happen. */}
        <FooterButton
          label={submitLabel}
          onPress={onSubmitSingle}
          disabled={!!submitting}
          loading={submitting}
          primary
          icon="arrow-forward"
          flex={2}
        />
      </>
    );
  })();

  return (
    <View className={wrapperCls}>
      {required && onPressRow ? (
        <RequiredProgressStrip
          rows={required.rows}
          doneCount={required.doneCount}
          total={required.total}
          onPressRow={onPressRow}
        />
      ) : null}
      <View className={rowCls}>{actions}</View>
    </View>
  );
}
```

`canPublish` / `useCanSell` are now unused in this file — delete the `const canPublish = useCanSell();`
line (`:53`) and the `import { useCanSell } …` line (`:5`) so `npm run lint` stays clean. Note that
`DetailFooter.saveDraft.test.tsx:10` mocks `useSellerUpgrade`; that mock becomes redundant but harmless,
so leave the test file alone.

---

### S10 — M-9: prove the silent no-op, then fix it

**Prove it.** With S9 in place, restart Metro (CI-mode does not hot-reload), clear the TITLE field and
press Submit. Nothing happens at all: no alert, no haptic, no navigation — `handleSubmit(onValid)` with
no second argument (`useDetailController.ts:94`) swallows the invalid submit. `adb logcat -d | tail -40`
showing no reaction, plus a screenshot, is the evidence.

**Fix.** In `src/features/scanner/components/detail/useDetailController.ts`:

1. Widen the imports:
   ```ts
   import { useForm, type FieldErrors, type UseFormReturn } from 'react-hook-form';
   ```
   ```ts
   import { useRequiredRowLabel } from '@/features/scanner/requiredRowLabels';
   import {
     REQUIRED_ROWS,
     rowForPath,
     type RequiredRowKey,
   } from '@/features/scanner/requiredStatus';
   ```

2. Accept the scroller — change `:36`:
   ```ts
   export function useDetailController(opts?: {
     /** M-9: jump the seller to the card that owns a missing row. Supplied by
      *  `app/scan/detail.tsx` from `useRowScroller`. Optional, so any other caller
      *  keeps working. */
     scrollToRow?: (row: RequiredRowKey) => void;
   }) {
   ```

3. After `const { handleSubmit, reset } = form;` (`:55`):
   ```ts
   const labelForRow = useRequiredRowLabel();
   ```

4. Insert this block immediately before `const submitSingleValidated = …` (`:94`):

```ts
  /**
   * M-9 — the dead-button fix, copied from `app/scan/grouped-edit.tsx:127-160`
   * ("no save path may silently no-op"). Any failed submit fires haptics, an Alert
   * naming the missing fields, a scroll to the first offending card, and
   * `setFocus` on the first invalid field.
   *
   * Field names come from `useRequiredRowLabel` via `rowForPath`, so a field is
   * named here exactly as the footer chips and the review hub name it. The copy
   * keys are `mobile.groupedEdit.*`, reused verbatim (they are already translated
   * in all six locales) rather than duplicated under `mobile.detail.*` — the same
   * cross-namespace reuse the hub already does with `mobile.detail.section*`
   * (grouped-review.tsx:546-565).
   */
  const photosLabel = labelForRow('photos');

  const missingRowsFrom = (errors: FieldErrors<DetailFormInput>): RequiredRowKey[] => {
    const rows = new Set<RequiredRowKey>();
    for (const field of Object.keys(errors)) {
      const row = rowForPath([field]);
      if (row) rows.add(row);
    }
    if ((useScanDraft.getState().current?.photos?.length ?? 0) === 0) rows.add('photos');
    // REQUIRED_ROWS order, so the list reads top-to-bottom like the screen.
    return REQUIRED_ROWS.filter((k) => rows.has(k));
  };

  const alertMissing = (rows: RequiredRowKey[]) => {
    haptics.error();
    Alert.alert(
      t('mobile.groupedEdit.missingTitle', { defaultValue: 'Some fields are missing' }),
      t('mobile.groupedEdit.missingBody', {
        defaultValue: 'Please add: {{fields}}',
        fields: rows.map(labelForRow).join(', '),
      }),
    );
    const first = rows[0];
    if (first) opts?.scrollToRow?.(first);
  };

  const onInvalid = (errors: FieldErrors<DetailFormInput>) => {
    alertMissing(missingRowsFrom(errors));
    // Best-effort focus. RHF's setFocus only works on Controllers wired with a ref
    // (mostly TextInputs) and silently no-ops otherwise — the intended degrade,
    // same as grouped-edit.tsx:152-159.
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      try {
        form.setFocus(firstErrorField as keyof DetailFormInput);
      } catch {
        // no ref registered — ignore
      }
    }
  };

  /**
   * Photos are not part of `detailSchema`, so the VALID path has to guard them
   * explicitly now that Submit is no longer disabled on incomplete state (S9).
   * Mirrors grouped-edit.tsx:105-117.
   */
  const missingPhotos = (): boolean => {
    if ((useScanDraft.getState().current?.photos?.length ?? 0) > 0) return false;
    alertMissing(['photos']);
    return true;
  };
```
**Reviewer fixes 2026-08-18 — two corrections to the block above, apply both:**

1. **Do NOT write the `const photosLabel = labelForRow('photos');` line.** It is dead: `alertMissing`
   names every row through `rows.map(labelForRow)`, including `'photos'`, so nothing reads it and
   `npm run lint` fails on the unused binding. Delete that one line from the block; keep everything else.

2. **`onInvalid` must never alert an empty list.** `missingRowsFrom` returns `[]` if every error path
   maps to no row, and `'Please add: {{fields}}'` would then render as `Please add: ` with nothing after
   it. That should be unreachable after S4, but the whole point of this task is that no failed submit
   ends in a dead end. Use this `onInvalid` instead of the one in the block above — the fallback is
   copied from `grouped-edit.tsx:127-160`, which already uppercases raw keys for unmapped fields:

```ts
  const onInvalid = (errors: FieldErrors<DetailFormInput>) => {
    const rows = missingRowsFrom(errors);
    if (rows.length > 0) {
      alertMissing(rows);
    } else {
      // No error path mapped to a visible row. Unreachable after S4's coercion
      // seam, but never alert an empty field list — name the raw fields the way
      // grouped-edit.tsx:127-160 does for unmapped keys.
      haptics.error();
      Alert.alert(
        t('mobile.groupedEdit.missingTitle', { defaultValue: 'Some fields are missing' }),
        t('mobile.groupedEdit.missingBody', {
          defaultValue: 'Please add: {{fields}}',
          fields: Object.keys(errors)
            .map((k) => k.replace(/^./, (c) => c.toUpperCase()))
            .join(', '),
        }),
      );
    }
    // Best-effort focus. RHF's setFocus only works on Controllers wired with a ref
    // (mostly TextInputs) and silently no-ops otherwise — the intended degrade,
    // same as grouped-edit.tsx:152-159.
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      try {
        form.setFocus(firstErrorField as keyof DetailFormInput);
      } catch {
        // no ref registered — ignore
      }
    }
  };
```

5. Wire `onInvalid` into all four `handleSubmit` calls, and the photos guard into the single-submit path:
   - `:94` `submitSingleValidated` → add `if (missingPhotos()) return;` as the **first** statement of the
     callback body, and close the call with `}, onInvalid);`
   - `:136` `onAddAnother` → close with `}, onInvalid);`
   - `:144` `onReviewGroup` → close with `}, onInvalid);`
   - `:152` `onSaveAndReturnToReview` → close with `}, onInvalid);`

   The three grouped handlers keep their `disabled={!allRequired}` buttons (§5.6), so their `onInvalid` is
   defence in depth — the same posture as the hub's pre-flight sweep (`grouped-review.tsx:152-183`).

---

### S11 — M-8 + M-9: wire the route (`app/scan/detail.tsx`)

1. Imports. Add `View` from `react-native` (the file imports none today), `KeyboardStickyView` on `:5`,
   and `useRowScroller` to the barrel import (`:10-25`):
   ```ts
   import { View } from 'react-native';
   import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
   ```
   ```ts
     useDetailController,
     useRowScroller,
   } from '@/features/scanner/components/detail';
   ```

2. Create the scroller **before** the controller (hook order matters) — replace `:52`:
   ```ts
   // M-8/M-9: the footer chips and the invalid-submit alert both jump to the card
   // that owns a required row.
   const { scrollRef, registerRow, scrollToRow } = useRowScroller();
   const controller = useDetailController({ scrollToRow });
   ```

3. Give the scroll view the ref (`:115`):
   ```tsx
         <KeyboardAwareScrollView
           ref={scrollRef}
           className="flex-1"
   ```

4. Wrap the cards that own a required row (`:121-139`). Only these need wrappers; `MarketplaceCard`,
   `ProfitIntelligenceCard`, `SpecsCard`, `DocumentsCard` and `RequiredChecklist` stay as they are:
   ```tsx
           <View onLayout={registerRow('photos')}>
             <PhotosCard
               photos={draft.photos ?? []}
               rearrangeLabel={t('mobile.review.rearrange')}
               onRearrange={() => router.push(routes.scanReorderPhotosEdit())}
               onAddMore={addMorePhotos}
             />
           </View>
           <View onLayout={registerRow('title')}>
             <IdentityCard />
           </View>
           <View onLayout={registerRow('description')}>
             <DescriptionCard />
           </View>
           <MarketplaceCard />
           {/* Category AND condition both live in this one card, so both rows
               register the SAME wrapper. Do not nest two wrappers: the inner y
               would be 0 relative to the outer and the jump would be a no-op.
               Splitting the card is M-2's job, in another phase. */}
           <View
             onLayout={(e) => {
               registerRow('category')(e);
               registerRow('condition')(e);
             }}
           >
             <CategoryConditionCard />
           </View>
           <ProfitIntelligenceCard aiPrices={draft.aiPrices} />
           <View onLayout={registerRow('price')}>
             <PricingCard />
           </View>
           <SpecsCard />
           <DocumentsCard draft={draft} />
           <View onLayout={registerRow('location')}>
             <LocationCard />
           </View>
           <RequiredChecklist draft={draft} />
   ```
   A plain wrapper `View` adds no visual change: it takes its child's height and the container's
   `gap: 8` (`:117`) applies between wrappers exactly as before.

5. Pass the strip props to the footer (inside the existing `<DetailFooter … />` at `:144-156`):
   ```tsx
           required={required}
           onPressRow={scrollToRow}
   ```
   (`required` is already computed at `:109`.)

6. M-11 — wrap the notice + footer (`:143-156`) according to your S1 observation:
   ```tsx
         <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
           {/* Only single mode submits from this screen — in grouped mode the footer
               leads to the review hub, which carries its own copy of this notice. */}
           {!isGrouped && <SellerApprovalNotice />}
           <DetailFooter … />
         </KeyboardStickyView>
   ```
   If S1 showed outcome **(b)**, add `enabled={Platform.OS === 'ios'}` to `KeyboardStickyView`, import
   `Platform` alongside `View`, and comment it with the S1 observation and date.

---

### S12 — M-8/M-9 tests

```bash
npx jest src/features/scanner/components/detail/__tests__/DetailFooter.saveDraft.test.tsx 2>&1 | tail -8
# expect: pass — it renders DetailFooter WITHOUT `required`/`onPressRow`, so the
# strip is absent and the rendered output is what it was.
```

Create `src/features/scanner/components/detail/__tests__/RequiredProgressStrip.test.tsx`:

```tsx
import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { RequiredProgressStrip } from '@/features/scanner/components/detail/RequiredProgressStrip';
import type { RequiredStatus } from '@/features/scanner/requiredStatus';

const allDone: RequiredStatus['rows'] = {
  photos: true,
  title: true,
  description: true,
  category: true,
  condition: true,
  price: true,
  location: true,
};

describe('RequiredProgressStrip', () => {
  it('names every missing row and fires onPressRow for the tapped one', () => {
    const onPressRow = jest.fn();
    const { getByText } = render(
      <RequiredProgressStrip
        rows={{ ...allDone, title: false, price: false }}
        doneCount={5}
        total={7}
        onPressRow={onPressRow}
      />,
    );
    // Labels come from `useRequiredRowLabel`; react-i18next is uninitialised under
    // Jest, so `t` returns the English defaultValue.
    expect(getByText('Title')).toBeTruthy();
    fireEvent.press(getByText('Price'));
    expect(onPressRow).toHaveBeenCalledWith('price');
  });

  it('renders nothing once every row passes', () => {
    const { toJSON } = render(
      <RequiredProgressStrip rows={allDone} doneCount={7} total={7} onPressRow={() => {}} />,
    );
    expect(toJSON()).toBeNull();
  });
});
```
```bash
npx jest src/features/scanner/components/detail/__tests__/RequiredProgressStrip.test.tsx 2>&1 | tail -8
# expect: 2 passed
```

---
### S13 — M-5: prove the card lies (write the failing test)

Create `src/features/scanner/components/detail/__tests__/ProfitIntelligenceCard.test.tsx`:

```tsx
import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

// lucide icons are ESM-ish and not in transformIgnorePatterns; same Proxy mock the
// chat characterization suites use (src/features/lab/chat/__tests__/cards.characterization.test.tsx:25-29).
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});

import { ProfitIntelligenceCard } from '@/features/scanner/components/detail/ProfitIntelligenceCard';
import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { AiPrices } from '@/features/scanner/smartDetectionTypes';

function Harness({ aiPrices }: { aiPrices?: AiPrices | null }) {
  const form = useForm<DetailFormInput>({ defaultValues: emptyDetailDefaults() });
  return (
    <FormProvider {...form}>
      <ProfitIntelligenceCard aiPrices={aiPrices} />
    </FormProvider>
  );
}

// L1 from the measured DEV set (SCAN_FLOW_BACKEND.md:364): scrap 100-300,
// used 3000-6000 -> the old card rendered "999% more than scrap value alone".
const L1: AiPrices = {
  scrap: { min: 100, max: 300 },
  used: { min: 3000, max: 6000 },
  currency: 'USD',
};

describe('ProfitIntelligenceCard — honesty (M-5)', () => {
  it('renders no fabricated figures when the AI returned no tiers', () => {
    const { queryByText, getByText } = render(<Harness aiPrices={null} />);
    // The deleted static stub: 12,500 / 4,200 / 33.
    expect(queryByText(/12,500/)).toBeNull();
    expect(queryByText(/4,200/)).toBeNull();
    expect(queryByText(/33%/)).toBeNull();
    // An honest empty state instead of a half-empty card.
    expect(getByText(/No price estimate/i)).toBeTruthy();
    // ...and no AI badge on content the AI never produced.
    expect(queryByText('AI')).toBeNull();
  });

  it('never renders a percentage, capped or otherwise', () => {
    const { queryByText } = render(<Harness aiPrices={L1} />);
    expect(queryByText(/999/)).toBeNull();
    expect(queryByText(/more than scrap/i)).toBeNull();
    expect(queryByText(/%/)).toBeNull();
  });

  it('keeps the AI ranges and labels them as an estimate', () => {
    const { getByText } = render(<Harness aiPrices={L1} />);
    expect(getByText('USD 100 – USD 300')).toBeTruthy();       // scrap range
    expect(getByText('+USD 2,700 – +USD 5,900')).toBeTruthy();  // used.min-scrap.max .. used.max-scrap.min
    expect(getByText(/AI estimate/i)).toBeTruthy();
    expect(getByText('AI')).toBeTruthy();                       // badge IS honest here
  });

  it('never names a marketplace (the old suggestion was circular)', () => {
    const { queryByText } = render(<Harness aiPrices={L1} />);
    expect(queryByText(/101LAB|101MACHINE|101IT|101RECYCLE/)).toBeNull();
  });
});
```

```bash
npx jest src/features/scanner/components/detail/__tests__/ProfitIntelligenceCard.test.tsx 2>&1 | tail -30
```
**Expected BEFORE the fix:** all four fail —
- test 1: `USD 12,500` and `+USD 4,200` render from the stub (`ProfitIntelligenceCard.tsx:103-116`) and
  there is no empty state;
- test 2: `999` renders via `profitInsight` (`:303-308`, cap at `:97`);
- test 3: the ranges are right but there is no "AI estimate" label;
- test 4: `101LAB` renders, because `suggestedKey` falls back to the seller's own `marketplace`
  (`:155-158`) — which is `101lab` from `emptyDetailDefaults`.

(The exact `USD 100 – USD 300` / `+USD 2,700 – +USD 5,900` strings come from `formatCurrency`
(`currencyFx.ts:49-68`: `${sign}${currency} ${body}`, `en-US` grouping) and `formatTier`'s en-dash join
(`ProfitIntelligenceCard.tsx:124-133`), which this task does not change.)

---

### S14 — M-5: rewrite the card

Replace `src/features/scanner/components/detail/ProfitIntelligenceCard.tsx` `:1-158` (imports through
`suggestedLabel`) with the version below and adjust the JSX as described. Concretely:

1. **Delete** `STATIC_SCRAP_BASELINE_USD`, `STATIC_POTENTIAL_PROFIT_USD`, `STATIC_PROFIT_PERCENT`,
   `STATIC_SUGGESTED_MARKETPLACE` and their comment (`:14-23`).
2. **Delete** the `MARKETPLACE_OPTIONS` import (`:7`) — after this change the card does not read the
   marketplace at all, which is the point: deriving an "AI suggestion" from the seller's own choice
   (`:153-158`) is circular the moment M-4 lets the AI write that field.
3. **Delete** `percent` from `DerivedFigures` (`:45-46`) and from `deriveFigures`.
4. `deriveFigures` returns `DerivedFigures | null`.

```ts
type DerivedFigures = {
  /** Canonical USD scrap-value range for display. min===max for point values. */
  scrapUsd: AiPriceTier;
  /** Canonical USD potential-profit range (resale − scrap). */
  profitUsd: AiPriceTier;
};

/**
 * Compute the USD-canonical figures the card displays, or NULL when the AI did
 * not return both a scrap and a used tier.
 *
 * M-5: there is no static-stub path any more. The old one rendered
 * $12,500 / $4,200 / 33% — three numbers nobody had measured — with the AI badge
 * hidden, so it read as analysis (SCAN_FLOW_BACKEND.md §3, MULTI_MARKETPLACE_PLAN
 * §1 item 3). Missing tiers now produce an honest empty state.
 *
 * The percent uplift is gone too, and not because of a rendering bug: it was
 * `round(profitMid / scrapMid × 100)` capped at 999, and over 72 real DEV
 * responses the MEDIAN was 999 with 45/72 (63%) hitting the cap
 * (SCAN_FLOW_BACKEND.md:389). A number that is usually its own display ceiling is
 * not information. It comes back when the scrap figure is grounded in something
 * other than the model's guess — a separate project (plan §9).
 */
function deriveFigures(aiPrices: AiPrices | null | undefined): DerivedFigures | null {
  // Require BOTH scrap and used: a used-only or scrap-only bundle cannot produce
  // a profit range at all.
  if (!aiPrices || aiPrices.scrap == null || aiPrices.used == null) return null;
  const scrapSrc = aiPrices.scrap;
  const usedSrc = aiPrices.used;
  // Normalize to USD canonical so the rest of the card (which formats through the
  // current currency pill) stays consistent regardless of the AI's source unit.
  const scrapUsd: AiPriceTier = {
    min: convertPrice(scrapSrc.min, aiPrices.currency, 'USD'),
    max: convertPrice(scrapSrc.max, aiPrices.currency, 'USD'),
  };
  const usedUsd: AiPriceTier = {
    min: convertPrice(usedSrc.min, aiPrices.currency, 'USD'),
    max: convertPrice(usedSrc.max, aiPrices.currency, 'USD'),
  };
  // Lowest possible profit is `used.min - scrap.max`, highest is
  // `used.max - scrap.min`. Floor at 0 so the bottom never reads as a loss.
  return {
    scrapUsd,
    profitUsd: {
      min: Math.max(0, usedUsd.min - scrapUsd.max),
      max: Math.max(0, usedUsd.max - scrapUsd.min),
    },
  };
}
```

5. The component body becomes:

```tsx
export function ProfitIntelligenceCard({ aiPrices }: Props) {
  const { t } = useTranslation();
  const { watch } = useFormContext<DetailFormInput>();
  const priceCurrency = watch('priceCurrency');

  const figures = deriveFigures(aiPrices);
  // ... header row unchanged EXCEPT the badge condition:  {figures ? (<AI badge/>) : null}
```

6. Keep the header row exactly as it is (`:166-204`) but change the badge condition from `fromAi` to
   `figures`.

7. Replace the stats block (`:206-280`) with an early empty state, then the unchanged stacked stats:

```tsx
      {figures === null ? (
        /* Honest empty state (UX_DESIGN_RULES "Empty states": never a blank or a
           fabricated panel — say what happened and where to go next). The AI
           returned no scrap/used pair for this item, so there is nothing to show
           and PricingCard directly below is where the seller sets the number. */
        <View style={{ gap: 4 }}>
          <Text className="font-semi text-2xl text-brand-foreground">
            {t('mobile.detail.profitNoEstimate', { defaultValue: 'No price estimate' })}
          </Text>
          <Text className="font-sans text-base text-brand-text-muted" style={{ lineHeight: 18 }}>
            {t('mobile.detail.profitNoEstimateHint', {
              defaultValue:
                'The AI did not return a resale range for this item. Set your own price below.',
            })}
          </Text>
        </View>
      ) : (
        /* Reviewer fix 2026-08-18 — this is a VERBATIM COPY, not something to
           rewrite. Paste `ProfitIntelligenceCard.tsx:209-280` exactly as it
           stands today: the `<View style={{ gap: 12 }}>` … `</View>` block
           holding SCRAP VALUE BASELINE (`:210-238`), the 1 px divider
           (`:240-246`) and POTENTIAL PROFIT (`:248-279`). It already renders
           `{scrapDisplay}` (`:236`) and `{profitDisplay}` (`:276`), so nothing
           inside it changes — only the two consts feeding it move (below). The
           comment at `:206-208` explaining the stacked layout comes with it. */
        <View style={{ gap: 12 }}>{/* …:209-280 verbatim… */}</View>
      )}
```
with the two display strings computed above the `return`, guarded on `figures` (they cannot live inside
the JSX — `const` declarations are statements). `figures` is narrowed to non-null inside the else branch,
so the empty strings are never rendered:
```tsx
  const scrapDisplay = figures ? formatTier(figures.scrapUsd, priceCurrency) : '';
  const profitDisplay = figures
    ? formatTier(figures.profitUsd, priceCurrency, { signed: true })
    : '';
```

8. Replace the whole info row (`:282-310`) — the `profitInsight` sentence — with the disclaimer, and
   render it in **both** states:

```tsx
      {/* M-5: was "Selling on {{marketplace}} could earn you {{percent}}% more than
          scrap value alone." Deleted: the percent hit its own 999 cap in 63% of
          real responses, and `{{marketplace}}` was the seller's own current choice
          dressed up as an AI suggestion. What is left is the one true thing we can
          say about these numbers. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          backgroundColor: ECO_TEAL_SURFACE,
          borderRadius: 8,
          padding: 12,
        }}
      >
        <Info size={16} color={ECO_TEAL} strokeWidth={2.5} style={{ marginTop: 1 }} />
        <Text
          className="flex-1"
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: brand.foreground,
          }}
        >
          {t('mobile.detail.profitAiEstimate', {
            defaultValue: 'AI estimate — verify before publishing',
          })}
        </Text>
      </View>
```

9. Update the two stale doc comments in the same file: the `Props.aiPrices` comment (`:30-37`, "fall back
   to the static stub so the card never renders half-empty") and the component's own comment (`:135-141`,
   "falls back to a static stub so the card still communicates the concept"). Say what happens now: no
   tiers ⇒ empty state.

Re-run S13: `npx jest src/features/scanner/components/detail/__tests__/ProfitIntelligenceCard.test.tsx`
→ **4 passed**.

---

### S15 — M-5: kill the six stale "static stub" comments

Grep first so you fix all of them:
```bash
grep -rn "static stub\|stub" src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v useAppUpdate
```
Expected hits after S14 (the card's own are handled there): `mapAnalyze.ts:57`,
`mapSmartDetection.ts:113-116`, `smartDetectionTypes.ts:126-130`, `scanDraftStore.ts:163-167`, `:257-262`,
`:320-323`. Rewrite each so it stops promising deleted behaviour, e.g.:

- `mapAnalyze.ts:57` → `// the AI didn't include \`prices\` — the card shows its "no estimate" state.`
- `mapSmartDetection.ts:113-116` → `Returns null when the AI didn't return any tier; the card then renders its honest empty state instead of figures.`
- `smartDetectionTypes.ts:128-129` → `Null when the AI didn't return them — the card shows "No price estimate".`
- `scanDraftStore.ts:165-166`, `:260-261`, `:322-323` → same wording.

Comment-only; no behaviour change. `npx tsc --noEmit` after, expect 0 errors.

---

### S16 — M-10: marketplace descriptions + the AI badge on the category label

1. `src/features/scanner/constants.ts` — widen the type and add the copy (`:40-48`):

```ts
// Order + labels mirror web (`ReviewSubmitScreen.tsx#MARKETPLACES`) so the pill
// row is visually identical across platforms: 101LAB → 101MACHINE → 101IT →
// 101RECYCLE, all caps, no spaces.
//
// M-10: `description` is the one-line "what belongs here" hint. After the
// marketplace unlock a seller is shown four codenames with no explanation, while
// the lower-stakes `installation` field has shipped a per-option hint since S5.1
// (INSTALLATION_OPTIONS below). These strings are the ENGLISH FALLBACK; the
// rendered value is `mobile.detail.marketplaceOption.<value>.description`, which
// ships in all six locales. M-3's marketplace sheet reads the same field.
export const MARKETPLACE_OPTIONS: {
  value: '101lab' | '101machine' | '101recycle' | '101it';
  label: string;
  description: string;
}[] = [
  { value: '101lab',     label: '101LAB',     description: 'Lab & scientific equipment' },
  { value: '101machine', label: '101MACHINE', description: 'Industrial & production machinery' },
  { value: '101it',      label: '101IT',      description: 'IT hardware & electronics' },
  { value: '101recycle', label: '101RECYCLE', description: 'Scrap, surplus & recyclable materials' },
];
```
This is type-compatible with all three existing consumers (`LockedMarketplaceRow.tsx:22` and
`MarketplaceCard.tsx:40` read `label`/`value`; `ProfitIntelligenceCard.tsx:157` stops reading it in S14).

2. `MarketplaceCard.tsx` — render the selected option's description under the pill row, exactly the
   pattern `LocationCard.tsx:320-327` uses for `INSTALLATION_OPTIONS.hint`. Insert after the pills'
   closing `</View>` (`:76`) and before the wrapper's `</View>` (`:77`):

```tsx
            {marketplace ? (
              <Text className="font-sans text-sm text-brand-text-muted mt-xs">
                {t(
                  `mobile.detail.marketplaceOption.${marketplace}.description`,
                  MARKETPLACE_OPTIONS.find((o) => o.value === marketplace)?.description ?? '',
                )}
              </Text>
            ) : null}
```
Add `Text` to the `react-native` import if it is not already there (it is — `MarketplaceCard.tsx:1`).

   ⚠️ This card returns `null` today (`MARKETPLACE_LOCKED = true`, `:22`, `:29`), so the line is not
   reachable in this build. That flip is **M-4**, another phase — do **not** flip it here. To see it once
   on the emulator: temporarily set `MARKETPLACE_LOCKED = false`, restart Metro, screenshot, then set it
   back and prove it:
   ```bash
   grep -n "MARKETPLACE_LOCKED = true" src/features/scanner/components/detail/MarketplaceCard.tsx
   # MUST print line 22 before you finish
   ```

3. `CategoryConditionCard.tsx:203` — add the AI badge:
```tsx
            <FieldLabel text={t('mobile.detail.sectionCategory')} required ai />
```
Rationale and the honest caveat are in §5.7. `FieldLabel` already supports both flags together
(`FieldLabel.tsx:18-33`): the red label + `*` from `required`, the sparkle badge from `ai`.

---

### S17 — i18n: 7 new keys × 6 locales, edited as TEXT

The three M-5 keys and the four M-10 descriptions are the only new strings in this phase. M-8 and M-9 add
**none**: the chips reuse `mobile.detail.colPhotos` / `mobile.detail.section*` (all present in all six
locales, verified today) and the invalid-submit alert reuses `mobile.groupedEdit.missingTitle` /
`missingBody` (also present and translated in all six).

**Never** round-trip the locale files through `json.load`/`json.dump`. Verified on 2026-08-18: each of the
six files ends every line with CRLF, and each contains a **duplicate `close` key inside
`mobile.labCommon`** (`en.json:4298` and `en.json:4313`, 16 sibling keys) that a dict round-trip silently
deletes. Two earlier attempts corrupted the files exactly that way.

Create `src/i18n/_phase5_keys.py`:

```python
# Phase 5 (M-5 + M-10): insert 7 keys into `mobile.detail` in all six locales.
#
# TEXT MODE ONLY. Do NOT round-trip these files through json.load/json.dump:
#   * each file carries a DUPLICATE "close" key inside `mobile.labCommon`
#     (en.json:4298 and :4313) that a dict round-trip silently deletes;
#   * every line ends CRLF, which json.dump would rewrite to LF.
# This script only INSERTS whole lines after a unique anchor line, in binary mode,
# then re-parses each file and re-checks the duplicate key to prove nothing broke.
#
# Idempotent: a file that already has the keys is skipped.
# Run from this directory:  python _phase5_keys.py

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LOCALES = os.path.join(HERE, 'locales')

# Unique, 6-space indented, inside `mobile.detail`, and comma-terminated in all six
# files (checked: en:3805 zh-Hans:3791 zh-Hant:3791 ja:3726 th:3710 vi:3807).
ANCHOR = b'"profitIntelligence":'

TEXT = {
    'en': {
        'profitAiEstimate': 'AI estimate \u2014 verify before publishing',
        'profitNoEstimate': 'No price estimate',
        'profitNoEstimateHint': 'The AI did not return a resale range for this item. Set your own price below.',
        '101lab': 'Lab & scientific equipment',
        '101machine': 'Industrial & production machinery',
        '101it': 'IT hardware & electronics',
        '101recycle': 'Scrap, surplus & recyclable materials',
    },
    'zh-Hans': {
        'profitAiEstimate': 'AI \u4f30\u7b97 \u2014 \u53d1\u5e03\u524d\u8bf7\u6838\u5b9e',
        'profitNoEstimate': '\u6682\u65e0\u4ef7\u683c\u4f30\u7b97',
        'profitNoEstimateHint': 'AI \u672a\u8fd4\u56de\u8be5\u7269\u54c1\u7684\u8f6c\u552e\u4ef7\u683c\u533a\u95f4\u3002\u8bf7\u5728\u4e0b\u65b9\u81ea\u884c\u8bbe\u5b9a\u4ef7\u683c\u3002',
        '101lab': '\u5b9e\u9a8c\u5ba4\u4e0e\u79d1\u7814\u8bbe\u5907',
        '101machine': '\u5de5\u4e1a\u4e0e\u751f\u4ea7\u673a\u68b0',
        '101it': 'IT \u786c\u4ef6\u4e0e\u7535\u5b50\u8bbe\u5907',
        '101recycle': '\u5e9f\u6599\u3001\u5269\u4f59\u7269\u8d44\u4e0e\u56de\u6536\u6750\u6599',
    },
    'zh-Hant': {
        'profitAiEstimate': 'AI \u4f30\u7b97 \u2014 \u767c\u5e03\u524d\u8acb\u6838\u5be6',
        'profitNoEstimate': '\u66ab\u7121\u50f9\u683c\u4f30\u7b97',
        'profitNoEstimateHint': 'AI \u672a\u56de\u50b3\u6b64\u7269\u54c1\u7684\u8f49\u552e\u50f9\u683c\u5340\u9593\u3002\u8acb\u5728\u4e0b\u65b9\u81ea\u884c\u8a2d\u5b9a\u50f9\u683c\u3002',
        '101lab': '\u5be6\u9a57\u5ba4\u8207\u79d1\u7814\u8a2d\u5099',
        '101machine': '\u5de5\u696d\u8207\u751f\u7522\u6a5f\u68b0',
        '101it': 'IT \u786c\u9ad4\u8207\u96fb\u5b50\u8a2d\u5099',
        '101recycle': '\u5ee2\u6599\u3001\u5269\u9918\u7269\u8cc7\u8207\u56de\u6536\u6750\u6599',
    },
    'ja': {
        'profitAiEstimate': 'AI\u63a8\u5b9a \u2014 \u516c\u958b\u524d\u306b\u3054\u78ba\u8a8d\u304f\u3060\u3055\u3044',
        'profitNoEstimate': '\u4fa1\u683c\u306e\u63a8\u5b9a\u306f\u3042\u308a\u307e\u305b\u3093',
        'profitNoEstimateHint': '\u3053\u306e\u5546\u54c1\u306e\u518d\u8ca9\u4fa1\u683c\u5e2f\u306fAI\u304b\u3089\u8fd4\u3055\u308c\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u4e0b\u3067\u4fa1\u683c\u3092\u8a2d\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
        '101lab': '\u7814\u7a76\u5ba4\u30fb\u79d1\u5b66\u6a5f\u5668',
        '101machine': '\u7523\u696d\u30fb\u751f\u7523\u6a5f\u68b0',
        '101it': 'IT\u6a5f\u5668\u30fb\u96fb\u5b50\u6a5f\u5668',
        '101recycle': '\u30b9\u30af\u30e9\u30c3\u30d7\u30fb\u4f59\u5270\u54c1\u30fb\u30ea\u30b5\u30a4\u30af\u30eb\u6750',
    },
    'th': {
        'profitAiEstimate': '\u0e01\u0e32\u0e23\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13\u0e42\u0e14\u0e22 AI \u2014 \u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e01\u0e48\u0e2d\u0e19\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48',
        'profitNoEstimate': '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e01\u0e32\u0e23\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13\u0e23\u0e32\u0e04\u0e32',
        'profitNoEstimateHint': 'AI \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e43\u0e2b\u0e49\u0e0a\u0e48\u0e27\u0e07\u0e23\u0e32\u0e04\u0e32\u0e02\u0e32\u0e22\u0e15\u0e48\u0e2d\u0e02\u0e2d\u0e07\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e19\u0e35\u0e49 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e31\u0e49\u0e07\u0e23\u0e32\u0e04\u0e32\u0e14\u0e49\u0e32\u0e19\u0e25\u0e48\u0e32\u0e07',
        '101lab': '\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c\u0e2b\u0e49\u0e2d\u0e07\u0e1b\u0e0f\u0e34\u0e1a\u0e31\u0e15\u0e34\u0e01\u0e32\u0e23\u0e41\u0e25\u0e30\u0e27\u0e34\u0e17\u0e22\u0e32\u0e28\u0e32\u0e2a\u0e15\u0e23\u0e4c',
        '101machine': '\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e08\u0e31\u0e01\u0e23\u0e2d\u0e38\u0e15\u0e2a\u0e32\u0e2b\u0e01\u0e23\u0e23\u0e21\u0e41\u0e25\u0e30\u0e01\u0e32\u0e23\u0e1c\u0e25\u0e34\u0e15',
        '101it': '\u0e2e\u0e32\u0e23\u0e4c\u0e14\u0e41\u0e27\u0e23\u0e4c\u0e44\u0e2d\u0e17\u0e35\u0e41\u0e25\u0e30\u0e2d\u0e34\u0e40\u0e25\u0e01\u0e17\u0e23\u0e2d\u0e19\u0e34\u0e01\u0e2a\u0e4c',
        '101recycle': '\u0e40\u0e28\u0e29\u0e27\u0e31\u0e2a\u0e14\u0e38 \u0e02\u0e2d\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e43\u0e0a\u0e49 \u0e41\u0e25\u0e30\u0e27\u0e31\u0e2a\u0e14\u0e38\u0e23\u0e35\u0e44\u0e0b\u0e40\u0e04\u0e34\u0e25',
    },
    'vi': {
        'profitAiEstimate': '\u01af\u1edbc t\u00ednh b\u1eb1ng AI \u2014 h\u00e3y ki\u1ec3m tra tr\u01b0\u1edbc khi \u0111\u0103ng',
        'profitNoEstimate': 'Ch\u01b0a c\u00f3 \u01b0\u1edbc t\u00ednh gi\u00e1',
        'profitNoEstimateHint': 'AI kh\u00f4ng tr\u1ea3 v\u1ec1 kho\u1ea3ng gi\u00e1 b\u00e1n l\u1ea1i cho m\u1eb7t h\u00e0ng n\u00e0y. H\u00e3y t\u1ef1 \u0111\u1eb7t gi\u00e1 b\u00ean d\u01b0\u1edbi.',
        '101lab': 'Thi\u1ebft b\u1ecb ph\u00f2ng th\u00ed nghi\u1ec7m v\u00e0 khoa h\u1ecdc',
        '101machine': 'M\u00e1y m\u00f3c c\u00f4ng nghi\u1ec7p v\u00e0 s\u1ea3n xu\u1ea5t',
        '101it': 'Thi\u1ebft b\u1ecb IT v\u00e0 \u0111i\u1ec7n t\u1eed',
        '101recycle': 'Ph\u1ebf li\u1ec7u, v\u1eadt t\u01b0 d\u01b0 v\u00e0 v\u1eadt li\u1ec7u t\u00e1i ch\u1ebf',
    },
}

FILES = {
    'en': 'en.json',
    'zh-Hans': 'zh-Hans.json',
    'zh-Hant': 'zh-Hant.json',
    'ja': 'ja.json',
    'th': 'th.json',
    'vi': 'vi.json',
}


def esc(s):
    """JSON-escape a single string value (no dict round-trip)."""
    return json.dumps(s, ensure_ascii=False)


def block(v):
    """The exact lines to insert, 6-space indent, CRLF-terminated."""
    lines = [
        '      "profitAiEstimate": %s,' % esc(v['profitAiEstimate']),
        '      "profitNoEstimate": %s,' % esc(v['profitNoEstimate']),
        '      "profitNoEstimateHint": %s,' % esc(v['profitNoEstimateHint']),
        '      "marketplaceOption": {',
        '        "101lab": {',
        '          "description": %s' % esc(v['101lab']),
        '        },',
        '        "101machine": {',
        '          "description": %s' % esc(v['101machine']),
        '        },',
        '        "101it": {',
        '          "description": %s' % esc(v['101it']),
        '        },',
        '        "101recycle": {',
        '          "description": %s' % esc(v['101recycle']),
        '        }',
        '      },',
    ]
    return b''.join((ln.encode('utf-8') + b'\r\n') for ln in lines)


def dup_close_count(raw):
    """How many objects carry a duplicate key. Must be 1 before and after."""
    hits = []

    def hook(pairs):
        seen = {}
        for k, val in pairs:
            if k in seen:
                hits.append(k)
            seen[k] = val
        return seen

    json.loads(raw.decode('utf-8'), object_pairs_hook=hook)
    return hits


for locale, fname in FILES.items():
    path = os.path.join(LOCALES, fname)
    raw = open(path, 'rb').read()
    before_dups = dup_close_count(raw)
    before_crlf = raw.count(b'\r\n')
    if b'"profitAiEstimate":' in raw:
        print('%-12s already has the keys - skipped' % locale)
        continue
    lines = raw.split(b'\r\n')
    idx = [i for i, ln in enumerate(lines) if ANCHOR in ln]
    assert len(idx) == 1, '%s: expected exactly 1 anchor, found %d' % (fname, len(idx))
    at = idx[0]
    ins = block(TEXT[locale])
    out = b'\r\n'.join(lines[: at + 1]) + b'\r\n' + ins + b'\r\n'.join(lines[at + 1 :])
    # Prove it before writing.
    json.loads(out.decode('utf-8'))
    open(path, 'wb').write(out)
    after = open(path, 'rb').read()
    assert dup_close_count(after) == before_dups, '%s: duplicate-key set changed' % fname
    assert after.count(b'\r\n') == before_crlf + 17, '%s: unexpected line count' % fname
    assert after.count(b'\n') == after.count(b'\r\n'), '%s: a bare LF appeared' % fname
    print('%-12s +7 keys, still valid, CRLF intact' % locale)
```

This script's logic was dry-run on 2026-08-18 against a COPY of `en.json` (the real files were not
touched): result `+7 keys, valid JSON, CRLF intact`, CRLF count 5290 → 5307, and the duplicate
`mobile.labCommon.close` key still present afterwards.

Run and verify:
```bash
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/src/i18n && python _phase5_keys.py
# expect six lines: "<locale>  +7 keys, still valid, CRLF intact"
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp && git diff --stat src/i18n/locales/
# expect: 6 files changed, 102 insertions(+)   (17 lines each), 0 deletions
git diff src/i18n/locales/en.json | head -30
# eyeball: ONLY additions, no reindentation, no CRLF churn (no "^M" noise on
# untouched lines)
```
If `git diff --stat` reports **any** deletions, stop: something round-tripped. `git checkout --
src/i18n/locales/` and retry (this is the one `git checkout` this phase allows — it touches only these
six files, which nobody else in this programme edits).

Then add the coverage test, `src/i18n/__tests__/phase5Keys.test.ts` (same shape as the existing
`draftKeys.test.ts`):

```ts
import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

// Phase 5: M-5 (profit-card honesty) + M-10 (marketplace option descriptions).
const DETAIL_KEYS = ['profitAiEstimate', 'profitNoEstimate', 'profitNoEstimateHint'];
const MARKETPLACES = ['101lab', '101machine', '101it', '101recycle'];

const LOCALES = { en, zhHant, zhHans, ja, th, vi };
const TRANSLATED = { zhHant, zhHans, ja, th, vi };

describe('phase 5 i18n', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has the profit-card + marketplace-description keys`, () => {
      const detail = (dict as any).mobile?.detail ?? {};
      for (const k of DETAIL_KEYS) expect(typeof detail[k]).toBe('string');
      for (const m of MARKETPLACES) {
        expect(typeof detail.marketplaceOption?.[m]?.description).toBe('string');
        expect(detail.marketplaceOption[m].description.length).toBeGreaterThan(0);
      }
    });
  }

  // The five non-English locales must actually be translated, not English copies.
  for (const [name, dict] of Object.entries(TRANSLATED)) {
    it(`${name} does not fall back to the English strings`, () => {
      const detail = (dict as any).mobile.detail;
      const enDetail = (en as any).mobile.detail;
      for (const k of DETAIL_KEYS) expect(detail[k]).not.toBe(enDetail[k]);
      for (const m of MARKETPLACES) {
        expect(detail.marketplaceOption[m].description).not.toBe(
          enDetail.marketplaceOption[m].description,
        );
      }
    });
  }

  // The duplicate `mobile.labCommon.close` key (en.json:4298 and :4313) is the
  // canary for a json.load/json.dump round-trip: a round-trip deletes one of them.
  // It survives here only because these files are edited as TEXT.
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} still parses and keeps mobile.labCommon.close`, () => {
      expect((dict as any).mobile.labCommon.close).toBeTruthy();
    });
  }
});
```
```bash
npx jest src/i18n/__tests__/phase5Keys.test.ts 2>&1 | tail -6
# expect: 17 passed  (6 + 5 + 6)
```

Also confirm the reused keys the new code depends on are all present (they were on 2026-08-18 — this is
the guard against someone pruning them later):
```bash
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/src/i18n/locales && python -c "
import json
keys=['colPhotos','sectionTitle','sectionDescription','sectionCategory','sectionCondition','sectionPrice','sectionLocation']
for f in ['en.json','zh-Hans.json','zh-Hant.json','ja.json','th.json','vi.json']:
    d=json.load(open(f,encoding='utf-8'))
    det=d['mobile']['detail']; ge=d['mobile']['groupedEdit']
    print(f, [k for k in keys if k not in det], bool(ge.get('missingTitle')), bool(ge.get('missingBody')))
"
# expect six lines of: <file> [] True True
```
(This one-liner only READS the files — it never writes, so the round-trip hazard does not apply.)

---

### S18 — M-11: the grouped editor's footer

`app/scan/grouped-edit.tsx`: the footer `View` at `:233-296` is a sibling of the
`KeyboardAwareScrollView` at `:207-230`. Wrap it the same way you wrapped `detail.tsx` in S11 step 6
(same `enabled` decision from S1):

```tsx
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View
          className="px-md pt-sm pb-md bg-brand-background"
          style={{ borderTopWidth: 1, borderTopColor: brand.border }}
        >
          {/* … unchanged CTA IIFE … */}
        </View>
      </KeyboardStickyView>
```
and extend the import at `:5`:
```ts
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
```
Nothing else on this screen changes — it keeps its `RequiredChecklist` card (`:229`) and its existing
`onInvalid` (§5.5).

---

### S19 — Device pass on dev (the whole phase, one run)

Emulator + Metro per §3.1, `.env` on dev (§3 E2/E3), Metro restarted so the new bundle is in. Then, on
`app/scan/detail.tsx` reached from the lab home with one photo:

| # | Do | Expect |
|---|---|---|
| 1 | Land on the editor | Profit card shows two USD ranges, an `AI` badge and "AI estimate — verify before publishing". **No `%`, no "more than scrap", no marketplace name** |
| 2 | Compare with S13's numbers | Ranges match the AI's `prices.scrap` / `prices.used` for that photo (the SSE `product` event's `data.prices`), not `12,500`/`4,200` |
| 3 | Clear TITLE | Footer shows a partly-filled 4 px bar and a red `TITLE` chip; the CTA is a live green button, not flat grey |
| 4 | Scroll to the bottom, then tap the `TITLE` chip | Scrolls back to `IdentityCard` |
| 5 | Press Submit with TITLE empty | Haptic + alert "Some fields are missing / Please add: **TITLE**", scroll to `IdentityCard`, keyboard focus in the title input. **No silent no-op**. *(Reviewer fix: the field name is ALL CAPS on device — `mobile.detail.sectionTitle` is `"TITLE"` in en.json, which is why `HubRow` lowercases it at `grouped-review.tsx:568`. `grouped-edit.tsx` already alerts the same way, so this is parity, not a bug. Do not "fix" it here.)* |
| 6 | Fill everything | The strip disappears entirely; the checklist card collapses to the green "✓ ALL REQUIRED COMPLETE" strip; the CTA stays green. **Do NOT press Submit** — that writes a listing (dev DB, still a write; the release gate's one DEV submit is a separate, owner-approved step in plan §8.3 gate 3) |
| 7 | Focus a text input near the bottom (e.g. a LOCATION row) | Per S1: the CTA is above the keyboard |
| 8 | Switch language to ja, then vi (Account → Language) | Profit-card disclaimer + empty state and (with `MARKETPLACE_LOCKED` temporarily false) the four marketplace descriptions render translated; nothing shows a raw `mobile.detail.*` key |
| 9 | Repeat 3/5/7 on a multi-photo upload, from `grouped-review` → a row → `grouped-edit` | Its footer is keyboard-sticky (S18); the rest of that screen is unchanged |
| 10 | **See the empty state on device.** Temporarily change `app/scan/detail.tsx:131` to `<ProfitIntelligenceCard aiPrices={null} />`, restart Metro, land on the editor | "No price estimate" + the hint + the "AI estimate" disclaimer, **no** `AI` badge, no figures, no blank panel. Then revert the line and prove it: `grep -n "aiPrices={draft.aiPrices}" app/scan/detail.tsx` **must** print line 131 before you finish |

**Reviewer addition 2026-08-18 — why row 10 exists.** M-5 is called the most sensitive change in the
programme (§11) and its empty state is the one new thing a seller will actually see, yet rows 1-9 never
show it: the dev AI returned a `scrap` range on **81/81** calls (`SCAN_FLOW_BACKEND.md:352-355`), so
`figures === null` is unreachable on dev by normal use and would otherwise ship covered by a unit test
only. Row 10 forces it, using the same temporary-flip-then-prove-you-reverted discipline S16 already uses
for `MARKETPLACE_LOCKED`.

Capture screenshots for 1, 3, 5, 6, 7. Then restore `.env` (§3 E4) and confirm
`grep -n "MARKETPLACE_LOCKED = true" src/features/scanner/components/detail/MarketplaceCard.tsx` prints
line 22.

---

## 8. Verification

Run in this order, from `c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp`.

```bash
# 1 — types
npx tsc --noEmit
# expect: no output, exit 0.  BASELINE: 0 errors (verified 2026-08-18)

# 2 — lint
npm run lint
# expect: no NEW errors/warnings in the files this phase touched. (Baseline not
# captured here — run it BEFORE your first edit and diff the two outputs.)

# 3 — full unit suite
npx jest --silent 2>&1 | tail -6
# BASELINE before this phase: 92 suites / 825 tests / 22 snapshots, all passing
# EXPECT after:               96 suites / 862 tests, all passing (if the four new
#                             suites are written exactly as given: +14 +4 +2 +17)
#   +4 suites: requiredStatusGap, ProfitIntelligenceCard, RequiredProgressStrip,
#              phase5Keys
# The "A worker process has failed to exit gracefully" warning is pre-existing.

# 4 — the four new suites on their own
npx jest src/features/scanner/__tests__/requiredStatusGap.test.ts \
         src/features/scanner/components/detail/__tests__/ProfitIntelligenceCard.test.tsx \
         src/features/scanner/components/detail/__tests__/RequiredProgressStrip.test.tsx \
         src/i18n/__tests__/phase5Keys.test.ts 2>&1 | tail -8

# 5 — the suites most likely to regress
npx jest src/services/scanner/__tests__/otherSubcategory.test.ts \
         src/features/scanner/components/detail/__tests__/DetailFooter.saveDraft.test.tsx \
         src/stores/__tests__/scanDraftStore.hydrate.test.ts \
         src/i18n/__tests__ 2>&1 | tail -8
# expect: all pass

# 6 — locale integrity (the two failure modes of the earlier attempts).
# READ-ONLY. Run it from src/i18n/locales:
cd src/i18n/locales && python - <<'PYEOF'
import json
for f in ['en.json','zh-Hans.json','zh-Hant.json','ja.json','th.json','vi.json']:
    b = open(f,'rb').read()
    dups = []
    def hook(pairs, acc=dups):
        seen = {}
        for k, v in pairs:
            if k in seen: acc.append(k)
            seen[k] = v
        return seen
    json.loads(b.decode('utf-8'), object_pairs_hook=hook)
    print(f, 'parses  crlf=%d lf=%d  dups=%s' % (b.count(b'\r\n'), b.count(b'\n'), dups))
PYEOF
cd ../../..
# expect one line per file: parses, crlf == lf (no bare LF crept in), dups=['close'].
# Line counts BEFORE this phase (measured 2026-08-18) -> AFTER (+17 lines each):
#   en 5290->5307  zh-Hans 5262->5279  zh-Hant 5262->5279
#   ja 5195->5212  th 5179->5196       vi 5280->5297
git diff --stat src/i18n/locales/
# expect: 6 files changed, 102 insertions(+), 0 deletions(-)

# 7 — env restored
npx expo config --type public | grep GREENBIDZ_API_URL
# expect: 'https://api.101recycle.greenbidz.com/api/v1'

# 8 — the lock was not flipped
grep -n "MARKETPLACE_LOCKED = true" src/features/scanner/components/detail/MarketplaceCard.tsx
# expect: 22:const MARKETPLACE_LOCKED = true;

# 9 — no stale promises left. Reviewer fix 2026-08-18: grep for "stub", not
# "static stub" — one of the six sites S15 must fix (mapSmartDetection.ts:115)
# reads "...stub (rather than render a half-empty insight)" and the narrower
# pattern lets it survive this gate.
grep -rn "stub" src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v useAppUpdate
# expect: no output
```

**Backend suite:** not applicable — this phase changes no backend file. For the record, the brief's
backend baseline is *2 pre-existing failing suites* (`zohoListingSyncPublished`,
`uploadValidationService`); **I did not run it** and nothing here should be judged against it. If your
change set somehow touches `101recycle-greenbidz-backend/`, you have gone outside this phase.

**Device evidence to attach:** the S1 keyboard observation (a or b, with the screenshot), and the S19
screenshots for rows 1, 3, 5, 6, 7.

**UX_DESIGN_RULES checklist** (run it before calling this done — it is mandatory):

| Question | Answer for this phase |
|---|---|
| Can a first-time user finish without guidance? | Better: the footer now names what is missing and jumps there (S8/S11) |
| Is the next action obvious? | Yes — the grey no-reason button is gone (S9), the chips say what is left |
| Only one primary CTA? | Yes, unchanged: Submit stays the only filled button |
| Can anything be removed? | Yes, and it was: the stub numbers, the capped percent, the circular marketplace sentence, and the duplicated draft→form projection |
| Can scrolling be reduced? | Not by this phase — that is M-2's searchable category sheet (~480 px) and the deferred IA restructure. The strip removes the *need* to scroll to learn why Submit is blocked |
| Duplicate controls? | None. The strip is progress + navigation with no copy of its own; the checklist card is the per-field summary (§5.4) |
| Adapted to progress? | Yes — the strip renders `null` when complete, the checklist collapses to one green line |
| Feedback on every action? | Yes — chip tap = haptic + scroll; invalid submit = haptic + named alert + scroll + focus |
| Error recovery? | Yes — every alert names the fields and moves the seller to the first one |
| AI UX: confidence shown, no invented information? | The invented figures are gone and the surviving ranges are labelled "AI estimate — verify before publishing". Numeric confidence is deliberately out of v1 (plan §2.1) |

---

## 9. What this phase does NOT do

- **It does not flip any marketplace lock.** `MARKETPLACE_LOCKED` (`MarketplaceCard.tsx:22`),
  `scanDraftStore.ts:413` and `app/scan/processing.tsx:504-508` are untouched — that is **M-4**.
- **It does not ground the scrap value.** 100% of scrap figures are model guesses
  (`SCAN_FLOW_BACKEND.md:352-355`); this phase stops the card *lying* about them, it does not make them
  right (plan §9).
- **It does not bring the percentage back in another form** (no "up to N%", no bands). It is out until
  the scrap number means something.
- **It does not restructure the review screen** (ten cards → three steps), does not add the searchable
  category sheet (M-2), does not build the routing chip (M-3), does not consume
  `site_type_confidence` / `needs_clearer_photo` (M-6), and does not add remote config (M-12).
- **It does not change `detailSchema`.** No field is added, removed or relaxed.
- **It does not move or delete `RequiredChecklist`** (§5.4), and it does not add the strip to
  `grouped-edit.tsx` (§5.5).
- **It does not un-disable the grouped-mode footer buttons** — only the single-mode Submit (§5.6).
- **It does not make the ten AI badges conditional on provenance** (§5.7).
- **It does not submit, publish or delete anything**, on dev or prod, and it runs no migration.
- **It does not ship.** No commit, no push, no `eas build`, no `eas update` — 1.0.3 is in review and an
  OTA would reach that build (plan §8.2).
- **It does not verify iOS keyboard behaviour** if S1 lands on outcome (b): there is no iOS simulator on
  this machine (win32). That single claim must be checked on a Mac before 1.0.4 goes out.

---

## 10. What must land before / after

**Before this phase (none blocking):** nothing. All six tasks are independent of Stage 0 (server) and of
the other Stage 1 tasks, which is exactly why plan §8.2 says *"M-5 can ship before the unlock and
should"*. The only sequencing constraint inside the phase is the step order in §7 (M-7's
`requiredRowLabels` + `rowForPath` are consumed by M-8 and M-9).

**Soft ordering with sibling phases:**
- **Land M-5's comment edits before M-6.** M-6 edits `mapSmartDetection.ts:186-190` /
  `smartDetectionTypes.ts:122-125`, adjacent to the stub comments S15 rewrites at
  `mapSmartDetection.ts:113-116` and `smartDetectionTypes.ts:126-130`. Same files, ~2 lines apart.
- **Land M-7 before M-4.** M-4 lets the AI write `marketplace`, and `marketplace: z.enum([...])`
  (`schema.ts:57`) is the first realistic way to reintroduce an invisible blocker — plan §6.3 says so.
  After S4, an unrecognised `site_type` can no longer produce an unsubmittable draft.
- **M-8's `useRequiredRowLabel`** is what M-3's routing chip should use if it needs to name a required
  field; it is already exported.

**After this phase, in order:**
1. **M-2** (searchable category sheet) — the plan makes it a v1 blocker (§4.2 item 4) and it is the piece
   that actually shortens the ~3,200 px scroll.
2. **M-1 / M-3 / M-4 / M-6 / M-10's sheet consumption**, then the Stage 0 server work on dev.
3. **Release gates** (plan §8.3): prod re-measurement, the S0-1 regression replay, **one** mixed submit on
   DEV, and the on-device pass on an SE-class phone plus an Android with a 3-button nav bar — including
   the Vietnamese condition pills, which are ~2× the English width and wrap in a `flex-wrap` row.
4. **1.0.4 binary** (`app.config.ts:34` → `1.0.4`, Android `versionCode` 7 — Play is at 6). Only after
   1.0.3 is out of review. If 1.0.4 slips, M-5 alone may go out as an OTA on 1.0.3 *after* 1.0.3 is
   approved **and released** — never while it is in review.

---

### 10.1 Known merge overlap with Phase 4 (read this before you edit `detail.tsx`)

`PHASE_4_APP_UNLOCK_AND_ROUTING.md` edits the same two hunks of `app/scan/detail.tsx` that S11 does:

| Hunk | Phase 4 does | This phase does | Resolution |
|---|---|---|---|
| `detail.tsx:127` (`<IdentityCard />`) | mounts `<RoutingChip>` immediately above it | wraps it in `<View onLayout={registerRow('title')}>` | Independent — the chip goes **above** the wrapper, not inside it. Whoever lands second re-applies by hand; it is two lines. |
| `detail.tsx:148` (`allRequired={required.allComplete}`) + the footer's disabled logic | adds a routing-confirmed term to the footer gate | removes `!allRequired` from the **single-mode** Submit's `disabled` (§5.6) | **Real collision.** After this phase the single-mode Submit is not gated by state at all; it is gated by `handleSubmit` + `onInvalid`. Phase 4 must express "marketplace not confirmed yet" the same way — as something the seller can SEE and act on — not by re-greying the CTA. |

The clean way to express Phase 4's gate on top of this phase, if it needs one: make the unconfirmed
marketplace a **required row** (an eighth `REQUIRED_ROWS` entry with a `rowForPath` mapping, so it gets a
footer chip, a scroll target and a name in the invalid-submit alert for free) rather than a new boolean
folded into `disabled`. That keeps the invariant this phase establishes: **every reason Submit will not
go through is named on screen.** If Phase 4 lands first, S9's comment needs updating to mention the extra
term; nothing else in this phase changes.

**Reviewer addition 2026-08-18 — `MarketplaceCard` and M-3.** S16 step 2 renders the selected option's
description as a `<Text>` under the pill row (`MarketplaceCard.tsx:76-77`), and M-3's brief says
"`MarketplaceCard` becomes the sheet body" (plan §7, M-3). Whoever lands M-3 must decide **one** home for
that string — the per-option row inside the sheet **or** a single line under the trigger — not both, or
the same sentence appears twice on one screen (`UX_DESIGN_RULES.md` → "Remove duplication"). The data
contract (§6) is unaffected either way: `MARKETPLACE_OPTIONS[].description` +
`mobile.detail.marketplaceOption.<value>.description` ship here regardless of where they are rendered.

Phase 3 (`M-1`/`M-2`) touches `CategoryConditionCard.tsx` heavily; the only line this phase changes there
is `:203` (the AI badge, S16 step 3). If Phase 3 lands first, re-find that `FieldLabel` — M-2 collapses
the card to one row and the label may move.

## 11. Honest limits of this plan

- Every `file:line` here was opened on 2026-08-18 at app commit `11ef609`. The drift table (§2.2) is what
  I found; §2.3 is how you re-check it if the tree moved.
- The app baselines in §8 (`0` tsc errors; 92 suites / 825 tests / 22 snapshots) I ran myself today. The
  **backend** baseline quoted in the brief I did **not** run — no backend file is in scope.
- The "expected failures" in S3, S10 and S13 are derived by reading the current code, not by running the
  new tests (writing them is the implementer's step). If one of them unexpectedly *passes* first time,
  stop and find out why before continuing — it means the code no longer says what §2.2 says it says.
- **The M-11 keyboard problem is structural-only until S1 runs.** I did not boot an emulator for this
  document. That is precisely why S1 exists and why S11/S18 have two branches.
- The `999`/63% figures, the 24-photo accuracy set and the "~3,200 px" scroll height are all quoted from
  the two audit documents (DEV, n = 24 × 3; the px figure is arithmetic on source constants, not measured
  on hardware). I re-derived none of them.
- No commit, push, branch switch, stash, reset, deploy, migration or production write was performed in
  producing this document; no `.ts`/`.tsx`/`.js` source file was edited; `greenbidz-ai-assistant/` was not
  touched. The only dev-server contact was one read-only `GET /api/v1/product/category` (HTTP 200) and one
  `npx expo config` (local).

### 11.1 KNOWN, NOT FIXED — a JS restart reverts every unsaved form edit *(device pass 2026-08-19)*

**What was seen.** A screen-size / density configuration change on the review form reverted an unsaved
CATEGORY pick to the stored draft value.

**What it actually is.** The category is not special, and the trigger is not really "configuration
change" — it is *a JS runtime restart*. The mechanism, verified in source:

1. the scan draft is MMKV-persisted (`scanDraftStore.ts`, key `scan.currentDraft`, debounced 250 ms) and
   rehydrated by `useScanDraft.hydrate()` on boot;
2. the detail form is a **scratch buffer** over that draft: `useDetailController` creates
   `useForm({ defaultValues: emptyDetailDefaults() })` and then, on every change of the `draft` object's
   identity, runs `reset(draftToFormValues(draft))`;
3. the only things that write form values BACK to the store are the four submit paths
   (`buildDraftPatch(values, …)` on Submit / Add another / Review group / Save & return);
4. `CategoryConditionCard.applyPick` therefore writes the FORM only — deliberately, per §1's hydration
   race, which is why it is documented as "the ONLY place this card writes the category fields".

So on a JS restart the store is rehydrated and the form is rebuilt from it, and **every edit made since
the last store write is gone** — the category, and equally title, description, price, specs and
locations. Photos survive (`updatePhotos` writes the store). The routing answer survives (the chip
patches the store). The AI's own values survive (processing.tsx patched them). What the seller loses is
exactly their MANUAL corrections, which is the more annoying half.

On Android, `density` is not in Expo's default `android:configChanges`, so `adb shell wm density …`
recreates the activity and restarts RN — that is why the device pass saw it. A normal ROTATION does not
(orientation and screenSize are in the default set). The other real-world triggers are a
background/low-memory kill and a dev reload.

**Why it was not fixed here, with the three options that were considered:**

| option | why not |
|---|---|
| `applyPick` also patches the store with just the category fields | `patch()` sets a NEW `current`, which re-fires the `[draft, reset]` effect and runs `reset(draftToFormValues(draft))`. Every OTHER unsaved edit (a half-typed title, a price) reverts at the moment the seller taps a category. Trades a rare bug for a common one. |
| `applyPick` patches the store with the WHOLE form snapshot, so the reset is a no-op | Correct in principle, and the right eventual design. But the card is mounted by BOTH `app/scan/detail.tsx` (store slot `current`) and `app/scan/grouped-edit.tsx` (slot `queuedItems[index]`), and the card cannot know which. It needs an explicit per-screen persist callback — a new store write path out of a shared card, into the exact area §1 and blocker (c) warn about, plus it makes every category tap an autosave of a half-typed form into a persisted draft. Phase-sized, not fix-sized. |
| `reset(…, { keepDirtyValues: true })` in the controller | Directly breaks **blocker (c)**. The RoutingChip's store patch RELIES on the reset restoring the CLEARED category into the form; a dirty `categoryId` — and a seller's pick is dirty by definition — would be KEPT and the clear defeated, so submit would send the previous tree's category id with the new marketplace's `allowed_sites[]`. That is the precise bug blocker (c) exists to prevent. |

**Consequence to accept in the meantime:** manual edits are silently discarded on a JS restart, with no
warning and no way to recover them. Nothing is corrupted and the draft itself is never lost.

**If it is picked up:** option 2, with the persist callback supplied by each screen (`patch(buildDraftPatch(...))`
on detail, `patchQueuedItem(index, ...)` on grouped-edit), plus a test that a store write during editing
does not revert a sibling field. `useDetailController.ts`'s reset effect now carries a comment pointing
at this section.

