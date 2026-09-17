# Multi-marketplace unlock — implementation plan

**Date:** 2026-08-18 · **Author:** CTO · **Status:** for owner approval, then execution
**Goal:** a seller photographs equipment in the mobile app; the AI works out which of the four
marketplaces (101lab / 101machine / 101it / 101recycle) it belongs to; marketplace and category
follow automatically; the seller is only asked when the machine is unsure.

**Inputs:** `SCAN_FLOW_BACKEND.md` (measured accuracy, 81 live DEV calls) and `SCAN_FLOW_UX.md`
(flow/complexity audit) in this folder, plus Stitch project `13503762192488530299` (screens 1, 2, 3,
4a, 4b). Both audits were reviewed and both had findings overturned; §10 records every disagreement
and how I resolved it, with my own verification.

**This document changed no code.** Everything below is a `file:line` claim I re-checked myself, a
measurement I re-took read-only today, or something explicitly labelled unverified.

---

## 1. Verdict — is this safe to ship?

**Yes for all four marketplaces, but only as "the AI decided, confirm with one tap" — never as
silent auto-routing. And the category, not the marketplace, is the thing that must stop guessing
before any of it ships.**

Three numbers decide this.

| What | Measured | What it means |
|---|---|---|
| Marketplace routing | **64/72 = 89%** (24 photos × 3 runs, DEV) | 1 item in 9 goes to the wrong marketplace. Not silent-auto-apply quality. Good as a pre-filled answer the seller confirms. |
| Run-to-run stability | **23/24 photos identical across 3 runs** | The errors are *systematic*, not random. Systematic errors can be fixed; two of them already have a named root cause. |
| Category correctness | **11/24 = 46%** fully correct | This is the real risk surface. Unlocking marketplaces multiplies it by four. |

Why 89% is shippable behind a confirmation and not otherwise:

- **Two of the eight routing failures are a deterministic backend bug, not model noise.**
  `inferSiteTypeFromProduct` (`services/smartExtractionValidator.js:234-267`) regex-overrides both
  vision passes using the AI's *own generated description*, and `IT_PRODUCT_RE`
  (`:223` — verified: contains the bare words `switch`, `monitor`, `printer`, `server`, `graphics`,
  `tablet`) makes IT win ties (`:259-261`). A Sigma benchtop **centrifuge** was sold as a **GPU
  Accelerator** on 101it in 2 of 3 runs, triggered by the sentence *"The power switch is located on
  the back of the unit."* Replayed over 800 real published lab listings: **75 (9%) false-overridden
  to 101it**. Fixing this is a contained change and removes the worst class of failure.
- **The residual failures are genuinely ambiguous photos** — a bare HPLC control panel, a room of
  conference furniture with a wall-mounted TV. A human would hesitate on both. A one-tap confirmation
  is the correct product answer to that, not more model work.
- **Per-item routing inside a mixed upload already works** — a 4-photo upload spanning all four
  marketplaces split into 4 products with 4 correct marketplaces. The premise of the feature is
  sound.

What is **not** safe to ship, and is gated below:

1. **The category fallback.** Verified live today (§4): the machines tree the runtime actually uses
   is 13 flat parents with zero subcategories and `tree[0]` = id **5300 "Boring & Drilling
   Machines"**, so `pickDefaultParent` (`controller/wordPressSmart.js:677-682`) returns exactly that
   string. A live capture in this repo shows id 5300 shipped on a **welding fixture** and on a device
   called "SULICK". One marketplace can absorb that; four cannot.
2. **101recycle's category tree.** Verified today: **zero** id overlap between the recycle tree the
   backend picks from and the lab tree the app fetches for `101recycle`. Every recycle category is
   cleared on arrival, and `categoryId` is schema-required (`src/features/scanner/schema.ts:23`), so
   it is a **hard submit-blocker**, not a bad default. And `recycle` is the backend's universal
   fallback for *unknown / low-confidence* — so this must be fixed even if 101recycle is not in the
   launch set.
3. **The profit card.** 63% of real responses render as "**999% more than scrap value alone**" (a
   display-cap artefact), and when the AI returns no tiers the card shows a hardcoded $12,500 /
   $4,200 / 33% *with the AI badge hidden* (`ProfitIntelligenceCard.tsx:18-20`, `:101-117`). Today
   that renders on one marketplace. Unlocking makes it render on four. Fix before, not after.
4. **Every measurement is DEV.** `testapi.greenbidz.com` / `greenbidz_test`. Prod runs a different
   vision-provider configuration. **Prod accuracy is not verified** — §8 makes a prod re-measurement
   a release gate.

---

## 2. Confidence policy

### 2.1 v1 ships "always confirm, one tap, pre-filled" — no numeric threshold

**Recommendation: do not ship a confidence threshold in v1.** Ship a confirmation that is one tap on
a screen the seller is already reviewing, and *earn* the threshold from live data before spending it.

The reason is not caution, it is arithmetic: **the number does not exist on the wire, so any
threshold we pick today would be calibrated on zero observations.** Verified:

- `resolveSiteTypeForGroup` computes the confidence and drops it at **both** return statements —
  `controller/wordPressSmart.js:1663` (hint-skip path) and `:1684` (contest path). It returns
  `{ siteType, suggested_terms }` only.
- `processProductGroup` stamps `data.site_type = siteType` with no confidence
  (`wordPressSmart.js:2010`).
- The SSE `product` event carries `{index, id, image_indexes, document_indexes, data}`
  (`:3272-3278`); the `result` payload's `detection` object carries `suggested_mode`, `confidence`,
  `summary` (`:3358-3363`) — and **that `confidence` is the how-many-products confidence**, rendered
  as such at `app/scan/detection.tsx:172`. Building "ask when unsure" on it would ask at the wrong
  times and stay silent at the wrong times.
- Client side: `site_type_confidence` has **zero** references in `src/` and `app/` (grepped today).

The cost of "always confirm" is one tap for the ~89% of sellers the AI already got right. The cost of
a guessed threshold is a listing on the wrong marketplace with the wrong category tree and the wrong
submit URL. One tap is cheaper.

### 2.2 What we ship instead of a threshold, in v1

Three states, all buildable today:

| State | Trigger (available now) | UI |
|---|---|---|
| **Confirmed** | AI returned a recognised `site_type` and `data.needs_clearer_photo !== true` | A **statement** above the item's identity fields: *"Listing on 101MACHINE — change"*. Zero taps. Marketplace + category pre-filled, category carrying the AI badge. |
| **Ask** | `data.needs_clearer_photo === true` | The same slot becomes a **question** with the AI's guess highlighted and the other options named with one-line descriptions. The routing sheet's CTA stays disabled until a choice is made. |
| **Ask, and don't pre-fill the category** | routed marketplace is `machines` or `recycle`, **or** the backend marks the category unresolved (§4) | Marketplace confirmed as above, but the category row reads *"Not set — pick a category"* rather than showing a guess. |

`needs_clearer_photo` is the one honest low-confidence tell that exists today and it costs **zero
backend change**: it is set at a single choke point (`wordPressSmart.js:818-819` — the model's
self-report OR the deterministic backstop "no brand AND no model"), it lives per product in
`products[].data`, it is aggregated to the top level of the payload (`:3367-3372`), and it is read
**nowhere** in the app (grepped: 0 hits in `src/` and `app/`). Measured **true on 9/24 photos**, and
every one of those nine had no legible nameplate.

> **Rejected interim trigger.** Do *not* gate on `suggestedMarketplace === null`. It will essentially
> never fire: every backend path hard-defaults to a valid site type — off-list → `recycle`
> (`smartExtractionValidator.js:291-295`), `confidence < 0.6` → `recycle` (`:298-301`), the vision
> exception path → `{siteType:'recycle', confidence:0}` (`wordPressSmart.js:1637-1638`) — so
> `marketplaceFromSiteType` (`src/features/scanner/constants.ts:116-120`) always receives a
> recognised string. A gate built on it silently never fires.

### 2.3 The threshold spec, for when the number exists (v1.1)

Ship the emission in v1's **server** release (§7), log it against what the seller actually chose,
then set the bands from real agreement rates. My starting values, to be calibrated:

| Confidence | Behaviour |
|---|---|
| **≥ 0.85** | Statement + "change". (Not 0.92: `SITE_HINT_SKIP_VISION_MIN_CONF = 0.92`, `wordPressSmart.js:66`, answers a *different* question — "is the hint good enough to skip a vision call". The pipeline's own defaults are 0.75 when the model omits a confidence (`smartExtractionValidator.js:283-286`) and 0.85 substituted in the contest (`wordPressSmart.js:1677-1679`), so a seller-facing 0.92 would ask on almost everything.) |
| **0.60 – 0.85** | Statement, but the routing sheet opens pre-selected and requires the tap before the category tree loads. |
| **< 0.60** | Do not apply. Ask, with the AI's real guess highlighted. **Never fall back to `recycle`.** |
| any band, `needs_clearer_photo === true` | Ask, and offer "add a clearer photo" as the primary recovery. |

**The emission contract matters more than the numbers.** A naive "return the confidence
`resolveSiteTypeForGroup` already computed" would ship a number that describes a *different* site
type than the one delivered, because (a) the `< 0.6` rule already rewrote the value to `recycle`
before `resolveSiteTypeForGroup` saw it (`smartExtractionValidator.js:298-301`) and (b)
`inferSiteTypeFromProduct` overrides the result *afterwards* (`wordPressSmart.js:1944-1948`). So the
contract is:

```
products[].data.site_type              (already shipped)
products[].data.site_type_confidence   NEW — must describe the FINAL site_type
products[].data.site_type_source       NEW — 'hint' | 'vision' | 'regex_override'
                                             | 'low_confidence_fallback'
```

Rules: when `site_type_source` is `regex_override` or `low_confidence_fallback`, emit
`site_type_confidence` as the *low* value (the override carries no confidence of its own — treat it
as ≤ 0.5), and the app treats both sources as **ask**. Note for whoever implements: on the wire today
`site_type === 'recycle'` is **ambiguous** — it means "genuinely recycle" *or* "we were unsure" —
which is exactly why `site_type_source` is part of the contract and not optional.

Good news on cost: the per-product confidence already exists at the emit site. `runDetectionPass`
stamps `site_type_confidence` per product (`wordPressSmart.js:2137-2160`) and it is already in scope
as `group.site_type_confidence` where the `product` event is constructed (`:3263-3265`, `:3272-3278`).

---

## 3. What already exists — do not rebuild it

Re-verified today, so nobody re-derives it:

- **The backend routes per item, not per upload.** The vision prompt asks for `site_type` +
  `site_type_confidence` per product and says mixed uploads are common; `processProductGroup`
  (`wordPressSmart.js:1922-2021`) resolves the site type, extracts in that context, re-infers, loads
  *that* marketplace's tree (`ensureSmartDetectionCategories`, `:1948`) and picks inside it.
- **The app is marketplace-aware end to end.** `MARKETPLACE_OPTIONS` (all four,
  `constants.ts:41-48`), `marketplaceFromSiteType` (`:116-120`), `marketplaceToPlatform` (`:106-114`,
  used at `createProduct.ts:25`, `createBatch.ts:32`, `submitGroupedListings.ts:153`),
  `marketplaceToAllowedSite` (`buildFormData.ts:18-23`, used at `:224` and `:264`),
  `defaultCurrencyForSite` (`constants.ts:70-72`), and `CategoryConditionCard` rebuilds its tree from
  `watch('marketplace')` (`:46-47`). `detailSchema` already accepts all four (`schema.ts:57`) — **no
  schema change is needed.**
- **Mixed-marketplace submit already works server-side** (§6.5) — this overturns an open question in
  the UX audit.
- **A precedent for refusing to guess already exists in the backend.** When 101it's brand
  subcategory can't be identified, the code deliberately clears it rather than shipping a wrong one
  (`wordPressSmart.js:2004-2006`, with the comment saying exactly why). §4 generalises that decision
  to the parent category.
- **Safe areas need no work.** Every scan screen handles top and bottom insets, with the Android
  48 dp nav-bar bug already found and fixed in the shared primitives (`Screen.tsx:12-30`,
  `Sheet.tsx:24-37`). No sticky CTA collides with the home indicator.

---

## 4. Decision: the category fallback stops guessing

**Decision: an empty category becomes a first-class, supported outcome. We would rather ask the
seller than file a welding fixture under "Boring & Drilling Machines".**

### 4.1 What I verified today (read-only, prod)

The two audits disagreed about where "Boring & Drilling Machines" comes from. I settled it.

`ensureSmartDetectionCategories(siteType)` prefers the **WordPress-fetched cache** and only falls
back to the SQL catalog when that cache is empty (`utils/categoryCache.js:236-249`). So the tree at
runtime is the WP tree, not the SQL one. Fetched today, HTTP 200:

| Tree | Source | Shape | `pickDefaultParent` returns |
|---|---|---|---|
| machines | `.../v1/machine-categories?language=en` | **13 parents, 0 subcategories**, `tree[0]` = **5300 "Boring & Drilling Machines"** | **"Boring & Drilling Machines"** |
| 101lab | `.../v1/product-labs?language=en` | 4 parents / 62 subs, **38 under one parent** | Lab Infrastructure & Essentials |
| 101it | `.../v1/iit-lab-products?language=en` | 6 parents / 25 subs | Components → its only child, **GPU Accelerators** |
| recycle | `/api/v1/product/category?lang=en` | **37 flat**, `term_id` shape, no `subcategories` | Material Handling Equipment |

`pickDefaultParent` is `tree.find(has children) || tree[0]` (`wordPressSmart.js:677-682`). With zero
children anywhere in the machines tree it returns `tree[0]` = 5300. **The brief and the UX audit were
right; the backend audit's rebuttal was computed against the SQL fallback tree, which the runtime
does not reach.** It is called from two places (`:857` inside `fuzzyCategoryFallback`, `:1576` inside
`ensureCategoryPairForSiteType`).

Corroborated by a live capture already in the repo:
`src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt` — parsed today, **three
products, all `product_cat: {id: 5300, name: "Boring & Drilling Machines"}`**, one of them a
multi-purpose **welding fixture**. This is not theoretical.

And it is worse than one bad function: the LLM pick itself (`pickCategoryFromTree`, `:1877-1919`)
also tends to return the first row of the tree text it is handed, and `buildCompressedCategoryTree`
emits parents in load order (`categoryCache.js:255-275`). **Two independent paths converge on the
same wrong string, and the last line of defence, `ensureCategoryPairForSiteType` (`:1560-1602`), is
explicitly written to guarantee *some* id.**

### 4.2 The change

1. **Allow blank.** `fuzzyCategoryFallback` (`:833-870`) and `ensureCategoryPairForSiteType`
   (`:1560-1602`) stop substituting `pickDefaultParent`. When nothing scores `>= FUZZY_MIN_SCORE`
   (= 4, `:64`) and the LLM's pick cannot be corroborated against name/brand/model, leave
   `product_cat` empty and emit `category_source: 'unresolved'`.
2. **Blank is safe by construction.** `categoryId` is required (`schema.ts:23`), so an empty category
   surfaces in the required-fields checklist and blocks Submit. That *is* "ask the seller".
3. **Badge the AI's category as AI.** Nine labels already carry the AI badge
   (`FieldLabel.tsx:28-33`) — category is labelled `required`, not `ai`
   (`CategoryConditionCard.tsx:203`). The one field where a machine guess is most likely and most
   consequential is the one presented as though the seller chose it. Fix that.
4. **Hard coupling:** blank categories only improve the product if picking one is fast. Today the
   picker is two stacked 240 px nested scrollers with no search (`CategoryConditionCard.tsx:211-216`,
   `:267-272`) and 38 of 101lab's 62 leaves sit under one parent — roughly **7 blind in-card
   swipes**. **Therefore the searchable category sheet is a v1 blocker (M-2), not a follow-up.**
   Without it we convert "wrong listing" into "abandoned listing".

### 4.3 What no code change can fix

**8 of the 11 category errors were unreachable-correct-answer errors** — the right row does not
exist: /machines has no glass machinery, no surface treatment, no inspection/metrology and no general
bucket (13 flat parents, 0 subs); /101it has **no ASUS** under Laptops & Desktops and no Monitors
parent, and `Components` has exactly one child which becomes the marketplace-wide dumping ground;
/recycle has no furniture bucket, so office chairs and a conference table landed in "Metalworking
Equipment". That is a **content decision for the owner** (Decision 6), not engineering.

Also verified today: **18 of 37 recycle names are HTML-escaped** (`Construction &amp; Earthmoving
Equipment`). They will render literally in the picker and they break `catTokenize`, which splits on
`&` and leaves the token `amp`.

---

## 5. Decision: 101recycle is in v1, because it cannot be left out

**Decision: fix the recycle tree in v1 and launch all four together.**

The UX audit's suggestion that 101lab/101machine/101it could ship first and recycle later is unsafe,
and I verified why. `recycle` is the backend's **universal fallback**:

- unmappable site type → `recycle` (`smartExtractionValidator.js:291-295`)
- `site_type_confidence < 0.6` → `recycle` (`:298-301`)
- `normalizeSiteType(value, fallback)` defaults to `recycle` (`:41-50`)
- the vision-call exception path → `{siteType:'recycle', confidence:0}` (`wordPressSmart.js:1637-1638`)

So flipping the locks without fixing recycle routes **every low-confidence and every vision-failure
item** to the one marketplace whose categories the app cannot render.

Measured today, and the failure is total: recycle ids span **1147–5366**, the lab tree's 66 ids are
**5371–5849**, **overlap = 0**. Every AI recycle category id fails the validity check
(`CategoryConditionCard.tsx:124`), `bridgeCategoryId` correctly returns null
(`fetchCategories.ts:95-130`), the field is cleared (`:157`) — and because `categoryId` is required
(`schema.ts:23`) the listing **cannot be submitted at all** until the seller files a scrap lot under
a lab category, which then ships with `allowed_sites: ['recycle']` (`buildFormData.ts:224`).

Two fixes, both in v1:

- **App (M-1):** add a `101recycle` branch to `endpointForMarketplace`
  (`src/services/scanner/fetchCategories.ts:24-30` — the comment there today literally reads *"101lab
  + 101recycle … share the lab tree"*), normalise the `{term_id, name, slug}` shape to `LabCategory`,
  and HTML-unescape the names.
- **Server (S0-3b):** stop using `recycle` as the silent bucket for "unknown". Keep the real guess
  and mark it via `site_type_source: 'low_confidence_fallback'` so the app can **ask** instead of
  accepting a wrong marketplace as fact.

---

## 6. Design of the confirmation step

Follows `UX_DESIGN_RULES.md` (one dominant action, progressive disclosure, adaptive UI, AI confidence
shown, no invented information). Stitch: `4a` = confident
(`9a852b6b56b4441ab9c29c4173b548da`), `4b` = unsure (`20fb6f62b31f45d18d9e912092504cc5`), routing
progress = `dbf4bae900174deea71c1a1be55e0279`. Discard the defective duplicate
`59e4f7434c0d431ea0ef94c82ecb09f3` (clipped at 852 px).

### 6.1 It is a chip on the review screen, not a new screen and not an eleventh card

`detail.tsx` is already one ~3,200 px scroll of ten cards. Adding a card makes it worse; adding a
screen is impossible on the common path.

**Verified constraint:** the common single-item case **never reaches `detection.tsx`** —
`shouldSkipDetectionChoice` routes straight to `detail.tsx` when
`productCount <= 1 || photoCount <= 1` (`src/features/scanner/smartDetectionRouting.ts:19-28`,
routing at `processing-v2.tsx:351-366`). So the confirmation cannot live only on the one screen in
the flow that already looks like a confirmation step.

**Design:**

- A single **routing chip** immediately above `IdentityCard` (`app/scan/detail.tsx:127`), in the
  *confirmed* state a statement — marketplace + category + a quiet "change" — carrying the AI badge
  and, once §2.3 lands, the confidence as **word + number** ("High · 94%") so the word translates and
  the number still reads in TH/VI/ZH/JA.
- In the *ask* state the same slot is a question. Tapping opens a `Sheet` whose options are the four
  marketplaces **with one-line descriptions** (`Sheet.Option.description` already supports this,
  `Sheet.tsx:139-181`), because after unlock a seller otherwise sees four codenames — `101LAB`,
  `101MACHINE`, `101IT`, `101RECYCLE` (`constants.ts:41-48`) — with no explanation, while the
  lower-stakes `installation` field ships a hint per option (`constants.ts:50-57`).
- `MarketplaceCard`'s four-pill row stops being a card and becomes the body of that sheet. Its
  existing `onPress` is the model to keep: it clears category / parent / custom-subcategory **on user
  action** (`MarketplaceCard.tsx:50-63`).
- **Never write `marketplace` from a `watch` effect.** The card's own comment (`:54-57`) and
  `useDetailController.ts:66-70` record the hydration race this caused: clearing the category inside
  a marketplace watch-effect wipes the AI's auto-filled category the moment the default flips to the
  AI's value. This is the single most likely way to break the feature while "finishing" it.
- **Name the marketplace in the loading copy.** Latency is p50 11.1 s / p90 15.6 s / max 37.8 s, so
  the wait is long enough to need honest copy: *"Working out which marketplace this belongs to…"* →
  *"Loading 101MACHINE categories…"*. Keep the real SSE phase labels already in
  `processing-v2.tsx:71-77`; show no percentage, because there is no honest progress fraction.

### 6.2 Mixed uploads

Show the split on `grouped-review.tsx`'s `HubRow` — per-row marketplace beside the existing
ready/missing badge — so the seller sees "3 to 101LAB, 1 to 101IT" **before** submitting. Read-only
in v1; retargeting happens in the item editor.

### 6.3 The review-screen restructure — what of it lands in v1

The UX audit's target IA (ten cards → three steps) is right and I am **not** shipping all of it in v1
(§9). What ships in v1 is only the part the unlock itself makes dangerous:

- sticky progress + missing-field names in the footer (today `RequiredChecklist` is the **last** card
  of a ~3,200 px scroll, `detail.tsx:139`, while Submit is pinned in the footer — the sibling
  `grouped-review.tsx:355-401` already does this correctly);
- `onInvalid` on the single-item editor (the grouped editor already alerts named missing fields and
  calls `form.setFocus`, `grouped-edit.tsx:130-161`; `useDetailController.ts` calls
  `handleSubmit(onValid)` at `:94, :136, :144, :152` with **no** `onInvalid`);
- the searchable category sheet (§4.2, item 4);
- closing the invisible-required-field gap (`requiredStatus.ts:42-61` maps only 6 paths and returns
  `null` for the rest, while `allComplete` gates Submit on the **full** schema, `:128-137`). Latent
  today because every unmapped field has a hard default — and `marketplace: z.enum([...])`
  (`schema.ts:57`) starting to take AI input is precisely the first realistic way to break it.

### 6.4 Currency — resolve the two audits' conflict the simple way

**Decision: the marketplace does not drive the currency on the AI-mapping path.**

Passing the *detected* site type into `mapProductData` so `defaultCurrencyForSite` follows the AI (as
the backend audit's B5 proposed) is a **mispricing bug** unless a conversion ships with it:
`mapProductData` sets `price = pickPrice(data.price)` (`mapSmartDetection.ts:153`) and
`currency = defaultCurrencyForSite(siteType)` (`:157`) **independently, with no conversion**; the
backend always returns USD (prompt, `wordPressSmart.js:421`); `defaultCurrencyForSite` returns TWD
for `101it` (`constants.ts:70-72`). A $4,500 laptop would render **NT$4,500 ≈ US$143** — a 31.5×
under-price (`FX_RATE_TWD_PER_USD = 31.5`, `currencyFx.ts:11`) written to `_product_currency`.
`PricingCard.tsx:31-40` converts only on a seller tap, so nothing downstream repairs it.

So: **label the AI price with the currency the backend actually returned (USD), on every
marketplace.** `defaultCurrencyForSite` stays for the seller's own currency toggle. TWD-native
pricing for 101it is a separate backend change (return TWD prices), not an app-side relabel. This is
one guard, not an FX engine, and it removes the whole class of bug.

Related, and cheap: `merged_single.site_type` is the **first** product's marketplace
(`wordPressSmart.js:3312-3320`), and `mapSmartDetection.ts:258-261` builds `mergedSingleFields` from
it — so any path falling back to `mergedSingleFields` on a mixed batch silently takes the wrong
marketplace. Guard it in M-4.

### 6.5 Mixed submit already works — verified, and it overturns an open question

The UX audit listed "what happens to a mixed upload — may need to become N submissions" as a
commercial decision. It is not; the mechanism already exists:

- the app sends `allowed_sites` **per product** in the grouped meta
  (`buildFormData.ts:264` — `allowed_sites: [marketplaceToAllowedSite(item.marketplace)]`);
- the backend resolves the marketplace **per product** from `allowed_sites[0]`
  (`services/groupedListingSubmitService.js:172-180`) and derives that product's `site_id` from it
  inside the per-product loop (`:344-346`);
- `?type=` — the thing `submitGroupedListings.ts:153` derives from `items[0]` — only feeds the admin
  notification's `platform` field (`groupedListingSubmitService.js:522`), not the products' site ids.

So one grouped submit can span marketplaces **by construction**. Two honest caveats: this is
**code-read, not exercised** (no listing was submitted, per the ground rules), and all items still
land in **one auction group** spanning `site_id`s, whose display/ops behaviour is unverified. §8 makes
one DEV mixed submit a release gate.

---

## 7. Task breakdown, in order

Sizes: **S** ≈ half a day · **M** ≈ 1–2 days · **L** ≈ 3–5 days. Stage 0 is server-side and can ship
before any app build. Stage 1 is the app half and needs a binary (§8).

### Stage 0 — server-side, ships first (dev → measure → prod with approval)

| # | Task | Files | Size |
|---|---|---|---|
| **S0-1** | **Narrow `inferSiteTypeFromProduct`.** Require a hit in `name`/`brand`/`model` (not the AI-written `equipment_description`); drop the bare words `switch`, `monitor`, `printer`, `server`, `graphics`, `tablet` from description-only matching; stop IT winning ties against lab. Fixes the centrifuge-as-GPU class of failure and the 9% false-101it rate over 800 real lab listings. | `services/smartExtractionValidator.js:223`, `:234-267` | **M** |
| **S0-2** | **Emit the routing signal per product** to the §2.3 contract: `site_type_confidence` + `site_type_source`, both describing the **final** site type (after the regex override and after the `<0.6` rewrite). The value is already in scope at the emit site. | `controller/wordPressSmart.js:1656-1685`, `:1944-1948`, `:2010`, `:3263-3278`, `:3358-3372` | **M** |
| **S0-3a** | **Let the category picker say "I don't know."** Stop `fuzzyCategoryFallback` and `ensureCategoryPairForSiteType` substituting `pickDefaultParent`; emit `category_source: 'unresolved'`. Follow the existing precedent at `:2004-2006`. | `controller/wordPressSmart.js:677-682`, `:833-870`, `:1560-1602` | **M** |
| **S0-3b** | **Stop `recycle` being the silent bucket for "unknown."** Preserve the real guess; mark it `low_confidence_fallback`. This changes behaviour for the web too — regression-check the web smart-upload before prod. | `services/smartExtractionValidator.js:41-50`, `:282-303`; `controller/wordPressSmart.js:1637-1638` | **M** |
| **S0-4** | **HTML-unescape recycle category names** at the API (18 of 37 affected). Server-side so every client benefits; the app unescapes defensively anyway in M-1. | recycle category endpoint / `jos_terms` read path | **S** |
| **S0-5** | **Field hygiene:** `year` emitted as the literal string `"null"`; `co2_emissions: "0 kg"` emitted as a measurement. | `controller/wordPressSmart.js` extraction normalisation | **S** |
| **S0-6** | **Taxonomy content additions** (Decision 6) — WP admin data work, not code. Blocks category *quality*, not the unlock. | WordPress taxonomies | owner |

### Stage 1 — app, the 1.0.4 blockers

| # | Task | Files | Size |
|---|---|---|---|
| **M-1** | **101recycle category endpoint + shape.** New branch in `endpointForMarketplace`; normalise `{term_id,name,slug}` → `LabCategory`; unescape names; make `flattenCategoryOptions` handle a flat tree. | `src/services/scanner/fetchCategories.ts:24-30`, `:95-130`, `:144-170` | **M** |
| **M-2** | **Searchable category sheet** replacing the two nested 240 px scrollers. Copy the pattern already in the flow one card lower. Card collapses to one row: label + current pick + "Change". Frees ~480 px and removes the nested-scroll trap. **Blocker because of §4.2.** | `CategoryConditionCard.tsx:198-388`; pattern: `CountryPicker.tsx:37-91`, `Sheet.tsx:139-181` | **L** |
| **M-3** | **Routing chip + marketplace sheet** in the §6.1 slot, with confirmed / ask / ask-and-don't-prefill states; per-row marketplace on `grouped-review`'s `HubRow`. `MarketplaceCard` becomes the sheet body. | `app/scan/detail.tsx:127`, new `RoutingChip`, `MarketplaceCard.tsx:22-76`, `app/scan/grouped-review.tsx` | **M** |
| **M-4** | **Plumb the detected marketplace — all three locks together, plus the two guards.** Flip `MARKETPLACE_LOCKED` (`:22`) / gate it on a supported list; take `suggestedMarketplace` on the apply path instead of the env default (`scanDraftStore.ts:413`); patch the detected marketplace on the single-photo path (`processing.tsx:504-508`); keep AI currency = USD (§6.4); guard the `mergedSingleFields` mixed-batch fallback. **Write `marketplace` only through the user-driven path.** | `MarketplaceCard.tsx:22`, `scanDraftStore.ts:413`, `app/scan/processing.tsx:504-508`, `mapSmartDetection.ts:153`, `:157`, `:188`, `:258-261` | **M** |
| **M-5** | **Profit card tells the truth.** Delete the static-stub path (`STATIC_SCRAP_BASELINE_USD` etc.); when tiers are missing show an honest empty state; **never render a capped percent** — drop the "% more than scrap" sentence in v1 and keep the range labelled "AI estimate — verify before publishing"; stop deriving the "suggested marketplace" from the seller's own choice (`:154-158`), which is circular after unlock. | `ProfitIntelligenceCard.tsx:18-20`, `:64-118`, `:154-158`, `:303-308` | **S** |
| **M-6** | **Consume the routing signal.** Add `site_type_confidence`, `site_type_source`, `needs_clearer_photo`, `category_source` to `SmartProductData` and carry them through `mapProductData` next to `suggestedMarketplace`. `needs_clearer_photo` works with **no** backend change and is the v1 ask-trigger. | `smartDetectionTypes.ts:35-37`, `:122-125`, `mapSmartDetection.ts:186-190`, `:209`, `:225`, `mapAnalyze.ts:53`, `:100` | **S** |
| **M-7** | **Close the invisible-required-field gap.** Give every schema-required field a checklist row or a guaranteed-valid default before `marketplace` starts taking AI input. | `requiredStatus.ts:42-61`, `:128-137`, `schema.ts:57` | **M** |
| **M-8** | **Sticky progress + named missing fields in the footer**; tapping a name scrolls to that card. Reuse `getRequiredStatus`; mirror `grouped-review.tsx:355-401`. | `app/scan/detail.tsx:139`, `DetailFooter.tsx:112-121`, `RequiredChecklist.tsx` | **M** |
| **M-9** | **`onInvalid` on the single-item editor** — named missing fields + `setFocus`, copied from `grouped-edit.tsx:130-161`. | `useDetailController.ts:94`, `:136`, `:144`, `:152` | **S** |
| **M-10** | **Marketplace option descriptions** (mirror `INSTALLATION_OPTIONS`' hint pattern) + AI badge on the category label. | `constants.ts:41-48`, `CategoryConditionCard.tsx:203`, `FieldLabel.tsx:28-33` | **S** |
| **M-11** | **Keyboard-sticky footer** — the footer is a sibling of `KeyboardAwareScrollView` in both editors with no `KeyboardStickyView`, so the primary CTA sits behind the keyboard during most of the editing session. `KeyboardProvider` is already mounted (`app/_layout.tsx:176`). *(Structural claim verified from code; the on-screen coverage is inferred, not observed — confirm on device.)* | `app/scan/detail.tsx:144`, `app/scan/grouped-edit.tsx:263` | **S** |
| **M-12** | **Server-driven supported-marketplaces list** so one marketplace can be pulled back without a store release. Today there is **no remote config**: flags are build-time env (`eas.json`) and `getSiteType()` reads `Constants.expoConfig.extra` (`buildFormData.ts:290-293`), so the only remote lever is an EAS Update. New surface — small, and it is the difference between "we can undo this" and "another review cycle". | new tiny config read; `constants.ts`, `MarketplaceCard.tsx:22` | **S** |

**Rough total:** Stage 0 ≈ 5–7 dev-days plus owner content work; Stage 1 ≈ 10–13 dev-days. Call it
**three to four weeks with one engineer on each side**, including the QA gates in §8.

---

## 8. Release plan

### 8.1 Ships server-side now (no app build)

All of Stage 0. It is additive on the wire — the app reads named fields only (`mapProductData`,
`mapSmartDetection.ts:152-230`), so new keys are ignored by 1.0.3 clients. Two behaviour changes need
care: S0-1 and S0-3a/b alter what the **web** smart-upload sees too, so regression-check web before
prod. Sequence: dev → re-measure (§8.3) → prod **with explicit approval, per the standing dev-first
rule**.

Shipping S0-2 early is deliberate: it starts **logging** confidence against the seller's final choice
so v1.1's threshold (§2.3) is calibrated on real agreement rates rather than a guess.

### 8.2 The app half is 1.0.4

- Current store version is **1.0.3** (`app.config.ts:34`) and it is in App Review.
- The unlock is **JS-only** — no native change — so technically it could go out as an EAS Update.
  **Do not.** `runtimeVersion` policy is `appVersion` (`app.config.ts:90-92`), so an OTA published for
  1.0.3 would reach the build Apple is currently reviewing. `app.config.ts:47-60` records the exact
  cost of that class of mistake: a 2.1.0 rejection where the reviewed artifact was not the artifact
  anyone had tested. **No OTA on a version that is in review.**
- So: **1.0.4 binary** carries Stage 1. Once 1.0.4 is live, OTA becomes the correction lever for copy
  and small fixes — which is why M-12 is worth its half day.
- Order inside 1.0.4 matters: **M-5 (profit-card honesty) can ship before the unlock and should.** It
  is a standalone honesty fix that the unlock would otherwise multiply across four marketplaces. If
  1.0.4 slips, M-5 goes out as an OTA on 1.0.3 *after* 1.0.3 is approved and released.

### 8.3 Release gates — all four must pass before the locks flip in a shipped build

1. **Prod re-measurement.** Every accuracy number in this plan is DEV
   (`testapi.greenbidz.com` / `greenbidz_test`). Prod runs a different vision-provider configuration.
   Re-run the same 24-photo set against prod, read-only, and confirm routing ≥ 85% with no new
   failure class. **Prod accuracy is currently unverified — treat that as the single biggest open
   risk in this plan.**
2. **S0-1 regression.** Replay `inferSiteTypeFromProduct` over the 800-listing lab sample and confirm
   the false-101it rate drops from 9% to ~0, with no new false-machines/lab.
3. **One mixed submit on DEV.** Submit a genuinely mixed 2-marketplace grouped listing and confirm
   each product landed on the right `site_id`, and that the single spanning auction group renders
   acceptably. §6.5 is code-read, not exercised.
4. **On-device pass** of the review screen after M-2 / M-8 / M-11 on a small phone (SE-class) and one
   Android with a 3-button nav bar, plus the Vietnamese condition pills
   (`Đã qua sử dụng — còn hoạt động tốt` is ~2× English and wraps in a `flex-wrap` row).

---

## 9. Deliberately NOT in v1

| Not doing | Why |
|---|---|
| **A numeric confidence threshold** | The number does not exist on the wire yet (§2.1). v1 confirms always; v1.1 sets the bands from logged agreement rates. Shipping a guessed threshold means asking at the wrong times and staying silent at the wrong times. |
| **The full ten-cards → three-steps restructure** | Right direction, large blast radius: it reshapes `detail.tsx` **and** `grouped-edit.tsx` together (they render the identical ten cards). Unrelated to routing risk. v1 takes only the four pieces the unlock makes dangerous (§6.3). |
| **Grounding the scrap value** | 100% of scrap figures shown today are model guesses; the only non-model path is `scrap = used × 0.15` (`wordPressSmart.js:1754-1771`), a marketplace-agnostic constant that never fired in 81 calls. Real grounding needs a price feed (recycle could use weight × spot price — weight is present 65% of the time). v1 stops the card *lying* (M-5); making it *right* is its own project. |
| **101it TWD-native pricing** | Requires the backend to return TWD prices. Relabelling a USD number as TWD is a 31.5× mispricing (§6.4). |
| **Auto-splitting mixed batches into N submissions** | Not needed — per-product `allowed_sites` already resolves per-product `site_id` server-side (§6.5). |
| **Editing a per-item marketplace from `grouped-review`** | v1 shows the split read-only; retargeting is via the item editor. A second write path to that field re-opens the documented hydration race. |
| **Taxonomy content additions** | Owner content decision (Decision 6). Blocks category *quality*, not the unlock; the S0-3a blank-category rule is what makes the gaps safe in the meantime. |
| **`condition` / `grade` as detected values** | Both were constant across all 72 runs (`usedFunctional`, `B`) and `grade` silently drives a price multiplier. Either make them vary or stop presenting them as detected — a separate honesty item. |
| **Tablet layout, `listingDurationDays` UI, Thai "LIVE" retranslation (`กำลังขาย` = "currently for sale", `RequiredChecklist.tsx:71`), 40 px → 44 px quantity steppers, currency-tap confirmation** | Real but small. OTA them onto 1.0.4. |

---

## 10. Where the audits disagreed, and how I resolved it

| # | Dispute | Resolution (verified today) |
|---|---|---|
| 1 | UX doc: *"there is no unsure signal on the wire; ask-when-unsure cannot be built."* Its reviewer: *"false — the `<0.6 → recycle` rewrite plus `suggested_terms.site_type` is exactly that signal, with zero backend change."* | **Both partly right; the doc's conclusion stands, its wording did not.** The signal exists in code (`smartExtractionValidator.js:298-301`) but is unusable as a gate: it fired **0 times in 81 calls**, it is merged at the payload's **top level** so it loses which product it belonged to (`wordPressSmart.js:3364`), and it is **destructive** — it overwrites the answer with `recycle`. So S0-2 is required, not optional. I replaced "cannot be built" with "buildable but not usable, and here is the contract that makes it usable" (§2.3). |
| 2 | UX doc proposed `suggestedMarketplace === null` as the interim must-ask trigger. | **Dropped.** Its reviewer is right that it is inert — every backend path hard-defaults to a valid site type (§2.2). The interim trigger is per-item **`needs_clearer_photo`** instead: measured true on 9/24, correlating perfectly with unreadable nameplates, already on the wire, **zero** references in the app. |
| 3 | UX doc: recycle could be deferred, 101lab/machine/it first. | **Overruled** (its own reviewer flagged this too). `recycle` is the universal fallback for unknown / low-confidence / vision-failure, so unlocking anything without fixing it routes exactly the worst items to the worst tree. Measured: **zero** id overlap between the recycle and lab trees, and a cleared `categoryId` is a hard submit-blocker (`schema.ts:23`). All four ship together (§5). |
| 4 | Backend doc: *"the brief is wrong — `pickDefaultParent` returns 'Semiconductor Equipment', so 'Boring & Drilling Machines' must come from the LLM."* | **The backend doc is wrong here; the brief and the UX doc were right.** It rebuilt the **SQL** tree, but `ensureSmartDetectionCategories` prefers the **WordPress** cache and only falls back to SQL when that is empty (`categoryCache.js:236-249`). I fetched the live WP machines tree today: **13 parents, 0 subcategories, `tree[0]` = 5300 "Boring & Drilling Machines"** — so `pickDefaultParent` (`:677-682`) returns exactly that. The repo's own live capture shows 5300 on a welding fixture. The backend doc's *broader* point survives and makes it worse: the LLM pick can produce the same first row independently, so **two** paths converge on it (§4.1). |
| 5 | Backend doc B5 (pass the detected site type into `mapProductData`) vs its reviewer's B6 (that alone is a 31.5× mispricing). | **Reviewer is right, and I am taking neither as written.** Simplest safe fix: the marketplace does **not** drive the currency on the AI path — the AI price keeps the currency the backend actually returned (USD). No FX engine, no live rate, whole class of bug gone (§6.4). |
| 6 | Backend doc's blocker table covered only one of the three switch-off sites. | **All three are in M-4 as one task**, verified: `MarketplaceCard.tsx:22`, `scanDraftStore.ts:413`, `app/scan/processing.tsx:504-508`. Flipping only the first leaves a picker permanently pre-set to the env marketplace and `suggestedMarketplace` (`mapSmartDetection.ts:188`) computed-but-unused, exactly as today. |
| 7 | UX doc listed "what happens to a mixed upload" as a commercial decision that may need N submissions. | **Already solved in code** (§6.5): per-product `allowed_sites` (`buildFormData.ts:264`) → per-product `site_id` (`groupedListingSubmitService.js:172-180`, `:344-346`); `?type=` only feeds a notification (`:522`). Code-read, not exercised — hence release gate 3. |
| 8 | UX doc's target IA silently dropped the 101it-only Grade control. | Noted and kept: `grade` is schema-required with a real 101it-only picker (`CategoryConditionCard.tsx:430-466`). 101it is one of the marketplaces being unlocked, so the control becomes *more* reachable, not less. It stays; §6.3 defers the IA change anyway. |
| 9 | Minor citation drift in both docs (line numbers off by 1–2; `MARKETPLACE_LOCKED` at `:22` not `:21`; t()-key count 96 vs 100; VI condition label 2.0× not 2.1×). | Not material. Every `file:line` in **this** document was re-checked today; where a range is cited, it contains the code claimed. |

---

## 11. Decisions for the owner

Each has my recommendation. I need a yes/no or a pick.

1. **Ship the unlock with a one-tap confirmation on every item, rather than waiting for the AI
   confidence number?**
   → **Recommend YES.** 89% routing accuracy is good product behind a confirmation and unacceptable
   as a silent decision. One tap on a screen the seller already reviews; the number gets emitted in
   the same release so v1.1 can remove the tap for the confident majority *with evidence*.

2. **All four marketplaces at once, or three first?**
   → **Recommend all four.** `recycle` is the backend's fallback for everything it cannot identify,
   so "three first" quietly ships the broken one anyway (§5).

3. **Category: allow the AI to return "unknown" and ask the seller, accepting that some sellers now
   pick a category by hand?**
   → **Recommend YES**, *conditional on shipping the searchable category picker in the same release*.
   A confident wrong category ("Boring & Drilling Machines" on a welding fixture, proven live) is
   worse for the marketplace than one search-and-tap. Without the picker fix, do not do this.

4. **The profit card: hide the "% more than scrap" sentence and the $12,500 stub in v1?**
   → **Recommend YES.** 63% of real responses render as "999% more than scrap", and the stub shows
   fabricated figures with the AI badge hidden. Keep the range, label it "AI estimate — verify before
   publishing", drop the percentage until the scrap figure is grounded.

5. **Allow genuinely mixed uploads (one submission spanning marketplaces) in v1?**
   → **Recommend YES, with the split shown before submit.** The backend already routes per product;
   the residual unknown is one auction group spanning marketplaces, which release gate 3 tests. If
   that group renders badly, the fallback is "mixed uploads must be submitted separately" — a copy
   change, not a rebuild.

6. **Taxonomy content — will you add the missing category rows?** /machines needs surface treatment,
   glass machinery, inspection/metrology and a general bucket (13 flat parents, **0** subcategories
   today); /101it needs **ASUS** and a Monitors & Displays parent; /recycle needs Furniture and a
   consumer-goods bucket.
   → **Recommend YES, and it is the highest-leverage item on this list.** 8 of 11 category errors
   were *unreachable-correct-answer* errors — no code or model change fixes them.

7. **Accept 1.0.4 (a store release) for the app half, with no OTA onto 1.0.3 while it is in review?**
   → **Recommend YES.** An OTA on 1.0.3 can reach the build Apple is reviewing; `app.config.ts:47-60`
   records what that cost last time. M-5 may go out as an OTA on 1.0.3 *after* it is approved and
   released, if 1.0.4 slips.

8. **Spend half a day on a server-driven supported-marketplaces list (M-12)?**
   → **Recommend YES.** There is no remote config today — flags are baked at build time — so without
   it, pulling one marketplace back means another store release.

9. **Is prod re-measurement a gate, or do we ship on the DEV numbers?**
   → **Recommend gate.** Every number in this plan is DEV; prod runs a different vision-provider
   configuration. It is one day of read-only measurement against a change that decides where the
   business's listings land.

---

## 12. Honest limits of this plan

- **Every accuracy figure is DEV, n = 24 photos × 3 runs (+3 nameplate photos).** Indicative, not
  statistically tight. The only large-n number is the 9% false-101it override rate (n = 800), and it
  used seller-written text as a proxy for AI-written descriptions — the live rate is probably higher.
- **Prod accuracy is not verified at all.** Release gate 1.
- **The mixed-marketplace submit path is code-read, not exercised.** No listing was submitted on any
  marketplace, per the ground rules. Release gate 3.
- **Category-tree measurements were re-taken read-only today** against the live WP endpoints and the
  live recycle endpoint (all HTTP 200): machines 13 parents / 0 subs, lab 4/62, 101it 6/25, recycle 37
  flat with 18 HTML-escaped names and zero id overlap with lab. Those I stand behind.
- **`needs_clearer_photo` is absent from the repo's zh-hant capture**, which also shows un-blanked
  `"未知"` brands — i.e. that fixture predates `normalizeIdentityAndConfidence`
  (`wordPressSmart.js:810-820`), which now always stamps the boolean. Current-code behaviour is read
  from source and corroborated by the backend audit's 9/24 measurement, **not** re-observed by me.
- **Keyboard coverage of the CTA (M-11) is inferred from structure**, not seen on a device.
- **Scroll-height figures (~3,200 px, ~5–6 screens) are arithmetic on source constants**, not measured
  on hardware.
- No production write, publish, submit, push, commit, branch switch, stash or migration was performed
  in producing this document, and `greenbidz-ai-assistant/` was not touched.
