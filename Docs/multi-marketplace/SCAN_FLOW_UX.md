# Scan flow UX audit — safe areas, inputs, and form complexity

**Scope:** `GreenBridgeApp/app/scan/*` and `src/features/scanner/components/detail/*`, read against
`greenBridge/UX_DESIGN_RULES.md`.
**Purpose:** prepare the scan flow for multi-marketplace (101lab / 101machine / 101it / 101recycle)
routing without turning the review screen into a bigger form.
**Status:** analysis and design only. No source file was modified. Every code claim carries a
`file:line`; every measurement says how it was taken; anything not verified says so.
**Date:** 2026-08-18.

---

## 1. The short version (for the owner)

The scanning flow is technically strong and unusually careful about safe areas — the hard,
device-specific bugs (Android nav-bar overlap, double-reserved insets, un-pinned footers) have
already been found and fixed, and the comments in the code record why. Two things are not fine.

**First, the review screen is a form, not a workflow.** `app/scan/detail.tsx` is one scroll of ten
cards — an estimated **~3,200 px, roughly 5 screens on an iPhone 14 and 6 on an iPhone SE**
(§4.3) — carrying **26 form fields** of which only **7 are ever shown as required** (§4.1). The
progress indicator and the "what's still missing" checklist sit at the **bottom of that scroll**
(`detail.tsx:139`), while the Submit button sits in the footer at the top of the thumb. A seller
whose Submit is greyed out has to scroll five screens to find out why. `UX_DESIGN_RULES.md:96-98`
requires progress and validation to be sticky on long forms; the sibling screen
`grouped-review.tsx:355-401` already does exactly that, so the flow contradicts itself.

**Second, the single worst control in the flow is the one multi-marketplace makes central: the
category picker.** It is two stacked 240 px-tall nested scroll lists inside the page scroll
(`CategoryConditionCard.tsx:211-216, 267-272`), with no search. Measured against production today,
the 101lab tree is 4 parents and 62 subcategories, **38 of them under one parent** — about **5 rows
visible at a time, so ~7 in-card swipes to reach the last brand**, in a scroll region that does not
chain to the page (§5.2). Unlock four marketplaces and this control becomes the place every seller
spends their time.

**Two blockers sit between the current code and the owner's goal**, and neither is a UI problem:

- **The AI's marketplace confidence never reaches the app.** The backend computes a
  `site_type_confidence` per product and then throws it away in
  `wordPressSmart.js:1657-1685` (`resolveSiteTypeForGroup` returns `{siteType, suggested_terms}`
  only). The wire payload's `detection.confidence` (`wordPressSmart.js:3355-3372`) is the
  *how-many-products* confidence, not the marketplace one. "Only ask the seller when the machine is
  unsure" **cannot be built today** — there is no "unsure" signal on the wire (§7.2).
- **101recycle would show the wrong category tree.** The backend picks recycle categories from the
  `product_cat` taxonomy (`utils/categoryCache.js:121-127`); the app fetches
  `/product/lab/category` for `101recycle` (`fetchCategories.ts:24-29`). Those are different
  taxonomies with different ids — measured: the recycle tree is 37 flat categories starting at
  term 1147 ("Material Handling Equipment"), the lab tree is 4 parents / 62 subs. Every AI recycle
  category id would fail validation and be cleared, leaving the seller to pick a **lab** category
  for a **recycle** listing (§7.3).

Fix those two, then unlock the picker, then do the form-complexity work in §8. The recommended end
state is **three steps, not ten cards**: *Confirm what this is* → *Price and pickup* → *Publish*,
with the marketplace confirmation folded into step 1 as a single reassurance chip rather than
another field (§9).

---

## 2. How this was verified

| Claim type | Method |
|---|---|
| Code structure, props, locks | Direct file reads; `file:line` cited inline |
| Category tree sizes | Read-only `GET` against production API on 2026-08-18: `/product/{lab,machines,it}/category?language=en` (HTTP 200) and `/product/category?lang=en` (HTTP 200), counted with a script |
| i18n coverage | 100 `t('…')` keys extracted from `detail.tsx` + all detail cards, checked against `src/i18n/locales/{en,ja,th,vi,zh-Hans}.json` by path lookup |
| Scroll height, row counts | **Estimated** by arithmetic on the code's own padding/height constants (`spacing['2xl']=24` in `constants/theme.ts:172`, `fontSize.lg=14` in `tailwind.config.js:103`, explicit `maxHeight: 240`, `minHeight: 110`, hero `(width-32)*9/16`) — *not* measured on a device |

**Not verified (and must be confirmed on hardware before anyone trusts it):**

- Nothing was run on a simulator, emulator, or device for this audit. Every layout number in §4.3
  and §5.2 is derived from constants in source, not from a screenshot.
- Whether a swipe that reaches the end of a nested category list chains to the page scroll on
  Android (§6.3) — the RN behaviour here is version-dependent and should be checked on device.
- Whether `react-native-keyboard-controller`'s `KeyboardAwareScrollView` leaves the sibling footer
  covered on iOS as the code structure implies (§6.2). The structural fact — the footer is *outside*
  the scroll view with no `KeyboardStickyView` — is verified; the visual consequence is inferred.
- No production write of any kind was performed. The mobile `.env` points at
  `https://api.101recycle.greenbidz.com` (PROD) — `GreenBridgeApp/.env:1`.

---

## 3. The flow as it actually runs

```
listing-method.tsx ─→ camera.tsx ─→ processing-v2.tsx (SSE; .env sets EXPO_PUBLIC_SMART_DETECT_V2=1)
                                       │
                    shouldSkipDetectionChoice(mapped, photoCount)   ← smartDetectionRouting.ts:19-28
                                       │
              ┌────────────────────────┴────────────────────────┐
        skip = true                                       skip = false
   (productCount ≤ 1 OR photoCount ≤ 1)                (AI found >1 product)
              │                                                 │
              ▼                                                 ▼
      detail.tsx (10 cards)                            detection.tsx ("STEP 1 OF 2")
                                                                │
                                                    grouped-review.tsx (hub)
                                                                │
                                                        grouped-edit.tsx (same 10 cards)
```

Two facts from this diagram matter for the marketplace work:

1. **The common case skips `detection.tsx`.** One item, or one photo, routes straight to
   `detail.tsx` (`processing-v2.tsx:351-357`). So `detection.tsx` — the only screen in the flow that
   already looks like a confirmation step — is *not* available on the single-item path. A
   marketplace confirmation cannot simply be dropped there and be done (§9).
2. **`detail.tsx` and `grouped-edit.tsx` render the identical ten cards** (`detail.tsx:121-139`,
   `grouped-edit.tsx:213-229`). Any card-level change lands on both surfaces for free, and any
   change made in only one of them forks the two editors. Every recommendation below is written at
   card level for that reason.

---

## 4. Form complexity — the core finding

### 4.1 The field census

`detailSchema` (`src/features/scanner/schema.ts:20-114`) has **26 fields** (counted from the
`z.object` keys at `schema.ts:21-61`; the table below enumerates all 26). `REQUIRED_ROWS`
(`requiredStatus.ts:11-19`) shows **7**. The gap is the interesting part.

| Field | Schema | Visible row | UI on the review screen | Prefilled by |
|---|---|---|---|---|
| `title` | required | ✅ | `IdentityCard.tsx:37-60` (80-char cap + counter) | AI |
| `description` | required | ✅ | `DescriptionCard.tsx:18-45` (500-char cap) | AI |
| `categoryId` | required | ✅ | `CategoryConditionCard.tsx:198-255` + subs `257-388` | AI (often; see §7.4) |
| `condition[]` | ≥1 | ✅ | 5 pills, `CategoryConditionCard.tsx:390-422` | AI (`normalize.ts:16-34`; **`[]` when the AI says nothing**) |
| `pricePerUnit` | required when `buyNow` | ✅ | `PricingCard.tsx:162-200` | AI |
| `locations[]` | ≥1 non-empty | ✅ | `LocationCard.tsx:198-272` | GPS → cache → profile (`LocationCard.tsx:63-106`) |
| `locationCountries[]` | length parity | ✅ (same row) | country sheet per row, `LocationCard.tsx:239-270` | same effect |
| `operationStatus[]` | **≥1** | ❌ | **no UI at all** — overridden at submit from `installation` (`constants.ts:66-68`) | default `['working']` |
| `quantity` | **≥1** | ❌ | stepper, `PricingCard.tsx:88-128` | default `1` |
| `priceCurrency` | **enum** | ❌ | 2 pills, `PricingCard.tsx:131-160` | `defaultCurrencyForSite` (101it → TWD) |
| `priceFormat` | **enum** | ❌ | 2-up segmented, `PricingCard.tsx:47-86` | AI (`buyNow` if a price came back) |
| `grade` | **enum** | ❌ | 4 pills — **101it only** (`CategoryConditionCard.tsx:430-466`) | AI, default `'A'` |
| `marketplace` | **enum** | ❌ | **hidden** (`MarketplaceCard.tsx:22,29`) | env default (§7.1) |
| `installation` | **enum** | ❌ | 2-up segmented, `LocationCard.tsx:288-330` | default `'deinstalled'` |
| `listingDurationDays` | **required int** | ❌ | **no UI** (backend has no slot yet) | default `90` |
| `customSubcategory` | required *iff* `categoryId === '__other__'` | ❌ | text input, `CategoryConditionCard.tsx:356-383` | — |
| `parentCategoryId` / `parentCategoryName` | required *iff* Other | ❌ | implicit | AI / parent tap |
| `categoryName` | optional | — | derived at submit (`formMapping.ts:91,97`) | — |
| `brand`, `model`, `year` | optional | ❌ | `IdentityCard.tsx:62-121` | AI |
| `weight`, `dimensions`, `co2Emissions`, `serialNumber` | optional | ❌ | `SpecsCard.tsx:25-96` | AI (serial: manual) |

**How many fields must a seller actually touch?** On a good AI run, **zero**: title, description,
category, condition, price, currency, brand/model/year/specs all arrive prefilled, and the location
effect fills the address from GPS, cache, or the seller's profile. That is the design working, and
it is the thing to protect.

On a bad run the picture inverts. `normalizeCondition` returns `[]` when the AI's value isn't
recognised (`normalize.ts:16-34`), the category may be empty or wrong (§7.4), and the price may be
absent — so the seller lands on a five-screen form with 2–4 required fields scattered across cards
3, 5, 7 and 10 and no map to them. **The flow is optimised for the good case and has no shape for
the bad one.** That is the complexity problem, not the field count.

### 4.2 Eight invisible required fields

Eight schema-required fields have **no row in `RequiredChecklist`**, because `rowForPath`
(`requiredStatus.ts:42-61`) maps only seven paths onto six rows and returns `null` for everything else — a fact its
own comment acknowledges. `allComplete` still gates Submit on the **full** schema
(`requiredStatus.ts:128-137`).

The consequence: if `operationStatus`, `priceFormat`, `quantity`, `grade`, `marketplace`,
`installation`, `priceCurrency` or `listingDurationDays` is ever invalid, **Submit is dead and the checklist says
everything is fine.** Today those all have hard defaults so it cannot happen — which is precisely
why it will not be noticed when multi-marketplace introduces the first realistic way to break it
(`marketplace: z.enum([...4])` at `schema.ts:57` receiving anything off-list). This is a latent
trap, not a live bug; it should be closed before the enum starts taking AI input.

### 4.3 The ten-card scroll, sized

Every card is `p-2xl` = 24 px padding (`constants/theme.ts:172`), the scroll adds
`padding: 16, paddingBottom: 48, gap: 8` (`detail.tsx:117`).

| Card | `detail.tsx` line | Est. height | Note |
|---|---|---|---|
| PhotosCard | 121 | ~272 | hero `(w−32)·9/16` = 202 px at w=390, + 54 px thumb strip |
| IdentityCard | 127 | ~246 | 4 inputs |
| DescriptionCard | 128 | ~188 | `minHeight: 110` |
| MarketplaceCard | 129 | **0** | returns `null` |
| CategoryConditionCard | 130 | **~714** | 240 + 240 nested scrollers + Other + 5 pills |
| ProfitIntelligenceCard | 131 | ~250 | read-only |
| PricingCard | 132 | ~224 | |
| SpecsCard | 133 | ~296 | 4 optional inputs |
| DocumentsCard | 134 | ~108 | |
| LocationCard | 138 | ~296 | |
| RequiredChecklist | 139 | ~460 | 7 rows while incomplete |
| **Total** | | **≈3,200 px** | |

Usable viewport ≈ 657 px on an iPhone 14 (844 − 47 top inset − 44 app bar − 62 footer − 34 bottom
inset) and ≈ 530 px on an iPhone SE. **≈4.9 and ≈6.0 screens** respectively. Estimated, not
measured (§2).

Against the rules: `UX_DESIGN_RULES.md:50-57` ("only show what the user needs NOW… do not overwhelm
users with large forms"), `:156-158` ("avoid unnecessary scrolling"), `:162-164` ("every screen has
ONE focal point"). Ten equally-weighted bordered cards of identical styling have no focal point at
all.

### 4.4 A failing field is not findable

- **Single path.** Submit is `disabled={!allRequired && canPublish}` (`DetailFooter.tsx:117`).
  Incomplete + approved seller ⇒ a flat grey button (`FooterButton.tsx:39-44`) with **no message, no
  count, no link to the offending field**. The only explanation is `RequiredChecklist` at the
  bottom of ~3,200 px of scroll. `useDetailController.ts` calls `handleSubmit(onValid)` at lines
  94, 136, 144 and 152 — **no `onInvalid` handler anywhere**, so there is no error path to speak of.
- **Grouped path does it right.** `grouped-edit.tsx:130-161` passes an `onInvalid` that alerts a
  named list of missing fields and calls `form.setFocus(firstErrorField)`. The single-item editor
  has none of it.
- **The hub does it right too.** `grouped-review.tsx:355-401` pins a progress bar, an
  "{n} of {total} products ready" counter, and the gated CTA. `detail.tsx` pins only the CTA.

This is the clearest "solve the same problem twice, differently" violation in the flow
(`UX_DESIGN_RULES.md:182-186`).

### 4.5 ProfitIntelligenceCard: wrong place, and sometimes untrue

It sits between category and price (`detail.tsx:131`). The placement argument is sound — anchor the
price decision before the price input — and it should stay in that position.

The content is the problem. When the AI returns no tier prices, `deriveFigures`
(`ProfitIntelligenceCard.tsx:101-117`) falls back to **hard-coded constants**: `$12,500` scrap
baseline, `+$4,200` potential profit, `33%` uplift (`:18-20`). Those render in the same 22 px bold
type as real figures; the *only* difference is that a small "AI" chip is not drawn
(`:196-209`, gated on `fromAi`). Nothing tells the seller the numbers are placeholders, and the
insight line — "Selling on {{marketplace}} could earn you {{percent}}% more than scrap value
alone" (`:303-308`) — states the stub as fact.

`UX_DESIGN_RULES.md:102-112` is explicit: show AI confidence, never imply AI is always correct, and
low confidence should *request clarification, not invent information*. Inventing a $12,500 scrap
value is the exact failure named. Worse after unlock: `suggestedLabel` is derived from the seller's
**own** current `marketplace` value (`:154-158`), so the card will "recommend" whichever marketplace
the seller just confirmed — a circular claim presented as intelligence.

---

## 5. Inputs and selects

### 5.1 Inventory

| Control | Type | Where | Verdict |
|---|---|---|---|
| Title | `TextInput`, 80 cap + counter | `IdentityCard.tsx:43-52` | Good |
| Brand / Model | `TextInput` ×2 side-by-side | `IdentityCard.tsx:62-99` | Good; ~155 px each at w=390 |
| Year | `TextInput`, `number-pad`, 4 cap | `IdentityCard.tsx:108-117` | Good |
| Description | multiline, `minHeight: 110`, 500 cap | `DescriptionCard.tsx:24-34` | Good |
| **Category parent** | nested `ScrollView`, `maxHeight: 240` | `CategoryConditionCard.tsx:211-248` | **Worst control in the flow** — §5.2 |
| **Subcategory** | second nested `ScrollView`, `maxHeight: 240` | `:267-310` | **Same, stacked below it** |
| "Other (type brand)" | row + conditional `TextInput` | `:317-383` | Correctly placed *outside* the inner scroller (`:312-316`) |
| Condition | 5 wrapping pills, multi-select | `:390-422` | OK; §5.5 on labels |
| Grade | 4 equal pills, 101it only | `:430-466` | Good gating |
| Buy-now / Make-offer | 2-up segmented | `PricingCard.tsx:47-86` | Good |
| Quantity | −/+ stepper, 40 px targets | `PricingCard.tsx:88-128` | 40 px is under the 44 px touch minimum |
| Currency | 2 pills, USD/TWD | `PricingCard.tsx:131-160`, `settings/constants.ts:40-43` | §5.3 |
| Price | `react-native-currency-input`, `decimal-pad`, ISO prefix | `PricingCard.tsx:162-200` | Good; §5.3 on the FX side-effect |
| Weight / Dimensions / CO₂ / Serial | 4 plain `TextInput`s | `SpecsCard.tsx:25-96` | All optional, all always visible — §8 |
| Documents | `expo-document-picker`, multi | `DocumentsCard.tsx:35-56` | Good |
| Address rows | `TextInput` per row + "Use my location" + add/remove | `LocationCard.tsx:198-286` | Good |
| Country | **searchable bottom sheet**, 95 entries | `CountryPicker.tsx:37-91` | **The pattern the category picker should copy** |
| Installation | 2-up segmented + hint line | `LocationCard.tsx:288-330` | Good — the only control that explains itself |
| Marketplace | 4 pills | `MarketplaceCard.tsx:39-76` | Hidden today; §5.4 |
| Photos | 16:9 hero + thumb strip + zoom viewer | `PhotosCard.tsx:41-137` | Good; satisfies `UX_DESIGN_RULES.md:148-152` |

### 5.2 The category tree is the bottleneck

Measured against production, 2026-08-18:

| Marketplace | App endpoint (`fetchCategories.ts:24-29`) | Parents | Subcategories | Largest parent |
|---|---|---|---|---|
| 101lab | `/product/lab/category` | 4 | 62 | **38** (Lab Infrastructure & Essentials) |
| 101machine | `/product/machines/category` | 13 | 0 (flat) | — |
| 101it | `/product/it/category` | 6 | 25 (brands) | 6 (Server, Smartphones) |
| 101recycle | `/product/lab/category` ⚠️ **wrong tree** | — | — | see §7.3 |

Row geometry from source: `px-md py-2.5` + `text-lg` (14 px) + 1–2 px border + `marginTop: 6`
(`CategoryConditionCard.tsx:223-228`) ≈ **45 px per row**, inside `maxHeight: 240` ⇒ **~5 rows
visible**.

So on 101lab, 61 % of the tree (38 of 62 leaves) lives behind one parent, reachable only by
**~7 successive swipes inside a 240 px window** with no search, no type-ahead, no alphabet index,
and the selected item scrolled out of sight. Two such windows are stacked, consuming ~480 px of a
~530 px SE viewport (§4.3) — the seller cannot see the parent list and the subcategory list at the
same time on a small phone.

The fix already exists in this codebase. `CountryPicker.tsx` puts 95 countries behind a
`Sheet` with a search field and `Sheet.Option` rows (`CountryPicker.tsx:37-91`), and `Sheet` even
ships a `header` variant explicitly built to separate parents from their subcategories
(`Sheet.tsx:145-181, 298-325`) — plus `Sheet.Option.description`, which is where an AI hint could
live. `flattenCategoryOptions` (`fetchCategories.ts:144-170`) already produces
`"Parent › Sub"` labels ideal for a flat searchable list. Nothing new needs designing; the picker
needs to adopt the pattern the flow already uses one card lower.

### 5.3 Price and currency

Two issues, both small and both surprising:

- **Currency pills silently rewrite the price.** `handleCurrencyChange`
  (`PricingCard.tsx:31-40`) converts the entered amount through `convertPrice` when the seller taps
  the other currency. A seller who typed `12000` intending TWD and then taps TWD sees the number
  change under them. There is no undo and no toast. `UX_DESIGN_RULES.md:114-118` wants feedback on
  every action; a silent mutation of the seller's own number is the opposite.
- **The FX rate is a client constant.** `schema.ts:13-16` points at a local `FX_RATE` map in
  `PricingCard.tsx` / `currencyFx.ts`. Fine for display, wrong as an implicit repricing engine.
- The prefix is the ISO code, not `$` (`PricingCard.tsx:24-29`) — deliberate, correct on a
  cross-border marketplace, and consistent with the profit card. Keep.

### 5.4 Pills: condition and marketplace

The condition row is five multi-select pills and reads well in English. The marketplace row
(`MarketplaceCard.tsx:39-76`) is four pills labelled `101LAB`, `101MACHINE`, `101IT`, `101RECYCLE`
(`constants.ts:40-48`). Estimated widths at `text-lg` + `px-md` total ~372 px against ~310 px of
available card width, so it **wraps to two rows** — cosmetic, but worth knowing.

The real problem is semantic: after unlock, a seller sees four codenames with **no explanation of
what any of them sells**, on a screen where picking wrong changes the category tree *and* the
submit URL (`marketplaceToPlatform`, `constants.ts:106-114`; `marketplaceToAllowedSite`,
`buildFormData.ts:18-23`). Compare `installation`, which ships a hint line per option
(`constants.ts:50-57`, rendered `LocationCard.tsx:320-327`). The marketplace choice — higher stakes
— explains itself less.

### 5.5 Translations: complete, and they fit

All **100** `t()` keys used by `detail.tsx` and the ten cards resolve to non-empty strings in
**en, ja, th, vi, zh-Hans** — 0 missing in every locale (method in §2). That is unusually clean and
contradicts the general i18n picture recorded elsewhere in this workspace; the scan-detail surface
is done.

Fit, measured as translated-length ÷ English-length:

| Key | en | th | vi | th× | vi× |
|---|---|---|---|---|---|
| `required.liveBadge` | LIVE | กำลังขาย | TRỰC TIẾP | 2.00 | 2.25 |
| `sectionBrand` | BRAND | แบรนด์ | THƯƠNG HIỆU | 1.20 | 2.20 |
| `required.header_complete` | ✓ ALL REQUIRED COMPLETE | ✓ ครบถ้วนทั้งหมด | ✓ ĐÃ HOÀN TẤT TẤT CẢ MỤC BẮT BUỘC | 0.70 | 1.43 |
| `condition.usedFunctional` | Used — functional | ใช้แล้ว — ใช้งานได้ | Đã qua sử dụng — còn hoạt động tốt | — | ~2.1 |

Two consequences. **`condition.usedFunctional` in Vietnamese is ~37 characters**; five pills of that
scale will wrap to 3–4 rows in `flex-wrap` (`CategoryConditionCard.tsx:392`) — vertical growth, not
clipping, so it degrades acceptably but should be eyeballed on device. And **the Thai "LIVE" badge
is a mistranslation**: `กำลังขาย` means "currently for sale", not "live-updating"
(`RequiredChecklist.tsx:71`). On a listing form that reads as a status claim about the item. Copy
fix, not a layout fix.

---

## 6. Safe areas, layout, keyboard

### 6.1 Per-screen safe-area audit (grepped, not assumed)

| Screen | Root | Bottom inset handled? |
|---|---|---|
| `camera.tsx` | `SafeAreaView` all edges (`:207`, `:488`) | ✅ + `paddingBottom: 24` (`:601`) |
| `detail.tsx` | `SafeAreaView edges={['top','bottom']}` (`:113`) | ✅ footer inside the SafeAreaView |
| `detection.tsx` | `Screen edges={['top','bottom']} scroll={false}` (`:236`) | ✅ |
| `grouped-review.tsx` | same (`:223`) | ✅ — and `:214-222` documents the double-inset bug it fixed |
| `grouped-edit.tsx` | same (`:180`) | ✅ — same note at `:176-179` |
| `reorder-photos.tsx` | `Screen edges={['top','bottom']}` (`:88-90`) | ✅ — regression noted at `:86` |
| `drafts.tsx` | `Screen edges={['top']}` + `insets.bottom + spacing.xl` (`:97`) | ✅ manual |
| `processing-v2.tsx` | `Screen scroll={false}` + `insets.bottom` (`:656`, `:1042`) | ✅ manual |
| `processing.tsx` | `Screen` default `edges={['top']}` (`:674`, `:1087`) | ✅ by inheritance — `Screen.tsx:70-73` adds `48 + insets.bottom`; content is centred, no pinned CTA |
| `success.tsx`, `listing-method.tsx` | `Screen` default | ✅ same inheritance |

**No sticky CTA in the flow collides with the home indicator or the Android gesture bar.** The
shared primitives read the live inset themselves — `Screen.tsx:12-30`, `Sheet.tsx:24-37,107-111`,
`PickerSelect.tsx:24-31,110` — each with a comment naming the 48 dp 3-button nav bar it was fixed
for. Expo SDK 56 / RN 0.85 (`package.json`) means Android is edge-to-edge, so this is load-bearing
and correct. **This part of the flow needs no work.**

### 6.2 The keyboard covers the primary CTA

In both editors the footer is a **sibling** of the scroll view, not a child, and nothing makes it
keyboard-aware:

- `detail.tsx:115-156` — `KeyboardAwareScrollView` … `</KeyboardAwareScrollView>` then
  `<SellerApprovalNotice />` and `<DetailFooter />` outside it.
- `grouped-edit.tsx:207-263` — identical shape.
- A repo-wide grep finds **no `KeyboardStickyView`** and no `KeyboardAvoidingView` on these screens
  (`KeyboardProvider` *is* mounted, `app/_layout.tsx:176`, so the scroll-into-view behaviour works).

`bottomOffset={24}` keeps the *focused input* visible, so nobody types blind. But while any of the
~12 text inputs is focused, the sticky Submit/Save is behind the keyboard. On a form of this length
that means the CTA is unreachable during most of the editing session —
`UX_DESIGN_RULES.md:32-36` ("primary CTA stays visible during long forms") and `:96-98`. Structural
claim verified from code; the on-screen result is inferred, not observed (§2).

### 6.3 Nested same-axis scrolling

`CategoryConditionCard` mounts two `ScrollView`s with `maxHeight: 240` and `nestedScrollEnabled`
inside the page's `KeyboardAwareScrollView` (`:211-216`, `:267-272`). That is ~480 px of the page —
roughly 90 % of an SE viewport — where a vertical swipe is captured by the inner list. Whether the
gesture chains to the page when the inner list hits its end is **RN-version-dependent and was not
tested on device**; if it does not chain, a seller can get stuck mid-form. The card's own comment at
`:312-316` records one instance of this class of bug already (the "Other" row was the clipped 5th
row until it was moved outside the scroller).

### 6.4 Small devices and tablets

The layout is relative throughout — `flex-1`, `flex-row`, `useWindowDimensions` for the photo hero
(`PhotosCard.tsx:31,38-39`) — so nothing *breaks* at 375 pt. The hard-coded values that hurt on
small screens are the two `maxHeight: 240` scrollers (§6.3) and `minHeight: 110` on the description
(`DescriptionCard.tsx:26`): together ~590 px of fixed vertical commitment out of ~530 px of SE
viewport.

Tablets: the flow is `orientation: 'portrait'` (`app.config.ts:35`) and the cards are full-width
with no `maxWidth`, so on a 10" tablet every input stretches to ~1000 px — a single-column form of
very long text fields. The sheets *do* cap at `maxWidth: 460` (`Sheet.tsx:237`,
`PickerSelect.tsx:189`), which is the pattern the cards should follow if tablet is in scope.
`UX_DESIGN_RULES.md:188-192` requires designing mobile and desktop separately; a tablet here is
neither.

---

## 7. What multi-marketplace actually needs

### 7.1 The three switch-offs (already located, do not re-derive)

| # | File:line | Effect |
|---|---|---|
| 1 | `MarketplaceCard.tsx:21-22,29` | `MARKETPLACE_LOCKED = true` ⇒ the card renders `null` |
| 2 | `scanDraftStore.ts:413` | `marketplace: marketplaceFromSiteType(getSiteType())` — discards `suggestedMarketplace` on the smart-detect path |
| 3 | `processing.tsx:~505-513` | same lock on the single-photo `analyze` path (comment only; no marketplace patch is written) |

`mapSmartDetection.ts:188` computes `suggestedMarketplace` and `:209,225` carry it into
`SmartItemFields.ai` — where nothing reads it. `mapAnalyze.ts:53,100` does the same. The wiring is
one line from working; the reason it is not is the reason in the comments, and that reason is still
valid until §7.2 and §7.3 are fixed.

### 7.2 BLOCKER — there is no confidence signal to gate on

The owner's requirement is "ask the seller only when the machine is unsure". Trace what survives:

1. `runDetectionPass` produces a real per-product number: `site_type_confidence`, normalised at
   `wordPressSmart.js:2138-2160`.
2. `resolveSiteTypeForGroup` uses it for the hint-vs-vision contest — including a threshold that can
   skip vision entirely (`wordPressSmart.js:1657-1685`, `SITE_HINT_SKIP_VISION_MIN_CONF`) — and then
   **returns `{ siteType, suggested_terms }` only. The number is dropped.**
3. `processProductGroup` stamps `data.site_type = siteType` (`:2010`) with no confidence field.
4. The wire payload's `detection` object has exactly three keys — `suggested_mode`, `confidence`,
   `summary` (`:3355-3372`) — and the SSE `detection` event four (`:3222-3227`). That `confidence`
   is the *how many products* confidence; `detection.tsx:172` renders it as such.

So the client's only confidence number answers a different question. **Do not build an
"ask when unsure" UI on `detection.confidence`** — it will ask at the wrong times and stay silent at
the wrong times.

Two signals *are* available today and are worth using in the interim:

- **`needs_clearer_photo`** is already on the wire (`wordPressSmart.js:3367-3370`, set from
  per-product data) and is **read nowhere in the app** (grepped: zero hits in `src/` and `app/`). It
  is a genuine low-confidence tell.
- **`suggestedMarketplace === null`** already means "the AI said nothing recognisable"
  (`constants.ts:116-120`, deliberately strict, per its own docstring) — a usable "must ask" trigger.

**Recommended contract change (backend, small):** have `resolveSiteTypeForGroup` return the
confidence it already computes and stamp it beside `data.site_type` in `processProductGroup`
(`wordPressSmart.js:2010`), then add it to `SmartProductData` in `smartDetectionTypes.ts` and carry
it through `mapProductData` (`mapSmartDetection.ts:186-190`) next to `suggestedMarketplace`. That is
the whole dependency for "ask only when unsure".

### 7.3 BLOCKER — 101recycle resolves the wrong category tree

| Side | Source | Result (measured today) |
|---|---|---|
| Backend AI | `product_cat` taxonomy for `recycle` (`utils/categoryCache.js:121-127`) | 37 flat categories, ids from 1147 ("Material Handling Equipment") — via `/product/category?lang=en`, HTTP 200 |
| Mobile app | `/product/lab/category` for `101recycle` (`fetchCategories.ts:24-29`, "lab + recycle share the lab tree") | 4 parents / 62 subs, different ids |

Walk the failure with the code: the AI returns recycle id `1147`; `CategoryConditionCard`'s
validity effect finds it absent from `options` (`:124`), tries `bridgeCategoryId`, which position-
matches only within the same logical tree and returns `null` for an id absent from the EN lab tree
(`fetchCategories.ts:95-130`) — no false positive, good — then clears the field (`:157`). The seller
is now asked to pick a **lab** category for a **recycle** listing, and whatever they pick is
submitted with `allowed_sites: ['recycle']` (`buildFormData.ts:18-23`). Silently wrong data, no
error anywhere.

**Fix before unlocking 101recycle:** add a `101recycle` branch to `endpointForMarketplace` pointing
at the recycle taxonomy, and normalise its `term_id` shape to `LabCategory` (it returns
`{term_id, name, slug}` with no `subcategories`, and HTML-escaped names — `Construction &amp;
Earthmoving Equipment` — which will need unescaping for display).

### 7.4 The AI's category pick is indistinguishable from the seller's own

`pickDefaultParent` (`wordPressSmart.js:677-684`) returns *the first parent with subcategories, else
`tree[0]`*. For `machines` no parent has subcategories, so it returns `tree[0]` — which the
production tree confirms is **"Boring & Drilling Machines"**. That is the earlier finding,
reproduced from data rather than memory, and it is called from two places
(`wordPressSmart.js:857`, `:1576`).

The UI makes this worse than it needs to be. Nine field labels carry the ✨ AI badge
(`FieldLabel.tsx:28-33`, used with `ai` on title, brand, model, year, weight, dimensions, CO₂,
grade, description) — but **category is labelled `required`, not `ai`**
(`CategoryConditionCard.tsx:203`). The one field where a machine guess is most likely, most
consequential, and hardest to verify is the one field presented as though the seller chose it.
Unlocking four marketplaces multiplies how often that guess is a default.

Minimum bar before unlock: mark an AI-derived category with the AI badge, and when the backend
reached it by `pickDefaultParent`, say so ("we weren't sure — check this") rather than showing a
confident selection. `UX_DESIGN_RULES.md:102-112`.

### 7.5 Where the marketplace confirmation belongs

Constraints, from the code:

- The single-item path never sees `detection.tsx` (`smartDetectionRouting.ts:19-28`), so that screen
  cannot be the only home for the confirmation.
- A marketplace change **must** clear the category, and it must do so **only on user action** — the
  hydration-time race is documented at `MarketplaceCard.tsx:50-63` and `useDetailController.ts:66-70`
  and cost real debugging. Any new confirmation UI must write `marketplace` through the same
  user-driven path, never via a `watch` effect.
- `CategoryConditionCard` already rebuilds its tree from `watch('marketplace')` (`:46-47`), and
  `defaultCurrencyForSite` already flips 101it to TWD (`constants.ts:70-72`). The dependency chain
  works.

**Recommendation: one chip at the top of the review screen, not a new step and not a new field.**

- **High confidence (or hint-skipped vision):** a single line above `IdentityCard` —
  *"Listing on 101MACHINE · Machining Centers — change"*. Zero taps on the happy path. This is the
  adaptive-UI rule (`UX_DESIGN_RULES.md:68-76`): the UI reflects what already happened rather than
  asking again.
- **Low confidence / `suggestedMarketplace === null` / `needs_clearer_photo`:** the same slot becomes
  a **question with two or three named options and one-line descriptions**, rendered through `Sheet`
  (which supports `description` per option, `Sheet.tsx:139-150`). Nothing else on the screen changes.
- **Mixed multi-item uploads** (which the vision prompt explicitly expects —
  `wordPressSmart.js:307`): show the marketplace per row in `grouped-review.tsx`'s `HubRow`
  alongside the existing ready/missing badge, so a seller sees "3 to 101LAB, 1 to 101IT" before
  submitting, and can retarget one row without opening the editor.

That keeps the four-pill `MarketplaceCard` unused for the common case and turns it into an
answer-a-question control for the uncommon one — which is exactly the owner's brief.

---

## 8. Prioritised change list

Each item: what to change, where, what the seller gains, which rule it satisfies. P0 items block the
multi-marketplace launch; P1 is the form-complexity work; P2/P3 are polish.

### P0 — blocks unlocking marketplaces

| # | Change | Where | Seller gain |
|---|---|---|---|
| P0-1 | Return and plumb the marketplace confidence: stop discarding it in `resolveSiteTypeForGroup`; stamp it beside `data.site_type`; add to `SmartProductData`; carry through `mapProductData` next to `suggestedMarketplace` | `wordPressSmart.js:1657-1685`, `:2010`; `smartDetectionTypes.ts`; `mapSmartDetection.ts:186-190` | Makes "ask only when unsure" possible at all — the difference between being asked once and being asked every time |
| P0-2 | Point `101recycle` at the recycle taxonomy and normalise its shape (`term_id` → `id`, no subcategories, HTML-unescape names) | `fetchCategories.ts:24-29` | A recycle listing gets recycle categories instead of silently filing under a lab category |
| P0-3 | Badge AI-derived categories as AI, and surface "we weren't sure" when the backend fell back to `pickDefaultParent` | `CategoryConditionCard.tsx:203`; `wordPressSmart.js:677-684,857,1576` | Stops "Boring & Drilling Machines" shipping unnoticed on items that are nothing of the kind |
| P0-4 | Give every schema-required field either a checklist row or a guaranteed valid default — close the `rowForPath` gap before `marketplace` starts taking AI input | `requiredStatus.ts:42-61`, `schema.ts:57` | Submit can never be dead-with-no-reason |
| P0-5 | Then flip the three locks, writing `marketplace` **only** through the user-driven path (never a `watch` effect) | `MarketplaceCard.tsx:22`, `scanDraftStore.ts:413`, `processing.tsx:505` | Reaches all four marketplaces without re-opening the hydration race |

### P1 — form complexity (the biggest seller-facing win)

| # | Change | Where | Seller gain | Rule |
|---|---|---|---|---|
| P1-1 | **Move progress + missing-count into the sticky footer.** Show "5 of 7 ready · Title, Price missing" above the CTA; tapping a name scrolls to that card | `detail.tsx:139,144-156`, `DetailFooter.tsx`, `RequiredChecklist.tsx` (reuse `getRequiredStatus`) | Never scroll five screens to learn why the button is grey | `:96-98`, `:174-178` |
| P1-2 | **Replace the two nested category scrollers with a searchable sheet** built on `Sheet` + `Sheet.Option` (`header` variant for parents), fed by `flattenCategoryOptions`. Card collapses to one row: label + current pick + "Change" | `CategoryConditionCard.tsx:198-388`; pattern: `CountryPicker.tsx:37-91` | 38 subcategories become a typed search instead of ~7 blind swipes; frees ~480 px and removes the nested-scroll trap | `:50-57`, `:156-158`, `:182-186` |
| P1-3 | **Collapse `SpecsCard` behind "Add more details (optional)"**, showing a filled-count summary when the AI populated it | `SpecsCard.tsx:19-97`, `detail.tsx:133` | Four optional inputs (~296 px) stop competing with required ones | `:50-57`, `:88-92` |
| P1-4 | **Add `onInvalid` to the single-item editor** with the named-missing-fields alert + `setFocus`, copied from the grouped editor | `useDetailController.ts:94,136,144,152`; source: `grouped-edit.tsx:130-161` | The two editors stop behaving differently on error | `:132-136`, `:182-186` |
| P1-5 | **Keep the CTA above the keyboard** — wrap the footer in `KeyboardStickyView` (already available via `react-native-keyboard-controller`, provider mounted at `app/_layout.tsx:176`) | `detail.tsx:144`, `grouped-edit.tsx:263` | The primary action never disappears mid-edit | `:32-36`, `:96-98` |
| P1-6 | **Tell the truth in ProfitIntelligenceCard**: when `fromAi === false`, either hide the figures behind "Estimate unavailable — price it yourself" or label them plainly as illustrative | `ProfitIntelligenceCard.tsx:18-23,101-117,303-308` | Sellers stop anchoring on a fabricated $12,500 | `:102-112` |
| P1-7 | **Add the marketplace chip / question in the §7.5 slot**, above `IdentityCard` | `detail.tsx:127`; per-row variant in `grouped-review.tsx` `HubRow` | Confirms routing in zero taps when the AI is sure, one tap when it is not | `:12-21`, `:68-76` |

### P2 — cohesion and honesty

| # | Change | Where | Seller gain |
|---|---|---|---|
| P2-1 | Group the ten cards into three labelled steps with a sticky step indicator (`detection.tsx:245-252` already has the "STEP n OF 2" pattern) | `detail.tsx:121-139` | "Where am I / what's next" answered without reading | `:174-178` |
| P2-2 | Confirm before a currency tap rewrites the entered amount, or convert on display only | `PricingCard.tsx:31-40` | The seller's own number stops changing silently |
| P2-3 | Give marketplace options one-line descriptions instead of bare codenames (mirror `INSTALLATION_OPTIONS` hints) | `constants.ts:40-48`, `MarketplaceCard.tsx:39-76` | A first-time seller can tell 101machine from 101recycle |
| P2-4 | Consume `needs_clearer_photo` — already on the wire, read nowhere — as the interim low-confidence trigger and as a "retake this photo" nudge | payload at `wordPressSmart.js:3367-3370` | Bad photos get fixed at the point of capture rather than after a wrong draft |
| P2-5 | Raise the quantity stepper hit targets from 40 px to ≥44 px | `PricingCard.tsx:100,116` | Fewer mis-taps one-handed |

### P3 — copy and long-tail

| # | Change | Where |
|---|---|---|
| P3-1 | Retranslate the Thai `LIVE` badge — `กำลังขาย` reads as "currently for sale" | `RequiredChecklist.tsx:71`; `th.json` |
| P3-2 | Check the 5 condition pills in Vietnamese on device (`Đã qua sử dụng — còn hoạt động tốt` is ~2.1× English) | `CategoryConditionCard.tsx:390-422` |
| P3-3 | Decide the tablet story: cap card width like the sheets do (`maxWidth: 460`) or declare tablets out of scope | detail cards; `Sheet.tsx:237` |
| P3-4 | Verify on device whether nested category scroll chains to the page on Android; if not, P1-2 removes the problem anyway | `CategoryConditionCard.tsx:211,267` |

---

## 9. Target shape: ten cards → three steps

Same fields, same schema, same submit path — regrouped so the screen adapts to progress rather than
exposing everything at once (`UX_DESIGN_RULES.md:50-57`, `:68-76`).

```
┌─ STEP 1 · Confirm what this is ───────────────────────┐
│ Photos (hero, large)                                  │  ← PhotosCard, unchanged
│ ▸ "Listing on 101MACHINE · Machining Centers  change" │  ← NEW chip (P1-7); becomes a
│                                                       │     question only when unsure
│ Title / Brand / Model  ✨AI                            │  ← IdentityCard
│ Description            ✨AI                            │  ← DescriptionCard
│ Category  ✨AI  [ Machining Centers      Change ]      │  ← one row, opens a SEARCHABLE sheet (P1-2)
│ Condition  ( pills )                                  │
└───────────────────────────────────────────────────────┘
┌─ STEP 2 · Price and pickup ───────────────────────────┐
│ Profit intelligence (only when real)                  │  ← P1-6
│ Buy-now / Offer · Amount · Qty · Currency             │
│ Pickup address + country · Installation               │
│ ▸ Add more details (optional)  — 3 of 4 filled by AI  │  ← SpecsCard collapsed (P1-3)
│ ▸ Attach documents (optional)                         │
└───────────────────────────────────────────────────────┘
┌─ STEP 3 · Sticky footer, always visible ──────────────┐
│ ▓▓▓▓▓▓▓▒▒▒  5 of 7 ready · Title, Price               │  ← P1-1; tap a name to jump
│ [           Submit listing  →           ]             │  ← above the keyboard (P1-5)
└───────────────────────────────────────────────────────┘
```

Rough effect on the numbers in §4.3: collapsing Specs (−296 px), Documents (−108 px) and the two
category scrollers (−480 px), and moving the checklist into the footer (−460 px) takes the scroll
from **≈3,200 px to ≈1,850 px** — under three SE screens, with the primary action and the reason it
is disabled both permanently on screen. Estimated on the same basis as §4.3.

---

## 10. Scorecard against `UX_DESIGN_RULES.md:196-209`

| Checklist item | Today | After P0+P1 |
|---|---|---|
| First-time user finishes without guidance | ⚠️ good AI run yes; bad run no map to the missing fields | ✅ |
| Next action obvious | ❌ grey button, no reason (`DetailFooter.tsx:117`) | ✅ |
| Only one primary CTA | ✅ (`DetailFooter.tsx:92-123`) | ✅ |
| Can anything be removed | ❌ 4 optional specs + a stub profit card always visible | ✅ |
| Can scrolling be reduced | ❌ ≈5–6 screens | ✅ ≈3 |
| Duplicate controls | ✅ none — dead "Preview"/"Rearrange" affordances already removed (`DetailFooter.tsx:94-98`, `PhotosCard.tsx:13-16`) | ✅ |
| Adapted to progress | ❌ ten cards regardless of AI success | ✅ |
| Every action gives feedback | ⚠️ currency tap silently rewrites the price (`PricingCard.tsx:31-40`) | ✅ |
| Every error has recovery | ⚠️ grouped yes (`grouped-edit.tsx:130-161`); single no | ✅ |
| Feels as polished as Linear/Stripe | ❌ one long form of identical bordered cards | ✅ |

---

## 11. Only the owner can decide these

1. **Ship marketplace unlock before or after the backend confidence field?** Without P0-1, the only
   honest options are *always ask* (one extra tap for everyone) or *never ask* (accept silent
   mis-routing). Both are product calls.
2. **What is the confidence threshold for "sure enough not to ask"?** The backend already has an
   analogous constant (`SITE_HINT_SKIP_VISION_MIN_CONF = 0.92`, `wordPressSmart.js:66`, applied `:1663`); the seller-facing
   one is a business trade-off between friction and wrong listings.
3. **Is 101recycle in the first unlock, or do 101lab / 101machine / 101it ship first?** Recycle needs
   P0-2 (a new endpoint mapping and a name-unescape) that the other three do not.
4. **Keep `ProfitIntelligenceCard` at all when the AI has no prices?** Options: hide the card, show
   an honest empty state, or keep illustrative figures with an explicit label. Removing it entirely
   is also defensible.
5. **What happens to a mixed upload?** One batch spanning marketplaces may need to become N
   submissions (`marketplaceToPlatform` is per-item, `constants.ts:106-114`, but the grouped submit
   posts one batch). That is a commercial/ops decision before it is a UI one.
6. **Are tablets supported?** Affects P3-3 and nothing else.
7. **`listingDurationDays`** is required by the schema (`schema.ts:61`), defaulted to 90, and has no
   UI because the backend has no slot. Keep it invisible, or is duration a seller-facing choice?

---

## 12. Files a developer will touch

**Mobile**
`app/scan/detail.tsx` · `app/scan/grouped-edit.tsx` · `app/scan/grouped-review.tsx` ·
`src/features/scanner/components/detail/{CategoryConditionCard,DetailFooter,RequiredChecklist,MarketplaceCard,ProfitIntelligenceCard,SpecsCard,PricingCard,FieldLabel}.tsx` ·
`src/features/scanner/{requiredStatus.ts,schema.ts,constants.ts,mapSmartDetection.ts,mapAnalyze.ts,smartDetectionTypes.ts}` ·
`src/services/scanner/fetchCategories.ts` · `src/stores/scanDraftStore.ts` ·
patterns to copy from: `src/components/ui/Sheet.tsx`, `src/features/scanner/components/detail/CountryPicker.tsx`

**Backend (P0-1 only)**
`101recycle-greenbidz-backend/controller/wordPressSmart.js` (`resolveSiteTypeForGroup` ~1657-1685,
`processProductGroup` ~2010, payload ~3355-3372)

**Do not touch:** `greenbidz-ai-assistant/`.
